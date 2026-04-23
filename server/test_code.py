import pymssql, json, os
from dotenv import load_dotenv

load_dotenv('.env')
conn = pymssql.connect(
    server=os.getenv('DB_SERVER'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    database=os.getenv('DB_DATABASE'),
    charset='cp949'
)
c = conn.cursor(as_dict=True)
c.execute("SELECT CodeGubun, Code, CodeName FROM TB_Chr900 ORDER BY CodeGubun, Code")
results = c.fetchall()
print(json.dumps(results, ensure_ascii=True, indent=2))
conn.close()
