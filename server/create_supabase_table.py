import requests, os
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = "https://wfpacsoyoalkdzksnmdg.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Create pension_estimates table via Supabase SQL API
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

sql = """
CREATE TABLE IF NOT EXISTS pension_estimates (
    id BIGSERIAL PRIMARY KEY,
    minister_code TEXT UNIQUE NOT NULL,
    pen_no TEXT,
    retire_age INT,
    estimated_monthly INT,
    contribution_rate NUMERIC(6,2),
    retirement_rate NUMERIC(6,2),
    base_salary INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_pension_estimates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pension_estimates_updated ON pension_estimates;
CREATE TRIGGER trg_pension_estimates_updated
    BEFORE UPDATE ON pension_estimates
    FOR EACH ROW
    EXECUTE FUNCTION update_pension_estimates_timestamp();

-- Enable RLS and allow service role full access
ALTER TABLE pension_estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON pension_estimates;
CREATE POLICY "service_role_full_access" ON pension_estimates
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
"""

r = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/",
    headers=headers,
    json={"query": sql},
    timeout=30,
)
print(f"RPC Status: {r.status_code}, Body: {r.text[:500]}")

# Try via SQL editor endpoint
r2 = requests.post(
    f"{SUPABASE_URL}/pg/query",
    headers=headers,
    json={"query": sql},
    timeout=30,
)
print(f"PG Status: {r2.status_code}, Body: {r2.text[:500]}")
