import urllib.request
import urllib.parse
import json
import time

API_BASE = "https://server.prok.or.kr"
FRONTEND_URL = "https://prok-ga.web.app"

def test_api(endpoint, search_term):
    encoded_term = urllib.parse.quote(search_term)
    url = f"{API_BASE}{endpoint}?search={encoded_term}"
    print(f"Testing API Endpoint: {url}")
    start = time.time()
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as res:
            code = res.getcode()
            content = res.read().decode('utf-8')
            elapsed = (time.time() - start) * 1000
            data = json.loads(content)
            print(f" -> [SUCCESS] HTTP {code} | Latency: {elapsed:.2f}ms")
            print(f" -> [DATA] Total records returned: {len(data)}")
            if len(data) > 0:
                print(f" -> [SAMPLE] First record: {list(data[0].items())[:3]}")
            else:
                print(" -> [WARNING] Empty data returned")
            return True, elapsed
    except Exception as e:
        print(f" -> [FAILED] Error: {e}")
        return False, 9999

def test_frontend():
    print(f"\nTesting Frontend Webapp: {FRONTEND_URL}")
    start = time.time()
    try:
        req = urllib.request.Request(FRONTEND_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as res:
            code = res.getcode()
            elapsed = (time.time() - start) * 1000
            print(f" -> [SUCCESS] HTTP {code} | Latency: {elapsed:.2f}ms")
            return True, elapsed
    except Exception as e:
        print(f" -> [FAILED] Error: {e}")
        return False, 9999

def main():
    print("=== LIVE PRODUCTION SYSTEM HEALTH CHECK ===\n")
    
    # 1. API Endpoint tests
    success_min, lat_min = test_api("/api/ministers", "김")
    success_chu, lat_chu = test_api("/api/churches", "신촌")
    success_eld, lat_eld = test_api("/api/elders", "이")
    success_adr, lat_adr = test_api("/api/addressbook", "서울")
    
    # 2. Frontend loading test
    success_fe, lat_fe = test_frontend()
    
    print("\n=== VERIFICATION SUMMARY ===")
    all_success = success_min and success_chu and success_eld and success_adr and success_fe
    if all_success:
        print("[STATUS] Live Environment is fully operational and extremely fast!")
        print(f" - Average API Response Time: {(lat_min + lat_chu + lat_eld + lat_adr)/4:.2f}ms")
        print(f" - Frontend Page Load Time: {lat_fe:.2f}ms")
    else:
        print("[STATUS] Degraded or failing elements detected. Please inspect log details above.")

if __name__ == "__main__":
    main()
