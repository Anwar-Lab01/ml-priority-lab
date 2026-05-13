# DD2 Segment-Level Staging Package

Source: `SIPDJDC_63_06(format_jaju).xlsx`

This package contains cleaned segment-level road condition data extracted from the `Master` sheet and summary comparison from the `Summary` sheet.

## Structure

- `raw/` keeps the original Excel file untouched.
- `processed/` contains extracted CSV files for review and downstream audit.
- `audit/` contains validation and extraction reports.

## Key outputs

- `processed/dd2_segments_2025_clean.csv`: clean segment-level table.
- `processed/dd2_segments_2025_road_aggregate.csv`: road-level aggregate derived from segment rows.
- `audit/dd2_segments_extraction_summary.json`: extraction summary.
- `audit/dd2_segments_validation_issues.csv`: row-level validation issues.
- `audit/dd2_segments_sta_gap_overlap.csv`: STA gap/overlap checks.
- `audit/dd2_segments_summary_compare.csv`: compares Master-derived aggregates to the Summary sheet.

## Extraction summary

- Master segment rows: `7487`
- Summary rows: `351`
- Unique nomor ruas: `350`
- Unique nama ruas raw: `350`
- Unique nomor+nama pairs: `350`
- Validation issues: `0`
- STA gap/overlap issues: `0`
- Summary compare mismatches: `1`

## Duplicate-sensitive guardrail

Do not resolve these names by name-only matching if they appear duplicated:

- `Jl. Mawar`
- `Jl. Musyawarah`
- `Jl. Sekolah Islam`

Use nomor ruas / geometry ref / occurrence-specific context.
