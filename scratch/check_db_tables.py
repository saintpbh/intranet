import sqlite3

def check():
    db_path = 'server/requests.db'
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in c.fetchall()]
    print("Tables in database:", tables)
    
    for t in tables:
        c.execute(f"SELECT COUNT(*) FROM {t}")
        cnt = c.fetchone()[0]
        print(f"- Table {t}: {cnt} rows")
        
    conn.close()

if __name__ == '__main__':
    check()
