const fs = require('fs');
const rankings = JSON.parse(fs.readFileSync('public/data/rankings.json'));
console.log(`Total rankings: ${rankings.length}`);
const normatif20 = rankings.filter(r => r.scenario_id === 'normatif_20' && r.model === 'XGBoost');
console.log(`normatif_20 XGBoost rankings: ${normatif20.length}`);
console.log(`First item keys: ${Object.keys(normatif20[0])}`);
