import requests

url = "https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=l40u45h4ou&submodules=geocoder"
headers = {"Referer": "http://localhost:5174/"}

resp = requests.get(url, headers=headers)
print("Status Code:", resp.status_code)
content = resp.text
if "Error Code / Error Message: 200 / Authentication Failed" in content:
    print("Authentication Failed Error found in standard script body!")
elif "Unauthorized" in content:
    print("Unauthorized!")
else:
    print("Content preview:")
    print(content[:500])

