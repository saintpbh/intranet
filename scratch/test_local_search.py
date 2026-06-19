import sqlite3

def run_test():
    db_path = 'server/requests.db'
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # 1. 목회자 노회 검색 테스트 (서울노회)
    print("=== [TEST 1] Ministers (Search: '서울노회') ===")
    search = '서울노회'
    search_pattern = f"%{search}%"
    
    c.execute("""
        SELECT 
            m.MinisterCode, m.MinisterName, m.CHRNAME, m.NOHNAME
        FROM local_ministers m
        WHERE m.MinisterName LIKE ? OR m.CHRNAME LIKE ? OR m.NOHNAME LIKE ?
        ORDER BY m.MinisterName, m.NOHNAME, m.CHRNAME
        LIMIT 10
    """, (search_pattern, search_pattern, search_pattern))
    results = [dict(r) for r in c.fetchall()]
    for idx, r in enumerate(results):
        print(f"{idx+1}. {r['MinisterName']} ({r['CHRNAME']} / {r['NOHNAME']})")
        
    names = [r['MinisterName'] for r in results]
    sorted_names = sorted(names)
    assert names == sorted_names, f"Sorting mismatch: {names} != {sorted_names}"
    print("-> SUCCESS: Alphabetically sorted by name!")
    
    # 2. 장로 노회 검색 테스트 (서울노회)
    print("\n=== [TEST 2] Elders (Search: '서울노회') ===")
    c.execute("""
        SELECT 
            PriestCode, PriestName, ChrName, NohName
        FROM local_elders
        WHERE PriestName LIKE ? OR ChrName LIKE ? OR NohName LIKE ?
        ORDER BY PriestName, NohName, ChrName
        LIMIT 10
    """, (search_pattern, search_pattern, search_pattern))
    results = [dict(r) for r in c.fetchall()]
    for idx, r in enumerate(results):
        print(f"{idx+1}. {r['PriestName']} ({r['ChrName']} / {r['NohName']})")
        
    names = [r['PriestName'] for r in results]
    sorted_names = sorted(names)
    assert names == sorted_names, f"Sorting mismatch: {names} != {sorted_names}"
    print("-> SUCCESS: Alphabetically sorted by name!")
    
    # 3. 교회 노회 검색 테스트 (서울노회)
    print("\n=== [TEST 3] Churches (Search: '서울노회') ===")
    c.execute("""
        SELECT 
            ChrCode, CHRNAME, NOHNAME
        FROM local_churches
        WHERE CHRNAME LIKE ? OR NOHNAME LIKE ?
        ORDER BY CHRNAME, NOHNAME
        LIMIT 10
    """, (search_pattern, search_pattern))
    results = [dict(r) for r in c.fetchall()]
    for idx, r in enumerate(results):
        print(f"{idx+1}. {r['CHRNAME']} ({r['NOHNAME']})")
        
    names = [r['CHRNAME'] for r in results]
    sorted_names = sorted(names)
    assert names == sorted_names, f"Sorting mismatch: {names} != {sorted_names}"
    print("-> SUCCESS: Alphabetically sorted by name!")
    
    conn.close()

if __name__ == '__main__':
    try:
        run_test()
    except Exception as e:
        print("Test failed with error:", e)
