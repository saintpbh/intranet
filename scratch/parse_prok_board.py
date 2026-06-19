import urllib.request
import urllib.parse
from bs4 import BeautifulSoup
import json
import re

def fetch_html(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as response:
        # Detect encoding
        charset = response.headers.get_content_charset() or 'utf-8'
        html_bytes = response.read()
        try:
            return html_bytes.decode(charset), charset
        except UnicodeDecodeError:
            # Try euc-kr fallback
            return html_bytes.decode('euc-kr', errors='replace'), 'euc-kr'

def test_parse():
    index_url = "https://www.prok.org/Board/Index/32?page=1"
    html, charset = fetch_html(index_url)
    print(f"Fetched index page. Detected charset: {charset}")
    
    soup = BeautifulSoup(html, 'html.parser')
    
    # Let's inspect the first table to find rows
    # The table has class ['table', 'table-hover']
    table = soup.find('table', class_='table-hover')
    if not table:
        print("Table not found!")
        return
        
    rows = table.find_all('tr')
    print(f"Found {len(rows)} rows in table")
    
    parsed_posts = []
    
    # We want to extract columns like Number, Title (with link), Author, Date, Views
    for row in rows:
        cells = row.find_all('td')
        if not cells:
            continue  # Probably the header row
            
        # Let's look for link in cells
        link_tag = row.find('a', href=True)
        if not link_tag:
            continue
            
        href = link_tag['href']
        # Check if it matches detail url
        # Link format: /Board/Detail/32/475757?page=1
        match = re.search(r'/Board/Detail/32/(\d+)', href)
        if not match:
            continue
            
        post_id = match.group(1)
        title = link_tag.get_text(strip=True)
        
        # Let's find author and date from the cells
        # We can extract text from all cells to see which index corresponds to what
        cell_texts = [c.get_text(strip=True) for c in cells]
        
        parsed_posts.append({
            'post_id': post_id,
            'title': title,
            'href': href,
            'cell_texts': cell_texts
        })
        
    print(f"Parsed {len(parsed_posts)} posts")
    
    # Fetch detail for the first post to see where content is stored
    if parsed_posts:
        first_post = parsed_posts[0]
        detail_url = f"https://www.prok.org/Board/Detail/32/{first_post['post_id']}?page=1"
        print(f"Fetching detail page for post {first_post['post_id']}: {detail_url}")
        detail_html, detail_charset = fetch_html(detail_url)
        detail_soup = BeautifulSoup(detail_html, 'html.parser')
        
        # We need to find the element containing the notice content.
        # Let's search for typical content wrappers, or just output the HTML structure around the text
        # Usually details have a card, or a div with class containing 'content', 'body', 'view', 'detail', etc.
        # Let's inspect divs that might contain the main text.
        # Let's find all divs and check their classes
        divs = detail_soup.find_all('div')
        possible_content_divs = []
        for div in divs:
            div_class = div.get('class')
            if div_class:
                class_str = ' '.join(div_class)
                if any(x in class_str.lower() for x in ['content', 'body', 'view-detail', 'detail', 'board-content', 'post-content']):
                    possible_content_divs.append((class_str, div.get_text(strip=True)[:100]))
                    
        # Let's print out the text of a known selector, or write the whole body to an output file for analysis
        with open('scratch/detail_page.html', 'w', encoding='utf-8') as f:
            f.write(detail_html)
            
        first_post['possible_divs'] = possible_content_divs
        
    # Write parsed results to JSON
    with open('scratch/parsed_posts.json', 'w', encoding='utf-8') as f:
        json.dump(parsed_posts, f, ensure_ascii=False, indent=2)
        
    print("Done. Saved results to scratch/parsed_posts.json and scratch/detail_page.html")

if __name__ == "__main__":
    test_parse()
