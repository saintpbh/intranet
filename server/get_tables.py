import sys
sys.path.append('.')
import main
import json

c = main.get_connection().cursor(as_dict=True)
c.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS")
v = [r['TABLE_NAME'] for r in c.fetchall()]
c.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES")
t = [r['TABLE_NAME'] for r in c.fetchall()]
with open('tables.json', 'w') as f:
    json.dump({'views': v, 'tables': t}, f)
