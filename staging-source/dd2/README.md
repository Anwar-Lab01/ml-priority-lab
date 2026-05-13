# DD2 / FormDD Staging Source

This folder contains staging data extracted from DD2/FormDD worksheets.
**Data here is NOT published to `public/data/` and is NOT loaded at runtime.**

## Folder Structure

### `raw/`
Untouched, original FormDD source spreadsheets as received.
These files must never be modified — treat them as immutable source-of-truth inputs.

Current contents:
- `FormDD1-2025.xlsx` — DD-1 form for fiscal year 2025

### `processed/`
Extracted CSV staging outputs derived from raw FormDD worksheets.
These are intermediate artefacts for inspection and identity resolution.

Current contents:
- `dd2_roads_2025_clean.csv` — Cleaned road segment rows (350 roads expected)
- `dd2_referensi_extracted_raw.csv` — Raw extraction from `Referensi` sheet

### `audit/`
Extraction and identity audit reports.
Generated during ingestion to verify data quality and canonical identity alignment.

Current contents:
- `dd2_extraction_summary.json` — Row counts, sheet metadata, and extraction notes

## Data Flow

```
raw/FormDD1-2025.xlsx
  ↓  extraction script
processed/dd2_roads_2025_clean.csv
processed/dd2_referensi_extracted_raw.csv
  ↓  identity audit
audit/dd2_extraction_summary.json
  ↓  canonical identity resolution (pending)
  ↓  verified only
public/data/dd2_road_features.json  ← NOT YET CREATED
```

`public/data/` receives **only verified runtime JSON** after identity audit confirms
alignment with the canonical 350-road universe using `nama_ruas_norm` / `road_key`
identity rules defined in `DATA_IDENTITY_RULES.md`.

## Identity Rules

All identity resolution must follow `DATA_IDENTITY_RULES.md`:
- Logical road universe = **350**
- Do NOT use `road_id` as cross-scenario identity
- Use canonical `nama_ruas_norm` / `road_key` identity
- Preserve existing alias rules and Map Explorer spatial identity rules

## Current Status

- [x] Raw FormDD source preserved
- [x] CSV extraction completed (350 rows)
- [x] Extraction summary audit generated
- [ ] Canonical identity resolution against 350-road universe
- [ ] Generation of `dd2_road_features.json`
- [ ] ASB price table connection
- [ ] Publication to `public/data/`
