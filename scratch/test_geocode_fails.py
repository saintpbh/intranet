import sqlite3
import urllib.request
import urllib.parse
import json
import time

def test_geocoding():
    db_path = 'server/requests.db'
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # 50개의 교회를 가져와서 주소 지오코딩 테스트
    c.execute("SELECT ChrCode, CHRNAME, ADDRESS, JUSO FROM local_churches LIMIT 50")
    churches = [dict(r) for r in c.fetchall()]
    conn.close()
    
    success_count = 0
    fail_count = 0
    failures = []
    
    print(f"Testing geocoding for {len(churches)} churches...\n")
    
    for idx, ch in enumerate(churches):
        name = ch['CHRNAME']
        addr = ch['ADDRESS']
        if not addr:
            print(f"[{idx+1}] {name}: FAILED (No address in DB)")
            fail_count += 1
            failures.append((name, "No address", ""))
            continue
            
        # Clean address for testing
        query = addr.strip()
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(query)}&countrycodes=kr&limit=1"
        
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GijangAddressbookFinder/1.0',
                'Accept-Language': 'ko'
            }
        )
        
        try:
            # 1초 딜레이 (Nominatim Usage Policy 준수)
            time.sleep(1.0)
            
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                if data and len(data) > 0:
                    print(f"[{idx+1}] {name}: SUCCESS -> {query}")
                    success_count += 1
                else:
                    print(f"[{idx+1}] {name}: FAILED -> {query}")
                    fail_count += 1
                    failures.append((name, "Nominatim returned no result", query))
        except Exception as e:
            print(f"[{idx+1}] {name}: ERROR -> {query} ({e})")
            fail_count += 1
            failures.append((name, f"HTTP/Network Error: {e}", query))
            
    print("\n=== SUMMARY ===")
    print(f"Total Tested: {len(churches)}")
    print(f"Success: {success_count} ({success_count/len(churches)*100:.1f}%)")
    print(f"Fail: {fail_count} ({fail_count/len(churches)*100:.1f}%)")
    
    if failures:
        print("\n=== FAILURES DETAIL (Top 10) ===")
        for f in failures[:10]:
            print(f"- Church: {f[0]}\n  Reason: {f[1]}\n  Address: {f[2]}\n")

if __name__ == '__main__':
    test_geocoding()
