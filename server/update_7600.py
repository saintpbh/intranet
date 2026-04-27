import sqlite3
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = r"c:\Users\User\OneDrive - 한국기독교장로회총회유지재단\0.박봉환개인문서폴더\기장주소록\server\requests.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT * FROM staff_accounts WHERE staff_code = '7600';")
print("Before:", cur.fetchall())

cur.execute("UPDATE staff_accounts SET name = '총회직원' WHERE staff_code = '7600';")
conn.commit()

cur.execute("SELECT * FROM staff_accounts WHERE staff_code = '7600';")
print("After:", cur.fetchall())
conn.close()
