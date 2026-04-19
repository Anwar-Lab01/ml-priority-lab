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

### 4. Immediate Next Steps (Roadmap)
1.  **[COMPLETED] Update `target_rows.json`**: Ingested authoritative 2026 ground-truth from `Master_report_scenario\historis_rank_alignment_report.xlsx`. Verified 28 unique target roads (19 Tender / 9 PL) across 5 scenarios.
2.  **Update `rankings.json`**: Inject new results (Rerank, PolicyBoost, etc.).
3.  **New Feature**: Build the **Target Capture Comparison** page to compare model performance at Top-35, 70, and 105 thresholds.

---
**Timestamp**: 2026-04-20 05:00
**State**: Production-Hardened (Data Aligned)
