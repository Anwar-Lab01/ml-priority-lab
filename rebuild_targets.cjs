const fs = require('fs');

const tek2026List = [
    "AMD - Ds. Lok Binuang", "Anjiran Rantauan - Ds. Taniran Tengah", "Asam Seranggan - Asam Tamiyang", "Bamban (Tibung) - Martajiwa", "Bamban Selatan - Tanggang - Panggang Hijau", "Bamban Tengah - Lok Nyiur", "Banua Hanyar - Ds. Tanjung Selor", "Banyu Barau - Sei Kalang", "Baru - Ds. Bajayau", "Batang Kulur Kanan - Batang Kulur Kiri", "Bayanan - Habirau Tengah", "Gerilya / (Depan PUSTU Habirau)", "Gumbil - Masimpan", "Guru H. Izim - Ds. Pantai Ulin", "Halaban", "Halunuk - Riam Tajam/Talo - Hamak Umpaya", "Hamayung - Hakurung Dalam", "Jarau - Parandakan", "Kalumpang (Ds. Balanti) - Teratai", "Karya Bakti - Ds. Balimau", "Loklahung - Kamawakan", "Loksado - Haratai", "Malinau - Katingin - Kamawakan", "Manggis - Ds. Baru", "Mawangi - Bukuanin - Telaga Langsat", "Muara Pipii - Tambak Pipii", "Muning Tengah - Batang Alai (Pihanin Raya)", "Muning Tengah - Ds. Muning Dalam", "Palas - Ds. Wasah Tengah", "Pandak Daun (Buntut Muradiyah) - Pakan Dalam", "Paramaian", "Sei. Mandala Murung Raya", "Sirih - Pacakan", "Sp. 4 Baru/Tampang - Sp. Bilui Pamujaan", "Sp. Empat Lungau - Garis", "Sp.3 Bukuanin - Riam Talo", "Tabihi - Telaga Langsat", "Talapak Manuk - Ds. Kapuh", "Tambangan - Ds. Baruh Jaya", "Tamiyang - Ds. Tamiyang (Eks TMMD)", "Tanah Habang - Ds. Simpur", "Taniran Selatan Kubah - Buntut Taniran / Wawaran", "Telaga Langsat - Pakuan Timur", "Teluk Haur I", "Teluk Haur II", "Ulin - Tanggul (Balai Mas)"
];

const tek2027List = [
    "AMD - Ds. Lok Binuang", "Anjiran Rantauan - Ds. Taniran Tengah", "Batang Kulur Kanan - Batang Kulur Kiri", "Halaban", "Halunuk - Riam Tajam/Talo - Hamak Umpaya", "Kalumpang (Ds. Balanti) - Teratai", "Mawangi - Bukuanin - Telaga Langsat", "Sei. Mandala Murung Raya", "Sp. 4 Baru/Tampang - Sp. Bilui Pamujaan", "Sp.3 Bukuanin - Riam Talo", "Talapak Manuk - Ds. Kapuh", "Tanah Habang - Ds. Simpur", "Teluk Haur I", "Teluk Haur II", "Aluh Idut", "Angkinang Selatan - Tawia - Wawaran", "Cangkingan Herman", "Hamalau - Anjiran", "Hamalau - Ganda", "Kaliring - Sp. Padang Batung", "Kaminting Batu", "Kampung Kawat", "Karasikan - Sarang Halang", "KS. Tubun", "Paharuangan - Asam Dua", "Siang Gantung - Ds. Baru", "Soetoyo - Teluk Mesjid", "Sp. Batang Kulur Kiri - Tatas", "Sungai Raya Selatan - Malutu - Goa Berangin", "Taal Jarau - Sp. Baru/Tampang", "Teluk Mesjid - Sp. 4 Muara Banta", "Tukang Garit (Tambangan)", "Wasah Hulu - Amparaya - Simpur"
];

function normalize(s) { return s.toString().trim().replace(/\s+/g, ' ').toLowerCase(); }
const t26Set = new Set(tek2026List.map(normalize));
const t27Set = new Set(tek2027List.map(normalize));

const rankings = JSON.parse(fs.readFileSync('public/data/rankings.json', 'utf8'));
const targetRows = JSON.parse(fs.readFileSync('public/data/target_rows.json', 'utf8'));
const metrics = JSON.parse(fs.readFileSync('public/data/model_metrics.json', 'utf8'));

