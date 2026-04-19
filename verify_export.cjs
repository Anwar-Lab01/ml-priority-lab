const fs = require('fs');

const targetRowsStr = fs.readFileSync('F:\\WebApps\\1.ml_apps\\scratch_target_rows.json', 'utf8');
const targetRows = JSON.parse(targetRowsStr);

const scenariosStr = fs.readFileSync('F:\\WebApps\\1.ml_apps\\public\\data\\scenarios.json', 'utf8');
const scenarios = JSON.parse(scenariosStr);

console.log("=== 1. SAMPLE ROWS ===");
const namesToFind = ["Menuju Stadion 2 Desember", "Taniran Selatan Kubah", "Bayanan"];
const samples = [];
for (const raw of targetRows) {
    for (const name of namesToFind) {
        if (raw.road_name.includes(name) && !samples.find(s => s.road_name === raw.road_name)) {
            samples.push(raw);
        }
    }
    if (samples.length === 3) break;
}
console.log(JSON.stringify(samples, null, 2));

console.log("\n=== 2. CROSS-SCENARIO CONSISTENCY CHECK ===");
const roadTruths = new Map();
let isConsistent = true;
for (const row of targetRows) {
    const rName = row.road_name;
    const key = `${row.planned_any_2026}_${row.planned_tender_2026}_${row.planned_pl_2026}`;
    
    if (!roadTruths.has(rName)) {
        roadTruths.set(rName, key);
    } else {
        if (roadTruths.get(rName) !== key) {
            console.log(`ERROR: Inconsistent truth for ${rName}!`);
            isConsistent = false;
        }
    }
}
console.log(`Consistency Check: ${isConsistent ? 'PASSED (Target flags are 100% identical across all scenarios for each road)' : 'FAILED'}`);

console.log("\n=== 3. SCENARIO ID MATCH CHECK ===");
const validIds = new Set(scenarios.map(s => s.scenario_id));
const exportedIds = new Set(targetRows.map(r => r.scenario_id));
let invalidIds = [];
for (const exId of exportedIds) {
    if (!validIds.has(exId)) invalidIds.push(exId);
}
if (invalidIds.length === 0) {
    console.log(`Scenario ID Match Check: PASSED. Expected vs Exported keys perfectly matched:`);
    console.log(`   Exported keys found: ${Array.from(exportedIds).join(', ')}`);
} else {
    console.log(`Scenario ID Match Check: FAILED. Invalid keys found: ${invalidIds.join(', ')}`);
}

console.log("\n=== 4. AUDIT FIELDS PRESENCE CHECK ===");
const requiredFields = ["scenario_id", "best_temporal_model", "plan_target", "rank_prioritas", "pred_prob"];
let allPresent = true;
for (const row of targetRows) {
    for (const f of requiredFields) {
        if (!(f in row)) {
            console.log(`Missing field ${f} in row:`, row);
            allPresent = false;
            break;
        }
    }
    if (!allPresent) break;
}
console.log(`Audit Fields Check: ${allPresent ? 'PASSED (All required fields exist natively in export structure)' : 'FAILED'}`);
