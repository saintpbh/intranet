import paramiko

HOST = "222.231.1.47"
USER = "root"
PASS = "Serv57^23"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    print(f"Connecting to {HOST}...")
    ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=15)
    print("Connected!")
    
    sftp = ssh.open_sftp()
    with sftp.open('/root/prok_api/main.py', 'rb') as f:
        content_bytes = f.read()
        
    content = content_bytes.decode('utf-8', errors='replace')
    lines = content.splitlines()
    
    # Print the line that matches sync_directory_fast
    for idx, line in enumerate(lines):
        if 'sync_directory_fast' in line:
            print(f"Line {idx+1}: {line}")
            # Print next 30 lines
            for i in range(1, 30):
                print(f"Line {idx+1+i}: {lines[idx+i]}")
                # Print hex representation of the line containing account_type
                if 'account_type' in lines[idx+i]:
                    print("Hex bytes of account_type line:", lines[idx+i].encode('utf-8').hex())
                    # Also decode with cp949 or euc-kr
                    try:
                        print("Decoded as cp949:", lines[idx+i].encode('utf-8').decode('cp949'))
                    except Exception as e:
                        print("cp949 decode error:", e)
            break
        
    sftp.close()
    ssh.close()

if __name__ == "__main__":
    main()
