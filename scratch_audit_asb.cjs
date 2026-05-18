const fs = require('fs');

const data = JSON.parse(fs.readFileSync('public/data/asb_unit_prices.json', 'utf8'));
const items = data.items;

const counts = {
  kelompok_barang: {},
  kelompok_belanja: {},
  satuan: {},
  surface_type: {},
  width_m: { parsed: 0, null: 0 },
  layer_thickness_cm: { parsed: 0, null: 0 },
  uraian: {},
  spesifikasi: {},
};

for (const item of items) {
  // 1
  counts.kelompok_barang[item.kelompok_barang] = (counts.kelompok_barang[item.kelompok_barang] || 0) + 1;
  // 2
  counts.kelompok_belanja[item.kelompok_belanja] = (counts.kelompok_belanja[item.kelompok_belanja] || 0) + 1;
  // 3
  counts.satuan[item.satuan] = (counts.satuan[item.satuan] || 0) + 1;
  // 4
  const st = item.surface_type || 'null';
  counts.surface_type[st] = (counts.surface_type[st] || 0) + 1;
  // 5
  if (item.width_m !== null) counts.width_m.parsed++; else counts.width_m.null++;
  // 6
  if (item.layer_thickness_cm !== null) counts.layer_thickness_cm.parsed++; else counts.layer_thickness_cm.null++;
  // 7
  counts.uraian[item.uraian] = (counts.uraian[item.uraian] || 0) + 1;
  // 8
  const spec = item.spesifikasi || 'null';
  counts.spesifikasi[spec] = (counts.spesifikasi[spec] || 0) + 1;
}

const getTop = (obj, n) => Object.entries(obj).sort((a,b) => b[1] - a[1]).slice(0, n);

// Candidate grouping rules
const families = {
  pemeliharaan_rutin: { rule: "uraian/kelompok contains 'rutin'", items: [] },
  pemeliharaan_berkala: { rule: "uraian/kelompok contains 'berkala'", items: [] },
  rehabilitasi: { rule: "uraian/kelompok contains 'rehabilitasi'", items: [] },
  rekonstruksi: { rule: "uraian/kelompok contains 'rekon'", items: [] },
  peningkatan_permukaan: { rule: "uraian/kelompok contains 'peningkatan' and not jembatan", items: [] },
  drainase: { rule: "uraian/kelompok/spec contains 'saluran', 'drainase', 'gorong', 'box culvert'", items: [] },
  jembatan: { rule: "uraian/kelompok contains 'jembatan'", items: [] },
  other_non_road: { rule: "uraian/kelompok contains 'bangunan', 'gedung', 'tanah', 'peralatan', 'jasa'", items: [] },
  unclassified: { rule: "fallback for rest", items: [] }
};

for (const item of items) {
  const ur = (item.uraian || '').toLowerCase();
  const kb = (item.kelompok_barang || '').toLowerCase();
  const kb2 = (item.kelompok_belanja || '').toLowerCase();
  const spec = (item.spesifikasi || '').toLowerCase();
  const fullText = `${ur} ${kb} ${kb2} ${spec}`;

  if (fullText.includes('jembatan')) {
    families.jembatan.items.push(item);
  } else if (fullText.includes('saluran') || fullText.includes('drainase') || fullText.includes('gorong') || fullText.includes('box culvert') || fullText.includes('u-ditch')) {
    families.drainase.items.push(item);
  } else if (fullText.includes('bangunan') || fullText.includes('gedung') || fullText.includes('tanah') || fullText.includes('peralatan') || fullText.includes('jasa') || fullText.includes('kendaraan')) {
    families.other_non_road.items.push(item);
  } else if (fullText.includes('rekonstruksi') || fullText.includes('rekon')) {
    families.rekonstruksi.items.push(item);
  } else if (fullText.includes('rehabilitasi')) {
    families.rehabilitasi.items.push(item);
  } else if (fullText.includes('peningkatan')) {
    families.peningkatan_permukaan.items.push(item);
  } else if (fullText.includes('berkala')) {
    families.pemeliharaan_berkala.items.push(item);
  } else if (fullText.includes('rutin')) {
    families.pemeliharaan_rutin.items.push(item);
  } else {
    families.unclassified.items.push(item);
  }
}

// Write report to console
console.log("=== ASB CLASSIFICATION AUDIT ===");
console.log("1. Count by kelompok_barang:", JSON.stringify(counts.kelompok_barang, null, 2));
console.log("2. Count by kelompok_belanja:", JSON.stringify(counts.kelompok_belanja, null, 2));
console.log("3. Count by satuan:", JSON.stringify(counts.satuan, null, 2));
console.log("4. Count by surface_type:", JSON.stringify(counts.surface_type, null, 2));
console.log(`5. Count by width_m: Parsed=${counts.width_m.parsed}, Null=${counts.width_m.null}`);
console.log(`6. Count by layer_thickness_cm: Parsed=${counts.layer_thickness_cm.parsed}, Null=${counts.layer_thickness_cm.null}`);
console.log("7. Top 50 uraian:");
getTop(counts.uraian, 50).forEach(x => console.log(`   - ${x[1]}: ${x[0]}`));
console.log("8. Top 50 spesifikasi:");
getTop(counts.spesifikasi, 50).forEach(x => console.log(`   - ${x[1]}: ${x[0]}`));

console.log("\n9. Candidate Groups & Sample Items");
for (const [key, val] of Object.entries(families)) {
  console.log(`\nFamily: ${key}`);
  console.log(`- Match Rule: ${val.rule}`);
  console.log(`- Matched Items: ${val.items.length}`);
  if (key === 'unclassified') {
     console.log(`- Confidence: low (need manual review)`);
  } else if (val.items.length === 0) {
     console.log(`- Confidence: N/A`);
  } else {
     console.log(`- Confidence: medium (keyword based)`);
  }
  console.log(`- Sample 5 items:`);
  val.items.slice(0, 5).forEach(it => {
    console.log(`    [${it.asb_id}] ${it.uraian} (${it.spesifikasi}) - ${it.satuan} - Rp${it.harga_rp}`);
  });
}
