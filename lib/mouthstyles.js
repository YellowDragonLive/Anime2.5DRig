/*!
 * Anime2.5DRig — mouthstyles.js
 * Selectable vector mouth styles (口のスタイル) for the procedural mouth.
 *
 * Every style is a set of SVG path keyframes — 閉 / あ / い / う / え / お —
 * in a normalised mouth space: x ∈ about [-1.3, 1.3] (1 = the drawn mouth's
 * half width), y down, 0 = the closed lip line. All keyframes of a style use
 * the same path commands, so a mouth between vowels is a plain weighted
 * average of the numbers (no cross-fade, no ghosting).
 *
 * At draw time the shape is bent onto the measured lip curve, tilted, scaled
 * to the character and coloured from the PSD (ink, skin, lips).
 *
 * Shapes per keyframe (any can be omitted by a style):
 *   cavity  closed path, the open mouth
 *   tongue, teethU, teethL   closed paths, clipped to the cavity
 *   lipU, lipL               closed paths, painted lips (skin side)
 *   lineU, lineL             open paths, stroked with a tapered pen
 * Add your own style: push an object to STYLES with `frames` holding either
 * shape numbers (see shapes()) or raw `d` strings with matching commands.
 * MIT License
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MouthStyles = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SS = 4;   // supersampling per axis
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function f3(v) { return (Math.round(v * 1000) / 1000).toString(); }

  // ------------------------------------------------------------ path keyframes
  // A keyframe is generated from a few numbers so every style shares one topology.
  //   W half width · cy corner height · top / bot opening at the centre
  //   k1 h1 k2 upper-edge handles · k3 h3 k4 lower-edge handles (0.552 ≈ ellipse)
  //   tH upper-teeth band · tL lower-teeth band · gw gh tongue · lu ll lip thickness
  var BASE = { W: 1, cy: 0, top: 0, bot: 0, k1: 0.3, h1: 0.5, k2: 0.5, k3: 0.3, h3: 0.5, k4: 0.5,
               tH: 0, tL: 0, gw: 0.5, gh: 0, lu: 0, ll: 0 };
  function edge(W, cy, mid, k1, h1, k2) {   // left corner → centre → right corner, two cubics
    return [[-W, cy], [-W * (1 - k1), cy + (mid - cy) * h1], [-W * k2, mid], [0, mid],
            [W * k2, mid], [W * (1 - k1), cy + (mid - cy) * h1], [W, cy]];
  }
  function P(pts) { return pts.map(function (p) { return f3(p[0]) + ' ' + f3(p[1]); }); }
  function openD(pts) { var q = P(pts); return 'M' + q[0] + ' C' + q[1] + ' ' + q[2] + ' ' + q[3] + ' C' + q[4] + ' ' + q[5] + ' ' + q[6]; }
  function closedD(a, b) {   // a: left→right (7 pts), b: right→left (7 pts)
    var p = P(a), q = P(b);
    return 'M' + p[0] + ' C' + p[1] + ' ' + p[2] + ' ' + p[3] + ' C' + p[4] + ' ' + p[5] + ' ' + p[6] +
           ' L' + q[0] + ' C' + q[1] + ' ' + q[2] + ' ' + q[3] + ' C' + q[4] + ' ' + q[5] + ' ' + q[6] + ' Z';
  }
  function rev(pts) { return pts.slice().reverse(); }
  function shift(pts, dy, prof) {   // move an edge vertically, tapering to the corners
    return pts.map(function (p, i) { var w = prof ? prof[i] : 1; return [p[0], p[1] + dy * w]; });
  }
  var TAPER = [0, 0.35, 0.9, 1, 0.9, 0.35, 0];
  function shapes(k) {
    var f = {}; for (var key in BASE) f[key] = k[key] == null ? BASE[key] : k[key];
    var up = edge(f.W, f.cy, f.top, f.k1, f.h1, f.k2), lo = edge(f.W, f.cy, f.bot, f.k3, f.h3, f.k4);
    var out = {};
    out.cavity = closedD(up, rev(lo));
    out.lineU = openD(up);
    out.lineL = openD(lo);
    out.teethU = closedD(shift(up, -0.3), rev(shift(up, f.tH, [0.4, 0.7, 1, 1, 1, 0.7, 0.4])));
    out.teethL = closedD(shift(lo, -f.tL, [0.4, 0.7, 1, 1, 1, 0.7, 0.4]), rev(shift(lo, 0.3)));
    var cx = 0, cyT = f.bot - f.gh * 0.35, rx = f.W * f.gw, ry = Math.max(0.001, f.gh), c = 0.552;
    out.tongue = 'M' + f3(cx - rx) + ' ' + f3(cyT) +
      ' C' + f3(cx - rx) + ' ' + f3(cyT - ry * c) + ' ' + f3(cx - rx * c) + ' ' + f3(cyT - ry) + ' ' + f3(cx) + ' ' + f3(cyT - ry) +
      ' C' + f3(cx + rx * c) + ' ' + f3(cyT - ry) + ' ' + f3(cx + rx) + ' ' + f3(cyT - ry * c) + ' ' + f3(cx + rx) + ' ' + f3(cyT) +
      ' C' + f3(cx + rx) + ' ' + f3(cyT + ry * c) + ' ' + f3(cx + rx * c) + ' ' + f3(cyT + ry) + ' ' + f3(cx) + ' ' + f3(cyT + ry) +
      ' C' + f3(cx - rx * c) + ' ' + f3(cyT + ry) + ' ' + f3(cx - rx) + ' ' + f3(cyT + ry * c) + ' ' + f3(cx - rx) + ' ' + f3(cyT) + ' Z';
    out.lipU = closedD(shift(up, -f.lu, TAPER), rev(up));
    out.lipL = closedD(lo, rev(shift(lo, f.ll, TAPER)));
    return out;
  }
  var ELL = { k1: 0, h1: 0.552, k2: 0.552, k3: 0, h3: 0.552, k4: 0.552 };
  function ex(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  // paint: line width (× measured ink), lower line opacity, what to draw
  var STYLES = [
    { id: 'anime', label: 'アニメ標準', note: '細い上唇線 + 口内・舌・上の歯。迷ったらこれ',
      paint: { lineW: 1.0, lineL: 0.55, teeth: true, tongue: true, lips: false, outline: false, shade: true },
      frames: {
        closed: { W: 1.0, top: 0, bot: 0, cy: 0 },
        a: { W: 0.92, cy: 0.06, top: -0.16, bot: 0.86, k1: 0.25, h1: 0.6, k2: 0.5, k3: 0.06, h3: 0.75, k4: 0.62, tH: 0.13, gw: 0.55, gh: 0.3 },
        i: { W: 1.15, cy: 0.0, top: -0.08, bot: 0.3, k1: 0.35, h1: 0.5, k2: 0.55, k3: 0.3, h3: 0.6, k4: 0.6, tH: 0.15, tL: 0.1, gw: 0.4, gh: 0.04 },
        u: ex(ELL, { W: 0.46, cy: 0.06, top: -0.1, bot: 0.36, gw: 0.5, gh: 0.1 }),
        e: { W: 1.04, cy: 0.03, top: -0.13, bot: 0.52, k1: 0.3, h1: 0.55, k2: 0.55, k3: 0.15, h3: 0.7, k4: 0.6, tH: 0.14, tL: 0.06, gw: 0.5, gh: 0.2 },
        o: ex(ELL, { W: 0.64, cy: 0.12, top: -0.18, bot: 0.72, k1: 0.05, k3: 0.05, tH: 0.07, gw: 0.5, gh: 0.24 })
      } },
    { id: 'lips', label: '唇あり（リアル寄り）', note: '色の付いた上下の唇。see-through の厚塗り・リアル系の顔に',
      paint: { lineW: 0.7, lineL: 0, teeth: true, tongue: true, lips: true, outline: false, shade: true },
      frames: {
        closed: { W: 0.92, top: 0, bot: 0, cy: 0, lu: 0.12, ll: 0.2 },
        a: { W: 0.86, cy: 0.06, top: -0.12, bot: 0.74, k1: 0.2, h1: 0.6, k2: 0.5, k3: 0.08, h3: 0.75, k4: 0.6, tH: 0.12, gw: 0.55, gh: 0.26, lu: 0.1, ll: 0.16 },
        i: { W: 1.06, cy: 0.0, top: -0.06, bot: 0.24, k1: 0.35, h1: 0.5, k2: 0.55, k3: 0.3, h3: 0.6, k4: 0.6, tH: 0.12, tL: 0.09, gw: 0.4, gh: 0.03, lu: 0.08, ll: 0.13 },
        u: ex(ELL, { W: 0.42, cy: 0.06, top: -0.08, bot: 0.3, gw: 0.5, gh: 0.08, lu: 0.13, ll: 0.18 }),
        e: { W: 0.98, cy: 0.03, top: -0.1, bot: 0.44, k1: 0.3, h1: 0.55, k2: 0.55, k3: 0.15, h3: 0.7, k4: 0.6, tH: 0.12, tL: 0.05, gw: 0.5, gh: 0.18, lu: 0.09, ll: 0.15 },
        o: ex(ELL, { W: 0.58, cy: 0.1, top: -0.15, bot: 0.6, k1: 0.05, k3: 0.05, tH: 0.06, gw: 0.5, gh: 0.2, lu: 0.12, ll: 0.17 })
      } },
    { id: 'simple', label: 'シンプル（ベタ塗り）', note: '口内は一色、歯・舌なし。崩れにくく、どの絵柄にも馴染む',
      paint: { lineW: 1.0, lineL: 0, teeth: false, tongue: false, lips: false, outline: false, shade: false },
      frames: {
        closed: { W: 0.95, top: 0, bot: 0, cy: 0 },
        a: { W: 0.9, cy: 0.06, top: -0.12, bot: 0.8, k1: 0.25, h1: 0.6, k2: 0.5, k3: 0.06, h3: 0.75, k4: 0.62 },
        i: { W: 1.08, cy: 0.0, top: -0.05, bot: 0.22, k1: 0.35, h1: 0.5, k2: 0.55, k3: 0.3, h3: 0.6, k4: 0.6 },
        u: ex(ELL, { W: 0.4, cy: 0.06, top: -0.08, bot: 0.32 }),
        e: ex(ELL, { W: 0.9, cy: 0.05, top: -0.1, bot: 0.45, k1: 0.2, k3: 0.15 }),
        o: ex(ELL, { W: 0.5, cy: 0.12, top: -0.18, bot: 0.7 })
      } },
    { id: 'deform', label: 'デフォルメ（ちびキャラ）', note: '丸い口と太めの輪郭線、大きめの舌。ちび・SD絵向け',
      paint: { lineW: 1.5, lineL: 1, teeth: false, tongue: true, lips: false, outline: true, shade: false },
      frames: {
        closed: { W: 0.8, top: -0.04, bot: -0.04, cy: -0.12, k1: 0.4, h1: 0.4, k2: 0.6, k3: 0.4, h3: 0.4, k4: 0.6 },
        a: { W: 0.86, cy: 0.04, top: -0.06, bot: 0.95, k1: 0.3, h1: 0.5, k2: 0.6, k3: 0.02, h3: 0.8, k4: 0.6, gw: 0.6, gh: 0.36 },
        i: { W: 0.95, cy: -0.04, top: -0.04, bot: 0.34, k1: 0.3, h1: 0.5, k2: 0.55, k3: 0.25, h3: 0.7, k4: 0.6, gw: 0.45, gh: 0.08 },
        u: ex(ELL, { W: 0.36, cy: 0.06, top: -0.06, bot: 0.38, gw: 0.55, gh: 0.12 }),
        e: ex(ELL, { W: 0.82, cy: 0.04, top: -0.06, bot: 0.55, k1: 0.2, k3: 0.1, gw: 0.55, gh: 0.22 }),
        o: ex(ELL, { W: 0.46, cy: 0.14, top: -0.16, bot: 0.8, gw: 0.55, gh: 0.28 })
      } }
  ];
  var SHAPE_KEYS = ['cavity', 'tongue', 'teethU', 'teethL', 'lipU', 'lipL', 'lineU', 'lineL'];
  var VKEYS = ['closed', 'a', 'i', 'u', 'e', 'o'];

  // d string → {cmds, nums}; keyframes are compiled once
  function parse(d) {
    var cmds = [], nums = [], re = /([MCLZ])|(-?\d*\.?\d+(?:e-?\d+)?)/gi, m;
    while ((m = re.exec(d))) { if (m[1]) cmds.push(m[1].toUpperCase()); else nums.push(parseFloat(m[2])); }
    return { cmds: cmds.join(''), nums: nums };
  }
  function compile(style) {
    if (style._c) return style._c;
    var c = {};
    VKEYS.forEach(function (v) {
      var fr = style.frames[v];
      var d = fr && fr.cavity && typeof fr.cavity === 'string' ? fr : shapes(fr || {});
      c[v] = {};
      SHAPE_KEYS.forEach(function (s) { if (d[s]) c[v][s] = parse(d[s]); });
    });
    SHAPE_KEYS.forEach(function (s) {   // every keyframe must share the commands
      var ref = c.closed[s]; if (!ref) return;
      VKEYS.forEach(function (v) {
        if (!c[v][s] || c[v][s].cmds !== ref.cmds || c[v][s].nums.length !== ref.nums.length)
          throw new Error('mouth style ' + style.id + ': ' + s + '/' + v + ' does not match the closed keyframe');
      });
    });
    style._c = c;
    return c;
  }
  function blend(style, P) {   // P.t open 0..1, P.w normalised vowel weights
    var c = compile(style), out = {}, w = P.w || { a: 1 }, t = P.t == null ? P.o : P.t;
    SHAPE_KEYS.forEach(function (s) {
      var base = c.closed[s]; if (!base) return;
      var n = base.nums.length, acc = new Float64Array(n), tot = 0, i;
      ['a', 'i', 'u', 'e', 'o'].forEach(function (v) {
        var k = w[v] || 0; if (!k) return; tot += k;
        for (i = 0; i < n; i++) acc[i] += c[v][s].nums[i] * k;
      });
      var nums = new Float64Array(n);
      for (i = 0; i < n; i++) nums[i] = base.nums[i] + ((tot ? acc[i] / tot : base.nums[i]) - base.nums[i]) * t;
      out[s] = { cmds: base.cmds, nums: nums };
    });
    return out;
  }
  // flatten to polylines (arrays of [x,y]); closed paths keep their closing segment implicit
  function flatten(path, map) {
    var pts = [], k = 0, cur = null, steps = 14;
    for (var ci = 0; ci < path.cmds.length; ci++) {
      var c = path.cmds[ci], a = path.nums;
      if (c === 'M' || c === 'L') { cur = [a[k], a[k + 1]]; k += 2; pts.push(map(cur[0], cur[1])); }
      else if (c === 'C') {
        var x1 = a[k], y1 = a[k + 1], x2 = a[k + 2], y2 = a[k + 3], x3 = a[k + 4], y3 = a[k + 5]; k += 6;
        for (var s = 1; s <= steps; s++) {
          var t = s / steps, u = 1 - t, b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
          pts.push(map(b0 * cur[0] + b1 * x1 + b2 * x2 + b3 * x3, b0 * cur[1] + b1 * y1 + b2 * y2 + b3 * y3));
        }
        cur = [x3, y3];
      }
    }
    return pts;
  }
  // nonzero scanline fill into a mask (subsample grid)
  var BB = [0, -1];   // rows touched by the last fill
  function fill(polys, Wd, Hd, mask) {
    if (BB[1] >= BB[0] && mask._bb) mask.fill(0, mask._bb[0] * Wd, (mask._bb[1] + 1) * Wd); else if (!mask._bb) mask.fill(0);
    mask._bb = [0, -1]; BB = mask._bb;
    var ymin = Infinity, ymax = -Infinity, e = [], p, i;
    for (p = 0; p < polys.length; p++) {
      var pts = polys[p];
      for (i = 0; i < pts.length; i++) {
        var A = pts[i], B = pts[(i + 1) % pts.length];
        if (A[1] === B[1]) continue;
        e.push(A[0], A[1], B[0], B[1]);
        ymin = Math.min(ymin, A[1], B[1]); ymax = Math.max(ymax, A[1], B[1]);
      }
    }
    if (!e.length) return 0;
    var y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(Hd - 1, Math.ceil(ymax)), xs = [], n = 0;
    mask._bb[0] = y0; mask._bb[1] = y1;
    for (var y = y0; y <= y1; y++) {
      var sy = y + 0.5; xs.length = 0;
      for (i = 0; i < e.length; i += 4) {
        var ay = e[i + 1], by = e[i + 3];
        if ((ay <= sy) !== (by <= sy)) xs.push([e[i] + (sy - ay) * (e[i + 2] - e[i]) / (by - ay), by > ay ? 1 : -1]);
      }
      if (xs.length < 2) continue;
      xs.sort(function (a, b) { return a[0] - b[0]; });
      var wnd = 0;
      for (i = 0; i < xs.length - 1; i++) {
        wnd += xs[i][1];
        if (!wnd) continue;
        var xa = Math.max(0, Math.ceil(xs[i][0] - 0.5)), xb = Math.min(Wd - 1, Math.floor(xs[i + 1][0] - 0.5));
        for (var x = xa; x <= xb; x++) { mask[y * Wd + x] = 1; n++; }
      }
    }
    return n;
  }
  function strokePoly(pts, wfn) {   // tapered pen → closed polygon
    var L = [], R = [], n = pts.length;
    if (n < 2) return [];
    for (var i = 0; i < n; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = wfn(i / (n - 1)) / 2;
      L.push([pts[i][0] - dy / l * w, pts[i][1] + dx / l * w]); R.push([pts[i][0] + dy / l * w, pts[i][1] - dx / l * w]);
    }
    return L.concat(R.reverse());
  }

  // ------------------------------------------------------------ render
  function render(st, style, P, out) {
    var Wb = st.box.w, Hb = st.box.h, Wd = Wb * SS, Hd = Hb * SS, N = Wd * Hd;
    var buf = render._buf && render._buf.length === N * 4 ? render._buf : (render._buf = new Float32Array(N * 4));
    var mask = render._m && render._m.length === N ? render._m : (render._m = new Uint8Array(N));
    var cav = render._c && render._c.length === N ? render._c : (render._c = new Uint8Array(N));
    buf.fill(0); mask.fill(0); cav.fill(0); mask._bb = null; cav._bb = null;
    var sh = blend(style, P), pt = style.paint, w0 = st.w0, f = P.f || 0;
    var c0 = st.coef[0], c1 = st.coef[1], c2 = st.coef[2], e1 = st.e1, e2 = st.e2;
    var ox = st.c[0] - st.box.x, oy = st.c[1] - st.box.y;
    function map(x, y) {   // normalised → subsample pixels: lip curve, smile, tilt, scale
      var u = x * w0, v = y * w0 + c0 + c1 * u + c2 * u * u - f * 0.16 * w0 * (x * x - 0.3);
      return [(ox + u * e1[0] + v * e2[0]) * SS, (oy + u * e1[1] + v * e2[1]) * SS];
    }
    function paint(m, col, alpha, grad) {
      var r0 = m._bb[0], r1 = m._bb[1], i, y, iEnd = (r1 + 1) * Wd;
      if (r1 < r0) return;
      for (i = r0 * Wd; i < iEnd; i++) {
        if (!m[i]) continue;
        var k = 1;
        if (grad) { y = (i / Wd) | 0; k = 0.72 + 0.4 * (r1 > r0 ? (y - r0) / (r1 - r0) : 0); }
        var q = i * 4, a = alpha;
        buf[q] = col[0] * k * a + buf[q] * (1 - a); buf[q + 1] = col[1] * k * a + buf[q + 1] * (1 - a);
        buf[q + 2] = col[2] * k * a + buf[q + 2] * (1 - a); buf[q + 3] = a + buf[q + 3] * (1 - a);
      }
    }
    function and(m, c) { if (m._bb[1] < m._bb[0]) return; for (var i = m._bb[0] * Wd, e = (m._bb[1] + 1) * Wd; i < e; i++) m[i] &= c[i]; }
    var t0 = st.t0 * SS * (pt.lineW || 1), openK = sstep(((sh.cavity ? 0 : 0) + (P.t == null ? P.o : P.t)) / 0.12);
    var hasCav = sh.cavity && fill([flatten(sh.cavity, map)], Wd, Hd, cav) > 0;
    // lips (under everything else)
    if (pt.lips) {
      var lipC = st.lip, lipU = [lipC[0] * 0.9, lipC[1] * 0.86, lipC[2] * 0.88];
      if (sh.lipL && fill([flatten(sh.lipL, map)], Wd, Hd, mask)) paint(mask, lipC, 0.9, false);
      if (sh.lipU && fill([flatten(sh.lipU, map)], Wd, Hd, mask)) paint(mask, lipU, 0.9, false);
    }
    if (hasCav) {
      paint(cav, st.cavity, 1, !!pt.shade);
      if (pt.tongue && sh.tongue && fill([flatten(sh.tongue, map)], Wd, Hd, mask)) { and(mask, cav); paint(mask, st.tongue, sstep(((P.t == null ? P.o : P.t) - 0.15) / 0.35), false); }
      if (pt.teeth && sh.teethU && fill([flatten(sh.teethU, map)], Wd, Hd, mask)) { and(mask, cav); paint(mask, st.teeth, 1, false); }
      if (pt.teeth && sh.teethL && fill([flatten(sh.teethL, map)], Wd, Hd, mask)) { and(mask, cav); paint(mask, [st.teeth[0] * 0.94, st.teeth[1] * 0.94, st.teeth[2] * 0.94], 1, false); }
    }
    var ink = st.line;
    if (pt.outline && hasCav && sh.cavity) {
      var ring = flatten(sh.cavity, map); ring.push(ring[0]);
      if (fill([strokePoly(ring, function () { return t0 * 0.9 * openK; })], Wd, Hd, mask)) paint(mask, ink, 1, false);
    }
    if (pt.lineL && sh.lineL && openK > 0.01) {
      var pl = flatten(sh.lineL, map);
      if (fill([strokePoly(pl, function (s) { return t0 * 0.75 * Math.pow(Math.sin(Math.PI * s), 1.4); })], Wd, Hd, mask)) paint(mask, ink, pt.lineL * openK, false);
    }
    if (sh.lineU) {
      var pu = flatten(sh.lineU, map);
      var wU = function (s) { var e = Math.min(s, 1 - s) / 0.12; return t0 * (0.55 + 0.45 * Math.pow(1 - Math.abs(2 * s - 1), 0.5)) * sstep(e); };
      if (fill([strokePoly(pu, wU)], Wd, Hd, mask)) paint(mask, ink, 1, false);
    }
    // downsample (premultiplied in buf) → straight alpha
    var d = out.data, inv = 1 / (SS * SS);
    for (var py = 0; py < Hb; py++) for (var px = 0; px < Wb; px++) {
      var r = 0, g = 0, b = 0, a = 0;
      for (var sy = 0; sy < SS; sy++) {
        var q = ((py * SS + sy) * Wd + px * SS) * 4;
        for (var sx = 0; sx < SS; sx++, q += 4) { r += buf[q]; g += buf[q + 1]; b += buf[q + 2]; a += buf[q + 3]; }
      }
      var o = (py * Wb + px) * 4;
      if (a > 0) { d[o] = r / a * 255; d[o + 1] = g / a * 255; d[o + 2] = b / a * 255; d[o + 3] = a * inv * 255; }
      else d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 0;
    }
    return out;
  }

  function get(id) { for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === id) return STYLES[i]; return null; }
  /** おまかせ: an open drawn mouth → redraw it from its own measurements ('measured'),
   *  painted closed lips → lips, otherwise the standard anime mouth. */
  function pick(st) { if (!st) return 'anime'; if (st.origOpen) return 'measured'; return st.lipFrac > 0.25 ? 'lips' : 'anime'; }
  /** A keyframe as a standalone SVG (for galleries / editing in Inkscape). */
  function toSVG(id, vowel) {
    var s = get(id), c = compile(s)[vowel || 'a'], body = '';
    function d(p) { var k = 0, out = ''; for (var i = 0; i < p.cmds.length; i++) { var cm = p.cmds[i], n = cm === 'C' ? 6 : cm === 'Z' ? 0 : 2; out += cm + (n ? Array.prototype.slice.call(p.nums, k, k + n).map(f3).join(' ') : '') + ' '; k += n; } return out.trim(); }
    if (s.paint.lips) body += '<path d="' + d(c.lipL) + '" fill="#d98a8a"/><path d="' + d(c.lipU) + '" fill="#c97a7d"/>';
    body += '<path d="' + d(c.cavity) + '" fill="#6b1f2a"/>';
    if (s.paint.tongue) body += '<path d="' + d(c.tongue) + '" fill="#e38791" clip-path="url(#cav)"/>';
    if (s.paint.teeth) body += '<path d="' + d(c.teethU) + '" fill="#fbf6f2" clip-path="url(#cav)"/><path d="' + d(c.teethL) + '" fill="#efe9e5" clip-path="url(#cav)"/>';
    if (s.paint.lineL) body += '<path d="' + d(c.lineL) + '" fill="none" stroke="#4a2326" stroke-width="0.05" stroke-linecap="round" opacity="' + s.paint.lineL + '"/>';
    body += '<path d="' + d(c.lineU) + '" fill="none" stroke="#4a2326" stroke-width="' + (0.07 * s.paint.lineW) + '" stroke-linecap="round"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.4 -0.7 2.8 1.9"><defs><clipPath id="cav"><path d="' + d(c.cavity) + '"/></clipPath></defs>' + body + '</svg>';
  }
  return { STYLES: STYLES, get: get, pick: pick, render: render, blend: blend, shapes: shapes, toSVG: toSVG, VOWELS: VKEYS };
});
