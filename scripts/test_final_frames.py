"""
Captura solo los frames finales (24-30s) que faltaron.
"""
import os
from playwright.sync_api import sync_playwright

HTML_PATH = '/home/z/my-project/scripts/animacion.html'
OUT_DIR = '/tmp/test_frames'
os.makedirs(OUT_DIR, exist_ok=True)

TIMES = [
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
    
    for ms, name in TIMES:
        page.goto(f'file://{HTML_PATH}', wait_until='networkidle')
        page.wait_for_function('window.__animReady === true', timeout=10000)
        page.wait_for_timeout(ms)
        page.screenshot(path=os.path.join(OUT_DIR, f'{name}.png'), type='png', clip={
            'x': 0, 'y': 0, 'width': 1920, 'height': 1080
        })
        print(f"OK: {name} ({ms}ms)")
    
    browser.close()
print("DONE")
