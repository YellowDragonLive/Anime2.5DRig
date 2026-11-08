"""对比视频 + 可量化验收。用法: python make_video_metrics.py"""
import os, sys, json, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mouthgen as MG
from mouthgen import *

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.environ.get('OUT', os.path.join(HERE, 'out'))
JS = os.path.join(ROOT, 'lib', 'genericparts.js')
CASES = {os.path.splitext(os.path.basename(p))[0]: p for p in sys.argv[1:]}
os.makedirs(OUT, exist_ok=True)
FONT = None
for _f in [os.environ.get('CJK_FONT', ''), 'C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/meiryo.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']:
    try: FONT = ImageFont.truetype(_f, 26); break
    except Exception: pass
if FONT is None: FONT = ImageFont.load_default()
FPS = 30
MG.PRESETS['U'] = dict(o=0.38, s=0.58, r=1.0, f=-0.1, tt=0.0)

def crop_layers(W, H, layers, roi):
    x0, y0, x1, y1 = roi
    out = []
    for L in layers:
        b = L['bbox']
        out.append({'name': L['name'], 'img': L['img'][y0:y1, x0:x1].copy(),
                    'bbox': (b[0] - x0, b[1] - y0, b[2] - x0, b[3] - y0)})
    return x1 - x0, y1 - y0, out

def mouth_mask(frame, ref, roi_c, R):
    cx, cy = int(roi_c[0]), int(roi_c[1])
    d = np.abs(frame[..., :3] - ref[..., :3]).sum(2)
    m = np.zeros(d.shape, bool)
    sl = (slice(max(0, cy - R), cy + R), slice(max(0, cx - R), cx + R))
    m[sl] = d[sl] > 0.10
    return m

def local_extent(mask, an):
    ys, xs = np.nonzero(mask)
    if len(xs) == 0: return 0, 0
    c = np.array(an['c']); e1 = np.array(an['e1']); e2 = np.array(an['e2'])
    u = (xs - c[0]) * e1[0] + (ys - c[1]) * e1[1]; v = (xs - c[0]) * e2[0] + (ys - c[1]) * e2[1]
    return float(np.ptp(u)), float(np.ptp(v))

def iou(a, b):
    return float((a & b).sum() / max(1, (a | b).sum()))

SEQ = [('闭', .40), ('A', .35), ('闭', .12), ('I', .35), ('U', .35), ('E', .35), ('O', .35), ('闭', .30),
       ('A', .22), ('A', .22), ('O', .30), ('E', .30), ('闭', .45)]
LYRIC = ['', 'a', '', 'i', 'u', 'e', 'o', '', 'ka', 'ra', 'o', 'ke', '']

def track(t):
    tt = 0; prev = MG.PRESETS['闭']; lab = ''
    for (k, d), ly in zip(SEQ, LYRIC):
        if t < tt + d:
            cur = MG.PRESETS[k]
            w = float(MG._sstep((t - tt) / 0.09))
            return {p: prev[p] * (1 - w) + cur[p] * w for p in cur}, k, ly
        prev = MG.PRESETS[k]; tt += d
    return dict(MG.PRESETS['闭']), '闭', ''

def label(img, text, col):
    im = Image.fromarray(MG.to_u8(img)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, im.width, 38), fill=(255, 255, 255)); d.text((10, 4), text, fill=col, font=FONT)
    return im

