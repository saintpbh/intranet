"""TB_SEN100 테이블 분석 스크립트"""
import pymssql
import json

conn = pymssql.connect('192.168.0.145', 'pbh', 'prok3000', 'KJ_CHURCH', charset='cp949')
c = conn.cursor(as_dict=True)

# 1. 컬럼 스키마 조회
print("=" * 80)
print("1. TB_SEN100 테이블 스키마")
print("=" * 80)
c.execute("""
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'TB_SEN100'
    ORDER BY ORDINAL_POSITION
""")
columns = c.fetchall()
for col in columns:
    print(f"  {col['COLUMN_NAME']:30s} | {col['DATA_TYPE']:15s} | len={col['CHARACTER_MAXIMUM_LENGTH']} | nullable={col['IS_NULLABLE']}")

# 2. 총 행 수
print("\n" + "=" * 80)
print("2. 총 레코드 수")
print("=" * 80)
c.execute("SELECT COUNT(*) AS cnt FROM TB_SEN100")
print(f"  Total rows: {c.fetchone()['cnt']}")

# 3. 샘플 데이터 5건
print("\n" + "=" * 80)
print("3. 샘플 데이터 (TOP 5)")
print("=" * 80)
c.execute("SELECT TOP 5 * FROM TB_SEN100")
rows = c.fetchall()
for i, row in enumerate(rows):
    print(f"\n  --- Row {i+1} ---")
    for k, v in row.items():
        print(f"    {k:30s} = {repr(v)}")

# 4. MinisterCode 또는 유사한 코드 컬럼의 고유값 수
print("\n" + "=" * 80)
print("4. 주요 컬럼별 고유값 수")
print("=" * 80)
for col in columns:
    cname = col['COLUMN_NAME']
    try:
        c.execute(f"SELECT COUNT(DISTINCT [{cname}]) AS cnt FROM TB_SEN100")
        cnt = c.fetchone()['cnt']
        print(f"  {cname:30s} : {cnt} distinct values")
    except:
        print(f"  {cname:30s} : (error)")

# 5. 납입연도/월 분포 확인 (추정 컬럼)
print("\n" + "=" * 80)
print("5. 추가 분석: 컬럼값 샘플 (상위 5개 고유값)")
print("=" * 80)
for col in columns:
    cname = col['COLUMN_NAME']
    try:
        c.execute(f"SELECT TOP 5 [{cname}], COUNT(*) AS cnt FROM TB_SEN100 GROUP BY [{cname}] ORDER BY cnt DESC")
        vals = c.fetchall()
        print(f"  {cname}: {vals}")
    except Exception as e:
        print(f"  {cname}: error - {e}")

conn.close()
