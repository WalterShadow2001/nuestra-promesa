"""
Test rápido: captura screenshots en diferentes momentos para verificar la animación.
"""
import os
from playwright.sync_api import sync_playwright

HTML_PATH = '/home/z/my-project/scripts/animacion.html'
OUT_DIR = '/tmp/test_frames'
os.makedirs(OUT_DIR, exist_ok=True)

TIMES = [
    (1500, '01_logo_visible'),
    (4000, '04_logo_con_texto'),
    (7000, '07_logo_fade_out'),
    (9000, '09_foto1_visible'),
    (12000, '12_foto1_ken_burns'),
    (16000, '16_foto1_to_foto2'),
    (18000, '18_foto2_visible'),
    (22000, '22_foto2_fade_out'),
    (25000, '25_final_visible'),
    (28000, '28_final_phrase'),
    (29500, '29_final_end'),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=[
        '--disable-gpu', '--no-sandbox', '--force-device-scale-factor=1'
    ])
    context = browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        device_scale_factor=1
    )
    page = context.new_page()
    page.goto(f'file://{HTML_PATH}', wait_until='networkidle')
    page.wait_for_function('window.__animReady === true', timeout=10000)
    page.evaluate('document.body.offsetHeight')
    page.wait_for_timeout(300)

    for ms, name in TIMES:
        page.wait_for_timeout(max(50, ms - (page.evaluate('performance.now()') or ms)))
        # Simular: solo esperamos al tiempo absoluto desde el inicio
        # Mas simple: esperamos hasta ese momento
        # Pero como ya pasó tiempo, mejor usar evaluate para sincronizar
        # Vamos mas simple: solo esperamos un delta
        pass
    
    # Reemplazar por enfoque mas simple: navegar al frame y screenshot
    # Como la animación se basa en performance.now(), mejor recargar y esperar
    for ms, name in TIMES:
        page.goto(f'file://{HTML_PATH}', wait_until='networkidle')
        page.wait_for_function('window.__animReady === true', timeout=10000)
        page.wait_for_timeout(ms)
        page.screenshot(path=os.path.join(OUT_DIR, f'{name}.png'), type='png', clip={
            'x': 0, 'y': 0, 'width': 1920, 'height': 1080
        })
        print(f"Capturado: {name} ({ms}ms)")
    
    browser.close()

print(f"\nFrames en {OUT_DIR}")
