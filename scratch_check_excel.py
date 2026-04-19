import pandas as pd
import sys

files = [
    r"F:\2.ML_Project\Demo\4.tanggal_berjalan\Historis_24_Maret\3_Skenario\Master_report_scenario\historis_rank_alignment_report.xlsx",
    r"F:\2.ML_Project\Demo\4.tanggal_berjalan\Historis_24_Maret\3_Skenario\Arsip\Pendukung\historis_rank_alignment_report.xlsx"
]

for file in files:
    print(f"--- Checking {file} ---")
    try:
        xl = pd.ExcelFile(file)
        print(f"Sheets: {xl.sheet_names}")
        for sheet in xl.sheet_names:
            df = xl.parse(sheet)
            cols = [c for c in df.columns if 'planned' in str(c).lower() or '2026' in str(c).lower() or 'target' in str(c).lower()]
            print(f"  Sheet '{sheet}': relevant cols -> {cols}")
            
            # check the total rows, total planned_any_2026 positives, etc if the column exists
            print(f"  Sheet '{sheet}' - Total Rows: {len(df)}")
            if 'planned_any_2026' in df.columns:
                print(f"    planned_any_2026 positives: {df['planned_any_2026'].sum()}")
            if 'planned_tender_2026' in df.columns:
                print(f"    planned_tender_2026 positives: {df['planned_tender_2026'].sum()}")
            if 'planned_pl_2026' in df.columns:
                print(f"    planned_pl_2026 positives: {df['planned_pl_2026'].sum()}")
                
    except Exception as e:
        print(f"Error reading file: {e}")
