import sqlite3
import json

def check():
    conn = sqlite3.connect('server/requests.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT id, scope, scope_code, scope_name, category, title, created_at FROM notices ORDER BY created_at DESC LIMIT 10")
    rows = c.fetchall()
    print("--- Notices currently in requests.db ---")
    for r in rows:
        print(dict(r))
    conn.close()

if __name__ == "__main__":
    check()
