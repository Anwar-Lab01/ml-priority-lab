const fs = require('fs');

const tek2026List = [
    "AMD - Ds. Lok Binuang",
    "Anjiran Rantauan - Ds. Taniran Tengah",
    "Asam Seranggan - Asam Tamiyang",
    "Bamban (Tibung) - Martajiwa",
    "Bamban Selatan - Tanggang - Panggang Hijau",
    "Bamban Tengah - Lok Nyiur",
    "Banua Hanyar - Ds. Tanjung Selor",
    "Banyu Barau - Sei Kalang",
    "Baru - Ds. Bajayau",
    "Batang Kulur Kanan - Batang Kulur Kiri",
    "Bayanan - Habirau Tengah",
    "Gerilya / (Depan PUSTU Habirau)",
    "Gumbil - Masimpan",
    "Guru H. Izim - Ds. Pantai Ulin",
    "Halaban",
    "Halunuk - Riam Tajam/Talo - Hamak Umpaya",
    "Hamayung - Hakurung Dalam",
    "Jarau - Parandakan",
    "Kalumpang (Ds. Balanti) - Teratai",
    "Karya Bakti - Ds. Balimau",
    "Loklahung - Kamawakan",
    "Loksado - Haratai",
    "Malinau - Katingin - Kamawakan",
    "Manggis - Ds. Baru",
    "Mawangi - Bukuanin - Telaga Langsat",
    "Muara Pipii - Tambak Pipii",
    "Muning Tengah - Batang Alai (Pihanin Raya)",
    "Muning Tengah - Ds. Muning Dalam",
    "Palas - Ds. Wasah Tengah",
    "Pandak Daun (Buntut Muradiyah) - Pakan Dalam",
    "Paramaian",
    "Sei. Mandala Murung Raya",
    "Sirih - Pacakan",
    "Sp. 4 Baru/Tampang - Sp. Bilui Pamujaan",
    "Sp. Empat Lungau - Garis",
    "Sp.3 Bukuanin - Riam Talo",
    "Tabihi - Telaga Langsat",
    "Talapak Manuk - Ds. Kapuh",
    "Tambangan - Ds. Baruh Jaya",
    "Tamiyang - Ds. Tamiyang (Eks TMMD)",
    "Tanah Habang - Ds. Simpur",
    "Taniran Selatan Kubah - Buntut Taniran / Wawaran",
    "Telaga Langsat - Pakuan Timur",
    "Teluk Haur I",
    "Teluk Haur II",
    "Ulin - Tanggul (Balai Mas)"
];

const tek2027List = [
    "AMD - Ds. Lok Binuang",
    "Anjiran Rantauan - Ds. Taniran Tengah",
    "Batang Kulur Kanan - Batang Kulur Kiri",
    "Halaban",
    "Halunuk - Riam Tajam/Talo - Hamak Umpaya",
    "Kalumpang (Ds. Balanti) - Teratai",
    "Mawangi - Bukuanin - Telaga Langsat",
    "Sei. Mandala Murung Raya",
    "Sp. 4 Baru/Tampang - Sp. Bilui Pamujaan",
    "Sp.3 Bukuanin - Riam Talo",
    "Talapak Manuk - Ds. Kapuh",
    "Tanah Habang - Ds. Simpur",
    "Teluk Haur I",
    "Teluk Haur II",
    "Aluh Idut",
    "Angkinang Selatan - Tawia - Wawaran",
    "Cangkingan Herman",
    "Hamalau - Anjiran",
    "Hamalau - Ganda",
    "Kaliring - Sp. Padang Batung",
    "Kaminting Batu",
    "Kampung Kawat",
    "Karasikan - Sarang Halang",
    "KS. Tubun",
    "Paharuangan - Asam Dua",
    "Siang Gantung - Ds. Baru",
    "Soetoyo - Teluk Mesjid",
    "Sp. Batang Kulur Kiri - Tatas",
    "Sungai Raya Selatan - Malutu - Goa Berangin",
    "Taal Jarau - Sp. Baru/Tampang",
    "Teluk Mesjid - Sp. 4 Muara Banta",
    "Tukang Garit (Tambangan)",
    "Wasah Hulu - Amparaya - Simpur"
];

function normalize(s) {
    if (!s) return "";
    return s.toString().trim().replace(/\s+/g, ' ').toLowerCase();
}

const tek2026Set = new Set(tek2026List.map(normalize));
const tek2027Set = new Set(tek2027List.map(normalize));

const targetRowsStr = fs.readFileSync('F:\\WebApps\\1.ml_apps\\public\\data\\target_rows.json', 'utf8');
const targetRows = JSON.parse(targetRowsStr);

let c2026 = new Set();
let c2027 = new Set();

for (const row of targetRows) {
    const rawName = String(row.road_name).trim();
    const nx = normalize(rawName);

    let is2026 = 0, is2027 = 0;
    
    // Exact or near match logic used in `utils.js` (getRoadKey) is basically lowercasing, 
    // but the provided road list is an exact match for how it's spelled in road_name.
    // We will use case-insensitive strict matching.
    if (tek2026Set.has(nx)) {
        is2026 = 1;
        c2026.add(nx);
    }
    if (tek2027Set.has(nx)) {
        is2027 = 1;
        c2027.add(nx);
    }

    row.planned_teknokratis_2026 = is2026;
    row.planned_teknokratis_2027 = is2027;
}

console.log("=== JSON Update Results ===");
console.log(`planned_teknokratis_2026 positives: ${c2026.size}`);
console.log(`planned_teknokratis_2027 positives: ${c2027.size}`);

// Print samples
const s1 = targetRows.find(r => r.planned_teknokratis_2026 === 1);
const s2 = targetRows.find(r => r.planned_teknokratis_2027 === 1);
const s3 = targetRows.find(r => r.planned_teknokratis_2026 === 1 && r.planned_teknokratis_2027 === 1);

console.log("\nSamples:");
console.log(JSON.stringify(s1, null, 2));
console.log(JSON.stringify(s2, null, 2));
console.log(JSON.stringify(s3, null, 2));

fs.writeFileSync('F:\\WebApps\\1.ml_apps\\public\\data\\target_rows.json', JSON.stringify(targetRows, null, 2), 'utf8');

// Also update rankings.json if needed? The user said "Do not touch rankings generation pipeline yet. Only extend the target truth system and Target Hit page."
// So target_rows.json holds the truth, and loaders.ts injects it into rankings.
