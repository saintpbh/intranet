import pymssql

DB_USER = "pbh"
DB_PASSWORD = "prok3000"
DB_SERVER = "192.168.0.145"
DB_DATABASE = "KJ_CHURCH"

try:
    conn = pymssql.connect(server=DB_SERVER, user=DB_USER, password=DB_PASSWORD, database=DB_DATABASE, charset='cp949')
    cursor = conn.cursor(as_dict=True)
    
    # Let's search for 강릉송강 which we know exists
    search = '강릉송강'
    search_term = f"%{search}%"
    
    query1 = "SELECT TOP 1 ChrName FROM TB_Chr100 WHERE ChrName LIKE %s"
    cursor.execute(query1, (search_term,))
    print("Test 1 (search_term unicode):", cursor.fetchall())
    
    encoded_search = search_term.encode('cp949')
    try:
        cursor.execute(query1, (encoded_search,))
        print("Test 2 (search_term cp949 bytes):", cursor.fetchall())
    except Exception as e:
        print("Test 2 Failed:", e)
        
    query3 = f"SELECT TOP 1 ChrName FROM TB_Chr100 WHERE ChrName LIKE '{search_term}'"
    cursor.execute(query3)
    print("Test 3 (string format):", cursor.fetchall())

    conn.close()
except Exception as e:
    print("Error:", e)
