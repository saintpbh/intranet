import requests
import json
import time
import re
import os

NCP_CLIENT_ID = os.getenv("VITE_NAVER_API_KEY_ID", "a7lrosytn2")
NCP_CLIENT_SECRET = os.getenv("VITE_NAVER_API_KEY", "")

SUPABASE_URL = "https://wfpacsoyoalkdzksnmdg.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase_headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def clean_and_concat(address, juso):
    """주소와 상세주소를 Geocoding에 맞게 변환 및 결합"""
    addr = str(address or "").strip()
    js = str(juso or "").strip()
    
    # 괄호 안(지번, 폐교회 등) 제거
    addr = re.sub(r'\([^)]*\)', '', addr).strip()
    js = re.sub(r'\([^)]*\)', '', js).strip()
    
    # "1013(폐교)" 등 괄호가 붙어있는 경우 대비
    if ',' in addr: addr = addr.split(',')[0].strip()
    
    # 아파트, 건물명 제거 (지번/도로명까지만 남기기)
    js = re.sub(r'\s*\d+층.*$', '', js)
    js = re.sub(r'\s*\d+호.*$', '', js)
    js = re.sub(r'\s*\d+동.*$', '', js)
    js = re.sub(r'[a-zA-Z가-힣]+아파트.*$', '', js)
    js = re.sub(r'[a-zA-Z가-힣]+상가.*$', '', js)
    
    candidates = []
    
    # Candidate 1: Address + Juso (가장 이상적)
    if addr and js and js[0].isdigit():
        # Juso가 숫자(번지수)로 시작하면 붙여서 시도
        candidates.append(f"{addr} {js}")
        # 혹시 '-' 가 포함된 번지수면, 앞부분만 시도 (예: 36-9 -> 36)
        if '-' in js:
            candidates.append(f"{addr} {js.split('-')[0]}")
    
    # Candidate 2: Address 만
    if addr:
        candidates.append(addr)
    # Candidate 3: Juso 만
    if js and not js[0].isdigit():
        candidates.append(js)
        
    return candidates

def geocode_candidates(candidates):
    for addr in candidates:
        if not addr or len(addr) < 5: continue
        url = f"https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query={addr}"
        headers = {
            "X-NCP-APIGW-API-KEY-ID": NCP_CLIENT_ID,
            "X-NCP-APIGW-API-KEY": NCP_CLIENT_SECRET
        }
        try:
            resp = requests.get(url, headers=headers, timeout=5)
            data = resp.json()
            if data.get('addresses') and len(data['addresses']) > 0:
                lat = float(data['addresses'][0]['y'])
                lng = float(data['addresses'][0]['x'])
                return lat, lng, addr
        except:
            pass
        time.sleep(0.1)
    return None, None, None

def main():
    if not os.path.exists("migration_failed.json"):
        print("migration_failed.json 파일을 찾을 수 없습니다.")
        return

    with open("migration_failed.json", "r", encoding="utf-8") as f:
        failed_list = json.load(f)

    print(f"총 {len(failed_list)}건의 실패 데이터 재처리 시작...")
    
    success_count = 0
    still_failed = []

    for idx, item in enumerate(failed_list):
        candidates = clean_and_concat(item.get("raw_address"), item.get("raw_juso"))
        
        lat, lng, matched_addr = geocode_candidates(candidates)
        
        if lat and lng:
            # Upsert to Supabase
            data_row = {
                "chr_code": item["chr_code"],
                "name": item["name"],
                # 기존 데이터 보존
                "lat": lat,
                "lng": lng
            }
            # GET existing row to merge details (since failed_json doesn't have phone/noh)
            # Actually, Supabase has the rows, but lat/lng are NULL. we just PATCH them.
            patch_url = f"{SUPABASE_URL}/rest/v1/churches?chr_code=eq.{item['chr_code']}"
            resp = requests.patch(patch_url, headers=supabase_headers, json={"lat": lat, "lng": lng})
            
            if resp.status_code in (200, 204):
                success_count += 1
                print(f"[{idx+1}] {item['name']} 성공 (매칭: {matched_addr})")
            else:
                still_failed.append(item)
                print(f"[{idx+1}] {item['name']} DB 갱신 실패 (HTTP {resp.status_code})")
        else:
            still_failed.append(item)
            print(f"[{idx+1}] {item['name']} 여전히 주소 변환 불가")

        time.sleep(0.3)
        
    print(f"\n✅ 재처리 성공: {success_count}건")
    print(f"❌ 여전히 실패 (수동확인 필요): {len(still_failed)}건")
    
    # Save remaining
    with open("migration_failed_remains.json", "w", encoding="utf-8") as f:
        json.dump(still_failed, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
