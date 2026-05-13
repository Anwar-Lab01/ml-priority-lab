const fs = require('fs');

const summary = JSON.parse(fs.readFileSync('popup_lookup_summary.json'));
const dd2 = JSON.parse(fs.readFileSync('./public/data/dd2_road_features.json'));

function levenshtein(a, b) {
  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1,
        matrix[i - 1][j] + 1,
        matrix[i - 1][j - 1] + indicator
      );
    }
  }
  return matrix[a.length][b.length];
}

const missing = summary.missing_roads;
const dd2Roads = dd2.roads;

const proposals = missing.map(m => {
  let bestMatch = null;
  let minDistance = Infinity;

  for (const r of dd2Roads) {
    const dist = levenshtein(m.resolved_key, r.road_key);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = r;
    }
  }

  return {
    geometry_road_name: m.geometry_road_name,
    geometry_legacy_ref: m.geometry_legacy_ref,
    resolved_key: m.resolved_key,
    proposed_dd2_name: bestMatch.canonical_road_name,
    proposed_dd2_key: bestMatch.road_key,
    distance: minDistance
  };
});

fs.writeFileSync('popup_proposals.json', JSON.stringify(proposals, null, 2));
console.log('Proposals generated.');
