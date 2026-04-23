import sqlite3
import json

conn = sqlite3.connect('server/requests.db')
c = conn.cursor()
c.execute("SELECT * FROM push_subscriptions WHERE minister_name LIKE '%박봉환%' ORDER BY created_at DESC")
rows = c.fetchall()
for r in rows:
    print(r)
