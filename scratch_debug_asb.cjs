// Simulate what the browser does
const fs = require('fs');
const path = require('path');

// 1. Load the same way the component does
const asbItemsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public/data/asb_unit_prices.json'), 'utf8'));
const asbRulesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public/data/asb_budget_package_rules.json'), 'utf8'));
const dd2Data = JSON.parse(fs.readFileSync(path.join(__dirname, 'public/data/dd2_road_features.json'), 'utf8'));

console.log('asbItemsData truthy?', !!asbItemsData);
console.log('asbRulesData truthy?', !!asbRulesData);
console.log('asbItemsData.items length:', (asbItemsData.items || []).length);
console.log('asbRulesData.selection_rules length:', (asbRulesData.selection_rules || []).length);

// Find Pangeran Antasari - Loklua
const roads = dd2Data.roads || [];
const target = roads.find(r => (r.canonical_road_name || '').includes('Pangeran Antasari'));
if (target) {
    console.log('\n--- Target Road: Pangeran Antasari - Loklua ---');
    console.log('panjang_ruas_km:', target.panjang_ruas_km);
    console.log('lebar_ruas_m:', target.lebar_ruas_m);
    console.log('non_mantap_pct:', target.non_mantap_pct, typeof target.non_mantap_pct);
    console.log('kondisi_rusak_berat_pct:', target.kondisi_rusak_berat_pct, typeof target.kondisi_rusak_berat_pct);
    console.log('perkerasan_tanah_belum_tembus_km:', target.perkerasan_tanah_belum_tembus_km);
    console.log('perkerasan_telford_kerikil_km:', target.perkerasan_telford_kerikil_km);

    // Compute exactly as the function does  
    const unpaved_pct = ((target.perkerasan_tanah_belum_tembus_km || 0) + (target.perkerasan_telford_kerikil_km || 0)) / target.panjang_ruas_km * 100;
    const non_mantap_pct = target.non_mantap_pct ?? ((target.kondisi_rusak_ringan_pct || 0) + (target.kondisi_rusak_berat_pct || 0));
    const rusak_berat_pct = target.kondisi_rusak_berat_pct ?? 0;
    
    console.log('\nComputed values:');
    console.log('unpaved_pct:', unpaved_pct);
    console.log('non_mantap_pct:', non_mantap_pct);
    console.log('rusak_berat_pct:', rusak_berat_pct);
    
    // Check which rule matches
    const rules = asbRulesData.selection_rules;
    for (const r of rules) {
        let match = false;
        if (r.rule_id === 'R01') match = unpaved_pct >= 50 || (non_mantap_pct >= 40 && rusak_berat_pct >= 20);
        else if (r.rule_id === 'R02') match = non_mantap_pct >= 40;
        else if (r.rule_id === 'R03') match = non_mantap_pct >= 25 && rusak_berat_pct >= 10;
        else if (r.rule_id === 'R04') match = non_mantap_pct >= 25 && rusak_berat_pct < 10;
        else if (r.rule_id === 'R05') match = non_mantap_pct >= 10 && non_mantap_pct < 25;
        else if (r.rule_id === 'R06') match = non_mantap_pct < 10;
        console.log(`  ${r.rule_id} (${r.label}): ${match ? 'MATCH' : 'no'}`);
        if (match) {
            console.log(`\n  >>> Selected: ${r.rule_id} -> profile: ${r.selected_profile}`);
            
            const asbType = asbRulesData.structural_profiles[r.selected_profile].asb_type;
            console.log('  ASB Type:', asbType);
            
            const candidates = asbItemsData.items.filter(i => {
                const m = (i.uraian || '').match(/Jalan Tipe ([A-Z])/i);
                return m && m[1].toUpperCase() === asbType;
            });
            console.log('  Candidates count:', candidates.length);
            if (candidates.length > 0) {
                console.log('  First candidate:', candidates[0].uraian, '|', candidates[0].spesifikasi, '| width:', candidates[0].width_m, '| harga:', candidates[0].harga_rp);
            }
            break;
        }
    }
} else {
    console.log('Target road not found!');
    console.log('First 5 canonical names:', roads.slice(0,5).map(r => r.canonical_road_name));
}
