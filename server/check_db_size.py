import sys
import os
import json

# Add current dir to path to import main
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import sync_directory

try:
    data = sync_directory()
    if "error" in data:
        print("Error in sync_directory:", data["error"])
    else:
        json_str = json.dumps(data, ensure_ascii=False)
        print(f"Total entries in directory: {len(data.get('ministers', [])) + len(data.get('elders', [])) + len(data.get('churches', []))}")
        print(f"Total directory JSON size: {len(json_str.encode('utf-8')) / 1024 / 1024:.2f} MB")
except Exception as e:
    print(f"Failed: {e}")
