import pymssql, os, sys
sys.stdout.reconfigure(encoding='utf-8')
from dotenv import load_dotenv
load_dotenv(os.path.join('server', '.env'))
conn = pymssql.connect(server=os.getenv('DB_SERVER'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD'), database=os.getenv('DB_NAME'), charset='utf8')
cur = conn.cursor(as_dict=True)

# TB_PEN110 전체 컬럼 확인
cur.execute("SELECT TOP 1 * FROM TB_PEN110 WHERE PenNo = '003288' AND YYMM = '202604'")
row = cur.fetchone()
print('=== TB_PEN110 컬럼 목록 (202604 - 실제 납입된 달) ===')
if row:
    for k, v in row.items():
        val = v.strip() if isinstance(v, str) else v
        print(f'  {k}: {val}')

print('\n')
cur.execute("SELECT TOP 1 * FROM TB_PEN110 WHERE PenNo = '003288' AND YYMM = '202605'")
row2 = cur.fetchone()
print('=== TB_PEN110 컬럼 목록 (202605 - 미래 데이터) ===')
if row2:
    for k, v in row2.items():
        val = v.strip() if isinstance(v, str) else v
        print(f'  {k}: {val}')

# 차이점 분석
if row and row2:
    print('\n=== 두 레코드 차이점 ===')
    for k in row.keys():
        v1 = row[k]
        v2 = row2[k]
        if isinstance(v1, str): v1 = v1.strip()
        if isinstance(v2, str): v2 = v2.strip()
        if v1 != v2:
            print(f'  {k}: 실제={v1} vs 미래={v2}')

conn.close()
