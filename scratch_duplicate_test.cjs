const fs = require('fs');

const geos = JSON.parse(fs.readFileSync('f:/WebApps/1.ml_apps/public/data/maps/road-geometries.json'));
const dd2 = JSON.parse(fs.readFileSync('f:/WebApps/1.ml_apps/public/data/dd2_road_features.json'));
const aliasMap = JSON.parse(fs.readFileSync('f:/WebApps/1.ml_apps/public/data/road_alias_map.json'));

function preprocessMapExplorerRoadName(name) {
  return name
    .replace(/\b(?:jalan|jln?|jl)\.?\s*/gi, '')
    .replace(/\bds\.?(?=\s|$|[-/()])/gi, 'desa ')
    .replace(/\bsimp(?:ang)?\.?\s*empat\b/gi, 'sp 4')
    .replace(/\bsp\.?\s*empat\b/gi, 'sp 4')
    .replace(/\bsp\.?\s*0*4\b/gi, 'sp 4')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function getRoadKey(name) {
   return normalizeRoadIdentity(name);
}

function getMapExplorerRoadKey(name) {
  if (!name) return 'unknown';
  return getRoadKey(preprocessMapExplorerRoadName(name));
}

function getMapExplorerAliasCandidate(name) {
  if (!name) return null;
  const sourceKey = getMapExplorerRoadKey(name);
  for (const [sourceName, aliasEntry] of Object.entries(aliasMap.MAP_EXPLORER_ROAD_ALIASES || {})) {
    if (getMapExplorerRoadKey(sourceName) === sourceKey) {
      return {
        key: getMapExplorerRoadKey(aliasEntry.target),
        method: aliasEntry.method,
      };
    }
  }
  return null;
}

function getMapExplorerRefAliasCandidate(ref, roadName) {
  if (!ref || !roadName) return null;
  const entry = (aliasMap.MAP_EXPLORER_ROAD_REF_ALIASES || []).find(
    (candidate) => candidate.ref === ref && candidate.roadName === roadName
  );
  if (!entry) return null;
  return {
    key: getMapExplorerRoadKey(entry.target),
    method: entry.method,
  };
}

const dd2Map = new Map();
for (const r of dd2.roads) {
  const k = r.road_key;
  if (!dd2Map.has(k)) dd2Map.set(k, []);
  dd2Map.get(k).push(r);
}

for (const geo of geos) {
  const directKey = getMapExplorerRoadKey(geo.road_name);
  const refAliasCandidate = getMapExplorerRefAliasCandidate(geo.legacy_ref, geo.road_name);
  const aliasCandidate = getMapExplorerAliasCandidate(geo.road_name);
  const matchedNameKey = geo.matched_name ? getMapExplorerRoadKey(geo.matched_name) : null;

  const resolve = (key) => {
    if (!key) return null;
    const bucket = dd2Map.get(key) || [];
    return bucket.length === 1 ? bucket[0] : null;
  };

  let feature = resolve(directKey);
  if (!feature && refAliasCandidate) feature = resolve(refAliasCandidate.key);
  if (!feature && aliasCandidate) feature = resolve(aliasCandidate.key);
  if (!feature && matchedNameKey) feature = resolve(matchedNameKey);

  if (['Jl. Mawar', 'Jl. Musyawarah', 'Jl. Sekolah Islam'].includes(geo.road_name)) {
      console.log(`[TEST] Geo: ${geo.legacy_ref} ${geo.road_name} -> DD2: ${feature?.canonical_road_name || 'NOT FOUND'} (Key: ${feature?.road_key})`);
  }
}
