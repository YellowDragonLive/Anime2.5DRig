"""
mouthgen.py — 从 see-through PSD 的 `mouth` 层自动生成参数化嘴型（闭/A/I/U/O/E），
并提供 Anime2.5DRig 现行口型逻辑的复刻（baseline）用于对比。

无任何按图硬编码坐标：所有几何/颜色都从 mouth 层 + face 层自动测量。
参数：open(0..1) width(s) round(r) form(f, 笑-1..1) teeth(tt) ；jaw 联动在 face 层做位移场。
"""
import numpy as np, cv2, json, sys, os
from PIL import Image
from psd_tools import PSDImage
from scipy import ndimage as ndi

SS = 4  # supersampling

# ---------------------------------------------------------------- PSD
def load_psd(path):
    p = PSDImage.open(path)
    W, H = p.width, p.height
    layers = []
    for l in p.descendants():
        if l.kind != 'pixel' or not l.visible:
            continue
        im = np.array(l.topil().convert('RGBA')).astype(np.float32) / 255.
        full = np.zeros((H, W, 4), np.float32)
        x0, y0, x1, y1 = l.bbox
        full[y0:y1, x0:x1] = im[:y1 - y0, :x1 - x0]
        layers.append({'name': l.name, 'img': full, 'bbox': l.bbox})
    return W, H, layers

def over(dst, src):
    a = src[..., 3:4]
    out = dst.copy()
    out[..., :3] = src[..., :3] * a + dst[..., :3] * (1 - a)
    out[..., 3:4] = a + dst[..., 3:4] * (1 - a)
    # un-premultiply-safe approximation (dst usually opaque bg)
    return out

def composite(W, H, layers, bg=(1, 1, 1)):
    out = np.zeros((H, W, 4), np.float32); out[..., :3] = bg; out[..., 3] = 1
    for L in layers:
        out = over(out, L['img'])
    return out

def lum(rgb):
    return rgb[..., 0] * .299 + rgb[..., 1] * .587 + rgb[..., 2] * .114

