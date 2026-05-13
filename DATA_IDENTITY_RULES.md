# DATA_IDENTITY_RULES

Purpose: this file is a guardrail so future agents do not accidentally change the road identity logic, target truth logic, or final workbook source assumptions.

## Locked Decisions

### 1. Deprecated Legacy Workbook Family
Do NOT use legacy `master_report_*` workbooks as the final thesis source.

These are deprecated / legacy POC sources:

- `master_report_originall.xlsx`
- `master_report_Tender_only.xlsx`
- `master_report_weighted_tender_tw2_pl1_neg1.xlsx`
- `master_report_weighted_tender_tw3_pl1_neg1.xlsx`
- `master_report_weighted_tender_tw5_pl1_neg1.xlsx`

### 2. Active Final Workbook Family
The final refined / rerank workbooks are the active source family:

- `ml_murni_refined_comprehensive_20260417_201703.xlsx`
- `recall_maximizer_any2026_policyboost.xlsx`
- `report_rerank_refined_planned_any_2026_20260417_211301.xlsx`
- `report_planned_teknokratis_2026.xlsx`
- `report_rerank_refined_planned_teknokratis_2026_20260422_215256.xlsx`
- `report_rerank_refined_planned_tender_2026_20260417_212741.xlsx`

`recall_case_analysis_any2026_v3.xlsx` is analysis-only and must not be treated as a primary rankings source.

### 3. Road Identity Rule
The logical road universe is `350` roads.

Do NOT use `road_id` as cross-scenario identity.

Use canonical road identity based on the refined 350-road universe.

The inflated count `519` is caused by road-name variants and must be resolved through canonical alias mapping.

### 4. Canonical Fallback Source
Use `ml_murni_refined_comprehensive_20260417_201703.xlsx`, sheet `ranking_horizon_2026`, field `nama_ruas_norm`, as the canonical 350-road fallback if the original refined dataset is unavailable.

### 5. Verified Alias Mapping Decisions
The following identity decisions are already verified and must be preserved:

- `Tamiyang - Ds. Tamiyang (Eks TMMD)` is the same road and must map to the canonical Tamiyang road.
- `Bangga TMMD` must map to canonical `Bangga`.
  `TMMD` is a project suffix, not part of the road identity.
- `Jl.` prefix must not create a new road identity.
- `Ds.` / `Desa` variants must not create new road identities.
- slash, parentheses, dash, and punctuation variants must not create new road identities if the canonical road meaning is the same.

### 6. Map Explorer Spatial Identity Rule
The spatial road matching in Map Explorer has been audited and fixed in the frontend matcher only. No ML scripts, ranking outputs, metrics, target truth, or model outputs were changed.

#### Final Default Overlay Diagnostics
- **Scenario:** `normatif_20`
- **Model:** `DecisionTree`
- **Total Visible:** 350
- **Matched Base:** 350
- **Direct:** 289
- **Alias:** 48
- **Manual verified alias:** 7
- **Ref-specific manual alias:** 6
- **Matched Name:** 0
- **Unmatched:** 0
- **Ambiguous:** 0

#### Matcher Guardrails
- **No Fuzzy Auto-Matching:** Do not use fuzzy string/auto-matching algorithms for spatial association.
- **No Aggressive Normalization:** Do not loosen string normalization aggressively.
- **No Name-Only Fallback as Truth:** Do not use `matched_name` as the main source of truth.
- **No Name-Only Aliases for Duplicate Roads:** Do not create name-only aliases for highly duplicate-sensitive road names like *Jl. Mawar*, *Jl. Musyawarah*, or *Jl. Sekolah Islam*.
- **Preserve Ambiguity Protection:** Ensure the matching engine continues to identify and protect duplicate-sensitive paths under `ambiguous` rather than forcing inaccurate matches.
- **Preserve Current Matcher Behavior:** Keep the current matcher logic in `mapExplorerMatching.ts` intact.
- **No Script or Model Output Mutations:** Do not modify ML scripts, rankings, target truth, metrics, or model outputs.

#### Ref-Specific Alias Decisions
The final six duplicate-sensitive roads were resolved using ref/road_id-specific aliases, not name-only aliases:
- `ruas_035` / `Jl. Mawar` &rarr; `Mawar (Kandangan Utara)`
- `ruas_038` / `Jl. Musyawarah` &rarr; `Musyawarah (Kandangan)`
- `ruas_083` / `Jl. Sekolah Islam` &rarr; `Sekolah Islam (Kandangan Barat)`
- `ruas_129` / `Jl. Mawar` &rarr; `Mawar (Daha Selatan)`
- `ruas_139` / `Jl. Sekolah Islam` &rarr; `Sekolah Islam (Sungai Pinang)`
- `ruas_196` / `Jl. Musyawarah` &rarr; `Musyawarah (Nagara)`

