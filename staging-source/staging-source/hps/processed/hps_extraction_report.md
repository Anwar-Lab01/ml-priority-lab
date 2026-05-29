# HPS/AHSP Extraction Report

- Raw source copied to: `staging-source/hps/raw/staging_hps.csv`
- Processed CSV: `staging-source/hps/processed/hps_unit_prices_2025.csv`
- Runtime JSON: `public/data/hps_unit_prices.json`
- Raw rows: `698`
- Valid HPS items extracted: `483`

## Skipped Rows by Reason

- `dash_price`: 3
- `division_header`: 11
- `empty_row`: 60
- `missing_price`: 123
- `ref_error`: 1
- `subheading_no_price`: 11
- `table_header`: 6

## Count by Division

- `1 - UMUM`: 37
- `2 - DRAINASE`: 54
- `3 - PEKERJAAN TANAH DAN GEOSINTETIK`: 36
- `4 - PEKERJAAN PREVENTIF`: 40
- `5 - PERKERASAN BERBUTIR`: 26
- `6 - PERKERASAN ASPAL`: 41
- `7 - STRUKTUR`: 174
- `8 - REHABILITASI JEMBATAN`: 36
- `9 - PEKERJAAN HARIAN & PEKERJAAN LAIN-LAIN`: 30
- `10 - PEKERJAAN PEMELIHARAAN KINERJA`: 9

## Count by Unit

- `M1`: 131
- `Set`: 7
- `Orang`: 6
- `Buah`: 80
- `Lembar`: 2
- `Rol`: 1
- `Pasang`: 2
- `M3`: 102
- `Ton`: 40
- `M2`: 45
- `Liter`: 11
- `Kg`: 32
- `None`: 1
- `Buah Jembatan`: 1
- `Jam`: 22

## Count by Item Family

- `general_and_smkk`: 37
- `drainage`: 54
- `earthwork_and_geosynthetic`: 36
- `preventive_maintenance`: 40
- `granular_pavement`: 14
- `concrete_pavement`: 12
- `asphalt_pavement`: 41
- `structure`: 174
- `road_furniture`: 36
- `daily_work`: 30
- `performance_maintenance`: 9

## Sample Items

| hps_id | division | payment_code | uraian | satuan | harga_rp | family |
|---|---|---|---|---:|---:|---|
| hps_0001 | 1 UMUM | 1.20.(1) | Pengeboran, termasuk SPT dan Laporan | M1 | 735878.68 | general_and_smkk |
| hps_0002 | 1 UMUM | 1.20.(2) | Sondir termasuk Laporan | M1 | 463909.01 | general_and_smkk |
| hps_0003 | 1 UMUM | SKh-1.1.22.(1a) | Pembuatan dokumen SMKK (RKK, RMPK, RKPPL, RMLLP) | Set | 550000.0 | general_and_smkk |
| hps_0004 | 1 UMUM | SKh-1.1.22.(1b) | Pembuatan Prosedur dan Instruksi Kerja | Set | 550000.0 | general_and_smkk |
| hps_0005 | 1 UMUM | SKh-1.1.22.(1c) | Penyusunan pelaporan penerapan SMKK | Set | 550000.0 | general_and_smkk |
| hps_0006 | 1 UMUM | SKh-1.1.22.(2a) | Induksi Keselamatan Konstruksi (Safety Induction) | Orang | 100000.0 | general_and_smkk |
| hps_0007 | 1 UMUM | SKh-1.1.22.(2b) | Pengarahan Keselamatan Konstruksi (Safety Briefing) | Orang | 100000.0 | general_and_smkk |
| hps_0008 | 1 UMUM | SKh-1.1.22.(2c) | Pertemuan keselamatan (Safety Talk dan/atau Tool Box Meeting) | Orang | 100000.0 | general_and_smkk |
| hps_0009 | 1 UMUM | SKh-1.1.22.(2g) | Spanduk (banner) | Buah | 350000.0 | general_and_smkk |
| hps_0010 | 1 UMUM | SKh-1.1.22.(2h) | Poster/leaflet | Lembar | 175000.0 | general_and_smkk |
