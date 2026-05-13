/**
 * generate_dd2_road_features.cjs  (v5 — final)
 *
 * Join strategy: match audit.dd2_road_name_raw to DD2.nama_ruas_raw
 * using a normalised key that strips embedded _x000D_ / whitespace artefacts.
 * For the 3 duplicate raw-name rows, use no_ruas as a tiebreaker
 * (with the +2 offset correction for rows whose no_ruas >= 117).
 */
const fs = require('fs');

// ── Robust CSV parser ──────────────────────────────────────────────────────────
function parseCSVFull(text) {
  const rows = [];
  let cur = [];
  let field = '';
  let inQ = false;

  for (let i = 0; i <= text.length; i++) {
    const c = i < text.length ? text[i] : null;
    if (c === '"') {
      if (inQ && text[i + 1] === '"') { field += '"'; i++; }
      else { inQ = !inQ; }
    } else if ((c === ',' || c === null) && !inQ) {
      cur.push(field.trim());
      field = '';
      if (c === null) { if (cur.some(Boolean)) rows.push(cur); }
    } else if ((c === '\n' || (c === '\r' && text[i + 1] !== '\n')) && !inQ) {
      cur.push(field.trim());
      field = '';
      if (cur.some(Boolean)) rows.push(cur);
      cur = [];
    } else if (c === '\r' && text[i + 1] === '\n' && !inQ) {
      // skip CR of CRLF
    } else {
      if (c !== null) field += c;
    }
  }
  return rows;
}

function rowsToObjects(rows) {
  const headers = rows[0];
  const data = rows.slice(1).filter(r => r.some(Boolean)).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] ?? '').replace(/[\r\n\t]+/g, ' ').trim();
    });
    return obj;
  });
  return { headers, data };
}

