import requests, os
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = "https://wfpacsoyoalkdzksnmdg.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# SQL to add columns if they don't exist
sql = """
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='churches' AND column_name='theme') THEN
        ALTER TABLE churches ADD COLUMN theme TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='churches' AND column_name='logo_symbol') THEN
        ALTER TABLE churches ADD COLUMN logo_symbol TEXT;
    END IF;
END $$;
"""

print("Updating schema on Supabase...")
# Try pg/query endpoint
r = requests.post(
    f"{SUPABASE_URL}/pg/query",
    headers=headers,
    json={"query": sql},
    timeout=30,
)
print(f"PG query Status: {r.status_code}, Body: {r.text[:500]}")

# Try rpc endpoint as fallback if supported
if r.status_code != 200:
    r2 = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/execute_sql", # Some custom RPCs if available
        headers=headers,
        json={"query": sql},
        timeout=30,
    )
    print(f"RPC Status: {r2.status_code}, Body: {r2.text[:500]}")
