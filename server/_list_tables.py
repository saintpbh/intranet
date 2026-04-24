import sqlite3
conn = sqlite3.connect('requests.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
for r in c.fetchall():
    print(r[0])
    c2 = conn.cursor()
    c2.execute(f"PRAGMA table_info({r[0]})")
    for col in c2.fetchall():
        print(f"  {col[1]} ({col[2]})")
conn.close()
