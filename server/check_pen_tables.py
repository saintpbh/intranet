"""Final check: TB_PEN350, TB_PEN904(DefaultPay), birth from TB_Chr200"""
import pymssql, os, sys
sys.stdout.reconfigure(encoding='utf-8')
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

conn = pymssql.connect(
    server=os.getenv("DB_SERVER", "192.168.0.145"),
    port=int(os.getenv("DB_PORT", "1433")),
    user=os.getenv("DB_USER", "pbh"),
    password=os.getenv("DB_PASSWORD", "prok3000"),
    database=os.getenv("DB_DATABASE", "KJ_CHURCH"),
    charset='cp949', login_timeout=5, timeout=10
)
cur = conn.cursor(as_dict=True)

# Check TB_Chr200 columns for birth info
cur.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='TB_Chr200' AND COLUMN_NAME LIKE '%irth%' OR (TABLE_NAME='TB_Chr200' AND COLUMN_NAME LIKE '%Birth%')")
print("TB_Chr200 birth columns:", [r['COLUMN_NAME'] for r in cur.fetchall()])

# Check full TB_Chr200 column list
cur.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='TB_Chr200' ORDER BY ORDINAL_POSITION")
print("\nTB_Chr200 ALL columns:", [r['COLUMN_NAME'] for r in cur.fetchall()])

# Sample TB_Chr200 row
cur.execute("SELECT TOP 1 MinisterCode, MinisterName, BirthDay FROM TB_Chr200 WHERE MinisterCode='003288'")
row = cur.fetchone()
print(f"\nTB_Chr200 sample (003288): {row}")

# Check MemberCode in TB_PEN100 - is it same as MinisterCode?
cur.execute("SELECT TOP 1 PenNo, MemberCode FROM TB_PEN100 WHERE MemberCode='003288'")
row2 = cur.fetchone()
print(f"TB_PEN100 for MemberCode=003288: {row2}")

# If not found, try different lookup
if not row2:
    cur.execute("SELECT TOP 5 PenNo, MemberCode, MemberName FROM TB_PEN100 WHERE MemberCode LIKE '2%' AND (EndDate='' OR EndDate IS NULL)")
    rows = cur.fetchall()
    print("TB_PEN100 sample (active):")
    for r in rows:
        print(f"  PenNo={r['PenNo'].strip()}, MemberCode={r['MemberCode'].strip()}, Name={r['MemberName'].strip()}")

# Check TB_PEN350 for PenNo 003288
cur.execute("SELECT PenNo, Lev1_Cnt, Lev2_Cnt, Lev3_Cnt, Lev4_Cnt, Amt, RetirementAge FROM TB_PEN350 WHERE PenNo='003288'")
row3 = cur.fetchone()
print(f"\nTB_PEN350 for PenNo=003288: {row3}")

# Check latest TB_PEN904 (current year base salary)
cur.execute("SELECT TOP 1 YY, DefaultPay FROM TB_PEN904 ORDER BY YY DESC")
row4 = cur.fetchone()
print(f"\nLatest TB_PEN904 (base salary): YY={row4['YY'].strip()}, DefaultPay={row4['DefaultPay']}")

# TB_MEM101 columns
cur.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='TB_MEM101' ORDER BY ORDINAL_POSITION")
print("\nTB_MEM101 columns:", [r['COLUMN_NAME'] for r in cur.fetchall()])

# TB_MEM101 sample 
cur.execute("SELECT TOP 3 * FROM TB_MEM101")
for r in cur.fetchall():
    print({k: (v.strip() if isinstance(v, str) else v) for k, v in r.items()})

conn.close()
print("\nDone.")
