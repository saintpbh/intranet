import sys
sys.path.append('./server')
from main import get_connection

conn = get_connection()
cursor = conn.cursor(as_dict=True)

# ChrCode가 없거나 TB_Chr100 테이블에 존재하지 않는 사역이력 조회
query = """
    SELECT TOP 10 
        r.*
    FROM TB_Chr201 r
    LEFT JOIN TB_Chr100 c ON r.ChrCode = c.ChrCode
    WHERE r.ChrCode IS NULL OR RTRIM(ISNULL(r.ChrCode, '')) = '' OR c.ChrCode IS NULL
"""
cursor.execute(query)
rows = cursor.fetchall()
for row in rows:
    print(row)

conn.close()