# ---------------------------------------------------------------- analysis
def analyze(mouth, face):
    a = mouth[..., 3]
    ys, xs = np.nonzero(a > 0.25)
    w = a[ys, xs]
    c = np.array([np.average(xs, weights=w), np.average(ys, weights=w)])
    P = np.stack([xs - c[0], ys - c[1]], 1)
    cov = (P * w[:, None]).T @ P / w.sum()
    ev, evec = np.linalg.eigh(cov)
    e1 = evec[:, 1]
    if e1[0] < 0: e1 = -e1
    th = float(np.arctan2(e1[1], e1[0]))
    e2 = np.array([-e1[1], e1[0]])  # "down" in local frame (y image down)
    if e2[1] < 0: e2 = -e2
    u = P @ e1; v = P @ e2
    umid = (np.percentile(u, 99.5) + np.percentile(u, 0.5)) / 2
    c = c + e1 * umid; u = u - umid
    w0 = (np.percentile(u, 99.5) - np.percentile(u, 0.5)) / 2

    rgb = mouth[ys, xs, :3]; L = lum(rgb)
    # skin: ring around mouth on face layer
    H, W = a.shape
    yy, xx = np.mgrid[0:H, 0:W]
    dd = np.hypot(xx - c[0], (yy - c[1]) * 1.6)
    ring = (dd > w0 * 1.3) & (dd < w0 * 2.2) & (face[..., 3] > 0.9)
    skin = face[ring][:, :3].mean(0)
    sl = lum(skin)
    Lmin = np.percentile(L, 2)
    dk = np.clip((sl * 0.92 - L) / max(1e-3, sl * 0.92 - Lmin), 0, 1) * w   # 墨线权重
    dark = dk > 0.35
    line_col = (rgb * (dk ** 3)[:, None]).sum(0) / max(1e-6, (dk ** 3).sum())
    t0 = float(np.clip(dk.sum() / (2 * w0), max(1.0, 0.055 * w0), w0 * 0.2))
    ud, vd, wd = u[dark], v[dark], dk[dark]
    nb = max(8, int(w0 / 2))
    bins = np.linspace(-w0, w0, nb + 1)
    cu, cv = [], []
    for i in range(nb):
        m = (ud >= bins[i]) & (ud < bins[i + 1])
        if m.sum() < 1: continue
        vv = vd[m]; ww = wd[m]
        top = vv <= np.percentile(vv, 60)
        cu.append((bins[i] + bins[i + 1]) / 2); cv.append(np.average(vv[top], weights=ww[top]))
    cu, cv = np.array(cu), np.array(cv)
    coef = np.polyfit(cu, cv, 2) if len(cu) >= 3 else np.array([0, 0, cv.mean()])
    # 原图是否张嘴：嘴内像素 = 与肤色明显不同、且不是墨线（牙更亮 / 口腔更暗红）
    diff = np.abs(rgb - skin).sum(1)
    interior = (~dark) & (w > 0.5) & (diff > 0.12) & ((L > sl * 1.0) | (L < sl * 0.8))
    inter_frac = float(interior.sum() / max(1, (w > 0.5).sum()))
    ext = v[(np.abs(u) < w0 * 0.25) & (w > 0.5) & (diff > 0.12)]
    h_center = float(ext.max() - ext.min()) if len(ext) else 0
    orig_open = inter_frac > 0.15 and h_center > 2.5 * t0
    if orig_open:
        bright = interior & (L >= np.percentile(L[interior], 70))
        teeth = rgb[bright].mean(0)
    else:
        teeth = 0.85 * np.array([1, 1, 1]) + 0.15 * skin
    teeth = np.clip(teeth * 0.6 + np.array([0.97, 0.95, 0.94]) * 0.4, 0, 1)
    deep = np.array([0.42, 0.10, 0.14])
    cavity = line_col * 0.45 + deep * 0.55
    tongue = np.array([0.86, 0.45, 0.47]) * 0.75 + skin * 0.25
    lipshade = skin * np.array([0.90, 0.80, 0.80])
    return dict(c=c.tolist(), th=th, e1=e1.tolist(), e2=e2.tolist(), w0=float(w0),
                coef=coef.tolist(), t0=t0, line=line_col.tolist(), skin=skin.tolist(),
                teeth=teeth.tolist(), cavity=cavity.tolist(), tongue=tongue.tolist(),
                lipshade=lipshade.tolist(), orig_open=bool(orig_open),
                h_center=h_center, inter_frac=inter_frac)

# ---------------------------------------------------------------- param model
PRESETS = {
    #       open  width round form  teeth
    '闭': dict(o=0.00, s=1.00, r=0.0, f=0.0, tt=0.0),
    'A':  dict(o=1.00, s=1.00, r=0.35, f=0.0, tt=0.55),
    'I':  dict(o=0.34, s=1.18, r=0.0, f=0.35, tt=1.0),
    'U':  dict(o=0.38, s=0.58, r=1.0, f=-0.1, tt=0.0),
    'E':  dict(o=0.55, s=1.10, r=0.15, f=0.2, tt=0.7),
    'O':  dict(o=0.72, s=0.70, r=1.0, f=-0.1, tt=0.25),
}

def _sstep(x):
    x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)

def mouth_geom(an, P):
    w0 = an['w0']; a2, a1, a0 = an['coef']
    W = w0 * P['s']
    h = P['o'] * 0.9 * w0
    def vb(uu):
        x = uu * w0
        return a0 + a1 * x + a2 * x * x - P['f'] * 0.16 * w0 * (uu * uu - 0.3)
    pu = 2 + 3 * (1 - P['r'])
    ql = 0.5 + 0.4 * (1 - P['r'])
    def su(uu): return np.power(np.clip(1 - np.abs(uu) ** pu, 0, 1), 0.5)
    def sl(uu): return np.power(np.clip(1 - np.abs(uu) ** 2, 0, 1), ql)
    yU = lambda uu: vb(uu) - 0.30 * h * su(uu)
    yL = lambda uu: vb(uu) + 0.70 * h * sl(uu)
    return W, h, vb, yU, yL

