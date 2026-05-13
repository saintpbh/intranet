"""TB_SEN100 추가 분석 v3 - 월별 매트릭스 + 미납현황"""
from db_helper import get_connection
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

conn = get_connection()
c = conn.cursor(as_dict=True)

# 1. InGubun 코드 해석 (한글)
print("=" * 80)
print("1. InGubun (납입 구분) 코드 매핑")
print("=" * 80)
c.execute("""
    SELECT DISTINCT InGubun, COUNT(*) AS cnt
    FROM TB_SEN100 GROUP BY InGubun ORDER BY cnt DESC
""")
for r in c.fetchall():
    val = r['InGubun'].strip() if r['InGubun'] else ''
    print(f"  '{val}' : {r['cnt']:,} rows")

# 2. MokGubun + TB_Chr900 JOIN
print("\n" + "=" * 80)
print("2. MokGubun (목사 구분) 코드 매핑")
print("=" * 80)
c.execute("""
    SELECT s.MokGubun, c.CodeName, COUNT(*) AS cnt
    FROM TB_SEN100 s
    LEFT JOIN TB_Chr900 c ON c.CodeGubun = '03' AND RTRIM(s.MokGubun) = RTRIM(c.Code)
    GROUP BY s.MokGubun, c.CodeName
    ORDER BY cnt DESC
""")
for r in c.fetchall():
    name = r['CodeName'] if r['CodeName'] else '(미매핑)'
    print(f"  {r['MokGubun'].strip()} = {name} : {r['cnt']:,}건")

# 3. 목사 월별 납입 매트릭스
print("\n" + "=" * 80)
print("3. 목사 '201673' 최근 3년 월별 납입")
print("=" * 80)
c.execute("""
    SELECT LEFT(YM, 4) AS yr, RIGHT(YM, 2) AS mo, SUM(Amt) AS amt
    FROM TB_SEN100
    WHERE MinisterCode = '201673' AND LEFT(YM, 4) >= '2023'
    GROUP BY LEFT(YM, 4), RIGHT(YM, 2)
    ORDER BY yr, mo
""")
rows = c.fetchall()
current_yr = ''
for r in rows:
    if r['yr'] != current_yr:
        current_yr = r['yr']
        print(f"\n  --- {current_yr} ---")
    paid = 'O' if r['amt'] and r['amt'] > 0 else 'X'
    print(f"    {r['mo']}월: {r['amt']:>10,}원 [{paid}]")

# 4. 2025년 납입현황 요약
print("\n" + "=" * 80)
print("4. 2025년 납입현황 요약")
print("=" * 80)
c.execute("""
    SELECT COUNT(DISTINCT MinisterCode) AS total_ministers,
           SUM(Amt) AS total_amt,
           COUNT(*) AS total_records
    FROM TB_SEN100 WHERE LEFT(YM, 4) = '2025'
""")
r = c.fetchone()
print(f"  2025년: {r['total_ministers']}명 목사, {r['total_records']:,}건, 총 {r['total_amt']:,}원")

c.execute("""
    SELECT months_paid, COUNT(*) AS minister_count
    FROM (
        SELECT MinisterCode, COUNT(DISTINCT RIGHT(YM, 2)) AS months_paid
        FROM TB_SEN100 WHERE LEFT(YM, 4) = '2025'
        GROUP BY MinisterCode
    ) sub
    GROUP BY months_paid ORDER BY months_paid
""")
for r in c.fetchall():
    print(f"  {r['months_paid']}개월 납입: {r['minister_count']}명")

# 5. 2026년 납입현황 요약
print("\n" + "=" * 80)
print("5. 2026년 납입현황 요약")
print("=" * 80)
c.execute("""
    SELECT COUNT(DISTINCT MinisterCode) AS total_ministers,
           SUM(Amt) AS total_amt,
           COUNT(*) AS total_records
    FROM TB_SEN100 WHERE LEFT(YM, 4) = '2026'
""")
r = c.fetchone()
print(f"  2026년: {r['total_ministers']}명 목사, {r['total_records']:,}건, 총 {r['total_amt']:,}원")

c.execute("""
    SELECT months_paid, COUNT(*) AS minister_count
    FROM (
        SELECT MinisterCode, COUNT(DISTINCT RIGHT(YM, 2)) AS months_paid
        FROM TB_SEN100 WHERE LEFT(YM, 4) = '2026'
        GROUP BY MinisterCode
    ) sub
    GROUP BY months_paid ORDER BY months_paid
""")
for r in c.fetchall():
    print(f"  {r['months_paid']}개월 납입: {r['minister_count']}명")

# 6. TB_SEN100 ↔ TB_Chr200(목사) 연결 확인
print("\n" + "=" * 80)
print("6. TB_SEN100 MinisterCode vs TB_Chr200 교차 확인")
print("=" * 80)
c.execute("""
    SELECT 
        (SELECT COUNT(DISTINCT MinisterCode) FROM TB_SEN100) AS sen_ministers,
        (SELECT COUNT(DISTINCT MinisterCode) FROM TB_Chr200) AS chr_ministers,
        (SELECT COUNT(DISTINCT s.MinisterCode) FROM TB_SEN100 s 
         INNER JOIN TB_Chr200 m ON s.MinisterCode = m.MinisterCode) AS matched
""")
r = c.fetchone()
print(f"  TB_SEN100 고유 목사: {r['sen_ministers']}명")
print(f"  TB_Chr200 고유 목사: {r['chr_ministers']}명")
print(f"  양쪽 매칭: {r['matched']}명")

# 7. 현재 MyInfoPage에서 사용할 수 있는 데이터 시나리오
# 로그인한 목사(MinisterCode)로 본인의 생보 납입이력 조회
print("\n" + "=" * 80)
print("7. API 시나리오 테스트: 특정 목사의 생보 납입 현황")
print("=" * 80)
c.execute("""
    SELECT s.YM, s.Amt, s.InGubun, s.ReceiptDate, s.RealDate,
           m.MinisterName, n.NohName, c.ChrName
    FROM TB_SEN100 s
    LEFT JOIN TB_Chr200 m ON s.MinisterCode = m.MinisterCode
    LEFT JOIN TB_Chr910 n ON s.NohCode = n.NohCode
    LEFT JOIN TB_Chr100 c ON s.ChrCode = c.ChrCode
    WHERE s.MinisterCode = '201673'
      AND LEFT(s.YM, 4) = '2025'
    ORDER BY s.YM
""")
rows = c.fetchall()
if rows:
    print(f"  목사: {rows[0]['MinisterName']} | 노회: {rows[0]['NohName']} | 교회: {rows[0]['ChrName']}")
    print(f"  2025년 납입 내역:")
    for r in rows:
        print(f"    {r['YM']} | {r['Amt']:>10,}원 | {r['InGubun'].strip()} | 실납일 {r['RealDate']}")

conn.close()
