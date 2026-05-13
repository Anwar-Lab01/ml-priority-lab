const fs = require('fs');
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
    headers.forEach((h, i) => { obj[h] = (row[i] ?? '').replace(/[\r\n\t]+/g, ' ').trim(); });
    return obj;
  });
  return { headers, data };
}

const dd2Raw = parseCSVFull(fs.readFileSync('staging-source/dd2/processed/dd2_roads_2025_clean.csv', 'utf8'));
const { data: dd2Rows } = rowsToObjects(dd2Raw);
console.log(`DD2 rows: ${dd2Rows.length}`);
// Show rows 114-119
for (let i = 113; i < 120; i++) {
  const r = dd2Rows[i];
  if (r) console.log(`[${i+1}] no_ruas=${r.no_ruas} nama=${JSON.stringify(r.nama_ruas_raw)}`);
}
