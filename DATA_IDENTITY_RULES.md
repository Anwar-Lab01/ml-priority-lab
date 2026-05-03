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

### 6. Target Truth Rule
`target_rows.json` is the authoritative target truth source and must not be regenerated casually.

Expected target counts:

- `planned_any_2026 = 28`
- `planned_tender_2026 = 19`
- `planned_pl_2026 = 9`
- `planned_teknokratis_2026 = 46`
- `planned_teknokratis_2027 = 33`

### 7. Target Hit Expected Results After Identity Fix
For `planned_teknokratis_2026`:

Baseline ML:

- `Top-35 = 11 / 46`
- `Top-70 = 22 / 46`
- `Top-105 = 25 / 46`

Rerank:

- `Top-35 = 16 / 46`
- `Top-70 = 25 / 46`
- `Top-105 = 30 / 46`

### 8. Implementation Guardrails
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
Implement `public/data/road_alias_map.json` and update loader identity resolution so current unique road count becomes exactly `350` and Target Hit matches validated workbook results.
