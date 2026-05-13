const fs = require('fs');
const targetData = JSON.parse(fs.readFileSync('public/data/target_rows.json'));
console.log(`Length: ${targetData.length}`);
console.log(`First item keys: ${Object.keys(targetData[0])}`);
console.log(`First item nama_ruas_norm: ${targetData[0].nama_ruas_norm}`);
