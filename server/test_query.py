import pymssql
conn = pymssql.connect('192.168.0.145', 'pbh', 'prok3000', 'KJ_CHURCH', charset='cp949')
c = conn.cursor(as_dict=True)

try:
    query = '''
    SELECT m.MinisterCode, m.MinisterName, m.TEL_MOBILE, m.EMAIL, m.DUTYNAME
    FROM VI_MIN_INFO m
    WHERE m.MinisterCode IN (
        SELECT MinisterCode FROM TB_Chr201 WHERE ChrCode='101794'
    )
    '''
    c.execute(query)
    print('Staff via VI_MIN_INFO:', c.fetchall())
except Exception as e:
    print('Error VI_MIN_INFO:', e)

try:
    query2 = '''
    SELECT m.MinisterCode, m.MinisterName, m.Tel_Mobile as TEL_MOBILE, m.Email as EMAIL
    FROM TB_Chr200 m
    WHERE m.MinisterCode IN (
        SELECT MinisterCode FROM TB_Chr201 WHERE ChrCode='101794'
    )
    '''
    c.execute(query2)
    print('Staff via TB_Chr200:', c.fetchall())
except Exception as e:
    print('Error TB_Chr200:', e)
