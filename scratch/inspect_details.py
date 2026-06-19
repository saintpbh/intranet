import urllib.request
from bs4 import BeautifulSoup
import re
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

def inspect():
    # Let's inspect a few post IDs
    post_ids = ["473866", "471400", "467368", "475757"]
    results = {}
    
    for pid in post_ids:
        url = f"https://www.prok.org/Board/Detail/32/{pid}?page=1"
        try:
            html, charset = fetch_html(url)
            soup = BeautifulSoup(html, 'html.parser')
            detail_div = soup.find('div', class_='detail-content')
            if detail_div:
                # Get raw HTML inside detail_div
                raw_inner_html = str(detail_div)
                # Get plain text
                plain_text = detail_div.get_text(separator='\n', strip=True)
                results[pid] = {
                    'found': True,
                    'text_preview': plain_text[:500],
                    'html_preview': raw_inner_html[:500]
                }
            else:
                results[pid] = {'found': False, 'error': 'detail-content div not found'}
        except Exception as e:
            results[pid] = {'found': False, 'error': str(e)}
            
    with open('scratch/inspected_details.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("Done. Results saved to scratch/inspected_details.json")

if __name__ == "__main__":
    inspect()
