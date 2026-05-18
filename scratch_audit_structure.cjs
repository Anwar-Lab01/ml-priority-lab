const fs = require('fs');

const data = JSON.parse(fs.readFileSync('public/data/asb_unit_prices.json', 'utf8'));
const items = data.items.filter(it => it.kelompok_barang === 'Jalan Kabupaten' && !it.uraian.toLowerCase().includes('jembatan'));

const groups = {};

function parseMatch(spec, regex) {
  const match = spec.match(regex);
  if (match) {
    return parseFloat(match[1].replace(',', '.'));
  }
  return null;
}

items.forEach(item => {
  const uraian = item.uraian || '';
  const spec = item.spesifikasi || '';
  
  // Extract letter from "Jalan Tipe A1", "Jalan Tipe B2", etc.
  let letter = 'Unknown';
  const matchLetter = uraian.match(/Jalan Tipe ([A-Za-z])/i);
  if (matchLetter) {
    letter = matchLetter[1].toUpperCase();
  } else if (uraian.toLowerCase().includes('drainase') || uraian.toLowerCase().includes('saluran')) {
    letter = 'Drainase';
  }

  if (!groups[letter]) {
    groups[letter] = {
      count: 0,
      width_m: new Set(),
      surface_types: {},
      thickness_cm: {},
      lpa_present: 0,
      lpb_present: 0,
      timbunan_present: 0,
      prices: [],
      samples: [],
      structural_profiles: {}
    };
  }

  const g = groups[letter];
  g.count++;
  if (item.width_m) g.width_m.add(item.width_m);
  
  const st = item.surface_type || 'None';
  g.surface_types[st] = (g.surface_types[st] || 0) + 1;
  
  const tk = item.layer_thickness_cm || 'None';
  g.thickness_cm[tk] = (g.thickness_cm[tk] || 0) + 1;
  
  const lpa = parseMatch(spec, /LPA\s*=\s*([\d,.]+)\s*cm/i) || parseMatch(spec, /Lapis Pondasi Agregat Kelas A\s*=\s*([\d,.]+)\s*cm/i);
  const lpb = parseMatch(spec, /LPB\s*=\s*([\d,.]+)\s*cm/i) || parseMatch(spec, /Lapis Pondasi Agregat Kelas B\s*=\s*([\d,.]+)\s*cm/i);
  const timbunan = parseMatch(spec, /Timbunan[^=]*=\s*([\d,.]+)\s*cm/i);
  
  if (lpa !== null) g.lpa_present++;
  if (lpb !== null) g.lpb_present++;
  if (timbunan !== null) g.timbunan_present++;
  
  if (item.harga_rp !== null) g.prices.push(item.harga_rp);
  
  if (g.samples.length < 5) {
    g.samples.push(item);
  }
  
  // Identify Structural Profile
  let profile = 'unknown';
  if (spec.toLowerCase().includes('drainase') || spec.toLowerCase().includes('pasangan batu') || uraian.toLowerCase().includes('drainase')) {
    profile = 'drainase';
  } else if (st === 'Rigid' || spec.toLowerCase().includes('beton')) {
    profile = 'rigid';
  } else if (timbunan !== null && lpa !== null && lpb !== null) {
    profile = 'base_subbase_fill';
  } else if (lpa !== null && lpb !== null) {
    profile = 'base_plus_subbase';
  } else if (lpa !== null) {
    profile = 'base_course';
  } else if (st !== 'None' && lpa === null && lpb === null && timbunan === null) {
    profile = 'surface_only';
  }
  
  g.structural_profiles[profile] = (g.structural_profiles[profile] || 0) + 1;
});

console.log("=== ASB ROAD TYPE STRUCTURE AUDIT ===");
console.log(`Total Road Items: ${items.length}\n`);

for (const letter of Object.keys(groups).sort()) {
  const g = groups[letter];
  console.log(`--- Tipe ${letter} ---`);
  console.log(`Count: ${g.count}`);
  
  const widths = Array.from(g.width_m).sort((a,b)=>a-b);
  console.log(`Widths: Min ${widths[0] || 0}, Max ${widths[widths.length-1] || 0}, List: [${widths.join(', ')}]`);
  
  console.log(`Surface Types: ${JSON.stringify(g.surface_types)}`);
  console.log(`Layer Thickness (cm): ${JSON.stringify(g.thickness_cm)}`);
  
  console.log(`LPA Present: ${g.lpa_present} items`);
  console.log(`LPB Present: ${g.lpb_present} items`);
  console.log(`Timbunan Present: ${g.timbunan_present} items`);
  
  const pMin = g.prices.length > 0 ? Math.min(...g.prices) : 0;
  const pMax = g.prices.length > 0 ? Math.max(...g.prices) : 0;
  console.log(`Prices: Rp${pMin.toLocaleString()} - Rp${pMax.toLocaleString()}`);
  
  console.log(`Structural Profiles: ${JSON.stringify(g.structural_profiles)}`);
  
  console.log(`Samples:`);
  g.samples.forEach(s => {
    console.log(`  - [${s.asb_id}] ${s.uraian} | ${s.spesifikasi}`);
  });
  console.log("");
}
