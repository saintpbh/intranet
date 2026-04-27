import json
import os
import sys
import time

from migrate_to_supabase import get_connection, safe_str, clean_address, geocode_address, upsert_to_supabase

def geocode_with_fallback(address):
    lat, lng = geocode_address(address)
    if lat is not None:
        return lat, lng, address
        
    # Split by spaces and remove the last word to fallback to broader region
    parts = address.split()
    while len(parts) > 2: # Keep at least "City District"
        parts = parts[:-1]
        fallback_addr = " ".join(parts)
        lat, lng = geocode_address(fallback_addr)
        if lat is not None:
            return lat, lng, fallback_addr
            
    return None, None, address

def main():
    failed_file = 'migration_failed.json'
    if not os.path.exists(failed_file):
        print("No failed file found.")
        return
        
    with open(failed_file, 'r', encoding='utf-8') as f:
        failed_list = json.load(f)
        
    print(f"Retrying {len(failed_list)} failed churches with region fallback...")
    
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
    supabase_headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    
    success_count = 0
    new_failed = []
    
    for idx, item in enumerate(failed_list):
        code = item['chr_code']
        cursor.execute(f"SELECT c.ChrCode, c.ChrName, n.NohName, c.Address, c.Juso, c.Tel_Church FROM TB_Chr100 c LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode WHERE c.ChrCode = '{code}'")
        row = cursor.fetchone()
        if not row:
            continue
            
        chr_code = safe_str(row.get("ChrCode"))
        name = safe_str(row.get("ChrName"))
        noh = safe_str(row.get("NohName"))
        phone = safe_str(row.get("Tel_Church"))
        raw_address = safe_str(row.get("Address"))
        raw_juso = safe_str(row.get("Juso"))
        
        # Try raw_address fallback
        lat, lng, best_addr = geocode_with_fallback(clean_address(raw_address))
        
        if lat is None and raw_juso:
            lat, lng, best_addr = geocode_with_fallback(clean_address(raw_juso))
            
        if lat and lng:
            data_row = {
                "chr_code": chr_code,
                "name": name,
                "noh": noh,
                "address": raw_address or raw_juso,
                "phone": phone,
                "lat": lat,
                "lng": lng
            }
            if upsert_to_supabase(data_row, supabase_headers):
                print(f"Success: {name} (Matched to: {best_addr})")
                success_count += 1
            else:
                print(f"Supabase upsert failed: {name}")
                new_failed.append(item)
        else:
            print(f"Still failing geocode entirely: {name} (Address: {raw_address})")
            new_failed.append(item)
            
        time.sleep(0.2)
            
    print(f"Retried {len(failed_list)} churches. Successfully migrated {success_count} new churches.")
    
    # Save the remaining failures
    with open('migration_failed.json', 'w', encoding='utf-8') as f:
        json.dump(new_failed, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
