import requests
r = requests.post("http://localhost:5000/api/auth/login", json={"code": "7600"})
print(r.status_code, r.json())

r2 = requests.get("http://localhost:5000/api/ministers/7600")
print(r2.status_code, r2.json())

r3 = requests.post("http://localhost:5000/api/auth/login", json={"code": "7605"})
print(r3.status_code, r3.json())

r4 = requests.post("http://localhost:5000/api/auth/login", json={"code": "9999"})
print(r4.status_code, r4.json())
