import urllib.request
from bs4 import BeautifulSoup
import re
import sqlite3
import json

def fetch_html(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as response:
        charset = response.headers.get_content_charset() or 'utf-8'
        html_bytes = response.read()
        try:
            return html_bytes.decode(charset), charset
        except UnicodeDecodeError:
            return html_bytes.decode('euc-kr', errors='replace'), 'euc-kr'

def clean_text(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    # Remove script and style elements
    for script in soup(["script", "style"]):
        script.decompose()
        
    text = soup.get_text(separator='\n')
    lines = [line.strip() for line in text.split('\n')]
    
    cleaned_lines = []
    for line in lines:
        if line:
            cleaned_lines.append(line)
        elif cleaned_lines and cleaned_lines[-1] != '':
            cleaned_lines.append('')
            
    return '\n'.join(cleaned_lines).strip()

def run_scraper():
    index_url = "https://www.prok.org/Board/Index/32?page=1"
    print("Fetching index page...")
    html, charset = fetch_html(index_url)
    
    soup = BeautifulSoup(html, 'html.parser')
    table = soup.find('table', class_='table-hover')
    if not table:
        print("Table not found!")
        return
        
    rows = table.find_all('tr')
    parsed_posts = []
    
    for row in rows:
        cells = row.find_all('td')
        if not cells or len(cells) < 5:
            continue
            
        link_tag = row.find('a', href=True)
        if not link_tag:
            continue
            
        href = link_tag['href']
        match = re.search(r'/Board/Detail/32/(\d+)', href)
        if not match:
            continue
            
        post_id = match.group(1)
        title = link_tag.get_text(strip=True)
        # Clean title: remove newlines/tabs
        title = re.sub(r'\s+', ' ', title).strip()
        
        # Date is usually at cell index 3
        date_str = cells[3].get_text(strip=True)
        is_pinned = 1 if 'notice' in row.get('class', []) or cells[0].get_text(strip=True) == '공지' else 0
        
        parsed_posts.append({
            'post_id': post_id,
            'title': title,
            'date': date_str,
            'is_pinned': is_pinned
        })
        
    print(f"Total posts parsed from index: {len(parsed_posts)}")
    
    # Sort posts by date descending
    # date is in format YYYY-MM-DD
    parsed_posts.sort(key=lambda x: x['date'], reverse=True)
    
    # Take the top 5 most recent posts
    top_5 = parsed_posts[:5]
    print("Top 5 most recent notices to sync:")
    for idx, p in enumerate(top_5):
        print(f"{idx+1}. ID: {p['post_id']}, Date: {p['date']}, Pinned: {p['is_pinned']}, Title: {p['title']}")
        
    db_path = 'server/requests.db'
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    synced_scope_codes = []
    
    for p in top_5:
        post_id = p['post_id']
        scope_code = f"prok_board_32_{post_id}"
        synced_scope_codes.append(scope_code)
        
        detail_url = f"https://www.prok.org/Board/Detail/32/{post_id}?page=1"
        print(f"Fetching detail for {post_id}...")
        
        try:
            detail_html, _ = fetch_html(detail_url)
            detail_soup = BeautifulSoup(detail_html, 'html.parser')
            
            # Find detail content
            detail_div = detail_soup.find('div', class_='detail-content')
            if detail_div:
                body_text = clean_text(str(detail_div))
            else:
                body_text = "본문 내용이 없습니다."
                
            # Parse actual creation datetime and author
            regdate_div = detail_soup.find('div', class_='document-regdate')
            created_at = regdate_div.get_text(strip=True) if regdate_div else f"{p['date']} 00:00:00"
            
            writer_div = detail_soup.find('div', class_='document-writer')
            author_name = writer_div.get_text(strip=True) if writer_div else "관리자"
            
            # Append original link
            body_text += f"\n\n원문 주소: {detail_url}"
            
            # Check if exists
            c.execute("SELECT id FROM notices WHERE scope_code = ?", (scope_code,))
            row = c.fetchone()
            if row:
                notice_id = row[0]
                c.execute("""
                    UPDATE notices 
                    SET title = ?, content = ?, author_name = ?, created_at = ?, updated_at = CURRENT_TIMESTAMP, is_pinned = ?
                    WHERE id = ?
                """, (p['title'], body_text, author_name, created_at, p['is_pinned'], notice_id))
                print(f"Updated notice {notice_id} (ID: {post_id})")
            else:
                c.execute("""
                    INSERT INTO notices (scope, scope_code, scope_name, category, title, content, author_name, author_role, is_pinned, target_type, recipients, created_at, updated_at)
                    VALUES ('assembly', ?, '', '총회공지', ?, ?, ?, '관리자', ?, 'all', '[]', ?, CURRENT_TIMESTAMP)
                """, (scope_code, p['title'], body_text, author_name, p['is_pinned'], created_at))
                print(f"Inserted new notice (ID: {post_id})")
                
        except Exception as e:
            print(f"Error syncing post {post_id}: {e}")
            
    # Clean up older scraped notices that are not in the latest 5
    # This keeps only the latest 5 scraped notices in the DB under general assembly
    c.execute("""
        DELETE FROM notices 
        WHERE scope = 'assembly' 
          AND scope_code LIKE 'prok_board_32_%' 
          AND scope_code NOT IN (?, ?, ?, ?, ?)
    """, tuple(synced_scope_codes))
    deleted_count = c.rowcount
    if deleted_count > 0:
        print(f"Cleaned up {deleted_count} old scraped notices.")
        
    conn.commit()
    conn.close()
    print("Sync complete.")

if __name__ == "__main__":
    run_scraper()
