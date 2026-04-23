import sqlite3
conn = sqlite3.connect('requests.db')
c = conn.cursor()
c.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='push_subscriptions'")
row = c.fetchone()
if row:
    print(row[0])
conn.close()
