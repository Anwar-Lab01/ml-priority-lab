const fs = require('fs');
const xlsx = require('xlsx');

const SOURCE_FILE = "F:\\2.ML_Project\\Demo\\4.tanggal_berjalan\\Historis_24_Maret\\3_Skenario\\Master_report_scenario\\historis_rank_alignment_report.xlsx";
const OUT_FILE = "F:\\WebApps\\1.ml_apps\\scratch_target_rows.json";

function formatScenarioId(s) {
    if (!s) return s;
    const str = String(s).toLowerCase();
    
    // Exact mapping to match scenarios.json
    if (str.includes('original')) return 'historis_original';
    if (str.includes('tender_only') || str === 'tender only') return 'historis_tender_only';
    if (str.includes('2:1') || str.includes('2_1')) return 'historis_weighted_2_1';
    if (str.includes('3:1') || str.includes('3_1')) return 'historis_weighted_3_1';
    if (str.includes('5:1') || str.includes('5_1')) return 'historis_weighted_5_1';
    
    if (!str.startsWith('historis_')) return 'historis_' + str;
    return str;
}

function run() {
    console.log(`Loading Excel: ${SOURCE_FILE}`);
    const workbook = xlsx.readFile(SOURCE_FILE);
    const sheet = workbook.Sheets['target_rows_ranked'];
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: null });

    const truthMap = new Map();

    for (const row of rawData) {
        const roadName = String(row.nama_ruas).trim();
        if (!truthMap.has(roadName)) {
            truthMap.set(roadName, {
                planned_any: 0,
                planned_tender: 0,
                planned_pl: 0
            });
        }
        const cur = truthMap.get(roadName);
        if (row.planned_any_2026 == 1 || String(row.planned_any_2026).toLowerCase() === 'true') cur.planned_any = 1;
        if (row.planned_tender_2026 == 1 || String(row.planned_tender_2026).toLowerCase() === 'true') cur.planned_tender = 1;
        if (row.planned_pl_2026 == 1 || String(row.planned_pl_2026).toLowerCase() === 'true') cur.planned_pl = 1;
    }

    const exportData = [];
    const validation = {
        totalRowCount: 0,
        uniqueRoads: new Set(),
        targetPositives: new Set(),
        countByScenario: {},
        scenarioRoadSets: {}
    };

    let hasDuplicates = false;

    for (const row of rawData) {
        const roadName = String(row.nama_ruas).trim();
        const truth = truthMap.get(roadName);

        if (truth.planned_any !== 1) continue;

        const scenarioId = formatScenarioId(row.scenario);
        
        const outRow = {
            scenario_id: scenarioId,
            best_temporal_model: row.best_temporal_model,
            plan_target: row.plan_target || 'planned_any_2026',
            road_id: row.nomor_ruas,
            road_name: roadName,
            rank_prioritas: row.rank_prioritas,
            pred_prob: row.pred_prob,
            planned_any_2026: truth.planned_any,
            planned_tender_2026: truth.planned_tender,
            planned_pl_2026: truth.planned_pl,
            source_file: "historis_rank_alignment_report.xlsx",
            source_sheet: "target_rows_ranked"
        };
        exportData.push(outRow);

        validation.totalRowCount++;
        validation.uniqueRoads.add(roadName);
        if (truth.planned_any === 1) validation.targetPositives.add(roadName);
        
        validation.countByScenario[scenarioId] = (validation.countByScenario[scenarioId] || 0) + 1;
        
        if (!validation.scenarioRoadSets[scenarioId]) validation.scenarioRoadSets[scenarioId] = new Set();
        
        if (validation.scenarioRoadSets[scenarioId].has(roadName)) {
            console.error(`DUPLICATE DETECTED: Road '${roadName}' appears multiple times in scenario '${scenarioId}'!`);
            hasDuplicates = true;
        }
        validation.scenarioRoadSets[scenarioId].add(roadName);
    }

    console.log("---------------------------------------");
    console.log("Export Validation Report:");
    console.log(`Total Rows Output:           ${validation.totalRowCount}`);
    console.log(`Unique Roads Exported:       ${validation.uniqueRoads.size}`);
    console.log(`Unique Target-Positive Roads:${validation.targetPositives.size}`);
    console.log("Count by Scenario:");
    for (const [k, v] of Object.entries(validation.countByScenario)) {
        console.log(`   - ${k}: ${v} rows`);
    }

    if (hasDuplicates) {
         console.error("FATAL: Duplicates detected within scenarios. Export aborted.");
         process.exit(1);
    } else {
         console.log("Duplicate Check:             PASSED (No roads repeated within any scenario)");
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(exportData, null, 2), "utf8");
    console.log("---------------------------------------");
    console.log(`Successfully wrote to ${OUT_FILE}`);
}

run();
