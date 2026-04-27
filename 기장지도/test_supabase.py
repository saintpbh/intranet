import os
import requests
import json

env_file = r'c:\Users\User\OneDrive - 한국기독교장로회총회유지재단\0.박봉환개인문서폴더\기장주소록\기장지도\.env.local'
if os.path.exists(env_file):
    with open(env_file, 'r', encoding='utf-16le') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                key, val = line.split('=', 1)
                os.environ[key.strip()] = val.strip()

SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
SUPABASE_URL = "https://wfpacsoyoalkdzksnmdg.supabase.co"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

data_row = {
    "chr_code": "101186",
    "name": "삼광",
    "noh": "익산",
    "address": "전라북도 익산시 황등면",
    "phone": "",
    "lat": 36.0125,
    "lng": 126.9535
}

resp = requests.post(f"{SUPABASE_URL}/rest/v1/churches", headers=headers, json=data_row)
print(f"Status Code: {resp.status_code}")
print(f"Response: {resp.text}")
