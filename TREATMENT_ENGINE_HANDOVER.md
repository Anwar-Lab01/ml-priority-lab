# Treatment Engine Handover

## Current Treatment Engine State

The Treatment Engine currently reflects the following completed flow:

1. Input DD1 / FormDD1 road-condition data
2. Load and validate data
3. Analyze road condition per road using `unpaved_pct`, `non_mantap_pct`, and `rusak_berat_pct`
4. Classify treatment package Type A/B/C/D/NONE
5. Select ASB package
6. Calculate pagu indikatif
7. Compare/detail with HPS/AHSP
8. Add selected road to planning scenario
9. Preview funded/deferred based on budget cap

## Completed Phases

- Phase 5: Planning Scenario Layer
- Phase 5B: Scenario UX Refinement
- Phase 5C: Scenario Management Polish
- Phase 6A: Read-only Historical Treatment Context
- Phase 6B: Read-only Scenario Kecamatan Summary

## Historical Treatment Context

- Runtime file: `public/data/treatment_history_by_road_key.json`
- Audit/source folder: `staging-source/historis/`
- Identity method: `normalized_canonical_name_bridge`
- Validation: matched `road_key` `350/350`, exact matches `76`, normalized bridge matches `274`, missing `0`, extra `0`, duplicate `0`
- Read-only only
- `planned_2026/2027` fields are not treated as historical realization unless source metadata explicitly confirms that meaning

## Scenario Kecamatan Summary

- Based on `kecamatan_dilalui`
- Read-only metadata only
- Not an editable prioritization input
- Wording should use `kelompok/lintasan kecamatan` when discussing grouped corridor values

## Guardrails

- ASB pagu indikatif remains the canonical budget source
- HPS/AHSP is comparison/detail only
- Use `road_key` as the canonical cross-dataset identity
- Do not use `road_id` for cross-dataset identity
- ML Priority Score remains outside Treatment Engine
- Constrained Multi-Objective Optimization is not implemented yet
- Kecamatan linkage and spatial equity are not yet implemented as optimization inputs

## Utilities

- `ScenarioPanel` includes budget cap preview, funded/deferred preview, Sync ASB Snapshot, Export Scenario JSON, and Clear Scenario utilities
- Those utilities are outside the academic conceptual flow

## Next Recommended Phases

- Phase 6D: UI polish / QA hardening, optional
- Phase 7A: Optimization readiness audit, not implementation
- Phase 7B: Constrained Multi-Objective Optimization prototype, only after the data objective contract is agreed
