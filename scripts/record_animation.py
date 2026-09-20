"""
Graba la animación HTML como video MP4 1920x1080 en bucle.
Usa Playwright video recording (mucho más rápido que frame-by-frame).
"""
import os
import subprocess
import time
from playwright.sync_api import sync_playwright

HTML_PATH = '/home/z/my-project/scripts/animacion.html'
RECORDINGS_DIR = '/home/z/my-project/scripts/recordings'
OUTPUT_VIDEO = '/home/z/my-project/download/nuestra_promesa.mp4'
FINAL_LOOP_VIDEO = '/home/z/my-project/download/nuestra_promesa_loop.mp4'

# 1 ciclo = 30s. Grabamos 35s para tener margen y recortar a exactamente 30s
RECORD_DURATION_S = 35

FPS = 30
WIDTH = 1920
HEIGHT = 1080

os.makedirs(RECORDINGS_DIR, exist_ok=True)
os.makedirs(os.path.dirname(OUTPUT_VIDEO), exist_ok=True)

# Limpiar recordings previos
for f in os.listdir(RECORDINGS_DIR):
    os.remove(os.path.join(RECORDINGS_DIR, f))

print(f"[1/4] Iniciando grabacion de {RECORD_DURATION_S}s con Playwright...")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=[
        '--disable-gpu',
        '--no-sandbox',
        '--force-device-scale-factor=1',
        '--disable-dev-shm-usage'
    ])
    context = browser.new_context(
        viewport={'width': WIDTH, 'height': HEIGHT},
        device_scale_factor=1,
        record_video_dir=RECORDINGS_DIR,
        record_video_size={'width': WIDTH, 'height': HEIGHT}
    )
    page = context.new_page()
    
    page.goto(f'file://{HTML_PATH}', wait_until='networkidle')
    page.wait_for_function('window.__animReady === true', timeout=10000)
    print("[2/4] Animacion cargada.")
    
    page.evaluate('document.body.offsetHeight')
    page.wait_for_timeout(500)
    
    print(f"[3/4] Grabando {RECORD_DURATION_S}s...")
    page.wait_for_timeout(RECORD_DURATION_S * 1000)
    print("Grabacion completada.")
    
    page.close()
    context.close()
    browser.close()

# Encontrar el video grabado
videos = [f for f in os.listdir(RECORDINGS_DIR) if f.endswith('.webm')]
if not videos:
    print("ERROR: no se genero ningun video webm")
    raise SystemExit(1)

webm_path = os.path.join(RECORDINGS_DIR, videos[0])
size_mb = os.path.getsize(webm_path) / (1024*1024)
print(f"Video webm: {webm_path} ({size_mb:.1f} MB)")

# Convertir webm -> mp4, tomando exactamente 30s empezando en 0.3s
print("[4/4] Convirtiendo a MP4 (30s exactos)...")
cmd = [
    'ffmpeg', '-y',
    '-i', webm_path,
    '-ss', '0.3',
    '-t', '30.0',
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-vf', f'scale={WIDTH}:{HEIGHT},fps={FPS}',
    '-an',
    OUTPUT_VIDEO
]
print(' '.join(cmd))
result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
if result.returncode != 0:
    print("ERROR ffmpeg:", result.stderr[-2000:])
    raise SystemExit(1)
print(f"MP4 creado: {OUTPUT_VIDEO}")

# Verificar duracion
dur = subprocess.check_output([
    'ffprobe', '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    OUTPUT_VIDEO
]).decode().strip()
size_mb = os.path.getsize(OUTPUT_VIDEO) / (1024*1024)
print(f"   {float(dur):.2f}s, {size_mb:.1f} MB")

# Crear version loop extendido (5 ciclos = 2.5 min)
print("Creando version bucle extendido (5 ciclos)...")
cmd_loop = [
    'ffmpeg', '-y',
    '-stream_loop', '4',
    '-i', OUTPUT_VIDEO,
    '-c', 'copy',
    '-movflags', '+faststart',
    FINAL_LOOP_VIDEO
]
result2 = subprocess.run(cmd_loop, capture_output=True, text=True, timeout=60)
if result2.returncode != 0:
    print("WARN loop:", result2.stderr[-500:])
else:
    dur2 = subprocess.check_output([
        'ffprobe', '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        FINAL_LOOP_VIDEO
    ]).decode().strip()
    size_mb2 = os.path.getsize(FINAL_LOOP_VIDEO) / (1024*1024)
    print(f"   Loop: {float(dur2):.2f}s, {size_mb2:.1f} MB")

# Limpiar webm
os.remove(webm_path)
print("\n=== DONE ===")
