import urllib.request
import urllib.parse
try:
    url = 'http://127.0.0.1:8000/api/notices?target_noh=' + urllib.parse.quote('서울노회')
    with urllib.request.urlopen(url) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print(e)
