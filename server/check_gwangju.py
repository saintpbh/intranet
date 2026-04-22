import os
from supabase import create_client

url = os.environ.get('SUPABASE_URL', '')
key = os.environ.get('SUPABASE_KEY', '')

# If no env vars, try reading from .env
if not url:
    try:
        with open('.env', 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('SUPABASE_URL='): url = line.strip().split('=')[1]
                if line.startswith('SUPABASE_KEY='): key = line.strip().split('=')[1]
    except Exception as e: print(e)

if url and key:
    supabase = create_client(url, key)
    res = supabase.table('churches').select('name, address, lat, lng').like('address', '%광주%').execute()
    
    gwangju_churches = res.data
    print(f"Total containing 광주: {len(gwangju_churches)}")
    
    no_coords = [c for c in gwangju_churches if not c.get('lat') or not c.get('lng')]
    print(f"Without coordinates: {len(no_coords)}")
    print("Sample with no coords:")
    for c in no_coords[:5]:
        print(c)
    
    with_coords = [c for c in gwangju_churches if c.get('lat') and c.get('lng')]
    print("Sample with coords:")
    for c in with_coords[:5]:
        print(c)
