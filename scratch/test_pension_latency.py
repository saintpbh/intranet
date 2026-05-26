import urllib.request
import json
import time

API_BASE = "https://server.prok.or.kr"
MINISTER_CODE = "200331"  # 권호경 목사님 코드

def test_pension_latency():
    url = f"{API_BASE}/api/pension/{MINISTER_CODE}/estimate"
    payload = {
        "retire_age": 65,
        "lev1_y": 15, "lev1_m": 6,
        "lev2_y": 10, "lev2_m": 0,
        "lev3_y": 5, "lev3_m": 0,
        "lev4_y": 4, "lev4_m": 0,
        "birth_year": 1968, "birth_month": 5,
        "amt": 3500000
    }
    
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
    }
    
    print(f"Triggering Pension Estimate API: {url}")
    print(f"Payload: {json.dumps(payload, ensure_ascii=False)}")
    
    latencies = []
    for i in range(3):
        start = time.time()
        try:
            req = urllib.request.Request(
                url, 
                data=json.dumps(payload).encode('utf-8'),
                headers=headers,
                method='POST'
            )
            with urllib.request.urlopen(req) as res:
                code = res.getcode()
                content = res.read().decode('utf-8')
                elapsed = (time.time() - start) * 1000
                latencies.append(elapsed)
                data = json.loads(content)
                print(f" -> [Run {i+1}] Success | HTTP {code} | Latency: {elapsed:.2f}ms | Estimated Monthly: {data.get('estimated_monthly'):,}원")
        except Exception as e:
            print(f" -> [Run {i+1}] Failed: {e}")
            
    if latencies:
        print(f"\n[LATENCY SUMMARY] Min: {min(latencies):.1f}ms | Max: {max(latencies):.1f}ms | Average: {sum(latencies)/len(latencies):.1f}ms")

if __name__ == "__main__":
    test_pension_latency()