def run(name, path):
    W, H, layers = load_psd(path)
    face = next(L for L in layers if L['name'] == 'face')
    fb = face['bbox']
    fw, fh = fb[2] - fb[0], fb[3] - fb[1]
    roi = (max(0, fb[0] - fw // 6), max(0, fb[1] + fh // 4), min(W, fb[2] + fw // 6), min(H, fb[3] + fh // 6))
    W, H, layers = crop_layers(W, H, layers, roi)
    mouth = next(L for L in layers if L['name'] == 'mouth')['img']
    face = next(L for L in layers if L['name'] == 'face')
    an = analyze(mouth, face['img'])
    B = baseline_setup(W, H, layers, JS)
    nomouth = composite(W, H, [L for L in layers if L['name'] != 'mouth'])
    R = int(an['w0'] * 2.2)
    # ---------- metrics ----------
    names = ['闭', 'A', 'I', 'U', 'O']; lv = [0, .25, .5, .75, 1.0]
    fo = {n: frame_ours(W, H, layers, an, MG.PRESETS[n]) for n in names}
    fbs = {m: frame_baseline(W, H, layers, B, m) for m in lv}
    def nm_ours(P):
        return composite(W, H, [dict(L, img=jaw_warp(L['img'], an, P, face['bbox'])) if L['name'] == 'face' else L
                                for L in layers if L['name'] != 'mouth'])
    def nm_base(m):
        return frame_baseline(W, H, [L for L in layers if L['name'] != 'mouth'], B, m)
    mo = {n: mouth_mask(fo[n], nm_ours(MG.PRESETS[n]), an['c'], R) for n in names}
    mb = {m: mouth_mask(fbs[m], nm_base(m), an['c'], R) for m in lv}
    def pairmax(ms):
        ks = list(ms); return max(iou(ms[a], ms[b]) for i, a in enumerate(ks) for b in ks[i + 1:])
    ext_o = {n: local_extent(mo[n], an) for n in names}
    ext_b = {m: local_extent(mb[m], an) for m in lv}
    # continuity: 30 帧线性扫 0→1
    def popratio(frames):
        ds = [np.abs(frames[i + 1][..., :3] - frames[i][..., :3]).mean() for i in range(len(frames) - 1)]
        ds = np.array(ds); return float(ds.max() / max(1e-9, np.median(ds))), ds
    ramp = np.linspace(0, 1, 31)
    pr_b, _ = popratio([frame_baseline(W, H, layers, B, m) for m in ramp])
    lerp = lambda a, b, w: {p: a[p] * (1 - w) + b[p] * w for p in a}
    pr_o, _ = popratio([frame_ours(W, H, layers, an, lerp(MG.PRESETS['闭'], MG.PRESETS['A'], w), orig_closed_keep=False) for w in ramp])
    iou_fit, _ = fit_original(an, mouth, H, W)
    # jaw: chin displacement at full open (face alpha lowest row at mouth column)
    col = int(an['c'][0])
    def chin(img): return np.nonzero(img[:, col, 3] > 0.5)[0].max()
    chin_o = chin(jaw_warp(face['img'], an, MG.PRESETS['A'], face['bbox'])) - chin(face['img'])
    chin_b = round(1.0 * 6 * B['FS'], 1)
    met = dict(
        distinct_max_pair_iou=dict(baseline=pairmax(mb), ours=pairmax(mo), target='≤0.60'),
        open_ratio_A=dict(baseline=ext_b[1.0][1] / max(1, ext_b[1.0][0]), ours=ext_o['A'][1] / max(1, ext_o['A'][0]), target='≥0.35'),
        width_ratio_I_over_U=dict(baseline=max(e[0] for e in ext_b.values()) / max(1, min(e[0] for e in ext_b.values())),
                                  ours=ext_o['I'][0] / max(1, ext_o['U'][0]), target='≥1.6'),
        pop_ratio_0to1=dict(baseline=pr_b, ours=pr_o, target='≤3.0'),
        style_fit_iou=dict(ours=float(iou_fit), target='≥0.80'),
        chin_drop_px_at_A=dict(baseline=chin_b, ours=int(chin_o), target='≥0.25×w0=%.1f' % (0.25 * an['w0'])),
        independent_mouth_params=dict(baseline=1, ours=5, target='≥4'),
    )
    for k, v in met.items():
        for kk in ('baseline', 'ours'):
            if kk in v and isinstance(v[kk], float): v[kk] = round(v[kk], 3)
    json.dump(met, open(f'{OUT}/metrics_{name}.json', 'w'), ensure_ascii=False, indent=1)
    print(name, json.dumps(met, ensure_ascii=False))
    if os.environ.get('NOVIDEO'): return met
    # ---------- video ----------
    fdir = f'{OUT}/frames_{name}'; os.makedirs(fdir, exist_ok=True)
    T = sum(d for _, d in SEQ); n = int(T * FPS)
    for i in range(n):
        t = i / FPS
        P, k, ly = track(t)
        a = frame_baseline(W, H, layers, B, P['o'])
        b = frame_ours(W, H, layers, an, P)
        A_ = label(a, f'现状 Anime2.5DRig  open={P["o"]:.2f}', (170, 0, 0))
        B_ = label(b, f'新方案  [{k}] {ly}', (0, 110, 0))
        canvas = Image.new('RGB', (A_.width * 2 + 10, A_.height), 'white')
        canvas.paste(A_, (0, 0)); canvas.paste(B_, (A_.width + 10, 0))
        if canvas.width % 2: canvas = canvas.crop((0, 0, canvas.width - 1, canvas.height))
        if canvas.height % 2: canvas = canvas.crop((0, 0, canvas.width, canvas.height - 1))
        canvas.save(f'{fdir}/{i:04d}.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{fdir}/%04d.png',
                    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
                    f'{OUT}/compare_{name}.mp4'], check=True)
    return met

if __name__ == '__main__':
    allm = {k: run(k, p) for k, p in CASES.items()}
    json.dump(allm, open(f'{OUT}/metrics_all.json', 'w'), ensure_ascii=False, indent=1)
