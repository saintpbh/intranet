import pymssql
conn = pymssql.connect(server='127.0.0.1', user='sa', password='Gj-2024!', database='kijang', charset='utf8')
cursor = conn.cursor(as_dict=True)

# 1. VI_MIN_INFO에서 박봉환 조회
cursor.execute("SELECT TOP 5 m.MinisterCode, m.MinisterName, m.CHRNAME, m.NOHNAME, m.DUTYNAME FROM VI_MIN_INFO m WHERE m.MinisterName LIKE '%박봉환%'")
rows = cursor.fetchall()
print("=== VI_MIN_INFO ===")
for r in rows:
    print(r)

# 2. TB_Chr201 이력 조회
if rows:
    code = rows[0]['MinisterCode']
    print(f"\n=== TB_Chr201 history for {code} ===")
    cursor.execute("""
        SELECT r.MinisterCode, c.ChrName, n.NohName, r.ChrCode, r.NohCode,
               d.CodeName as DUTYNAME, r.AppDate, r.TradeDate
        FROM TB_Chr201 r
        LEFT JOIN TB_Chr100 c ON r.ChrCode = c.ChrCode
        LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode
        LEFT JOIN TB_Chr900 d ON d.CodeGubun = '05' AND r.DutyCode = d.Code
        WHERE r.MinisterCode = %s
        ORDER BY r.AppDate DESC
    """, (code,))
    hist = cursor.fetchall()
    for h in hist:
        is_current = not h.get('TradeDate') or str(h.get('TradeDate','')).strip() == ''
        print(f"  ChrCode={h.get('ChrCode','')!r:>10s} ChrName={h.get('ChrName','')!r:>15s} Duty={h.get('DUTYNAME','')!r:>10s} App={h.get('AppDate','')!r:>12s} Trade={h.get('TradeDate','')!r:>12s} is_current={is_current}")

conn.close()
