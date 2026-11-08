/*!
 * Anime2.5DRig — mouthgen.js
 * Procedural mouth (自動生成口) for see-through style PSDs that ship a single
 * `mouth` layer and no open/close diffs.
 *
 *  1. analyze(): measures the drawn mouth once (tilt, half width, upper-lip
 *     curve, line weight / colour, skin colour, whether the drawing is open).
 *     Nothing is hard-coded per character.
 *  2. render(): draws the mouth for continuous parameters
 *     {o: open 0..1, s: width, r: roundness 0..1, f: smile -1..1, tt: teeth 0..1}
 *     in layers: cavity → tongue → teeth → lower lip line/shade → side walls →
 *     upper lip line, with supersampled anti-aliasing.
 *  3. mix(): vowel weights {a,i,u,e,o} + openness → parameters. Vowels are
 *     interpolated in parameter space, so there is no cross-fade ghosting.
 *  4. jaw(): displacement of the face mesh (jaw drop, cheeks pull in on U/O).
 *  5. vowelFromSamples(): LPC formant (F1/F2) vowel estimate for mic / audio.
 * MIT License
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./mouthstyles.js'));
  else root.MouthGen = factory(root.MouthStyles);
})(typeof self !== 'undefined' ? self : this, function (MS) {
  'use strict';
  var SS = 2;   // supersampling per axis (measured style)

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function lum(r, g, b) { return r * 0.299 + g * 0.587 + b * 0.114; }
  function percentile(arr, p) {
    if (!arr.length) return 0;
    var s = Float64Array.from(arr).sort();
    var i = clamp((s.length - 1) * p / 100, 0, s.length - 1), lo = Math.floor(i), hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  }
  function solve3(M, y) {   // Gaussian elimination, 3x3
    var A = [M[0].concat([y[0]]), M[1].concat([y[1]]), M[2].concat([y[2]])];
    for (var c = 0; c < 3; c++) {
      var p = c; for (var r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      var t = A[c]; A[c] = A[p]; A[p] = t;
      if (Math.abs(A[c][c]) < 1e-12) return null;
      for (var r2 = 0; r2 < 3; r2++) if (r2 !== c) {
        var k = A[r2][c] / A[c][c];
        for (var j = c; j < 4; j++) A[r2][j] -= k * A[c][j];
      }
    }
    return [A[0][3] / A[0][0], A[1][3] / A[1][1], A[2][3] / A[2][2]];
  }

  // ---------------------------------------------------------------- analyze
  /**
   * mouth / face: {x, y, img:{width,height,data}} in PSD pixel coordinates
   * (straight alpha RGBA). Returns null when the mouth layer is unusable.
   */
  function analyze(mouth, face) {
    var mi = mouth.img, mw = mi.width, mh = mi.height, md = mi.data;
    var xs = [], ys = [], ws = [], R = [], G = [], B = [];
    for (var j = 0; j < mh; j++) for (var i = 0; i < mw; i++) {
      var q = (j * mw + i) * 4, a = md[q + 3] / 255;
      if (a <= 0.25) continue;
      xs.push(mouth.x + i + 0.5); ys.push(mouth.y + j + 0.5); ws.push(a);
      R.push(md[q] / 255); G.push(md[q + 1] / 255); B.push(md[q + 2] / 255);
    }
    var n = xs.length;
    if (n < 12) return null;
    var sw = 0, cx = 0, cy = 0, k;
    for (k = 0; k < n; k++) { sw += ws[k]; cx += xs[k] * ws[k]; cy += ys[k] * ws[k]; }
    cx /= sw; cy /= sw;
    var sxx = 0, sxy = 0, syy = 0;
    for (k = 0; k < n; k++) { var dx = xs[k] - cx, dy = ys[k] - cy; sxx += ws[k] * dx * dx; sxy += ws[k] * dx * dy; syy += ws[k] * dy * dy; }
    var th = 0.5 * Math.atan2(2 * sxy, sxx - syy);   // major axis angle
    if (Math.abs(th) > Math.PI / 2.2) th = 0;          // a mouth is never vertical
    var e1 = [Math.cos(th), Math.sin(th)], e2 = [-e1[1], e1[0]];
    if (e2[1] < 0) { e2 = [-e2[0], -e2[1]]; }
    var U = new Float64Array(n), V = new Float64Array(n);
    for (k = 0; k < n; k++) { var px = xs[k] - cx, py = ys[k] - cy; U[k] = px * e1[0] + py * e1[1]; V[k] = px * e2[0] + py * e2[1]; }
    var u0 = percentile(U, 0.5), u1 = percentile(U, 99.5), umid = (u0 + u1) / 2;
    cx += e1[0] * umid; cy += e1[1] * umid;
    for (k = 0; k < n; k++) U[k] -= umid;
    var w0 = Math.max(4, (u1 - u0) / 2);

    // skin: ring around the mouth on the face layer
    var skin = [0.9, 0.75, 0.7];
    if (face && face.img) {
      var fi = face.img, fw = fi.width, fh = fi.height, fd = fi.data, sr = 0, sg = 0, sb = 0, sn = 0;
      var x0 = Math.floor(cx - w0 * 2.3), x1 = Math.ceil(cx + w0 * 2.3), y0 = Math.floor(cy - w0 * 1.5), y1 = Math.ceil(cy + w0 * 1.5);
      for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) {
        var dd = Math.hypot(xx - cx, (yy - cy) * 1.6);
        if (dd < w0 * 1.3 || dd > w0 * 2.2) continue;
        var fx = xx - face.x, fy = yy - face.y;
        if (fx < 0 || fy < 0 || fx >= fw || fy >= fh) continue;
        var fq = (fy * fw + fx) * 4;
        if (fd[fq + 3] < 230) continue;
        sr += fd[fq]; sg += fd[fq + 1]; sb += fd[fq + 2]; sn++;
      }
      if (sn > 10) skin = [sr / sn / 255, sg / sn / 255, sb / sn / 255];
    }
    var sl = lum(skin[0], skin[1], skin[2]);
    var L = new Float64Array(n);
    for (k = 0; k < n; k++) L[k] = lum(R[k], G[k], B[k]);
    var Lmin = percentile(L, 2);
    var dk = new Float64Array(n), dsum = 0, lc = [0, 0, 0], lw = 0;
    for (k = 0; k < n; k++) {
      dk[k] = clamp((sl * 0.92 - L[k]) / Math.max(1e-3, sl * 0.92 - Lmin), 0, 1) * ws[k];
      dsum += dk[k];
      var w3 = dk[k] * dk[k] * dk[k];
      lc[0] += R[k] * w3; lc[1] += G[k] * w3; lc[2] += B[k] * w3; lw += w3;
    }
    var line = lw > 1e-6 ? [lc[0] / lw, lc[1] / lw, lc[2] / lw] : [0.3, 0.15, 0.15];
    // soft see-through ink is often too faint for a generated open mouth: keep it clearly darker than the skin
    var darkInk = [skin[0] * 0.36, skin[1] * 0.22, skin[2] * 0.22];
    for (var it = 0; it < 8 && lum(line[0], line[1], line[2]) > 0.5 * sl; it++)
      line = [line[0] * 0.7 + darkInk[0] * 0.3, line[1] * 0.7 + darkInk[1] * 0.3, line[2] * 0.7 + darkInk[2] * 0.3];
    // line weight: only clearly dark ink counts (painted lips are not line)
    var inkN = 0; for (k = 0; k < n; k++) if (dk[k] > 0.6) inkN++;
    var t0 = clamp(inkN / (2 * w0), Math.max(1.0, 0.04 * w0), Math.max(1.0, 0.06 * w0));

    // upper-lip curve: per column, upper 60 % of the dark pixels → quadratic fit
    var nb = Math.max(8, Math.floor(w0 / 2)), cu = [], cv = [];
    for (var bI = 0; bI < nb; bI++) {
      var ua = -w0 + 2 * w0 * bI / nb, ub = ua + 2 * w0 / nb, vv = [], vw = [];
      for (k = 0; k < n; k++) if (dk[k] > 0.35 && U[k] >= ua && U[k] < ub) { vv.push(V[k]); vw.push(dk[k]); }
      if (!vv.length) continue;
      var lim = percentile(vv, 60), s1 = 0, s2 = 0;
      for (var m = 0; m < vv.length; m++) if (vv[m] <= lim) { s1 += vv[m] * vw[m]; s2 += vw[m]; }
      cu.push((ua + ub) / 2); cv.push(s1 / Math.max(1e-6, s2));
    }
    var coef = [0, 0, 0];   // v = c0 + c1 u + c2 u²
    if (cu.length >= 3) {
      var S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], Y = [0, 0, 0];
      for (k = 0; k < cu.length; k++) {
        var p = [1, cu[k], cu[k] * cu[k]];
        for (var r = 0; r < 3; r++) { Y[r] += p[r] * cv[k]; for (var c = 0; c < 3; c++) S[r][c] += p[r] * p[c]; }
      }
      coef = solve3(S, Y) || [cv.reduce(function (a, b) { return a + b; }, 0) / cv.length, 0, 0];
    } else if (cv.length) coef = [cv[0], 0, 0];

    // was the drawing open? interior = clearly not skin and not ink
    var lipN = 0, lR = 0, lG = 0, lB = 0;
    var inter = 0, solid = 0, tR = 0, tG = 0, tB = 0, tN = 0, vmin = 1e9, vmax = -1e9, Li = [];
    var isInt = new Uint8Array(n);
    for (k = 0; k < n; k++) {
      if (ws[k] <= 0.5) continue;
      solid++;
      var diff = Math.abs(R[k] - skin[0]) + Math.abs(G[k] - skin[1]) + Math.abs(B[k] - skin[2]);
      if (diff > 0.12 && Math.abs(U[k]) < w0 * 0.25) { vmin = Math.min(vmin, V[k]); vmax = Math.max(vmax, V[k]); }
      if (dk[k] > 0.35) continue;
      if (diff > 0.08 && L[k] < sl * 1.02 && R[k] > G[k] + 0.04) { lipN++; lR += R[k]; lG += G[k]; lB += B[k]; }
      if (diff > 0.12 && (L[k] > sl || L[k] < sl * 0.8)) { inter++; isInt[k] = 1; Li.push(L[k]); }
    }
    var interFrac = inter / Math.max(1, solid), hCenter = vmax > vmin ? vmax - vmin : 0;
    var origOpen = interFrac > 0.15 && hCenter > 2.5 * t0;
    // An open drawing has a dark cavity that the ink estimate counts as line: keep anime line weights.
    // an open drawing: the ink estimate of the first version read well there (sample.psd); keep it
    if (origOpen) t0 = Math.min(clamp(dsum / (2 * w0), Math.max(1.0, 0.055 * w0), w0 * 0.2), Math.max(1.0, 0.09 * w0));
    var lipFrac = lipN / Math.max(1, solid);
    var lip = lipN > 8 ? [lR / lipN, lG / lipN, lB / lipN] : [skin[0] * 0.95, skin[1] * 0.72, skin[2] * 0.74];
    var teeth = [0.85 + 0.15 * skin[0], 0.85 + 0.15 * skin[1], 0.85 + 0.15 * skin[2]];
    if (origOpen) {
      var tl = percentile(Li, 70);
      for (k = 0; k < n; k++) if (isInt[k] && L[k] >= tl) { tR += R[k]; tG += G[k]; tB += B[k]; tN++; }
      if (tN) teeth = [tR / tN, tG / tN, tB / tN];
    }
    teeth = [teeth[0] * 0.6 + 0.97 * 0.4, teeth[1] * 0.6 + 0.95 * 0.4, teeth[2] * 0.6 + 0.94 * 0.4];
    var deep = [0.42, 0.10, 0.14];
    var cavity = [line[0] * 0.45 + deep[0] * 0.55, line[1] * 0.45 + deep[1] * 0.55, line[2] * 0.45 + deep[2] * 0.55];
    var tongue = [0.86 * 0.75 + skin[0] * 0.25, 0.45 * 0.75 + skin[1] * 0.25, 0.47 * 0.75 + skin[2] * 0.25];
    var lipshade = [skin[0] * 0.90, skin[1] * 0.80, skin[2] * 0.80];
    var Rb = Math.ceil(w0 * 1.9) + 6;
    var box = { x: Math.floor(cx - Rb), y: Math.floor(cy - Rb), w: 2 * Rb, h: 2 * Rb };
    var faceBox = null;
    if (face && face.img) faceBox = { x0: face.x, y0: face.y, x1: face.x + face.img.width, y1: face.y + face.img.height };
    return { c: [cx, cy], th: th, e1: e1, e2: e2, w0: w0, coef: coef, t0: t0, line: line, skin: skin,
             teeth: teeth, cavity: cavity, tongue: tongue, lipshade: lipshade, origOpen: origOpen,
             interFrac: interFrac, hCenter: hCenter, box: box, faceBox: faceBox, lip: lip, lipFrac: lipFrac };
  }

  // ---------------------------------------------------------------- params
  var CLOSED = { o: 0, s: 1, r: 0, f: 0, tt: 0 };
  var VOWELS = {
    a: { o: 1.00, s: 1.00, r: 0.35, f: 0.0, tt: 0.55 },
    i: { o: 0.34, s: 1.18, r: 0.0, f: 0.35, tt: 1.0 },
    u: { o: 0.38, s: 0.58, r: 1.0, f: -0.1, tt: 0.0 },
    e: { o: 0.55, s: 1.10, r: 0.15, f: 0.2, tt: 0.7 },
    o: { o: 0.72, s: 0.70, r: 1.0, f: -0.1, tt: 0.25 }
  };
  var KEYS = ['o', 's', 'r', 'f', 'tt'];
  /** weights {a,i,u,e,o} (any scale), open 0..1, form -1..1 → params */
  function mix(weights, open, form) {
    var w = weights || { a: 1 }, tot = 0, shape = { o: 0, s: 0, r: 0, f: 0, tt: 0 }, v;
    for (v in VOWELS) tot += Math.max(0, w[v] || 0);
    if (tot < 1e-6) { w = { a: 1 }; tot = 1; }
    for (v in VOWELS) {
      var k = Math.max(0, w[v] || 0) / tot;
      if (!k) continue;
      for (var i = 0; i < KEYS.length; i++) shape[KEYS[i]] += VOWELS[v][KEYS[i]] * k;
    }
    var t = clamp(open, 0, 1), out = {};
    for (var j = 0; j < KEYS.length; j++) out[KEYS[j]] = CLOSED[KEYS[j]] + (shape[KEYS[j]] - CLOSED[KEYS[j]]) * t;
    out.f = clamp(out.f + (form || 0) * 0.8, -1, 1);
    out.t = t; out.w = {};
    for (v in VOWELS) out.w[v] = Math.max(0, w[v] || 0) / tot;
    return out;
  }
  function geom(st, P) {
    var w0 = st.w0, c0 = st.coef[0], c1 = st.coef[1], c2 = st.coef[2];
    var Wd = w0 * P.s, h = P.o * 0.9 * w0, f = P.f;
    var pu = 2 + 3 * (1 - P.r), ql = 0.5 + 0.4 * (1 - P.r);
    function vb(uu) { var x = uu * w0; return c0 + c1 * x + c2 * x * x - f * 0.16 * w0 * (uu * uu - 0.3); }
    function su(uu) { return Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(uu), pu))); }
    function sl(uu) { return Math.pow(Math.max(0, 1 - uu * uu), ql); }
    return { Wd: Wd, h: h, vb: vb,
             yU: function (uu) { return vb(uu) - 0.30 * h * su(uu); },
             yL: function (uu) { return vb(uu) + 0.70 * h * sl(uu); } };
  }

  // ---------------------------------------------------------------- render
  /** Style ids: 'auto' (おまかせ), 'measured' (計測: drawn from the PSD's own mouth) or a MouthStyles id. */
  var STYLE_IDS = ['auto', 'anime', 'lips', 'simple', 'deform', 'measured'];
  function resolveStyle(st, id) {
    if (!MS || id === 'measured') return 'measured';
    if (!id || id === 'auto') return MS.pick(st);
    return MS.get(id) ? id : MS.pick(st);
  }
  /** Draws into out = {width,height,data} (size st.box.w × st.box.h, straight alpha). */
  function render(st, P, out, styleId) {
    var sid = resolveStyle(st, styleId);
    if (sid !== 'measured') return MS.render(st, MS.get(sid), P, out);
    return renderMeasured(st, P, out);
  }
  function renderMeasured(st, P, out) {
    var W = st.box.w, H = st.box.h, d = out.data;
    var g = geom(st, P), Wd = g.Wd, h = g.h, t0 = st.t0, w0 = st.w0;
    var e1 = st.e1, e2 = st.e2, cx = st.c[0], cy = st.c[1], bx = st.box.x, by = st.box.y;
    var o = P.o, tt = P.tt;
    var cav = st.cavity, ton = st.tongue, tee = st.teeth, lin = st.line, lsh = st.lipshade;
    var tongueA = sstep((o - 0.25) / 0.4);
    var lowK = h > t0 * 1.2 ? sstep((h - t0 * 1.2) / (t0 * 2)) : 0, lt = 0.75 * t0;
    var tw = 0.62 * Wd, tcy = g.vb(0) + 0.70 * h * 0.95, hh = Math.max(h, 1e-3);
    var ringK = sstep((h - t0 * 0.3) / (t0 * 1.5)), ring = ringK > 0.004, Wr = Wd + t0 * 0.75;
    var lipExtra = 0.35 * t0 * (1 - sstep(h / (t0 * 1.5)));
    // per-column cache would be nicer; boxes are small (~120 px) so we keep it simple.
    var inv = 1 / (SS * SS);
    for (var py = 0; py < H; py++) {
      for (var px = 0; px < W; px++) {
        var aR = 0, aG = 0, aB = 0, aA = 0;
        for (var sy = 0; sy < SS; sy++) for (var sx = 0; sx < SS; sx++) {
          var X = bx + px + (sx + 0.5) / SS - cx, Y = by + py + (sy + 0.5) / SS - cy;
          var u = X * e1[0] + Y * e1[1], v = X * e2[0] + Y * e2[1];
          var uu = u / Wd, au = Math.abs(uu), uc = clamp(uu, -1, 1);
          var YU = g.yU(uc), YL = g.yL(uc), r = 0, gg = 0, b = 0, a = 0, m;
          // paint helper inlined: col = c*m + col*(1-m); a = m + a*(1-m)
          var inside = au < 1;
          var inCav = inside && v > YU && v < YL;
          if (inCav) {
            var gr = clamp((v - YU) / Math.max(YL - YU, 1e-3), 0, 1), kk = 0.75 + 0.35 * gr;
            r = cav[0] * kk; gg = cav[1] * kk; b = cav[2] * kk; a = 1;
            if (tongueA > 0) {
              var ex = u / tw, ey = (v - tcy) / (0.38 * hh);
              if (ex * ex + ey * ey < 1) { m = tongueA; r = ton[0] * m + r * (1 - m); gg = ton[1] * m + gg * (1 - m); b = ton[2] * m + b * (1 - m); }
            }
            if (tt > 0) {
              var tH = o < 0.5 ? (0.16 + 0.42 * tt) * (YL - YU) : 0.18 * w0 * (0.5 + 0.5 * tt);
              if (v < YU + tH && au < 0.88) { r = tee[0]; gg = tee[1]; b = tee[2]; }
              if (tt > 0.8 && o < 0.5 && v > YL - 0.30 * (YL - YU) && au < 0.7) { r = tee[0] * 0.94; gg = tee[1] * 0.94; b = tee[2] * 0.94; }
            }
          }
          if (lowK > 0) {
            if (inside && v > YL - 0.25 * lt && v < YL + lt && au < 0.97) {
              m = 0.55 * lowK; r = lin[0] * m + r * (1 - m); gg = lin[1] * m + gg * (1 - m); b = lin[2] * m + b * (1 - m); a = m + a * (1 - m);
            }
            if (inside) {
              var shc = YL + lt + 0.10 * w0 * o, q1 = u / (0.45 * Wd), q2 = (v - shc) / (0.09 * w0 + 0.5);
              m = 0.22 * lowK * Math.exp(-q1 * q1 - q2 * q2);
              if (m > 0.004) { r = lsh[0] * m + r * (1 - m); gg = lsh[1] * m + gg * (1 - m); b = lsh[2] * m + b * (1 - m); a = m + a * (1 - m); }
            }
          }
          if (ring && !inCav) {   // side walls: cavity dilated by the line weight
            var ur = u / Wr;
            if (Math.abs(ur) < 1) {
              var urc = clamp(ur, -1, 1), YU2 = g.yU(urc), YL2 = g.yL(urc);
              if (v > YU2 - t0 * 0.75 && v < YL2 + t0 * 0.5) {
                m = (v < (YU2 + YL2) / 2 ? 1 : 0.6) * ringK;
                r = lin[0] * m + r * (1 - m); gg = lin[1] * m + gg * (1 - m); b = lin[2] * m + b * (1 - m); a = m + a * (1 - m);
              }
            }
          }
          if (au < 1.04) {   // upper lip line (this alone is the closed mouth)
            var taper = sstep((1.04 - au) / 0.12), tU = t0 * (0.8 + 0.5 * uc * uc) * taper;
            if (v > YU - 0.6 * tU && v < YU + 0.4 * tU + lipExtra) { r = lin[0]; gg = lin[1]; b = lin[2]; a = 1; }
          }
          aR += r * a; aG += gg * a; aB += b * a; aA += a;
        }
        var q = (py * W + px) * 4;
        if (aA > 0) { d[q] = aR / aA * 255; d[q + 1] = aG / aA * 255; d[q + 2] = aB / aA * 255; d[q + 3] = aA * inv * 255; }
        else { d[q] = d[q + 1] = d[q + 2] = d[q + 3] = 0; }
      }
    }
    return out;
  }
  function blank(st) {
    var n = st.box.w * st.box.h * 4;
    return { width: st.box.w, height: st.box.h, data: new Uint8ClampedArray(n) };
  }

  // ---------------------------------------------------------------- jaw
  /** face-mesh displacement [dx,dy] at PSD point (x,y) for params P. */
  function jaw(st, P, x, y, strength) {
    var g = geom(st, P), drop = (strength == null ? 0.55 : strength) * 0.70 * g.h;
    var X = x - st.c[0], Y = y - st.c[1];
    var u = X * st.e1[0] + Y * st.e1[1], v = X * st.e2[0] + Y * st.e2[1];
    var dv = 0, du = 0;
    if (drop > 0 && st.faceBox) {
      var vchin = Math.max(1, st.faceBox.y1 - st.c[1]), fw = st.faceBox.x1 - st.faceBox.x0;
      dv = drop * sstep(v / (0.35 * vchin)) * Math.exp(-Math.pow(u / (fw * 0.38), 2));
    }
    var sq = (1 - P.s) * st.w0 * 0.35;
    if (sq) du = sq * Math.tanh(u / st.w0) * Math.exp(-Math.pow(u / (st.w0 * 1.8), 2) - Math.pow(v / (st.w0 * 1.4), 2));
    return [dv * st.e2[0] - du * st.e1[0], dv * st.e2[1] - du * st.e1[1]];
  }

  // ---------------------------------------------------------------- vowels from audio
  // Reference (F1, F2) in Hz; mid values between adult female and male voices.
  var REF = { a: [800, 1300], i: [330, 2500], u: [380, 1500], e: [530, 2100], o: [520, 900] };
  /**
   * samples: Float32Array (mono, -1..1), sr: sample rate.
   * Returns {a,i,u,e,o, f1, f2, rms} or null when silent / unvoiced.
   */
  function vowelFromSamples(samples, sr, opts) {
    var o = opts || {}, scale = o.formantScale || 1;
    var q = Math.max(1, Math.round(sr / 11025)), fs = sr / q, n = Math.floor(samples.length / q);
    if (n < 128) return null;
    var x = new Float64Array(n), i, j, rms = 0;
    for (i = 0; i < n; i++) { var s = 0; for (j = 0; j < q; j++) s += samples[i * q + j]; x[i] = s / q; rms += x[i] * x[i]; }
    rms = Math.sqrt(rms / n);
    if (rms < (o.gate || 0.008)) return null;
    for (i = n - 1; i > 0; i--) x[i] -= 0.95 * x[i - 1];
    for (i = 0; i < n; i++) x[i] *= 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1));
    var p = Math.min(16, 2 + Math.round(fs / 1000)), rr = new Float64Array(p + 1);
    for (j = 0; j <= p; j++) { var acc = 0; for (i = j; i < n; i++) acc += x[i] * x[i - j]; rr[j] = acc; }
    if (rr[0] <= 0) return null;
    rr[0] *= 1.0001;
    var a = new Float64Array(p + 1), tmp = new Float64Array(p + 1), err = rr[0];
    a[0] = 1;
    for (i = 1; i <= p; i++) {   // Levinson–Durbin
      var lam = 0; for (j = 0; j < i; j++) lam -= a[j] * rr[i - j];
      lam /= err;
      for (j = 0; j <= i; j++) tmp[j] = a[j] + lam * a[i - j];
      for (j = 0; j <= i; j++) a[j] = tmp[j];
      err *= 1 - lam * lam;
      if (err <= 0) return null;
    }
    // LPC envelope 0..4 kHz, peak picking
    var NF = 200, fmax = Math.min(4000, fs / 2 - 50), env = new Float64Array(NF), peaks = [];
    for (var k = 0; k < NF; k++) {
      var w = 2 * Math.PI * (fmax * k / (NF - 1)) / fs, re = 0, im = 0;
      for (j = 0; j <= p; j++) { re += a[j] * Math.cos(w * j); im -= a[j] * Math.sin(w * j); }
      env[k] = -Math.log(re * re + im * im + 1e-12);
    }
    for (k = 1; k < NF - 1; k++) if (env[k] > env[k - 1] && env[k] >= env[k + 1]) peaks.push({ f: fmax * k / (NF - 1), e: env[k] });
    var F1 = 0, F2 = 0, best = -1e9;
    for (k = 0; k < peaks.length; k++) if (peaks[k].f >= 200 * scale && peaks[k].f <= 1100 * scale) { F1 = peaks[k].f; break; }
    if (!F1) return null;
    for (k = 0; k < peaks.length; k++) {   // F2 = strongest resonance above F1
      var pk = peaks[k];
      if (pk.f > F1 + 250 && pk.f >= 650 * scale && pk.f <= 3200 * scale && pk.e > best) { best = pk.e; F2 = pk.f; }
    }
    if (!F2) F2 = F1 < 600 ? 900 * scale : 1300 * scale;   // F1/F2 merged (o / a)
    var out = { f1: F1, f2: F2, rms: rms }, tot = 0;
    for (var v in REF) {
      var d1 = Math.log(F1 / (REF[v][0] * scale)) / 0.25, d2 = Math.log(F2 / (REF[v][1] * scale)) / 0.20;
      out[v] = Math.exp(-0.5 * (d1 * d1 + d2 * d2)); tot += out[v];
    }
    if (tot < 1e-9) return null;
    for (v in REF) out[v] /= tot;
    return out;
  }

  // ---------------------------------------------------------------- rig hookup
  /**
   * Adds a `mouth_gen` layer to a rig from Rigger.buildRig (right after the
   * drawn mouth) when the PSD has no hand-drawn mouth_close. Sets rig.mouthGen
   * to the analysis (or null). Idempotent. baseName: Rigger.baseName.
   */
  function attachToRig(rig, baseName) {
    if ('mouthGen' in rig) return rig.mouthGen;
    rig.mouthGen = null;
    var bn = function (p) { return baseName(p.name.replace(/_(l|r)$/, '')); };
    var real = rig.layers.filter(function (p) { return !p.synthetic; });
    if (real.some(function (p) { return bn(p) === 'mouth_close'; })) return null;   // hand-drawn diffs win
    var mo = real.filter(function (p) { return bn(p) === 'mouth_open'; })[0];
    var face = real.filter(function (p) { return bn(p) === 'face'; })[0];
    if (!mo || !mo.img) return null;
    var st = null;
    try { st = analyze(mo, face); } catch (err) { st = null; }
    if (!st) return null;
    var img = render(st, mix({ a: 1 }, 0, 0), blank(st));
    rig.layers.splice(rig.layers.indexOf(mo) + 1, 0, {
      name: 'mouth_gen', source: '', x: st.box.x, y: st.box.y, w: st.box.w, h: st.box.h,
      z: mo.z + 0.5, depth: mo.depth, group: 'head', phys: null, opacity: 1, fade: 'mouthGen',
      side: null, strands: null, synthetic: true, img: img });
    rig.mouthGen = st;
    return st;
  }

  return { analyze: analyze, attachToRig: attachToRig, STYLE_IDS: STYLE_IDS, resolveStyle: resolveStyle, render: render, blank: blank, mix: mix, jaw: jaw, geom: geom,
           vowelFromSamples: vowelFromSamples, VOWELS: VOWELS, CLOSED: CLOSED };
});
