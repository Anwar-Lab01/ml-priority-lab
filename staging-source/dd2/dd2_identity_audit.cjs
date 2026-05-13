const fs = require('fs');

function normalizeRoadIdentity(name) {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\bjl\.?\s*/g, '')
    .replace(/\bds\.?(?=\s|$)/g, 'desa')
    .replace(/\bsp\.?\s*/g, 'sp ')
    .replace(/\bsei\.?\s*/g, 'sei ')
    .replace(/\//g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCSVRow(str) {
  const result = [];
  let inQuote = false;
  let cur = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"') {
      if (inQuote && str[i+1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === ',' && !inQuote) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function formatDelimitedCell(value) {
  if (value == null) return '';
  let str = String(value);
  const shouldQuote = str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r');
  if (!shouldQuote) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

function main() {
  const aliasMapData = JSON.parse(fs.readFileSync('public/data/road_alias_map.json'));
  const roadAliasMap = new Map(Object.entries(aliasMapData.aliases || {}));

  function applyRoadAlias(normalizedKey) {
    let current = normalizedKey;
    const visited = new Set();
    while (roadAliasMap.has(current) && !visited.has(current)) {
      visited.add(current);
      current = roadAliasMap.get(current);
    }
    return current;
  }

  function getRoadKey(name) {
    return applyRoadAlias(normalizeRoadIdentity(name));
  }

  const rankings = JSON.parse(fs.readFileSync('public/data/rankings.json'));
  const normatif20 = rankings.filter(r => r.scenario_id === 'normatif_20' && r.model === 'XGBoost');
  
  const canonicalLookup = new Map();
  normatif20.forEach(r => {
    const key = getRoadKey(r.road_name);
    if (!canonicalLookup.has(key)) canonicalLookup.set(key, []);
    if (!canonicalLookup.get(key).includes(r.road_name)) {
      canonicalLookup.get(key).push(r.road_name);
    }
  });

  const resolutionsFile = 'staging-source/dd2/audit/dd2_duplicate_resolution_proposal.json';
  let resolutionMap = new Map();
  if (fs.existsSync(resolutionsFile)) {
    const resolutions = JSON.parse(fs.readFileSync(resolutionsFile));
    resolutions.forEach(r => {
      resolutionMap.set(r.dd2_row_index, r);
    });
  }

  const csvText = fs.readFileSync('staging-source/dd2/processed/dd2_roads_2025_clean.csv', 'utf8');
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  const headers = parseCSVRow(lines[0]);
  const namaRuasRawIndex = headers.indexOf('nama_ruas_raw');
  
  let auditRows = [];
  let matchedCount = 0;
  let unmatchedCount = 0;
  let ambiguousCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    const dd2_road_name_raw = row[namaRuasRawIndex];
    if (!dd2_road_name_raw) continue;

    const dd2_normalized_key = getRoadKey(dd2_road_name_raw);
    
    let match_method = 'unmatched';
    let canonical_road_name = '';
    let canonical_road_key = '';
    let reason = '';

    if (resolutionMap.has(i)) {
      const res = resolutionMap.get(i);
      matchedCount++;
      canonical_road_name = res.canonical_name;
      canonical_road_key = res.canonical_key;
      match_method = res.resolution_method;
      reason = res.evidence_context;
    } else {
      const matches = canonicalLookup.get(dd2_normalized_key) || [];
      
      if (matches.length === 1) {
        matchedCount++;
        canonical_road_name = matches[0];
        canonical_road_key = dd2_normalized_key;
        const directMatch = normalizeRoadIdentity(dd2_road_name_raw) === normalizeRoadIdentity(canonical_road_name);
        match_method = directMatch ? 'direct' : 'alias';
      } else if (matches.length > 1) {
        ambiguousCount++;
        match_method = 'ambiguous';
        reason = `Matched ${matches.length} canonical roads: ${matches.join(' | ')}`;
      } else {
        unmatchedCount++;
        match_method = 'unmatched';
        reason = 'No canonical road found';
      }
    }
    
    auditRows.push({
      dd2_row_index: i,
      dd2_road_name_raw,
      dd2_normalized_key,
      canonical_road_name,
      canonical_road_key,
      match_method,
      confidence_or_reason: reason,
      notes: ''
    });
  }

  let seenNames = new Set();
  let duplicates = [];
  for (let r of auditRows) {
    if (seenNames.has(r.dd2_road_name_raw)) {
      duplicates.push(r.dd2_road_name_raw);
    }
    seenNames.add(r.dd2_road_name_raw);
  }

  const auditHeader = ['dd2_row_index', 'dd2_road_name_raw', 'dd2_normalized_key', 'canonical_road_name', 'canonical_road_key', 'match_method', 'confidence_or_reason', 'notes'];
  
  const toCSV = (rows) => {
    return [auditHeader.join(',')]
      .concat(rows.map(r => auditHeader.map(h => formatDelimitedCell(r[h])).join(',')))
      .join('\n');
  };

  const auditCsv = toCSV(auditRows);
  fs.writeFileSync('staging-source/dd2/audit/dd2_identity_audit.csv', auditCsv);

  const unmatchedRows = auditRows.filter(r => r.match_method === 'unmatched');
  if (unmatchedRows.length > 0) {
    fs.writeFileSync('staging-source/dd2/audit/dd2_unmatched.csv', toCSV(unmatchedRows));
  } else {
    if (fs.existsSync('staging-source/dd2/audit/dd2_unmatched.csv')) {
      fs.unlinkSync('staging-source/dd2/audit/dd2_unmatched.csv');
    }
  }

  const ambiguousRows = auditRows.filter(r => r.match_method === 'ambiguous');
  if (ambiguousRows.length > 0) {
    fs.writeFileSync('staging-source/dd2/audit/dd2_ambiguous.csv', toCSV(ambiguousRows));
  } else {
    if (fs.existsSync('staging-source/dd2/audit/dd2_ambiguous.csv')) {
      fs.unlinkSync('staging-source/dd2/audit/dd2_ambiguous.csv');
    }
  }

  const summary = {
    total_dd2_rows: auditRows.length,
    matched: matchedCount,
    unmatched: unmatchedCount,
    ambiguous: ambiguousCount,
    duplicates: duplicates
  };

  fs.writeFileSync('staging-source/dd2/audit/dd2_identity_summary.json', JSON.stringify(summary, null, 2));

  console.log(`DD2 total rows: ${summary.total_dd2_rows}`);
  console.log(`Matched count: ${summary.matched}`);
  console.log(`Unmatched count: ${summary.unmatched}`);
  console.log(`Ambiguous count: ${summary.ambiguous}`);
  console.log(`Duplicate DD2 names: ${summary.duplicates.length} (${summary.duplicates.join(', ')})`);
}

main();
