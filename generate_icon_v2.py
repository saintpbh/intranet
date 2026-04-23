import math
import os
from PIL import Image, ImageDraw

def draw_exact_prok_logo(size, bg_color=(255, 255, 255, 255)):
    scale = 8 # High supersampling for perfect anti-aliasing
    sz = size * scale
    
    img = Image.new('RGBA', (sz, sz), (0, 0, 0, 0)) # transparent background to mask later
    draw = ImageDraw.Draw(img)
    
    cx, cy = sz / 2, sz / 2
    r = sz * 0.45  # circle radius (leaving a small 5% margin)

    blue = (0, 160, 233, 255)     # #00A0E9
    purple = (142, 0, 122, 255)   # #8E007A
    white = (255, 255, 255, 255)
    
    # 1. Draw full blue circle
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=blue)
    
    # 2. Draw the purple pie slice (90 to 180 degrees in PIL is bottom-left)
    draw.pieslice([cx - r, cy - r, cx + r, cy + r], 90, 180, fill=purple)
    
    # 3. Draw the white gap lines
    gap_width = sz * 0.035
    hw_half = gap_width / 2.0
    
    # We will draw accurate polygons from the center extending well past the radius
    r_ext = r + sz * 0.1 # extended radius
    
    # A central white circle to smooth the intersection of the 3 lines
    draw.ellipse([cx - hw_half, cy - hw_half, cx + hw_half, cy + hw_half], fill=white)
    
    # Horizontal left gap
    draw.polygon([
        (cx, cy - hw_half),
        (cx - r_ext, cy - hw_half),
        (cx - r_ext, cy + hw_half),
        (cx, cy + hw_half)
    ], fill=white)
    
    # Vertical down gap
    draw.polygon([
        (cx - hw_half, cy),
        (cx + hw_half, cy),
        (cx + hw_half, cy + r_ext),
        (cx - hw_half, cy + r_ext)
    ], fill=white)
    
    # Diagonal down-left gap (135 degrees)
    angle = math.radians(135)
    # Normals to the line
    nx = math.cos(angle + math.pi/2) * hw_half
    ny = math.sin(angle + math.pi/2) * hw_half
    
    end_x = cx + math.cos(angle) * r_ext
    end_y = cy + math.sin(angle) * r_ext
    
    draw.polygon([
        (cx + nx, cy + ny),
        (end_x + nx, end_y + ny),
        (end_x - nx, end_y - ny),
        (cx - nx, cy - ny),
    ], fill=white)
    
    # Ensure the outer bounding is a perfect circle by masking it
    mask = Image.new('L', (sz, sz), 0)
    mask_draw = ImageDraw.Draw(mask)
    # The mask should be exactly the size of our original circle
    mask_draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    
    # Final image with the requested background color (white)
    final_large = Image.new('RGBA', (sz, sz), bg_color)
    final_large.paste(img, (0, 0), mask)
    
    # Downscale for anti-aliasing
    final = final_large.resize((size, size), Image.Resampling.LANCZOS)
    return final

def create_icon(size, output_path):
    final_img = draw_exact_prok_logo(size)
    final_img.save(output_path, 'PNG')
    print(f"Created exact PROK icon: {output_path} ({size}x{size})")

base = r"c:\Users\User\OneDrive - 한국기독교장로회총회유지재단\0.박봉환개인문서폴더\기장주소록\client\public\assets"

create_icon(512, os.path.join(base, "pwa-512x512.png"))
create_icon(192, os.path.join(base, "pwa-192x192.png"))
create_icon(192, os.path.join(base, "logo.png"))
create_icon(192, os.path.join(base, "admin_logo.png"))
create_icon(192, os.path.join(base, "logo_v3.png"))

print("Done! Official icons generated successfully.")