def render_mouth(an, P, H, W_img, pad=None):
    """returns full-canvas RGBA float, plus roi box"""
    w0 = an['w0']; c = np.array(an['c']); e1 = np.array(an['e1']); e2 = np.array(an['e2'])
    R = int(w0 * 1.9) + 6
    x0, x1 = int(c[0] - R), int(c[0] + R); y0, y1 = int(c[1] - R), int(c[1] + R)
    n_x, n_y = (x1 - x0) * SS, (y1 - y0) * SS
    gx = x0 + (np.arange(n_x) + 0.5) / SS; gy = y0 + (np.arange(n_y) + 0.5) / SS
    X, Y = np.meshgrid(gx, gy)
    dx, dy = X - c[0], Y - c[1]
    u = dx * e1[0] + dy * e1[1]; v = dx * e2[0] + dy * e2[1]
    Wd, h, vb, yU, yL = mouth_geom(an, P)
    uu = u / Wd
    inside = np.abs(uu) < 1
    uuc = np.clip(uu, -1, 1)
    YU, YL, VB = yU(uuc), yL(uuc), vb(uuc)
    t0 = an['t0']
    cav = inside & (v > YU) & (v < YL)
    out = np.zeros((n_y, n_x, 4), np.float32)
    def paint(mask, col, alpha=1.0):
        m = mask.astype(np.float32) * alpha
        if np.ndim(col) == 1: col = np.broadcast_to(np.array(col, np.float32), out[..., :3].shape)
        out[..., :3] = col * m[..., None] + out[..., :3] * (1 - m[..., None])
        out[..., 3] = m + out[..., 3] * (1 - m)
    hh = max(h, 1e-3)
    if cav.any():
        # cavity with vertical gradient (darker at top)
        g = np.clip((v - YU) / np.maximum(YL - YU, 1e-3), 0, 1)[..., None]
        cc = np.array(an['cavity']) * (0.75 + 0.35 * g)
        paint(cav, cc)
        # tongue
        tw = 0.62 * Wd; tcy = YL.max() if False else vb(0) + 0.70 * h * 0.95
        tong = cav & ((u / tw) ** 2 + ((v - tcy) / (0.38 * hh)) ** 2 < 1)
        paint(tong, an['tongue'], float(_sstep((P['o'] - 0.25) / 0.4)))
        # teeth
        tt = P['tt']
        if tt > 0:
            tH = (0.16 + 0.42 * tt) * (YL - YU) if P['o'] < 0.5 else (0.18 * w0) * (0.5 + 0.5 * tt)
            up = cav & (v < YU + tH) & (np.abs(uu) < 0.88)
            paint(up, an['teeth'])
            if tt > 0.8 and P['o'] < 0.5:
                lo = cav & (v > YL - 0.30 * (YL - YU)) & (np.abs(uu) < 0.7)
                paint(lo, np.array(an['teeth']) * 0.94)
    # lower lip line & shade
    if h > t0 * 1.2:
        k = _sstep((h - t0 * 1.2) / (t0 * 2))
        lt = 0.75 * t0
        lowband = inside & (v > YL - 0.25 * lt) & (v < YL + lt) & (np.abs(uu) < 0.97)
        paint(lowband, an['line'], 0.55 * k)
        sh_c = YL + lt + 0.10 * w0 * P['o']
        shade = np.exp(-(u / (0.45 * Wd)) ** 2 - ((v - sh_c) / (0.09 * w0 + 0.5)) ** 2)
        paint(shade, an['lipshade'], 0.22 * k)
    # outline ring for rounded side walls (EDT outside cavity)
    if cav.sum() > 16:
        d_out = ndi.distance_transform_edt(~cav) / SS
        upper_half = v < (YU + YL) / 2
        ring = (d_out > 0) & (d_out < t0 * 0.75) & upper_half
        paint(ring, an['line'])
        ring2 = (d_out > 0) & (d_out < t0 * 0.5) & ~upper_half
        paint(ring2, an['line'], 0.6)
    # upper line (always; = closed mouth when h=0)
    taper = _sstep((1.04 - np.abs(uu)) / 0.12)
    tU = t0 * (0.8 + 0.5 * uuc ** 2) * taper
    upline = (np.abs(uu) < 1.04) & (v > YU - 0.6 * tU) & (v < YU + 0.4 * tU + (0.35 * t0 if h < t0 else 0))
    paint(upline, an['line'])
    # downsample (premultiplied)
    pm = out[..., :3] * out[..., 3:4]
    pm = pm.reshape(n_y // SS, SS, n_x // SS, SS, 3).mean((1, 3))
    al = out[..., 3].reshape(n_y // SS, SS, n_x // SS, SS).mean((1, 3))
    rgb = pm / np.maximum(al[..., None], 1e-6)
    full = np.zeros((H, W_img, 4), np.float32)
    full[y0:y1, x0:x1, :3] = rgb; full[y0:y1, x0:x1, 3] = al
    return full, (x0, y0, x1, y1)

def jaw_warp(img, an, P, face_bbox, strength=0.55):
    """face 层位移场：下颌随张嘴下移，U/O 时嘴角两侧脸颊略内收"""
    H, W = img.shape[:2]
    c = np.array(an['c']); e1 = np.array(an['e1']); e2 = np.array(an['e2']); w0 = an['w0']
    Wd, h, vb, yU, yL = mouth_geom(an, P)
    drop = strength * 0.70 * h
    fx0, fy0, fx1, fy1 = face_bbox
    X, Y = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    dx, dy = X - c[0], Y - c[1]
    u = dx * e1[0] + dy * e1[1]; v = dx * e2[0] + dy * e2[1]
    vchin = (fy1 - c[1]) * 1.0
    wy = _sstep(v / (0.35 * vchin)) * (1 - 0.0 * _sstep((v - vchin) / 20))
    wx = np.exp(-(u / ((fx1 - fx0) * 0.38)) ** 2)
    d = drop * wy * wx
    # cheek squeeze for narrow mouths
    sq = (1 - P['s']) * w0 * 0.35
    cs = sq * np.tanh(u / w0) * np.exp(-(u / (w0 * 1.8)) ** 2 - (v / (w0 * 1.4)) ** 2)
    du = cs
    mapx = (X - (d * e2[0] + du * e1[0])).astype(np.float32)
    mapy = (Y - (d * e2[1] + du * e1[1])).astype(np.float32)
    return cv2.remap(img, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)

def chin_shift(an, P, face_bbox, strength=0.55):
    Wd, h, *_ = mouth_geom(an, P)
    return strength * 0.70 * h

# ---------------------------------------------------------------- ours: frame
def frame_ours(W, H, layers, an, P, orig_closed_keep=True):
    out = np.zeros((H, W, 4), np.float32); out[..., :3] = 1; out[..., 3] = 1
    face_bbox = next(L['bbox'] for L in layers if L['name'] == 'face')
    for L in layers:
        if L['name'] == 'mouth':
            if (not an['orig_open']) and orig_closed_keep and P['o'] < 0.02 and abs(P['s'] - 1) < 0.02:
                out = over(out, L['img'])      # 闭口=原画（原图本来就是闭口）
            else:
                m, _ = render_mouth(an, P, H, W)
                out = over(out, m)
            continue
        img = L['img']
        if L['name'] == 'face':
            img = jaw_warp(img, an, P, face_bbox)
        out = over(out, img)
    return out

def fit_original(an, mouth, H, W):
    """拟合原图嘴：返回最佳参数及 IoU（风格/形状保真度）"""
    tgt = mouth[..., 3] > 0.35
    best = (-1, None)
    for o in np.linspace(0, 0.8, 17):
        for f in np.linspace(-0.6, 1.0, 9):
            for tt in ([0, 0.5, 1.0] if an['orig_open'] else [0]):
                P = dict(o=o, s=1.0, r=0.0, f=f, tt=tt)
                m, _ = render_mouth(an, P, H, W)
                pr = m[..., 3] > 0.35
                iou = (pr & tgt).sum() / max(1, (pr | tgt).sum())
                if iou > best[0]: best = (iou, P)
    return best

# ---------------------------------------------------------------- baseline (Anime2.5DRig v2 logic)
def _gen_mouth_sprite(js_path):
    import re, base64
    s = open(js_path, encoding='utf8').read()
    m = re.search(r"P\.mouth=\{width:(\d+),height:(\d+),b64:'([^']+)'", s)
    w, h = int(m.group(1)), int(m.group(2))
    d = np.frombuffer(base64.b64decode(m.group(3)), np.uint8).reshape(h, w, 4).astype(np.float32) / 255.
    return d

def baseline_setup(W, H, layers, js_path):
    mouth = next(L for L in layers if L['name'] == 'mouth')
    face = next(L for L in layers if L['name'] == 'face')
    a = (mouth['img'][..., 3] * 255).astype(np.uint8)
    ys, xs = np.nonzero(a > 8)
    mb = dict(x0=xs.min(), x1=xs.max(), y0=ys.min(), y1=ys.max())
    aw = mouth['img'][..., 3]
    yy, xx = np.nonzero(aw > 0)
    cx = np.average(xx, weights=aw[yy, xx]); cy = np.average(yy, weights=aw[yy, xx])
    # generic close sprite, tinted (meanColorOfImg darkWeight) + recolorTo
    rgb = mouth['img'][..., :3]; al = mouth['img'][..., 3]
    m = (al * 255) >= 24
    lumv = rgb[m].mean(1) * 255
    wts = al[m] * (1 - lumv / 255) ** 2
    tint = (rgb[m] * wts[:, None]).sum(0) / wts.sum()
    g = _gen_mouth_sprite(js_path)
    tw = max(2, round((mb['x1'] - mb['x0']) * 1.1)); th = max(2, round(g.shape[0] * tw / g.shape[1]))
    spr = cv2.resize(g, (tw, th), interpolation=cv2.INTER_LINEAR)
    A_ = spr[..., 3] > 24 / 255
    lm = spr[..., :3].mean(2); mean = max(8 / 255, lm[A_].mean())
    f = np.minimum(2.2, lm / mean)
    spr[..., :3] = tint[None, None] * f[..., None]
    sx = int(round(cx - tw / 2)); sy = int(round(mb['y0'] + 0.3 * (mb['y1'] - mb['y0']) - 0.5 * th))
    close = np.zeros((H, W, 4), np.float32)
    close[sy:sy + th, sx:sx + tw] = spr
    fb = face['bbox']
    FS = max(1, fb[2] - fb[0]) / 333.0
    return dict(mb=mb, cx=cx, cy=cy, close=close, FS=FS, face_y1=fb[3])

def frame_baseline(W, H, layers, B, mo, ease=0.72):
    def sm(t):
        t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
    thr = 0.05 + ease * 0.35
    a_open = float(sm((mo - thr) / 0.12)); a_close = 1 - a_open
    out = np.zeros((H, W, 4), np.float32); out[..., :3] = 1; out[..., 3] = 1
    X, Y = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    for L in layers:
        img = L['img']
        if L['name'] == 'face':
            # y += mo*6*FS*smooth((y-cy)/(face.y1-cy)) — 近似逆映射
            d = mo * 6 * B['FS'] * sm((Y - B['cy']) / max(1, B['face_y1'] - B['cy']))
            img = cv2.remap(img, X, (Y - d).astype(np.float32), cv2.INTER_LINEAR)
        if L['name'] == 'mouth':
            k = 0.5 + 0.5 * mo
            y0 = B['mb']['y0']
            mapy = (y0 + (Y - y0) / k).astype(np.float32)
            mimg = cv2.remap(img, X, mapy, cv2.INTER_LINEAR)
            mimg = mimg.copy(); mimg[..., 3] *= a_open
            out = over(out, mimg)
            cl = B['close'].copy(); cl[..., 3] *= a_close
            out = over(out, cl)
            continue
        out = over(out, img)
    return out

def to_u8(img):
    return (np.clip(img[..., :3], 0, 1) * 255).astype(np.uint8)
