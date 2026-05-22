"""연금 데이터 정밀 분석 - 레거시(5,306,000) vs 앱(5,117,500) 차이 원인"""
import pymssql, os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

conn = pymssql.connect(
    server=os.getenv("DB_SERVER", "192.168.0.145"),
    port=int(os.getenv("DB_PORT", "1433")),
    user=os.getenv("DB_USER", "pbh"),
    password=os.getenv("DB_PASSWORD", "prok3000"),
    database=os.getenv("DB_DATABASE", "KJ_CHURCH"),
    charset='cp949', login_timeout=5, timeout=10
)
cursor = conn.cursor(as_dict=True)

pen_no = '003288'

# 1. 전체 데이터 조회 (Finish 상관없이)
print("="*120)
print(f"=== TB_PEN110 전체 데이터 (PenNo={pen_no}) ===")
print("="*120)
cursor.execute("""
    SELECT YYMM, Finish, PenLevel,
           ISNULL(Contribute, 0) AS Contribute,
           ISNULL(Share, 0) AS Share,
           ISNULL(Arrear, 0) AS Arrear,
           ISNULL(inContribute, 0) AS inContribute,
           ISNULL(inShare, 0) AS inShare,
           ISNULL(inArrear, 0) AS inArrear,
           ISNULL(ArrearRate, 0) AS ArrearRate,
           ISNULL(ArrearMonth, 0) AS ArrearMonth
    FROM TB_PEN110
    WHERE PenNo = %s
    ORDER BY YYMM
""", (pen_no,))
rows = cursor.fetchall()

# 집계 변수들
sum_cont = 0         # Contribute (부과 기여금)
sum_share = 0        # Share (부과 부담금)
sum_arrear = 0       # Arrear (부과 연체금)
sum_in_cont = 0      # inContribute (납입 기여금)
sum_in_share = 0     # inShare (납입 부담금)
sum_in_arrear = 0    # inArrear (납입 연체금)
sum_plan_total = 0   # Contribute + Share + Arrear
sum_in_total = 0     # inContribute + inShare + inArrear
sum_app = 0          # inContribute + inShare (앱의 현재 로직)
paid_count = 0

header = f"{'YYMM':>8} {'Fin':>3} {'Lv':>2} {'Contribute':>10} {'Share':>10} {'Arrear':>10} {'Plan Tot':>10} | {'inCont':>10} {'inShare':>10} {'inArrear':>10} {'In Tot':>10} {'AppTot':>10} {'Diff':>6}"
print(header)
print("-" * 130)

for r in rows:
    yymm = str(r['YYMM']).strip()
    finish = str(r.get('Finish') or '').strip()
    lv = str(r.get('PenLevel') or '').strip()
    cont = int(r['Contribute'] or 0)
    share = int(r['Share'] or 0)
    arrear = int(r['Arrear'] or 0)
    in_cont = int(r['inContribute'] or 0)
    in_share = int(r['inShare'] or 0)
    in_arrear = int(r['inArrear'] or 0)
    
    plan_total = cont + share + arrear
    in_total = in_cont + in_share + in_arrear
    app_total = in_cont + in_share  # 앱 현재 로직
    diff = in_total - app_total  # = inArrear

    if finish.upper() == 'Y':
        sum_cont += cont
        sum_share += share
        sum_arrear += arrear
        sum_in_cont += in_cont
        sum_in_share += in_share
        sum_in_arrear += in_arrear
        sum_plan_total += plan_total
        sum_in_total += in_total
        sum_app += app_total
        paid_count += 1
    
    marker = " ***" if in_arrear != 0 and finish.upper() == 'Y' else ""
    print(f"{yymm:>8} {finish:>3} {lv:>2} {cont:>10,} {share:>10,} {arrear:>10,} {plan_total:>10,} | {in_cont:>10,} {in_share:>10,} {in_arrear:>10,} {in_total:>10,} {app_total:>10,} {diff:>6,}{marker}")

print("-" * 130)
print(f"{'TOTAL':>8} {'':>3} {'':>2} {sum_cont:>10,} {sum_share:>10,} {sum_arrear:>10,} {sum_plan_total:>10,} | {sum_in_cont:>10,} {sum_in_share:>10,} {sum_in_arrear:>10,} {sum_in_total:>10,} {sum_app:>10,} {sum_in_arrear:>6,}")

print(f"\n{'='*60}")
print(f"분석 결과:")
print(f"{'='*60}")
print(f"  총 납입 건수 (Finish='Y'): {paid_count}")
print(f"")
print(f"  [부과금 합계]")
print(f"    기여금 (Contribute):     {sum_cont:>12,}")
print(f"    부담금 (Share):          {sum_share:>12,}")
print(f"    연체금 (Arrear):         {sum_arrear:>12,}")
print(f"    합계:                    {sum_plan_total:>12,}")
print(f"")
print(f"  [납입금 합계]")
print(f"    기여금 (inContribute):   {sum_in_cont:>12,}")
print(f"    부담금 (inShare):        {sum_in_share:>12,}")
print(f"    연체금 (inArrear):       {sum_in_arrear:>12,}")
print(f"    합계(기+부+연):          {sum_in_total:>12,}")
print(f"    합계(기+부만, 앱방식):   {sum_app:>12,}")
print(f"")
print(f"  [차이 분석]")
print(f"    레거시 정답:             {5306000:>12,}")
print(f"    앱 현재값:               {sum_app:>12,}")
print(f"    DB 전체 납입합계:        {sum_in_total:>12,}")
print(f"    앱에서 누락한 연체금:    {sum_in_arrear:>12,}")
print(f"    연체금 포함시 합계:      {sum_app + sum_in_arrear:>12,}")
print(f"    레거시와의 차이:         {5306000 - (sum_app + sum_in_arrear):>12,}")

conn.close()
