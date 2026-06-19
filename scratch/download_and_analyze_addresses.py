import urllib.request
import json
import urllib.parse
import time

def analyze():
    url = 'https://firebasestorage.googleapis.com/v0/b/prok-ga.firebasestorage.app/o/directory.json?alt=media&token=e2ed687f-0f99-4655-a0ac-0cc86845b910'
    print(f"Downloading directory.json from {url}...")
    
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print("Failed to download directory.json:", e)
        return
        
    churches = data.get('churches', [])
    print(f"Total churches in directory: {len(churches)}")
    
    if not churches:
        print("No churches found in directory.")
        return
        
    # Analyze address patterns
    no_address = []
    has_juso = []
    has_only_address = []
    
    for ch in churches:
        addr = ch.get('ADDRESS') or ch.get('address') or ''
        juso = ch.get('JUSO') or ch.get('juso') or ''
        name = ch.get('CHRNAME') or ch.get('ChrName') or ''
        
        if not addr:
            no_address.append(name)
        else:
            if juso:
                has_juso.append((name, addr, juso))
            else:
                has_only_address.append((name, addr))
                
    print("\n=== Address Stats ===")
    print(f"Churches with no address: {len(no_address)}")
    print(f"Churches with address and detailed Juso: {len(has_juso)}")
    print(f"Churches with only main address: {len(has_only_address)}")
    
    if no_address:
        print("\nSample churches with no address (Top 5):")
        for n in no_address[:5]:
            print(f"- {n}")
            
    # Geocoding test on first 30 churches that have addresses
    test_churches = (has_juso + has_only_address)[:30]
    print(f"\nTesting geocoding on {len(test_churches)} churches with addresses...")
    
    success = 0
    failed = []
    
    for idx, (name, addr, *extra) in enumerate(test_churches):
        query = addr.strip()
        
        # Test 1: Raw Address
        url_geo = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(query)}&countrycodes=kr&limit=1"
        req_geo = urllib.request.Request(
            url_geo,
            headers={'User-Agent': 'GijangAddressTest/1.0 (test@prok.org)'}
        )
        
        time.sleep(1.0) # 1 second delay to respect usage policy
        
        try:
            with urllib.request.urlopen(req_geo) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                if res_data and len(res_data) > 0:
                    print(f"[{idx+1}] {name}: SUCCESS -> {query}")
                    success += 1
                else:
                    # Let's try cleaning the address (take first 3 words)
                    cleaned_query = " ".join(query.split()[:3])
                    time.sleep(1.0)
                    url_geo_clean = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(cleaned_query)}&countrycodes=kr&limit=1"
                    req_geo_clean = urllib.request.Request(
                        url_geo_clean,
                        headers={'User-Agent': 'GijangAddressTest/1.0 (test@prok.org)'}
                    )
                    with urllib.request.urlopen(req_geo_clean) as response_clean:
                        res_data_clean = json.loads(response_clean.read().decode('utf-8'))
                        if res_data_clean and len(res_data_clean) > 0:
                            print(f"[{idx+1}] {name}: FAILED raw, but SUCCESS with Cleaned -> {cleaned_query} (orig: {query})")
                            success += 1
                        else:
                            print(f"[{idx+1}] {name}: FAILED -> {query}")
                            failed.append((name, query))
        except Exception as e:
            print(f"[{idx+1}] {name}: ERROR -> {query} ({e})")
            failed.append((name, f"Error: {e} | Address: {query}"))
            
    print("\n=== Geocoding Test Summary ===")
    print(f"Total tested: {len(test_churches)}")
    print(f"Success: {success} ({success/len(test_churches)*100:.1f}%)")
    print(f"Failed: {len(failed)} ({len(failed)/len(test_churches)*100:.1f}%)")
    
    if failed:
        print("\n=== Failures Detail ===")
        for f in failed:
            print(f"- {f[0]}: {f[1]}")

if __name__ == '__main__':
    analyze()
