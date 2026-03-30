import socket

def test_port(ip, port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(2)
    result = sock.connect_ex((ip, port))
    sock.close()
    return result == 0

ip = '192.168.0.145'
ports = {
    3306: 'MySQL / MariaDB',
    1433: 'MS SQL Server',
    5432: 'PostgreSQL',
    1521: 'Oracle'
}

print("Scanning common database ports on", ip)
found = False
for port, name in ports.items():
    if test_port(ip, port):
        print(f"Port {port} ({name}) is OPEN.")
        found = True
    else:
        print(f"Port {port} ({name}) is closed.")

if not found:
    print("No common database ports are open. Will try scanning server 'sunstar'.")
    try:
        ip_sunstar = socket.gethostbyname('sunstar')
        print(f"'sunstar' resolves to {ip_sunstar}")
        for port, name in ports.items():
            if test_port(ip_sunstar, port):
                print(f"Port {port} ({name}) on sunstar ({ip_sunstar}) is OPEN.")
    except Exception as e:
        print("Could not resolve 'sunstar':", e)
