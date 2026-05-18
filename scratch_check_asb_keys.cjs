const d = require('./public/data/asb_unit_prices.json');
console.log('Top-level keys:', Object.keys(d));
console.log('Has .items?', !!d.items);
console.log('Is array?', Array.isArray(d));
if (d.items) {
  console.log('items count:', d.items.length);
} else if (Array.isArray(d)) {
  console.log('array length:', d.length);
} else {
  for (const k of Object.keys(d)) {
    const v = d[k];
    console.log(k, ':', Array.isArray(v) ? 'Array[' + v.length + ']' : typeof v);
  }
}
