import urllib.request
import json

def trigger():
    url = 'https://server.prok.or.kr/api/admin/sync-to-firebase'
    print(f"Triggering sync to Firebase via {url}...")
    
    req = urllib.request.Request(
        url,
        data=b'', # POST request
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            print("Response:", res_data)
    except Exception as e:
        print("Failed to trigger sync:", e)

if __name__ == '__main__':
    trigger()