### 10. DD2 Treatment Engine Normalization Gap (sungai ↔ sei)
The DD2 identity audit pipeline (`dd2_identity_audit.cjs`) normalizes "Sungai" → "Sei" when generating `road_key` values in `dd2_road_features.json`. However, the shared frontend normalizer (`normalizeRoadIdentity` in `utils.ts`) does **not** perform this conversion — it only standardizes pre-existing "sei" tokens.

This creates a systematic key mismatch for 38 roads when the Treatment Engine popup resolver computes a lookup key from the map geometry's `road_name`.

#### Example
| Source | Key |
|---|---|
| Map geometry `road_name` | `Sungai Raya Selatan - Malutu - Goa Berangin` |
| `getMapExplorerRoadKey()` result | `sungai raya selatan - malutu - goa berangin` |
| DD2 `road_key` | `sei raya selatan - malutu - goa berangin` |

#### Fix (2026-05-10)
`TreatmentEnginePage.tsx` builds `dd2Map` with a **dual-key index**:
1. **Primary key:** DD2's native `road_key` (may use "sei" abbreviation).
2. **Secondary key:** `getMapExplorerRoadKey(canonical_road_name)` (preserves full "sungai").

Validated metrics after fix:
- Primary keys: 350
- Secondary keys: 43
- Total dd2Map entries: 393
- Multi-entry (collision) buckets: 0
- All 6 duplicate-sensitive roads still resolve correctly via ref-alias

#### Guardrails
- Do **not** remove the secondary DD2 lookup index unless DD2 and Map Explorer normalization are fully unified and the 350-road identity audit is rerun.
- Do **not** modify the global `normalizeRoadIdentity()` in `utils.ts` to add `sungai → sei` unless the full 350-road identity audit (rankings, targets, Map Explorer, DD2) is revalidated.
- Do **not** modify `dd2_road_features.json` to change road_key values unless the upstream DD2 identity audit script is also updated.

### 7. Target Truth Rule
`target_rows.json` is the authoritative target truth source and must not be regenerated casually.

Expected target counts:

- `planned_any_2026 = 28`
- `planned_tender_2026 = 19`
- `planned_pl_2026 = 9`
- `planned_teknokratis_2026 = 46`
- `planned_teknokratis_2027 = 33`

### 8. Target Hit Expected Results After Identity Fix
For `planned_teknokratis_2026`:

Baseline ML:

- `Top-35 = 11 / 46`
- `Top-70 = 22 / 46`
- `Top-105 = 25 / 46`

Rerank:

- `Top-35 = 16 / 46`
- `Top-70 = 25 / 46`
- `Top-105 = 30 / 46`

### 9. Implementation Guardrails
Do not:

- modify model scores
- modify ranking order
- retrain models
- regenerate target truth unless explicitly requested

Only fix the identity / canonical mapping layer.

Any change must first output a validation report containing:

- unique roads before / after
- target counts
- Target Hit before / after
- number of alias mappings applied

## Current Next Step
`road_alias_map.json` and canonical identity resolution are implemented and verified at 350 unique roads.

Next priority: Connect **ASB price table** and implement **indicative treatment cost estimation** in the Treatment Engine (pending user request). Rule v0.1 classification and DD2 read-only inspection are complete.


## DD2 Segment Damage Layer

Treatment Engine now includes a prototype segment-level damage visualization layer based on verified DD2/STA data.

### Verified Segment Runtime Data

- Runtime file: `public/data/dd2_damage_segments.json`
- Source staging folder: `staging-source/dd2-segments/`
- Total segment records: `7,487`
- Unique road keys: `350`
- Missing identifiers: `0`
- Ambiguous matches: `0`

### Visualization Method

Segment geometry is not stored as independent surveyed geometry. Instead, each segment is projected at runtime along the existing master road polyline using STA proportions:

- `sta_start_m`
- `sta_end_m`
- cumulative master polyline length

This means the Segment Damage Layer is an indicative visualization of segment-level DD2 condition along the road geometry, not a replacement for field-surveyed segment geometry.

### Guardrails

- Do not mutate Map Explorer geometry.
- Do not modify Map Explorer matcher.
- Do not modify ML rankings, targets, metrics, or model outputs.
- Do not treat segment projection as exact engineering geometry.
- Any future improvement to segment geometry must be separately audited.