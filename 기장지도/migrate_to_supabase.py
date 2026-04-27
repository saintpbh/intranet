"""
PROK_MAP 교회 데이터 마이그레이션 스크립트 (강화판)
- 본부 MSSQL DB → Naver Geocoding → Supabase
- UPSERT: 중복 실행 안전 (chr_code 기준)
- 실패 목록 별도 저장 → 수동 보완 가능
- 주소 우선순위: Address(지번) → Juso(도로명) → 건너뜀
"""

import pymssql
import requests
import json
import time
import os
from datetime import datetime

# ----------------- 설정 -----------------
DB_SERVER = "192.168.0.145"
DB_USER = "pbh"
DB_PASSWORD = "prok3000"
DB_DATABASE = "KJ_CHURCH"

# .env 파일들에서 환경 변수 직접 읽기 (우회 방식)
for env_path in [
    os.path.join(os.path.dirname(__file__), "..", "server", ".env"),
    os.path.join(os.path.dirname(__file__), ".env.local")
]:
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    if k not in os.environ:
                        os.environ[k] = v

NCP_CLIENT_ID = os.getenv("VITE_NAVER_API_KEY_ID", "a7lrosytn2")
NCP_CLIENT_SECRET = os.getenv("VITE_NAVER_API_KEY", "")

SUPABASE_URL = "https://wfpacsoyoalkdzksnmdg.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Load from dynamic config if available
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "..", "server", "map_sync_config.json")
if os.path.exists(CONFIG_FILE):
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            if cfg.get("db_server"):
                DB_SERVER = cfg["db_server"]
            if cfg.get("supabase_url"):
                SUPABASE_URL = cfg["supabase_url"]
        print(f"Loaded dynamic config: DB_SERVER={DB_SERVER}, SUPABASE_URL={SUPABASE_URL}")
    except Exception as e:
        print(f"Error loading config file: {e}")
# -----------------------------------------

def get_connection():
    return pymssql.connect(
        server=DB_SERVER, user=DB_USER,
        password=DB_PASSWORD, database=DB_DATABASE,
        charset='cp949'
    )

def safe_str(val):
    """DB에서 가져온 값을 안전하게 문자열로 변환"""
    if val is None:
        return ""
    if isinstance(val, bytes):
        return val.decode('cp949', errors='ignore').strip()
    return str(val).strip()

def clean_address(addr):
    """주소를 Geocoding에 적합하게 정리"""
    if not addr:
        return ""
    # 괄호 안 부가정보 제거: (내발산동), (폐교회) 등
    import re
    # "서울시 강서구 (내발산동)" → "서울시 강서구"
    cleaned = re.sub(r'\([^)]*\)', '', addr).strip()
    # 쉼표 뒤 부가정보 제거
    if ',' in cleaned:
        cleaned = cleaned.split(',')[0].strip()
    # 너무 짧은 주소(동 이름만)는 무효 처리
    if len(cleaned) < 5:
        return ""
    # 아파트 동/호수 및 층수 상세 정보 제거 (지번/도로명 번호는 유지)
    cleaned = re.sub(r'\s+\d+동\s*\d+호.*$', '', cleaned)
    cleaned = re.sub(r'\s+B?\d+층.*$', '', cleaned)
    cleaned = re.sub(r'지하\s*\d+층.*$', '', cleaned)
    return cleaned.strip()

def geocode_address(address):
    """네이버 Geocoding API로 주소를 좌표로 변환"""
    url = f"https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query={address}"
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
            return lat, lng
    except Exception as e:
        pass  # 에러는 호출부에서 처리
    return None, None

def upsert_to_supabase(data_row, headers):
    """Supabase에 UPSERT (있으면 업데이트, 없으면 삽입)"""
    upsert_headers = {**headers, "Prefer": "resolution=merge-duplicates"}
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/churches",
            headers=upsert_headers,
            json=data_row
        )
        return resp.status_code in (200, 201)
    except:
        return False

