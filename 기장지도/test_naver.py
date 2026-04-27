import requests
import json
import os
from migrate_to_supabase import geocode_address, clean_address

def test_geocode(address):
    lat, lng = geocode_address(address)
    print(f"[{address}] -> lat={lat}, lng={lng}")

if __name__ == "__main__":
    # Load env for API keys
    env_file = r"c:\Users\User\OneDrive - 한국기독교장로회총회유지재단\0.박봉환개인문서폴더\기장주소록\기장지도\.env.local"
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-16le') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, val = line.split('=', 1)
                    os.environ[key.strip()] = val.strip()

    addr = "전라북도 익산시 황등면 죽촌길 176호 31통"
    test_geocode(addr)
    test_geocode(clean_address(addr))
    test_geocode("전라북도 익산시 황등면 죽촌길 176")
    test_geocode("500-15번지")
