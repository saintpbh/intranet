import os
import sys

def load_env():
    env_file = r"c:\Users\User\OneDrive - 한국기독교장로회총회유지재단\0.박봉환개인문서폴더\기장주소록\기장지도\.env.local"
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-16le') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, val = line.split('=', 1)
                    os.environ[key.strip()] = val.strip()

if __name__ == "__main__":
    load_env()
    # Now run retry_failed.py
    sys.path.append(r"c:\Users\User\OneDrive - 한국기독교장로회총회유지재단\0.박봉환개인문서폴더\기장주소록\기장지도")
    import retry_failed
    retry_failed.main()
