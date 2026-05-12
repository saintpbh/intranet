import pymssql
conn = pymssql.connect(server='192.168.0.145', user='pbh', password='prok3000', database='KJ_CHURCH', charset='cp949', login_timeout=5, timeout=10)
cursor = conn.cursor(as_dict=True)

# Find 구름산교회 directly
search = '%구름산%'.encode('cp949')
cursor.execute("SELECT * FROM TB_Chr100 WHERE ChrName LIKE %s", (search,))
rows = cursor.fetchall()
print(f"Found {len(rows)} churches matching '구름산'")
for church in rows:
    print("\n=== ALL TB_Chr100 FIELDS ===")
    for k, v in church.items():
        val = str(v).strip() if v else ''
        print(f"  {k}: [{val}]")

# Also check what's in TB_Chr200 columns
print("\n=== TB_Chr200 columns (sample) ===")
cursor.execute("SELECT TOP 1 * FROM TB_Chr200")
row = cursor.fetchone()
if row:
    for k in row.keys():
        print(f"  {k}")

# Check ministers at this church
print("\n=== VI_MIN_INFO for 구름산 ===")
cursor.execute("SELECT MinisterCode, MinisterName, ChrCode, CHRNAME, NOHNAME, DUTYNAME FROM VI_MIN_INFO WHERE CHRNAME LIKE %s", (search,))
for r in cursor.fetchall():
    print(f"  {r}")

conn.close()
