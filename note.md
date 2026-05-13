# ML Priority Lab - Development Checkpoint

## Current Status: Stabilized & Audit-Complete
The application has undergone a major identity refactor and data-layer hardening pass. It is now stable, null-safe, and ready for new dataset ingestion.

### 1. Major Refactors Completed
*   **Identity Migration**: Switched from unstable numeric `road_id` to normalized `road_key` (based on `road_name`).
*   **Target Reconciliation**: Implemented a global truth injector in `loaders.ts`. All evaluation pages (Target Hit, Dashboard, etc.) now use ground-truth flags from `target_rows.json` regardless of scenario origin.
*   **Canonical Model Joins**: Implemented `getModelKey()` and `getShapKey()` to normalize model names (e.g., `XGBoost` vs `xgboost`), preventing silent SHAP chart failures.

### 2. UI/UX Enhancements
*   **Ranking Transition**: Added "Top-K Retention" KPI box to visualize how many roads stay in the Top-K subset between scenario shifts.
*   **Debugging Hardening**: Added explicit `console.warn` alerts in DEV mode for missing road names, incomplete SHAP keys, or model casing inconsistencies.
*   **Stability**: Patched runtime crashes in *Ranking Compare* and *Road Inspector* caused by stale hook dependencies.

### 3. Documentation (Artifacts)
*   [**Data Flow Audit**](file:///C:/Users/Windows%2010/.gemini/antigravity/brain/6e11e182-88be-4304-aa93-3bdfb26210ce/data_flow_audit.md): Complete map of JSON schemas, joining logic, and page dependencies.
*   [**Implementation Plan**](file:///C:/Users/Windows%2010/.gemini/antigravity/brain/6e11e182-88be-4304-aa93-3bdfb26210ce/implementation_plan.md): Archive of the migration strategy.
*   [**Data Identity Rules**](file:///f:/WebApps/1.ml_apps/DATA_IDENTITY_RULES.md): Guardrails for road identity logic and target truth, updated with the **Map Explorer Spatial Identity Rule**.

### 4. Immediate Next Steps (Roadmap)
1.  **[COMPLETED] Update `target_rows.json`**: Ingested authoritative 2026 ground-truth from `Master_report_scenario\historis_rank_alignment_report.xlsx`. Verified 28 unique target roads (19 Tender / 9 PL) across 5 scenarios.
2.  **Update `rankings.json`**: Inject new results (Rerank, PolicyBoost, etc.).
3.  **New Feature**: Build the **Target Capture Comparison** page to compare model performance at Top-35, 70, and 105 thresholds.

---
**Timestamp**: 2026-04-20 05:00
**State**: Production-Hardened (Data Aligned)


## DD2 Rule Engine Integration Checkpoint

**Status:** Rule v0.1 classification + DD2 read-only inspection completed  
**Last Updated:** 2026-05-10  
**Initial Conversation:** 317d1bbd-45a1-41c1-b4ae-aef007f9abc3

### Completed

- Verified `staging-source/dd2/` structure:
  - `raw/`
  - `processed/`
  - `audit/`
- Created DD2 identity audit workflow using `dd2_identity_audit.cjs`.
- Resolved six duplicate-sensitive DD2 rows using occurrence/context-specific mapping:
  - `Jl. Mawar` (2 roads)
  - `Jl. Musyawarah` (2 roads)
  - `Jl. Sekolah Islam` (2 roads)
- Generated verified runtime DD2 file:
  - `public/data/dd2_road_features.json`
- Verified runtime DD2 output:
  - total records: `350`
  - unique road keys: `350`
  - unmatched: `0`
  - ambiguous: `0`
- Integrated DD2 into `TreatmentEnginePage.tsx` in read-only mode.
- Added:
  - DD2 summary cards
  - interactive geometry map with condition-based highlighting
  - searchable road table with full pagination (25/50/100/350)
  - road detail panel with Rule v0.1 classification display
- Implemented **Rule v0.1** read-only classification:
  - Categories: Pemeliharaan Rutin, Pemeliharaan Berkala, Rehabilitasi, Rekonstruksi, Peningkatan / Pengaspalan, Data Tidak Cukup
  - Summary dashboard cards with live category counts
  - Rule reason and confidence displayed in map popup and table
  - Classification is indicative only — does not represent final DED/RAB
- **Condition Highlight system** on map:
  - Toggle-enabled threshold filtering by DD2 fields
  - Fields: `non_mantap_pct`, `kondisi_rusak_berat_pct`, `kondisi_rusak_ringan_pct`, `kondisi_sedang_pct`, `kondisi_baik_pct`
  - Configurable operator (`>=` / `<=`) and threshold value
  - Visual: highlighted roads in red, muted roads in slate, selection always takes precedence
  - Live summary count and percentage of highlighted roads
- **Fixed DD2 map popup lookup mismatch (sungai ↔ sei):**
  - Root cause: DD2 pipeline normalized "Sungai" → "Sei" in `road_key`, but `getMapExplorerRoadKey()` preserves full "Sungai"
  - Fix: `dd2Map` now uses dual-key index (primary DD2 key + secondary Map Explorer key)
  - 38 roads affected, 43 secondary keys added, 0 collisions
  - See `DATA_IDENTITY_RULES.md` Rule 10 for full details and guardrails
- Build verified with `npm run build`.

### Safety Confirmation

No changes were made to:

- ML training scripts
- model outputs
- ranking order
- `rankings.json`
- `target_rows.json`
- `model_metrics.json`
- `dd2_road_features.json` (public/data unchanged)
- Map Explorer matcher logic (`mapExplorerMatching.ts`)
- existing ML evaluation pages

### Current Boundary

The Treatment Engine currently supports **DD2 read-only inspection** and **Rule v0.1 indicative classification**.

Not yet implemented:

- ASB price table integration
- indicative cost estimation
- budget simulation
- funded/backlog allocation

### Next Recommended Step

Connect **ASB price table** and implement indicative cost estimation.

No ASB costing should be added until the user explicitly requests it.