def main():
    start_time = datetime.now()
    print(f"=== PROK_MAP 교회 데이터 마이그레이션 시작 ===")
    print(f"시작 시각: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # 1. 본부 DB에서 전체 교회 조회
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    cursor.execute("""
        SELECT c.ChrCode, c.ChrName, n.NohName,
               c.Address, c.Juso, c.Tel_Church
        FROM TB_Chr100 c
        LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode
        ORDER BY c.ChrCode
    """)
    churches = cursor.fetchall()
    conn.close()

    total = len(churches)
    print(f"본부 DB에서 총 {total}개 교회 조회 완료")
    print()

    # 2. Supabase 헤더 준비
    supabase_headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    # 3. 결과 추적
    success_list = []
    fail_list = []
    skip_list = []  # 주소 자체가 없는 경우

    for idx, row in enumerate(churches):
        chr_code = safe_str(row.get("ChrCode"))
        name = safe_str(row.get("ChrName"))
        noh = safe_str(row.get("NohName"))
        phone = safe_str(row.get("Tel_Church"))
        
        # 주소 우선순위: Address → Juso
        raw_address = safe_str(row.get("Address"))
        raw_juso = safe_str(row.get("Juso"))
        
        addr = clean_address(raw_address)
        if not addr:
            addr = clean_address(raw_juso)
        
        progress = f"[{idx+1}/{total}]"

        if not addr:
            skip_list.append({
                "chr_code": chr_code, "name": name,
                "reason": "주소 없음",
                "raw_address": raw_address, "raw_juso": raw_juso
            })
            if (idx+1) % 100 == 0:
                print(f"{progress} 진행 중... (성공: {len(success_list)}, 실패: {len(fail_list)}, 건너뜀: {len(skip_list)})")
            continue

        # Geocoding
        lat, lng = geocode_address(addr)
        
        # 1차 실패 시 다른 주소 필드로 재시도
        if lat is None:
            # 2. raw_address 원본 그대로 시도 (clean_address가 오히려 필수 정보를 날렸을 경우 대비)
            lat, lng = geocode_address(raw_address.strip())
            if lat:
                addr = raw_address.strip()
            
            # 3. 그래도 안 되면 raw_juso (도로명/지번) 시도
            if lat is None and raw_juso and raw_juso != raw_address:
                alt_addr = clean_address(raw_juso)
                if alt_addr:
                    lat, lng = geocode_address(alt_addr)
                    if lat:
                        addr = alt_addr
                # 4. raw_juso 원본 그대로 시도
                if lat is None:
                    lat, lng = geocode_address(raw_juso.strip())
                    if lat:
                        addr = raw_juso.strip()

            time.sleep(0.3)

        if lat and lng:
            data_row = {
                "chr_code": chr_code,
                "name": name,
                "noh": noh,
                "address": raw_address or raw_juso,  # 원본 주소 저장
                "phone": phone,
                "lat": lat,
                "lng": lng
            }
            
            if upsert_to_supabase(data_row, supabase_headers):
                success_list.append(data_row)
            else:
                fail_list.append({
                    "chr_code": chr_code, "name": name,
                    "reason": "Supabase 저장 실패",
                    "raw_address": raw_address
                })
        else:
            fail_list.append({
                "chr_code": chr_code, "name": name,
                "reason": "좌표 변환 실패",
                "raw_address": raw_address, "raw_juso": raw_juso,
                "cleaned_address": addr
            })

        # 진행률 표시 (50건마다)
        if (idx+1) % 50 == 0:
            elapsed = (datetime.now() - start_time).seconds
            rate = (idx+1) / max(elapsed, 1)
            remaining = int((total - idx - 1) / max(rate, 0.1))
            print(f"{progress} 진행 중... 성공:{len(success_list)} 실패:{len(fail_list)} 건너뜀:{len(skip_list)} (예상 남은시간: {remaining//60}분 {remaining%60}초)")

        # API 쿼터 보호 (초당 2건 이하)
        time.sleep(0.5)

    # 4. 결과 보고
    end_time = datetime.now()
    duration = (end_time - start_time).seconds

    print()
    print(f"{'='*50}")
    print(f"=== 마이그레이션 완료 보고서 ===")
    print(f"{'='*50}")
    print(f"총 교회 수:    {total}개")
    print(f"✅ 성공:       {len(success_list)}개")
    print(f"❌ 실패:       {len(fail_list)}개")
    print(f"⏭️ 건너뜀:     {len(skip_list)}개  (주소 없음)")
    print(f"소요 시간:     {duration//60}분 {duration%60}초")
    print(f"{'='*50}")

    # 5. 성공 데이터 JSON 백업
    with open('churches_migrated.json', 'w', encoding='utf-8') as f:
        json.dump(success_list, f, ensure_ascii=False, indent=2)
    print(f"\n✅ 성공 데이터 → churches_migrated.json")

    # 6. 실패 목록 저장 (수동 보완용)
    if fail_list:
        with open('migration_failed.json', 'w', encoding='utf-8') as f:
            json.dump(fail_list, f, ensure_ascii=False, indent=2)
        print(f"❌ 실패 목록 → migration_failed.json ({len(fail_list)}건)")

    # 7. 건너뜀 목록 저장
    if skip_list:
        with open('migration_skipped.json', 'w', encoding='utf-8') as f:
            json.dump(skip_list, f, ensure_ascii=False, indent=2)
        print(f"⏭️ 건너뜀 목록 → migration_skipped.json ({len(skip_list)}건)")

if __name__ == "__main__":
    main()
