"""
기장 마크 PWA 아이콘 생성 스크립트
사용자 첨부 이미지 기반 정밀 재현:
  - 하늘색(#39BDE8) 원
  - 보라색(#7B2FA0) 부채꼴 (왼쪽 하단, ~90도)
  - 흰색 삼각형 화살표 (오른쪽 위 방향)
"""
from PIL import Image, ImageDraw
import math, os

def draw_prok_mark(size):
    """기장 마크를 정확히 그립니다"""
    img = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size // 2, size // 2
    r = int(size * 0.42)  # 원 반지름 (캔버스의 84%)
    
    # 1) 하늘색 원 배경
    sky_blue = (57, 189, 232)  # #39BDE8
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=sky_blue)
    
    # 2) 보라색 부채꼴 (왼쪽 하단 ~90도, 180도~270도)
    purple = (123, 47, 160)  # #7B2FA0
    # PIL의 pieslice: 0도=3시, 90도=6시, 180도=9시, 270도=12시
    # 왼쪽 하단 = 약 135도~225도 (PIL 기준)
    # 사용자 이미지 분석: 보라색은 약 7시~11시 방향 = PIL의 210도~330도 사이가 아닌
    # 왼쪽과 아래 영역 = 약 135도~270도
    draw.pieslice(
        [cx - r, cy - r, cx + r, cy + r],
        start=150,  # 약 7시 방향
        end=270,    # 12시 방향 
        fill=purple
    )
    
    # 3) 흰색 삼각형/화살표 (중심에서 오른쪽 위로 향하는 형태)
    # 사용자 이미지에서: 보라색 영역 위에 흰색 삼각형이 오른쪽 위를 가리킴
    arrow_len = r * 0.85
    
    # 화살표 방향: 약 -45도 (오른쪽 위)
    angle = math.radians(-45)
    
    # 화살표 끝점
    tip_x = cx + arrow_len * math.cos(angle)
    tip_y = cy + arrow_len * math.sin(angle)
    
    # 화살표 좌우 날개
    wing_angle1 = angle + math.radians(135)
    wing_angle2 = angle - math.radians(135)
    wing_len = arrow_len * 0.45
    
    w1_x = tip_x + wing_len * math.cos(wing_angle1)
    w1_y = tip_y + wing_len * math.sin(wing_angle1)
    w2_x = tip_x + wing_len * math.cos(wing_angle2)
    w2_y = tip_y + wing_len * math.sin(wing_angle2)
    
    # 화살표 몸체 (얇은 삼각형)
    body_width = r * 0.08
    body_angle1 = angle + math.radians(90)
    body_angle2 = angle - math.radians(90)
    
    b1_x = cx + body_width * math.cos(body_angle1)
    b1_y = cy + body_width * math.sin(body_angle1)
    b2_x = cx + body_width * math.cos(body_angle2)
    b2_y = cy + body_width * math.sin(body_angle2)
    
    # 화살표 전체 (몸체 + 머리)
    white = (255, 255, 255)
    
    # 화살표 머리 (삼각형)
    draw.polygon([(tip_x, tip_y), (w1_x, w1_y), (w2_x, w2_y)], fill=white)
    
    # 화살표 몸체 (얇은 사각형)
    mid_x = (tip_x + cx) / 2
    mid_y = (tip_y + cy) / 2
    draw.polygon([
        (b1_x, b1_y), (b2_x, b2_y),
        (tip_x + body_width * math.cos(body_angle2) * 0.5, 
         tip_y + body_width * math.sin(body_angle2) * 0.5),
        (tip_x + body_width * math.cos(body_angle1) * 0.5, 
         tip_y + body_width * math.sin(body_angle1) * 0.5),
    ], fill=white)
    
    # 안티앨리어싱을 위해 4x로 그리고 축소
    return img

def create_icon(size, output_path):
    """고해상도로 그린 후 다운스케일하여 안티앨리어싱 적용"""
    scale = 4
    large = draw_prok_mark(size * scale)
    final = large.resize((size, size), Image.LANCZOS)
    final.save(output_path, 'PNG')
    print(f"Created: {output_path} ({size}x{size})")

base = r"c:\Users\User\OneDrive - 한국기독교장로회총회유지재단\0.박봉환개인문서폴더\기장주소록\client\public\assets"

create_icon(512, os.path.join(base, "pwa-512x512.png"))
create_icon(192, os.path.join(base, "pwa-192x192.png"))
create_icon(192, os.path.join(base, "logo.png"))
create_icon(192, os.path.join(base, "admin_logo.png"))
create_icon(192, os.path.join(base, "logo_v3.png"))

print("Done! All icons generated.")
