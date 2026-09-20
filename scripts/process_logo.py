"""
Procesa el logo para crear versiones con fondo transparente:
- logo_white.png: logo en blanco con transparencia (para fondo oscuro)
- logo_gold.png: logo en dorado con transparencia (para detalles)
"""
from PIL import Image
import numpy as np

src = '/home/z/my-project/assets/logo.png'
img = Image.open(src).convert('RGBA')
arr = np.array(img)

# Crear alpha basada en luminosidad invertida
# Píxeles oscuros = logo = alpha alto
# Píxeles blancos = fondo = alpha bajo
r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
luminance = (r.astype(int) + g.astype(int) + b.astype(int)) / 3
# alpha = 255 - luminance (oscuro = opaco)
alpha = (255 - luminance).astype(np.uint8)

# Versión blanca (para fondo oscuro)
white_arr = np.zeros_like(arr)
white_arr[:,:,0] = 255  # R
white_arr[:,:,1] = 255  # G
white_arr[:,:,2] = 255  # B
white_arr[:,:,3] = alpha
white_img = Image.fromarray(white_arr, 'RGBA')
white_img.save('/home/z/my-project/assets/logo_white.png', 'PNG', optimize=True)
print("logo_white.png creado")

# Versión dorada (#D4AF37)
gold_arr = np.zeros_like(arr)
gold_arr[:,:,0] = 0xD4  # R
gold_arr[:,:,1] = 0xAF  # G
gold_arr[:,:,2] = 0x37  # B
gold_arr[:,:,3] = alpha
gold_img = Image.fromarray(gold_arr, 'RGBA')
gold_img.save('/home/z/my-project/assets/logo_gold.png', 'PNG', optimize=True)
print("logo_gold.png creado")

# Versión con fondo transparente preservando colores originales
transp_arr = arr.copy()
transp_arr[:,:,3] = alpha
transp_img = Image.fromarray(transp_arr, 'RGBA')
transp_img.save('/home/z/my-project/assets/logo_transparent.png', 'PNG', optimize=True)
print("logo_transparent.png creado")

# Verificar
for name in ['logo_white.png', 'logo_gold.png', 'logo_transparent.png']:
    p = f'/home/z/my-project/assets/{name}'
    im = Image.open(p)
    print(f"{name}: {im.size}, mode={im.mode}")
    a = np.array(im)
    print(f"  alpha range: {a[:,:,3].min()}-{a[:,:,3].max()}, mean={a[:,:,3].mean():.1f}")
