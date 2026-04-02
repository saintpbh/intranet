import requests

url = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=분당구"
secret = "g3TaJ7TZPvLF4gFMvoup9hyM8hYDMs5jFLGWxwxs"

def test_key(client_id, desc):
    headers = {
        "X-NCP-APIGW-API-KEY-ID": client_id,
        "X-NCP-APIGW-API-KEY": secret
    }
    resp = requests.get(url, headers=headers)
    print(f"Testing {desc} ('{client_id}'): Status {resp.status_code}")
    try:
        print(f"Response: {resp.json().get('errorMessage', 'Success!')}")
    except:
        print(f"Response text: {resp.text[:100]}")

test_key("l40u45h4ou", "Lowercase L")
test_key("I40u45h4ou", "Uppercase I")
test_key("140u45h4ou", "Number 1")
