"""Genera imágenes placeholder elegantes."""
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

IMG_DIR = '/home/z/my-project/public/images'
os.makedirs(IMG_DIR, exist_ok=True)

def create_logo():
    W, H = 1408, 768
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    try:
        font_title = ImageFont.truetype('/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-VariableFont_wght.ttf', 96)
        font_sub = ImageFont.truetype('/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-VariableFont_wght.ttf', 56)
        font_tag = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 32)
    except Exception:
        font_title = font_sub = font_tag = ImageFont.load_default()
    cx, cy = W//2, H//2 - 30
    r = 180
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=(212, 175, 55, 220), width=3)
    draw.ellipse([cx-r+15, cy-r+15, cx+r-15, cy+r-15], outline=(212, 175, 55, 120), width=1)
    text = "D & W"
    bbox = draw.textbbox((0, 0), text, font=font_title)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw//2 - bbox[0], cy - th//2 - bbox[1] - 10), text, fill=(245, 239, 224, 255), font=font_title)
    for side in [-1, 1]:
        for i in range(5):
            angle = -30 + i * 15
            rad = math.radians(angle)
            x1 = cx + side * (r - 30)
            y1 = cy + 80
            x2 = x1 + side * 35 * math.cos(rad)
            y2 = y1 + 35 * math.sin(rad)
            draw.line([(x1, y1), (x2, y2)], fill=(212, 175, 55, 220), width=3)
    text2 = "NUESTRA PROMESA"
    bbox2 = draw.textbbox((0, 0), text2, font=font_sub)
    tw2 = bbox2[2] - bbox2[0]
    draw.text((W//2 - tw2//2 - bbox2[0], cy + r + 30), text2, fill=(212, 175, 55, 255), font=font_sub)
    text3 = "D & W"
    bbox3 = draw.textbbox((0, 0), text3, font=font_tag)
    tw3 = bbox3[2] - bbox3[0]
    draw.text((W//2 - tw3//2 - bbox3[0], cy + r + 110), text3, fill=(245, 239, 224, 200), font=font_tag)
    img.save(os.path.join(IMG_DIR, 'logo.png'), 'PNG')
    print("logo.png creado")

def create_photo(name, num, caption):
    W, H = 1920, 1080
    gradients = [
        [(20, 15, 12), (80, 50, 35), (40, 25, 20)],
        [(15, 20, 30), (50, 60, 80), (25, 35, 50)],
        [(30, 15, 20), (80, 35, 45), (50, 20, 30)],
        [(20, 25, 15), (60, 70, 35), (35, 45, 25)],
        [(25, 20, 30), (70, 50, 75), (45, 35, 50)],
    ]
    c0, c1, c2 = gradients[(num - 1) % len(gradients)]
    img = Image.new('RGB', (W, H), c0)
    draw = ImageDraw.Draw(img)
    for r in range(1200, 0, -10):
        t = 1 - (r / 1200)
        if t < 0.5:
            k = t * 2
            color = (int(c0[0] + (c2[0] - c0[0]) * k), int(c0[1] + (c2[1] - c0[1]) * k), int(c0[2] + (c2[2] - c0[2]) * k))
        else:
            k = (t - 0.5) * 2
            color = (int(c2[0] + (c1[0] - c2[0]) * k), int(c2[1] + (c1[1] - c2[1]) * k), int(c2[2] + (c1[2] - c2[2]) * k))
        draw.ellipse([W//2 - r, H//2 - r, W//2 + r, H//2 + r], fill=color)
    img = img.filter(ImageFilter.GaussianBlur(radius=100))
    draw = ImageDraw.Draw(img)
    try:
        font_big = ImageFont.truetype('/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-VariableFont_wght.ttf', 240)
        font_caption = ImageFont.truetype('/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-VariableFont_wght.ttf', 64)
    except Exception:
        font_big = font_caption = ImageFont.load_default()
    num_text = str(num).zfill(2)
    bbox = draw.textbbox((0, 0), num_text, font=font_big)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    for offset in range(15, 0, -3):
        glow_img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow_img)
        glow_draw.text((W//2 - tw//2 - bbox[0], H//2 - th//2 - bbox[1] - 80), num_text, fill=(212, 175, 55, max(20, 80 - offset * 4)), font=font_big)
        glow_img = glow_img.filter(ImageFilter.GaussianBlur(radius=offset))
        img = Image.alpha_composite(img.convert('RGBA'), glow_img).convert('RGB')
    draw = ImageDraw.Draw(img)
    draw.text((W//2 - tw//2 - bbox[0], H//2 - th//2 - bbox[1] - 80), num_text, fill=(212, 175, 55, 255), font=font_big)
    bbox2 = draw.textbbox((0, 0), caption, font=font_caption)
    tw2 = bbox2[2] - bbox2[0]
    draw.text((W//2 - tw2//2 - bbox2[0], H//2 + 180), caption, fill=(245, 239, 224, 220), font=font_caption)
    draw.rectangle([60, 60, W-60, H-60], outline=(212, 175, 55, 150), width=2)
    corner = 80
    draw.line([(60, 60+corner), (60, 60), (60+corner, 60)], fill=(212, 175, 55, 255), width=4)
    draw.line([(W-60-corner, H-60), (W-60, H-60), (W-60, H-60-corner)], fill=(212, 175, 55, 255), width=4)
    draw.line([(W-60-corner, 60), (W-60, 60), (W-60, 60+corner)], fill=(212, 175, 55, 255), width=4)
    draw.line([(60, H-60-corner), (60, H-60), (60+corner, H-60)], fill=(212, 175, 55, 255), width=4)
    img.save(os.path.join(IMG_DIR, name), 'JPEG', quality=88)
    print(f"{name} creado")

create_logo()
captions = ["Para siempre", "Nuestro comienzo", "Un sí para siempre", "Nuestra historia", "El sí"]
for i, cap in enumerate(captions, 1):
    create_photo(f"foto{i}.jpg", i, cap)
print("\n=== Todos los placeholders creados ===")
