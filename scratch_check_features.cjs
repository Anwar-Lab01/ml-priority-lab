const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/road_features.json'));
console.log(`Length: ${data.length}`);
console.log(`First item keys: ${Object.keys(data[0])}`);
console.log(`First item nama_ruas_norm: ${data[0].nama_ruas_norm}`);
