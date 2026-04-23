import sys
sys.path.append('.')
import main
import json

c = main.get_connection().cursor(as_dict=True)
c.execute("SELECT TOP 1 * FROM VI_MIN_JANG_LIST")
row = c.fetchone()

with open('jang_list.json', 'w', encoding='utf-8') as f:
    json.dump(row, f, ensure_ascii=False)
