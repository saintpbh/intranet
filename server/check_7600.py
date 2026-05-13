from db_helper import get_connection

conn = get_connection()
cursor = conn.cursor(as_dict=True)
cursor.execute("SELECT MinisterCode, MinisterName FROM VI_MIN_INFO WHERE MinisterCode BETWEEN %s AND %s ORDER BY MinisterCode", ('7600', '7700'))
rows = cursor.fetchall()
print(f"Total rows in 7600-7700: {len(rows)}")
for r in rows:
    print(f"  {r['MinisterCode']} - {r['MinisterName']}")
conn.close()
