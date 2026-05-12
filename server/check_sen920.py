import pymssql
conn = pymssql.connect(server='192.168.0.145', user='pbh', password='prok3000', database='KJ_CHURCH', charset='cp949', login_timeout=5, timeout=10)
cursor = conn.cursor(as_dict=True)

# Check TB_Sen920 structure — ministers with non-zero Amt
cursor.execute("SELECT TOP 10 * FROM TB_Sen920 WHERE Amt > 0 ORDER BY udate DESC")
rows = cursor.fetchall()
print("=== TB_Sen920 with Amt > 0 ===")
for r in rows:
    print(r)

# Also check latest payments from TB_SEN100 for minister 205226 to understand the monthly amounts
print("\n=== Latest TB_SEN100 payments for 205226 ===")
cursor.execute("SELECT TOP 5 YM, Amt, InGubun FROM TB_SEN100 WHERE MinisterCode = '205226' ORDER BY YM DESC")
rows2 = cursor.fetchall()
for r in rows2:
    print(r)

# What's the current year monthly amount for 205226?
print("\n=== TB_Sen920 Gubun values ===")
cursor.execute("SELECT DISTINCT Gubun FROM TB_Sen920")
for r in cursor.fetchall():
    print(r)

conn.close()
