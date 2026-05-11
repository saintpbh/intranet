"""TB_SEN100 추가 분석 - 한글 필드, 연도 범위, InGubun 코드"""
import pymssql

conn = pymssql.connect('192.168.0.145', 'pbh', 'prok3000', 'KJ_CHURCH', charset='cp949')
c = conn.cursor(as_dict=True)

# 1. InGubun 코드 전체 조회
print("=" * 80)
print("1. InGubun (납입 구분) 전체 코드")
print("=" * 80)
c.execute("SELECT DISTINCT InGubun, COUNT(*) AS cnt FROM TB_SEN100 GROUP BY InGubun ORDER BY cnt DESC")
for r in c.fetchall():
    val = r['InGubun'].strip() if r['InGubun'] else ''
    print(f"  '{val}' ({repr(r['InGubun'])}) : {r['cnt']} rows")

# 2. YM 연도 범위
print("\n" + "=" * 80)
print("2. YM(납입 연월) 범위")
print("=" * 80)
c.execute("SELECT MIN(YM) AS min_ym, MAX(YM) AS max_ym FROM TB_SEN100")
r = c.fetchone()
print(f"  최소: {r['min_ym']}  최대: {r['max_ym']}")

# 3. 최근 3년 연도별 건수
print("\n" + "=" * 80)
print("3. 연도별 납입 건수 (최근 10년)")
print("=" * 80)
c.execute("""
    SELECT LEFT(YM, 4) AS yr, COUNT(*) AS cnt, SUM(Amt) AS total_amt,
           COUNT(DISTINCT MinisterCode) AS ministers
    FROM TB_SEN100
    WHERE LEFT(YM, 4) >= '2016'
    GROUP BY LEFT(YM, 4)
    ORDER BY yr DESC
""")
for r in c.fetchall():
    print(f"  {r['yr']}년 : {r['cnt']:,} 건 | 총 {r['total_amt']:,}원 | {r['ministers']}명")

# 4. 특정 목사 예시 - 납입 이력
print("\n" + "=" * 80)
print("4. 목사 납입 이력 예시 (MinisterCode='201673' - 최다 납입자)")
print("=" * 80)
c.execute("""
    SELECT YM, Amt, InGubun, ReceiptDate, RealDate
    FROM TB_SEN100
    WHERE MinisterCode = '201673'
    ORDER BY YM DESC
""")
rows = c.fetchall()
print(f"  총 {len(rows)}건")
for r in rows[:10]:
    print(f"    YM={r['YM']} | 금액={r['Amt']:,}원 | 구분={r['InGubun'].strip()} | 접수={r['ReceiptDate']} | 실납={r['RealDate']}")

# 5. Amt 금액 분포
print("\n" + "=" * 80)
print("5. 납입금액 분포 (상위 10)")
print("=" * 80)
c.execute("SELECT TOP 10 Amt, COUNT(*) AS cnt FROM TB_SEN100 GROUP BY Amt ORDER BY cnt DESC")
for r in c.fetchall():
    print(f"  {r['Amt']:>10,}원 : {r['cnt']:,}건")

# 6. MokGubun 코드 해석
print("\n" + "=" * 80)
print("6. MokGubun (목사 구분) 코드")
print("=" * 80)
c.execute("""
    SELECT s.MokGubun, c.CodeName, COUNT(*) AS cnt
    FROM TB_SEN100 s
    LEFT JOIN TB_Chr900 c ON c.CodeGubun = '03' AND s.MokGubun = c.Code
    GROUP BY s.MokGubun, c.CodeName
    ORDER BY cnt DESC
""")
for r in c.fetchall():
    print(f"  {r['MokGubun']} = {r['CodeName'] or '(없음)'} : {r['cnt']:,}건")

# 7. DutyCode 코드 해석
print("\n" + "=" * 80)
print("7. DutyCode (직분) 코드")
print("=" * 80)
c.execute("""
    SELECT s.DutyCode, c.CodeName, COUNT(*) AS cnt
    FROM TB_SEN100 s
    LEFT JOIN TB_Chr900 c ON c.CodeGubun = '02' AND s.DutyCode = c.Code
    GROUP BY s.DutyCode, c.CodeName
    ORDER BY cnt DESC
""")
for r in c.fetchall():
    print(f"  {r['DutyCode']} = {r['CodeName'] or '(없음)'} : {r['cnt']:,}건")

# 8. 한 사람의 월별 납입 현황 매트릭스 (최근 3년)
print("\n" + "=" * 80)
print("8. 목사 '201673' 최근 3년 월별 납입 요약")
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
        print(f"\n  --- {current_yr}년 ---")
    paid = '✅' if r['amt'] and r['amt'] > 0 else '❌'
    print(f"    {r['mo']}월: {r['amt']:>10,}원 {paid}")

# 9. 미납 확인: 특정 연도에 12개월 미만 납입한 목사 수
print("\n" + "=" * 80)
print("9. 2025년 납입현황 요약")
print("=" * 80)
c.execute("""
    SELECT COUNT(DISTINCT MinisterCode) AS total_ministers,
           SUM(Amt) AS total_amt,
           COUNT(*) AS total_records
    FROM TB_SEN100
    WHERE LEFT(YM, 4) = '2025'
""")
r = c.fetchone()
print(f"  2025년: {r['total_ministers']}명 목사, {r['total_records']:,}건, 총 {r['total_amt']:,}원")

c.execute("""
    SELECT months_paid, COUNT(*) AS minister_count
    FROM (
        SELECT MinisterCode, COUNT(DISTINCT RIGHT(YM, 2)) AS months_paid
        FROM TB_SEN100
        WHERE LEFT(YM, 4) = '2025'
        GROUP BY MinisterCode
    ) sub
    GROUP BY months_paid
    ORDER BY months_paid
""")
for r in c.fetchall():
    print(f"  {r['months_paid']}개월 납입: {r['minister_count']}명")

conn.close()
