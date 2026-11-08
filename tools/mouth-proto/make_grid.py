import os
import sys, json, numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mouthgen import *

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.environ.get('OUT', os.path.join(HERE, 'out'))
JS = os.path.join(ROOT, 'lib', 'genericparts.js')
CASES = {os.path.splitext(os.path.basename(p))[0]: p for p in sys.argv[1:]}
os.makedirs(OUT, exist_ok=True)
FONT = None
for f in [os.environ.get('CJK_FONT', 'C:/Windows/Fonts/msyh.ttc'), '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc']:
    try: FONT = ImageFont.truetype(f, 22); break
    except Exception: pass
if FONT is None: FONT = ImageFont.load_default()

def crop(img, an, scale=3):
    c = an['c']; w0 = an['w0']; R = int(w0 * 2.6)
    x0, y0 = int(c[0] - R), int(c[1] - R * 0.8)
    x1, y1 = int(c[0] + R), int(c[1] + R * 1.2)
    im = Image.fromarray(to_u8(img[y0:y1, x0:x1]))
    return im.resize((im.width * scale // 1, im.height * scale // 1), Image.LANCZOS)

def run(name, path):
    W, H, layers = load_psd(path)
    mouth = next(L for L in layers if L['name'] == 'mouth')['img']
    face = next(L for L in layers if L['name'] == 'face')['img']
    an = analyze(mouth, face)
    iou, Pfit = fit_original(an, mouth, H, W)
    an['fit_iou'] = float(iou); an['fit_P'] = {k: float(v) for k, v in Pfit.items()}
    B = baseline_setup(W, H, layers, JS)
    orig = composite(W, H, layers)
    base_levels = [0, 0.25, 0.5, 0.75, 1.0]
    base = [frame_baseline(W, H, layers, B, m) for m in base_levels]
    names = ['闭', 'A', 'I', 'U', 'O']
    ours = [frame_ours(W, H, layers, an, PRESETS[n]) for n in names]
    fitf = frame_ours(W, H, layers, an, Pfit, orig_closed_keep=False)
    tiles_b = [crop(x, an) for x in base]; tiles_o = [crop(x, an) for x in ours]
    tw, th = tiles_b[0].size
    G = Image.new('RGB', (tw * 6 + 70, th * 2 + 90), 'white')
    d = ImageDraw.Draw(G)
    G.paste(crop(orig, an), (0, 40)); d.text((10, 8), '原图', fill='black', font=FONT)
    G.paste(crop(fitf, an), (0, th + 80)); d.text((10, th + 48), f'参数化拟合原图 IoU={iou:.2f}', fill='black', font=FONT)
    for i in range(5):
        x = (i + 1) * (tw + 12) + 10
        G.paste(tiles_b[i], (x, 40)); d.text((x + 6, 8), f'现状 mouthOpen={base_levels[i]}', fill=(170, 0, 0), font=FONT)
        G.paste(tiles_o[i], (x, th + 80)); d.text((x + 6, th + 48), f'新方案 {names[i]}', fill=(0, 110, 0), font=FONT)
    G.save(f'{OUT}/grid_{name}.png')
    json.dump(an, open(f'{OUT}/analysis_{name}.json', 'w'), ensure_ascii=False, indent=1)
    print(name, json.dumps({k: an[k] for k in ['w0', 't0', 'th', 'orig_open', 'fit_iou']}))

for k, p in CASES.items():
    run(k, p)
