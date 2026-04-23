import sqlite3
import os
import sys

db_path = os.path.join("server", "requests.db")
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("SELECT * FROM push_subscriptions")
rows = c.fetchall()
print(f"Total subscriptions: {len(rows)}")
for r in rows:
    print(r)
conn.close()
