import urllib.request
import urllib.parse
from bs4 import BeautifulSoup
import sys

def test_fetch():
    url = "https://www.prok.org/Board/Index/32?page=1"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read()
        
        soup = BeautifulSoup(html, 'html.parser')
        print("Page Title:", soup.title.string if soup.title else "No Title")
        
        # Look for table or board list
        # Let's print some table or list elements to understand the structure
        tables = soup.find_all('table')
        print(f"Found {len(tables)} tables")
        
        for idx, table in enumerate(tables):
            print(f"--- Table {idx} ---")
            # Print class or id
            print("Classes:", table.get('class'), "ID:", table.get('id'))
            # Print some sample text
            text = table.get_text(strip=True)[:200]
            print("Preview:", text)
            
        # Let's also search for links containing '/Board/Detail/32/' or just 'Detail'
        links = soup.find_all('a', href=True)
        detail_links = [l for l in links if 'Detail' in l['href']]
        print(f"Found {len(detail_links)} links containing 'Detail'")
        for dl in detail_links[:10]:
            print(f"Link: {dl['href']}, Text: {dl.get_text(strip=True)}")
            
    except Exception as e:
        print("Error fetching:", e)

if __name__ == "__main__":
    test_fetch()
