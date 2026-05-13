const fs = require('fs');
const text = fs.readFileSync('staging-source/dd2/processed/dd2_roads_2025_clean.csv', 'utf8');
const lines = text.split('\n');
console.log(`Total raw lines: ${lines.length}`);
for (let i = 115; i <= 122; i++) {
  console.log(`Line ${i}: ${JSON.stringify(lines[i])}`);
}
