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
c.execute("SELECT TOP 5 MinisterCode, MinisterName FROM VI_MIN_INFO")
results = c.fetchall()
print(json.dumps(results, ensure_ascii=False, indent=2))
c.execute("SELECT TOP 5 * FROM TB_Chr201")
tb_chr201 = c.fetchall()
print(json.dumps(tb_chr201, ensure_ascii=False, indent=2))
conn.close()
