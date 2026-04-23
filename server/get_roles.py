import sys
sys.path.append('.')
import main
import json

c = main.get_connection().cursor(as_dict=True)
c.execute('SELECT DISTINCT MOKGUBUNNAME FROM VI_MIN_INFO')
m = [r['MOKGUBUNNAME'] for r in c.fetchall() if r['MOKGUBUNNAME']]

c.execute('SELECT DISTINCT DUTYNAME FROM VI_MIN_INFO')
d = [r['DUTYNAME'] for r in c.fetchall() if r['DUTYNAME']]

with open('roles.json', 'w', encoding='utf-8') as f:
    json.dump({'mok': m, 'duty': d}, f, ensure_ascii=False)