// Find best models per scenario from metrics
const bestModels = new Map();
for (const m of metrics) {
    if (!bestModels.has(m.scenario_id)) bestModels.set(m.scenario_id, m);
    else {
        const cur = bestModels.get(m.scenario_id);
        const p1 = m.pr_auc || 0, p2 = cur.pr_auc || 0;
        if (p1 > p2) bestModels.set(m.scenario_id, m);
        else if (p1 === p2 && (m.mcc || 0) > (cur.mcc || 0)) bestModels.set(m.scenario_id, m);
    }
}

// Build a master map of road properties (planned_any_2026, tender, pl) from the existing target_rows
// We will augment this map with teknokratis 2026 and 2027.
const truthMap = new Map();
for (const row of targetRows) {
    const k = normalize(row.road_name);
    truthMap.set(k, {
        any: row.planned_any_2026 || 0,
        tender: row.planned_tender_2026 || 0,
        pl: row.planned_pl_2026 || 0,
        tek26: t26Set.has(k) ? 1 : 0,
        tek27: t27Set.has(k) ? 1 : 0,
        road_id: row.road_id,
        road_name: row.road_name
    });
}

// Ensure all newly specified roads are in truthMap too
for (const list of [tek2026List, tek2027List]) {
    for (const rawName of list) {
        const k = normalize(rawName);
        if (!truthMap.has(k)) {
            // Need to find road_id and original casing from rankings
            const foundRank = rankings.find(r => normalize(r.road_name) === k);
            if (foundRank) {
                truthMap.set(k, {
                    any: 0, tender: 0, pl: 0,
                    tek26: t26Set.has(k) ? 1 : 0,
                    tek27: t27Set.has(k) ? 1 : 0,
                    road_id: foundRank.road_id,
                    road_name: foundRank.road_name
                });
            } else {
                console.warn("Could not find road in rankings:", rawName);
            }
        } else {
            // update flags just in case
            truthMap.get(k).tek26 = t26Set.has(k) ? 1 : 0;
            truthMap.get(k).tek27 = t27Set.has(k) ? 1 : 0;
        }
    }
}

// Rebuild targetRows
const newTargetRows = [];
const scenarios = Array.from(bestModels.keys());

for (const sid of scenarios) {
    const bestModel = bestModels.get(sid).model;
    
    // Get all rankings for this scenario + model
    const ranks = rankings.filter(r => r.scenario_id === sid && r.model === bestModel);
    
    for (const [k, truth] of truthMap.entries()) {
        const isTarget = truth.any || truth.tek26 || truth.tek27;
        if (!isTarget) continue;
        
        const rankObj = ranks.find(r => normalize(r.road_name) === k);
        if (rankObj) {
            newTargetRows.push({
                scenario_id: sid,
                best_temporal_model: bestModel,
                plan_target: "planned_any_2026", // keep for legacy compatibility
                road_id: truth.road_id,
                road_name: truth.road_name,
                rank_prioritas: rankObj.rank,
                pred_prob: rankObj.score,
                planned_any_2026: truth.any,
                planned_tender_2026: truth.tender,
                planned_pl_2026: truth.pl,
                planned_teknokratis_2026: truth.tek26,
                planned_teknokratis_2027: truth.tek27,
                source_file: "system_augmented",
                source_sheet: "-"
            });
        }
    }
}

fs.writeFileSync('public/data/target_rows.json', JSON.stringify(newTargetRows, null, 2));

// Log verification
const u26 = new Set(newTargetRows.filter(r => r.planned_teknokratis_2026 === 1).map(r => r.road_name));
const u27 = new Set(newTargetRows.filter(r => r.planned_teknokratis_2027 === 1).map(r => r.road_name));

console.log("planned_teknokratis_2026 positive roads:", u26.size);
console.log("planned_teknokratis_2027 positive roads:", u27.size);

const samples26 = Array.from(u26).slice(0, 3);
const samples27 = Array.from(u27).slice(0, 3);

console.log("\nSamples 2026:", samples26.map(r => newTargetRows.find(x => x.road_name === r && x.planned_teknokratis_2026)));
console.log("\nSamples 2027:", samples27.map(r => newTargetRows.find(x => x.road_name === r && x.planned_teknokratis_2027)));
