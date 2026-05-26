import pandas as pd
import sqlite3
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

EXCEL_PATH = r"C:\Users\User\OneDrive - 한국기독교장로회총회유지재단\1. 문서\카카오톡 받은 파일\기장교회선교주일가상계좌.xlsx"
DB_PATH = "server/requests.db"

def main():
    print("=== [1] Checking Excel for '총회' or '본부' ===")
    if os.path.exists(EXCEL_PATH):
        df = pd.read_excel(EXCEL_PATH)
        header_row = df.iloc[0]
        df_data = df.iloc[1:].copy()
        df_data.columns = header_row
        
        matches = df_data[df_data["교회명"].astype(str).str.contains("총회|본부", na=False)]
        print(f"Matches in Excel (Count: {len(matches)}):")
        print(matches.to_string())
    else:
        print("Excel not found locally.")

    print("\n=== [2] Checking requests.db local_churches for '총회' or '본부' ===")
    if os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT ChrCode, CHRNAME FROM local_churches WHERE CHRNAME LIKE '%총회%' OR CHRNAME LIKE '%본부%'")
        rows = c.fetchall()
        print(f"Matches in local_churches (Count: {len(rows)}):")
        for r in rows:
            print(r)
        
        # Check church_virtual_accounts too
        c.execute("SELECT * FROM church_virtual_accounts WHERE chr_code IN (SELECT ChrCode FROM local_churches WHERE CHRNAME LIKE '%총회%' OR CHRNAME LIKE '%본부%')")
        va_rows = c.fetchall()
        print(f"Matches in church_virtual_accounts (Count: {len(va_rows)}):")
        for vr in va_rows:
            print(vr)
            
        conn.close()
    else:
        print("requests.db not found locally.")

if __name__ == "__main__":
    main()