// Normalise a raw road name for matching — strips _x000D_, collapses whitespace
function normKey(s) {
  return (s || '')
    .replace(/_x000D_/gi, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function toNum(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }
function toInt(v) { const n = parseInt(v, 10); return isNaN(n) ? null : n; }

// ── Main ───────────────────────────────────────────────────────────────────────
function main() {
  const auditRaw = parseCSVFull(fs.readFileSync('staging-source/dd2/audit/dd2_identity_audit.csv', 'utf8'));
  const { data: auditRows } = rowsToObjects(auditRaw);

  const dd2Raw = parseCSVFull(fs.readFileSync('staging-source/dd2/processed/dd2_roads_2025_clean.csv', 'utf8'));
  const { data: dd2Rows } = rowsToObjects(dd2Raw);

  console.log(`Audit rows: ${auditRows.length}  |  DD2 rows: ${dd2Rows.length}`);
  if (auditRows.length !== 350) { console.error(`Audit: expected 350, got ${auditRows.length}`); process.exit(1); }
  if (dd2Rows.length  !== 350) { console.error(`DD2:   expected 350, got ${dd2Rows.length}`);   process.exit(1); }

  // Build DD2 lookups
  const dd2ByNormName = new Map();  // normKey(nama_ruas_raw) -> [row, ...]
  const dd2ByNoRuas   = new Map();  // no_ruas integer -> row
  for (const row of dd2Rows) {
    const nk = normKey(row.nama_ruas_raw);
    if (!dd2ByNormName.has(nk)) dd2ByNormName.set(nk, []);
    dd2ByNormName.get(nk).push(row);
    dd2ByNoRuas.set(toInt(row.no_ruas), row);
  }

  // The 3 raw names that appear twice in DD2
  const DUPLICATE_RAW_NAMES = new Set([
    normKey('Jl. Mawar'),
    normKey('Jl. Musyawarah'),
    normKey('Jl. Sekolah Islam'),
  ]);

  // The audit's dd2_row_index is line-based.
  // For no_ruas <= 116: audit_index == no_ruas
  // For no_ruas >= 117: audit_index == no_ruas + 2  (multiline cell spans 3 raw lines)
  // So: no_ruas = audit_index <= 116 ? audit_index : audit_index - 2
  function auditIndexToNoRuas(idx) {
    return idx <= 116 ? idx : idx - 2;
  }

  const records = [];
  for (const audit of auditRows) {
    const rawNormKey = normKey(audit.dd2_road_name_raw);
    const auditIdx   = toInt(audit.dd2_row_index);
    let dd2;

    if (DUPLICATE_RAW_NAMES.has(rawNormKey)) {
      // Use no_ruas tiebreaker for the 3 duplicate-sensitive names
      const noRuas = auditIndexToNoRuas(auditIdx);
      dd2 = dd2ByNoRuas.get(noRuas);
      if (!dd2) {
        console.error(`ERROR: no DD2 row for duplicate "${audit.dd2_road_name_raw}" audit_idx=${auditIdx} -> no_ruas=${noRuas}`);
        process.exit(1);
      }
    } else {
      const candidates = dd2ByNormName.get(rawNormKey) || [];
      if (candidates.length === 0) {
        console.error(`ERROR: no DD2 row matching raw name "${audit.dd2_road_name_raw}" (normKey="${rawNormKey}")`);
        // Show near-matches for debugging
        for (const [k] of dd2ByNormName) {
          if (k.includes(rawNormKey.slice(0, 10))) console.log(`  candidate: "${k}"`);
        }
        process.exit(1);
      }
      dd2 = candidates[0];
    }

    // Derive non_mantap_pct
    const baikPct   = toNum(dd2.kondisi_baik_pct);
    const sedangPct = toNum(dd2.kondisi_sedang_pct);
    let non_mantap_pct = toNum(dd2.non_mantap_pct);
    if (non_mantap_pct === null && baikPct !== null && sedangPct !== null) {
      non_mantap_pct = Math.round((100 - baikPct - sedangPct) * 100) / 100;
    }

    records.push({
      road_key:              audit.canonical_road_key,
      nama_ruas_norm:        audit.canonical_road_key,
      canonical_road_name:   audit.canonical_road_name,
      dd2_road_name_raw:     audit.dd2_road_name_raw,
      dd2_row_index:         auditIdx,
      identity_match_method: audit.match_method,

      kecamatan_dilalui: dd2.kecamatan_dilalui || null,
      no_ruas:           dd2.no_ruas || null,

      panjang_ruas_km:                  toNum(dd2.panjang_ruas_km),
      lebar_ruas_m:                     toNum(dd2.lebar_ruas_m),
      perkerasan_hotmix_km:             toNum(dd2.perkerasan_hotmix_km),
      perkerasan_lapen_makadam_km:      toNum(dd2.perkerasan_lapen_makadam_km),
      perkerasan_beton_km:              toNum(dd2.perkerasan_beton_km),
      perkerasan_telford_kerikil_km:    toNum(dd2.perkerasan_telford_kerikil_km),
      perkerasan_tanah_belum_tembus_km: toNum(dd2.perkerasan_tanah_belum_tembus_km),

      kondisi_baik_km:          toNum(dd2.kondisi_baik_km),
      kondisi_baik_pct:         toNum(dd2.kondisi_baik_pct),
      kondisi_sedang_km:        toNum(dd2.kondisi_sedang_km),
      kondisi_sedang_pct:       toNum(dd2.kondisi_sedang_pct),
      kondisi_rusak_ringan_km:  toNum(dd2.kondisi_rusak_ringan_km),
      kondisi_rusak_ringan_pct: toNum(dd2.kondisi_rusak_ringan_pct),
      kondisi_rusak_berat_km:   toNum(dd2.kondisi_rusak_berat_km),
      kondisi_rusak_berat_pct:  toNum(dd2.kondisi_rusak_berat_pct),
      non_mantap_pct,

      lhr:              toNum(dd2.lhr),
      akses_npk:        dd2.akses_npk || null,
      keterangan_tahun: toInt(dd2.keterangan_tahun),
    });
  }

  // Validate
  if (records.length !== 350) {
    console.error(`ERROR: Expected 350 output records, got ${records.length}`); process.exit(1);
  }
  const keyCounts = new Map();
  records.forEach(r => keyCounts.set(r.road_key, (keyCounts.get(r.road_key) || 0) + 1));
  const dupes = [...keyCounts.entries()].filter(([, c]) => c > 1);
  if (dupes.length > 0) {
    console.warn('Duplicate road_keys:');
    dupes.forEach(([k, c]) => console.warn(`  "${k}" ×${c}`));
  } else {
    console.log('road_key uniqueness: ✓ all 350 unique');
  }

  const summary = JSON.parse(fs.readFileSync('staging-source/dd2/audit/dd2_identity_summary.json', 'utf8'));
  const output = {
    _metadata: {
      source_file:           'staging-source/dd2/processed/dd2_roads_2025_clean.csv',
      identity_audit_file:   'staging-source/dd2/audit/dd2_identity_audit.csv',
      generated_at:          new Date().toISOString(),
      total_records:         records.length,
      identity_audit_status: 'clean_350_matched_0_unmatched_0_ambiguous',
      matched:   summary.matched,
      unmatched: summary.unmatched,
      ambiguous: summary.ambiguous,
    },
    roads: records,
  };

  fs.writeFileSync('public/data/dd2_road_features.json', JSON.stringify(output, null, 2));
  console.log(`\n✓ Wrote public/data/dd2_road_features.json`);
  console.log(`  Total records : ${records.length}`);
  console.log(`  Generated at  : ${output._metadata.generated_at}`);
}

main();
