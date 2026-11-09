/* 第 7 章：深层信号传播动力学：交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §7.1 残差直通车与 Pre-Norm · §7.2 LayerNorm 与 RMSNorm 手算 · §7.3 SwiGLU 与 1/√(2L) 缩放 · §7.4 手算一层 · 练习 7.1–7.3' });

  const $ = (s) => document.querySelector(s);
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const fe = (x) => { if (!isFinite(x)) return '–'; if (x === 0) return '0'; const a = Math.abs(x); if (a >= 1000 && a < 1e4) return String(Math.round(x)); if (a >= 0.01 && a < 1e4) return x.toPrecision(3); const e = Math.floor(Math.log10(a)); return (x / Math.pow(10, e)).toFixed(1) + '×10' + String(e).split('').map((c) => SUP[c]).join(''); };
  const FONT_NUM = '600 12px Avenir Next, Avenir, sans-serif';
  // 对数纵轴的刻度：最多 7 个，且总包含 1
  function logTicks(e0, e1) {
    const step = Math.max(1, Math.ceil((e1 - e0) / 6)), t = [];
    for (let e = 0; e >= e0; e -= step) t.unshift(Math.pow(10, e));
    for (let e = step; e <= e1; e += step) t.push(Math.pow(10, e));
    return t;
  }
  function logSpan(arrs, lo0, hi0) {
    let lo = lo0, hi = hi0;
    arrs.forEach((a) => a.forEach((v) => { if (v > 0 && isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
    return [Math.floor(Math.log10(lo)), Math.ceil(Math.log10(hi))];
  }
  // 指针拖拽（鼠标 + 触屏）
  function pointer(el, h) {
    el = typeof el === 'string' ? $(el) : el;
    const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let on = false;
    el.addEventListener('pointerdown', (e) => { on = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} h.down && h.down(...pos(e)); e.preventDefault(); });
    el.addEventListener('pointermove', (e) => { if (on && h.move) h.move(...pos(e)); });
    const end = () => { if (on) { on = false; h.up && h.up(); } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  const rgbOf = (hex) => { hex = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(hex.substr(i, 2), 16)); };
  const lerp3 = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
  // 用离屏像素绘制标量场
  function paintField(ctx, x0, y0, w, h, nx, ny, colorAt) {
    const off = document.createElement('canvas'); off.width = nx; off.height = ny;
    const oc = off.getContext('2d'), img = oc.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const c = colorAt(i, j), k = 4 * (j * nx + i); img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255; }
    oc.putImageData(img, 0, 0);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, x0, y0, w, h); ctx.restore();
  }
  // 行进方格法画等值线
  function contour(ctx, grid, nx, ny, level, toX, toY) {
    ctx.beginPath();
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = grid[j * nx + i], b = grid[j * nx + i + 1], c = grid[(j + 1) * nx + i + 1], d = grid[(j + 1) * nx + i];
      const p = [];
      const e = (v1, v2, x1, y1, x2, y2) => { if ((v1 < level) !== (v2 < level)) { const t = (level - v1) / (v2 - v1); p.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]); } };
      e(a, b, i, j, i + 1, j); e(b, c, i + 1, j, i + 1, j + 1); e(c, d, i + 1, j + 1, i, j + 1); e(d, a, i, j + 1, i, j);
      for (let q = 0; q + 1 < p.length; q += 2) { ctx.moveTo(toX(p[q][0]), toY(p[q][1])); ctx.lineTo(toX(p[q + 1][0]), toY(p[q + 1][1])); }
    }
    ctx.stroke();
  }

  /* ================= 实验 1：百层信号传播 ================= */
  const st1 = { L: 100, d: 64, g: 0.9, scale: false, seed: 1 };
  let bank = { key: '', W: [], R: null };
  function weights(K) { // 标准正态权重库（按需扩展，改变层数时前面各层保持不变）
    const key = st1.seed + ':' + st1.d, d = st1.d;
    if (bank.key !== key) bank = { key, W: [], R: LAB.rng(1000 + st1.seed * 7919 + d) };
    while (bank.W.length < K) { const W = new Float32Array(d * d); for (let i = 0; i < d * d; i++) W[i] = bank.R.normal(); bank.W.push(W); }
    return bank.W;
  }
  const EPS1 = 1e-6;
  function simulate() {
    const { L, d, g } = st1, K = 2 * L, s = st1.scale ? 1 / Math.sqrt(2 * L) : 1;
    const Ws = weights(K), sd = g * Math.sqrt(2 / d);
    const R = LAB.rng(77 + st1.seed * 31 + d);
    const x0 = new Float64Array(d), u = new Float64Array(d);
    for (let i = 0; i < d; i++) x0[i] = R.normal();
    for (let i = 0; i < d; i++) u[i] = R.normal();
    const un = Math.hypot(...u); for (let i = 0; i < d; i++) u[i] /= un;
    const nrm = (v) => { let t = 0; for (let i = 0; i < d; i++) t += v[i] * v[i]; return Math.sqrt(t); };
    const rmsOf = (v) => nrm(v) / Math.sqrt(d);
    const rr = (v) => { let t = 0; for (let i = 0; i < d; i++) t += v[i] * v[i]; return Math.sqrt(t / d + EPS1); };
    const mv = (W, v, c) => { const o = new Float64Array(d); for (let i = 0; i < d; i++) { let t = 0; const b = i * d; for (let j = 0; j < d; j++) t += W[b + j] * v[j]; o[i] = t * c; } return o; };
    const mtv = (W, v, c) => { const o = new Float64Array(d); for (let i = 0; i < d; i++) { const vi = v[i] * c, b = i * d; if (vi !== 0) for (let j = 0; j < d; j++) o[j] += W[b + j] * vi; } return o; };
    const relu = (v) => v.map((a) => (a > 0 ? a : 0));
    // RMSNorm 的雅可比（对称）：J = (1/r)(I − x xᵀ/(d r²))
    const JN = (x, gv) => { const r = rr(x); let dot = 0; for (let i = 0; i < d; i++) dot += x[i] * gv[i]; const c = dot / (d * r * r); return gv.map((a, i) => (a - x[i] * c) / r); };
    const out = {};
    for (const arch of ['plain', 'post', 'pre']) {
      const c = sd * (arch === 'plain' ? 1 : s);
      let x = Float64Array.from(x0);
      const fwd = [rmsOf(x)], cache = [];
      for (let k = 0; k < K; k++) {
        const W = Ws[k];
        if (arch === 'plain') { cache.push(x); x = mv(W, relu(x), c); }
        else if (arch === 'pre') { const r = rr(x), z = x.map((a) => a / r), f = mv(W, relu(z), c); cache.push({ x, z }); x = x.map((a, i) => a + f[i]); }
        else { const f = mv(W, relu(x), c), y = x.map((a, i) => a + f[i]); cache.push({ x, y }); const r = rr(y); x = y.map((a) => a / r); }
        fwd.push(rmsOf(x));
      }
      let gr = Float64Array.from(u), hw = Float64Array.from(u);
      const bwd = new Array(K + 1), hwy = new Array(K + 1);
      bwd[K] = 1; hwy[K] = 1;
      for (let k = K - 1; k >= 0; k--) {
        const W = Ws[k], cc = cache[k];
        if (arch === 'plain') { const t = mtv(W, gr, c); gr = t.map((a, i) => (cc[i] > 0 ? a : 0)); hw = null; }
        else if (arch === 'pre') { const t = mtv(W, gr, c).map((a, i) => (cc.z[i] > 0 ? a : 0)); const v = JN(cc.x, t); gr = gr.map((a, i) => a + v[i]); }
        else { const dy = JN(cc.y, gr), t = mtv(W, dy, c); gr = dy.map((a, i) => a + (cc.x[i] > 0 ? t[i] : 0)); hw = JN(cc.y, hw); }
        bwd[k] = nrm(gr); hwy[k] = hw ? nrm(hw) : NaN;
      }
      out[arch] = { fwd, bwd, hwy };
    }
    out.K = K; out.s = s;
    return out;
  }
  let R1 = null, pend1 = false;
  function run1() { if (pend1) return; pend1 = true; setTimeout(() => { pend1 = false; R1 = simulate(); fwdCv.redraw(); bwdCv.redraw(); stats1(); }, 0); }
  LAB.slider('#d-L', { label: '层数 $L$（每层 2 个子层）', min: 2, max: 160, step: 1, value: st1.L, onInput: (v) => { st1.L = v; run1(); } });
  LAB.slider('#d-g', { label: '初始化增益 $g$', min: 0.5, max: 1.5, step: 0.01, value: st1.g, fmt: (v) => v.toFixed(2), hint: '$g=1$ 即 Kaiming 初始化（ReLU 的临界点）', onInput: (v) => { st1.g = v; run1(); } });
  LAB.segmented('#d-width', ['16', '32', '64', '128'], 2, (i) => { st1.d = [16, 32, 64, 128][i]; run1(); });
  LAB.checkbox('#d-scale', '残差支路输出 $\\times 1/\\sqrt{2L}$（GPT-2 缩放初始化）', false, (v) => { st1.scale = v; run1(); });
  $('#d-resample').onclick = () => { st1.seed++; run1(); };
  const ARCH = [['plain', C.c4], ['post', C.c2], ['pre', C.c1]];
  function layerPlot(ctx, w, h, series, extra, ylabel) {
    const K = R1.K, xs = M.range(K + 1).map((k) => k / 2);
    const [e0, e1] = logSpan(series, 0.5, 2);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: K / 2, ymin: Math.pow(10, e0), ymax: Math.pow(10, e1), logy: true, ytickValues: logTicks(e0, e1), xlabel: '层 l', ylabel, pad: { l: 54, r: 14, t: 12, b: 38 } }).axes();
    P.clip();
    extra(P, xs);
    series.forEach((ys, i) => P.line(xs, ys, ARCH[i][1], 2.2));
    P.unclip();
    return P;
  }
  const fwdCv = LAB.canvas('#d-fwd', (ctx, w, h) => {
    if (!R1) return;
    layerPlot(ctx, w, h, ARCH.map(([a]) => R1[a].fwd), (P, xs) => {
      const r0 = R1.plain.fwd[0], g = st1.g, s = R1.s;
      P.line(xs, xs.map((_, k) => r0 * Math.pow(g, k)), C.slate, 1.2, [4, 4]);
      P.line(xs, xs.map((_, k) => Math.sqrt(r0 * r0 + k * g * g * s * s)), C.slate, 1.2, [4, 4]);
    }, 'RMS(x_l)');
  });
  const bwdCv = LAB.canvas('#d-bwd', (ctx, w, h) => {
    if (!R1) return;
    layerPlot(ctx, w, h, ARCH.map(([a]) => R1[a].bwd), (P, xs) => {
      const K = R1.K;
      P.line(xs, xs.map((_, k) => Math.pow(st1.g, K - k)), C.slate, 1.2, [4, 4]);
      P.line(xs, R1.post.hwy, C.c2, 1.8, [6, 4]);
    }, '‖∂L/∂x_l‖');
  });
  const s1a = LAB.stat('#d-stats', '无残差 · 首层梯度', 'coral');
  const s1b = LAB.stat('#d-stats', 'Post-LN · 首层梯度', 'amber');
  const s1c = LAB.stat('#d-stats', 'Post-LN · 直通分量', 'amber');
  const s1d = LAB.stat('#d-stats', 'Pre-LN · 首层梯度');
  const s1e = LAB.stat('#d-stats', 'Pre-LN · 末层 RMS', 'plum');
  function stats1() {
    s1a.set(fe(R1.plain.bwd[0])); s1b.set(fe(R1.post.bwd[0])); s1c.set(fe(R1.post.hwy[0]));
    s1d.set(fe(R1.pre.bwd[0])); s1e.set(fe(R1.pre.fwd[R1.K]));
  }
  run1();

  // 手算连乘题：a^L 与残差保底项 1；方差账本 1+2L 与 2（书中 7.1 节、练习 7.3）
  const stM = { a: 0.8, L: 100 };
  LAB.slider('#m-a', { label: '每层导数 $a$', min: 0.5, max: 1.5, step: 0.01, value: stM.a, fmt: (v) => v.toFixed(2), onInput: (v) => { stM.a = v; updM(); } });
  LAB.slider('#m-L', { label: '层数 $L$', min: 1, max: 200, step: 1, value: stM.L, onInput: (v) => { stM.L = v; updM(); } });
  const mPlot = LAB.canvas('#m-plot', (ctx, w, h) => {
    const { a, L } = stM, xs = M.range(L + 1), ys = xs.map((l) => Math.pow(a, l));
    const [e0, e1] = logSpan([ys], 0.5, 2);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: L, ymin: Math.pow(10, e0), ymax: Math.pow(10, e1), logy: true, ytickValues: logTicks(e0, e1), xlabel: '层数 l', pad: { l: 54, r: 12, t: 12, b: 36 } }).axes();
    P.clip(); P.line(xs, xs.map(() => 1), C.c3, 2.4); P.line(xs, ys, C.c4, 2.4); P.unclip();
    P.points([L], [ys[L]], C.c4, 4.5, '#fff');
  });
  const ms1 = LAB.stat('#m-stats', '无残差：$a^L$', 'coral');
  const ms2 = LAB.stat('#m-stats', '残差保底项', 'leaf');
  const ms3 = LAB.stat('#m-stats', '主干道方差（不缩放）$1+2L$', 'amber');
  const ms4 = LAB.stat('#m-stats', '支线 $\\times1/\\sqrt{2L}$ 后', 'teal');
  const texSci = (v) => { if (v === 0) return '0'; const e = Math.floor(Math.log10(Math.abs(v))); if (e >= -2 && e < 4) return v.toPrecision(4); return (v / Math.pow(10, e)).toFixed(2) + '\\times10^{' + e + '}'; };
  function updM() {
    const { a, L } = stM, v = Math.pow(a, L);
    ms1.set(fe(v)); ms2.set('1'); ms3.set(String(1 + 2 * L)); ms4.set('2');
    $('#m-formula').innerHTML = LAB.tex(`${a.toFixed(2)}^{${L}}\\approx ${texSci(v)}`, true);
    mPlot.redraw();
  }
  updM();

  /* ================= 实验 2：RMSNorm 超球面 ================= */
  const st2 = { mode: 0, dim: 3, mu: 0.6, la: 0, t: 1, yaw: -0.65, pitch: 0.38, seed: 3 };
  const EPS = 1e-5;
  let cloud = [];
  function genCloud() {
    const R = LAB.rng(st2.seed), ang = 0.6;
    cloud = M.range(40).map(() => { const a = R.normal() * 1.0, b = R.normal() * 0.45, c = R.normal() * 0.35; return [a * Math.cos(ang) - b * Math.sin(ang) + 0.4, a * Math.sin(ang) + b * Math.cos(ang) - 0.3, c + 0.2]; });
  }
  genCloud();
  const inputs = () => { const A = Math.pow(10, st2.la); return cloud.map((p) => p.slice(0, st2.dim).map((x) => A * (x + st2.mu))); };
  function normalize(x) {
    const d = x.length;
    if (st2.mode === 0) { const r = Math.sqrt(x.reduce((a, v) => a + v * v, 0) / d + EPS); return x.map((v) => v / r); }
    const m = M.mean(x), va = x.reduce((a, v) => a + (v - m) * (v - m), 0) / d, r = Math.sqrt(va + EPS);
    return x.map((v) => (v - m) / r);
  }
  LAB.segmented('#n-mode', ['RMSNorm', 'LayerNorm'], 0, (i) => { st2.mode = i; upd2(); });
  LAB.segmented('#n-dim', ['$d=2$', '$d=3$'], 1, (i) => { st2.dim = i + 2; upd2(); });
  LAB.slider('#n-mu', { label: '沿 $\\mathbf 1$ 方向的偏移 $\\mu$', min: -2, max: 2, step: 0.05, value: st2.mu, fmt: (v) => v.toFixed(2), onInput: (v) => { st2.mu = v; upd2(); } });
  LAB.slider('#n-alpha', { label: '整体缩放 $\\alpha$（对数）', min: -3, max: 2, step: 0.05, value: 0, fmt: (v) => fe(Math.pow(10, v)), onInput: (v) => { st2.la = v; upd2(); } });
  const tS = LAB.slider('#n-t', { label: '投影进度 $t$', min: 0, max: 1, step: 0.01, value: 1, fmt: (v) => v.toFixed(2), onInput: (v) => { st2.t = v; view.redraw(); } });
  $('#n-resample').onclick = () => { st2.seed++; genCloud(); upd2(); };
  let playing = false;
  $('#n-play').onclick = () => {
    if (playing) return; playing = true; const t0 = performance.now();
    const step = (now) => { const t = Math.min(1, (now - t0) / 1400); const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; st2.t = e; tS.set(e); view.redraw(); if (t < 1 && document.getElementById('rmsnorm').classList.contains('active')) requestAnimationFrame(step); else { playing = false; st2.t = 1; tS.set(1); view.redraw(); } };
    requestAnimationFrame(step);
  };
  function proj(v) { // 正交投影：返回 [屏幕 x, 屏幕 y(向上), 深度]
    const [x, y, z] = v.length === 3 ? v : [v[0], v[1], 0];
    if (st2.dim === 2) return [x, y, 0];
    const cy = Math.cos(st2.yaw), sy = Math.sin(st2.yaw), cp = Math.cos(st2.pitch), sp = Math.sin(st2.pitch);
    const x1 = cy * x - sy * y, y1 = sy * x + cy * y;
    return [x1, sp * y1 + cp * z, cp * y1 - sp * z];
  }
  const view = LAB.canvas('#n-view', (ctx, w, h) => {
    const d = st2.dim, Rv = 3.1, sc = Math.min(w, h) / 2 / Rv, cx = w / 2, cy = h / 2;
    const S = (p) => [cx + sc * p[0], cy - sc * p[1]];
    const X = inputs(), Y = X.map(normalize);
    const maxIn = Math.max(...X.map((v) => Math.hypot(...v)));
    const f = maxIn > 2.9 ? 2.9 / maxIn : 1;
    const rad = Math.sqrt(d);
    ctx.lineCap = 'round';
    // 坐标轴
    const axes = d === 3 ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : [[1, 0], [0, 1]];
    axes.forEach((a, i) => {
      const p0 = S(proj(a.map((v) => -Rv * 0.92 * v))), p1 = S(proj(a.map((v) => Rv * 0.92 * v)));
      ctx.strokeStyle = '#d5dce5'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.stroke();
      ctx.fillStyle = C.slate; ctx.font = '12px Avenir Next, sans-serif'; ctx.fillText('x' + '₁₂₃'[i], p1[0] + 4, p1[1] - 4);
    });
    const poly = (pts, color, width, alphaFn, dash) => {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
      for (let i = 0; i + 1 < pts.length; i++) { const a = proj(pts[i]), b = proj(pts[i + 1]); ctx.globalAlpha = alphaFn ? alphaFn((a[2] + b[2]) / 2) : 1; ctx.beginPath(); ctx.moveTo(...S(a)); ctx.lineTo(...S(b)); ctx.stroke(); }
      ctx.restore();
    };
    const circ = (c, e1, e2, r, n) => M.range(n + 1).map((k) => { const t = (2 * Math.PI * k) / n; return c.map((ci, i) => ci + r * (Math.cos(t) * e1[i] + Math.sin(t) * e2[i])); });
    const depthA = (z) => 0.18 + 0.5 * (1 - (z / rad + 1) / 2);
    if (d === 3) {
      const faint = st2.mode === 1 ? 0.35 : 1;
      for (let k = -2; k <= 2; k++) { const z = (rad * k) / 3, r = Math.sqrt(rad * rad - z * z); poly(circ([0, 0, z], [1, 0, 0], [0, 1, 0], r, 56), C.c6, 1, (zz) => depthA(zz) * faint); }
      for (let k = 0; k < 6; k++) { const a = (Math.PI * k) / 6; poly(circ([0, 0, 0], [Math.cos(a), Math.sin(a), 0], [0, 0, 1], rad, 56), C.c6, 1, (zz) => depthA(zz) * faint); }
      if (st2.mode === 1) {
        const e1 = [1 / Math.SQRT2, -1 / Math.SQRT2, 0], e2 = [1 / Math.sqrt(6), 1 / Math.sqrt(6), -2 / Math.sqrt(6)];
        poly(circ([0, 0, 0], e1, e2, rad, 80), C.c6, 2.4, (zz) => 0.5 + 0.5 * depthA(zz));
      }
    } else {
      if (st2.mode === 0) poly(circ([0, 0], [1, 0], [0, 1], rad, 80), C.c6, 1.6, null);
      else { poly(circ([0, 0], [1, 0], [0, 1], rad, 80), C.c6, 1, () => 0.3); poly([[-2.6, 2.6], [2.6, -2.6]], C.c6, 1.2, () => 0.6, [4, 4]); }
    }
    // 𝟏 方向
    const one = M.range(d).map(() => 1 / Math.sqrt(d));
    poly([one.map((v) => -2.8 * v), one.map((v) => 2.8 * v)], C.c4, 1.4, () => 0.75, [6, 4]);
    { const p = S(proj(one.map((v) => 2.8 * v))); ctx.fillStyle = C.c4; ctx.font = '12px PingFang SC, sans-serif'; ctx.fillText('𝟏', p[0] + 5, p[1] + 4); }
    // 点：按深度排序
    const t = st2.t;
    const items = X.map((x, i) => { const xi = x.map((v) => v * f), y = Y[i], p = xi.map((v, k) => v + t * (y[k] - v)); return { a: proj(xi), b: proj(p) }; });
    items.sort((u, v) => v.b[2] - u.b[2]);
    items.forEach((it) => { ctx.strokeStyle = 'rgba(92,103,115,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...S(it.a)); ctx.lineTo(...S(it.b)); ctx.stroke(); });
    items.forEach((it) => { ctx.fillStyle = '#b8c4d2'; ctx.beginPath(); ctx.arc(...S(it.a), 3, 0, 7); ctx.fill(); });
    items.forEach((it) => { ctx.fillStyle = t > 0.98 ? C.c6 : LAB.mix('#b8c4d2', C.c6, t); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(...S(it.b), 4.2, 0, 7); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = C.slate; ctx.font = '12px PingFang SC, sans-serif';
    ctx.fillText(`球面半径 √d = ${rad.toFixed(3)}`, 10, 18);
    if (f < 1) ctx.fillText(`输入点已缩小 ${M.fmt(1 / f, 1)} 倍显示`, 10, 36);
  });
  pointer('#n-view', {
    down: (x, y) => { view._p = [x, y]; $('#n-view').style.cursor = 'grabbing'; },
    move: (x, y) => { if (st2.dim !== 3 || !view._p) return; st2.yaw += (x - view._p[0]) * 0.01; st2.pitch = M.clamp(st2.pitch + (y - view._p[1]) * 0.01, -1.4, 1.4); view._p = [x, y]; view.redraw(); },
    up: () => { view._p = null; $('#n-view').style.cursor = 'grab'; },
  });
  const n1 = LAB.stat('#n-stats', '输入平均 $\\operatorname{RMS}(\\mathbf x)$');
  const n2 = LAB.stat('#n-stats', '输出平均模长 $\\|\\mathbf y\\|$', 'teal');
  const n3 = LAB.stat('#n-stats', '目标半径 $\\sqrt d$', 'plum');
  const n4 = LAB.stat('#n-stats', '输出沿 $\\mathbf 1$ 的平均分量', 'coral');
  function upd2() {
    const X = inputs(), Y = X.map(normalize), d = st2.dim;
    n1.set(fe(M.mean(X.map((x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / d)))));
    n2.set(M.mean(Y.map((y) => Math.hypot(...y))).toFixed(3));
    n3.set(Math.sqrt(d).toFixed(3));
    n4.set(M.mean(Y.map((y) => Math.abs(M.sum(y)) / Math.sqrt(d))).toFixed(3));
    $('#n-sub').textContent = st2.mode === 0 ? '只缩放，不减均值' : '先减均值，再缩放';
    view.redraw();
  }
  upd2();

  // 手算对比：x=(1,2,3,4) 的 LayerNorm 四步与 RMSNorm 两步（书中 7.2 节）
  const stH = { x: [1, 2, 3, 4], big: false };
  const hS = [1, 2, 3, 4].map((k) => LAB.slider('#h-x' + k, { label: `$x_${k}$`, min: -10, max: 10, step: 0.5, value: stH.x[k - 1], fmt: (v) => v.toFixed(1), onInput: (v) => { stH.x[k - 1] = v; updH(); } }));
  $('#h-reset').onclick = () => { stH.x = [1, 2, 3, 4]; stH.big = false; $('#h-x10').textContent = '整体放大 10 倍'; hS.forEach((sl, i) => sl.set(stH.x[i])); updH(); };
  $('#h-x10').onclick = () => { stH.big = !stH.big; $('#h-x10').textContent = stH.big ? '恢复原尺度' : '整体放大 10 倍'; updH(); };
  let HR = null;
  function handCalc() {
    const sc = stH.big ? 10 : 1, x = stH.x.map((v) => v * sc), eps = 1e-5;
    const mu = M.mean(x), xc = x.map((v) => v - mu), va = M.mean(xc.map((v) => v * v)), sd = Math.sqrt(va);
    const ln = xc.map((v) => v / Math.sqrt(va + eps));
    const rms = Math.sqrt(M.mean(x.map((v) => v * v)));
    const rn = x.map((v) => (rms > 0 ? v / rms : 0));
    return { x, mu, xc, va, sd, ln, rms, rn, sq: M.sum(rn.map((v) => v * v)) };
  }
  const hBars = LAB.canvas('#h-bars', (ctx, w, h) => {
    if (!HR) return;
    const all = HR.ln.concat(HR.rn), m = Math.max(1.6, ...all.map(Math.abs)) * 1.15;
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.4, xmax: 4.6, ymin: -m, ymax: m, xtickValues: [1, 2, 3, 4], xfmt: (v) => 'x' + v, pad: { l: 40, r: 10, t: 12, b: 30 } }).axes();
    P.hline(0, '#9aa5b1', null, 1);
    const bw = Math.min(16, (P.tx(2) - P.tx(1)) * 0.3), dx = P.ix(P.tx(1) + bw * 0.6) - 1;
    P.bars([1, 2, 3, 4].map((i) => i - dx), HR.ln, C.c4, bw);
    P.bars([1, 2, 3, 4].map((i) => i + dx), HR.rn, C.c1, bw);
    P.text(0.5, m * 0.9, 'LayerNorm', C.c4, 'left', 'middle', '600 12px PingFang SC, sans-serif');
    P.text(0.5, m * 0.75, 'RMSNorm', C.c1, 'left', 'middle', '600 12px PingFang SC, sans-serif');
  });
  function updH() {
    HR = handCalc();
    const f = (a, dg) => '(' + a.map((v) => v.toFixed(dg == null ? 3 : dg)).join(', ') + ')';
    const r = HR;
    $('#h-table').innerHTML = `<tr><th>步骤</th><th>LayerNorm（四步走）</th><th>RMSNorm（两步走）</th></tr>
      <tr><td>输入</td><td colspan="2">$\\mathbf x=${f(r.x, 1)}$</td></tr>
      <tr><td>第 1 步</td><td>$\\mu=${r.mu.toFixed(3)}$</td><td>$\\operatorname{RMS}=\\sqrt{${(r.rms * r.rms).toFixed(3)}}\\approx${r.rms.toFixed(4)}$</td></tr>
      <tr><td>第 2 步</td><td>$\\mathbf x-\\mu=${f(r.xc, 2)}$</td><td>$\\mathbf x/\\operatorname{RMS}=${f(r.rn)}$</td></tr>
      <tr><td>第 3 步</td><td>$\\sigma^2=${r.va.toFixed(3)},\\ \\sigma\\approx${r.sd.toFixed(3)}$</td><td>平方和 $=${r.sq.toFixed(3)}$（$d=4$）</td></tr>
      <tr><td>第 4 步</td><td>$(\\mathbf x-\\mu)/\\sigma=${f(r.ln, 2)}$</td><td>（两步已完成）</td></tr>`;
    LAB.renderMath($('#h-table'));
    hBars.redraw();
  }
  updH();

  // 雅可比切向投影（d = 2）
  const J = { x: [2.3, 0.9], g: [0.5, 1.2], drag: null, P: null };
  const jac = LAB.canvas('#n-jac', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -3, xmax: 3, ymin: -3, ymax: 3, xticks: 6, yticks: 6, pad: { l: 28, r: 12, t: 12, b: 28 } }).axes();
    J.P = P;
    const d = 2, x = J.x, n = Math.hypot(...x) || 1e-9, xh = x.map((v) => v / n), yh = xh.map((v) => Math.sqrt(d) * v);
    const gdot = J.g[0] * xh[0] + J.g[1] * xh[1], rad = xh.map((v) => gdot * v), tan = J.g.map((v, i) => v - rad[i]);
    const back = tan.map((v) => (Math.sqrt(d) / n) * v);
    const px = (p) => [P.tx(p[0]), P.ty(p[1])];
    ctx.save(); ctx.strokeStyle = C.c6; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(P.tx(0), P.ty(0), P.tx(Math.SQRT2) - P.tx(0), 0, 7); ctx.stroke(); ctx.restore();
    // 切线
    const tdir = [-xh[1], xh[0]];
    P.line([yh[0] - 2 * tdir[0], yh[0] + 2 * tdir[0]], [yh[1] - 2 * tdir[1], yh[1] + 2 * tdir[1]], 'rgba(26,140,140,.35)', 1);
    P.line([0, yh[0] * 2], [0, yh[1] * 2], 'rgba(92,103,115,.3)', 1, [2, 3]);
    LAB.arrow(ctx, ...px([0, 0]), ...px(x), C.navy, 2.4);
    const gt = [yh[0] + J.g[0], yh[1] + J.g[1]];
    LAB.arrow(ctx, ...px(yh), ...px(gt), C.c2, 2.4);
    if (Math.hypot(...rad) > 0.03) LAB.arrow(ctx, ...px(yh), ...px([yh[0] + rad[0], yh[1] + rad[1]]), C.c4, 1.8, 7);
    if (Math.hypot(...tan) > 0.03) LAB.arrow(ctx, ...px(yh), ...px([yh[0] + tan[0], yh[1] + tan[1]]), C.c6, 1.8, 7);
    if (Math.hypot(...back) > 0.03) LAB.arrow(ctx, ...px(x), ...px([x[0] + back[0], x[1] + back[1]]), C.c5, 2.6);
    P.points([yh[0]], [yh[1]], C.c6, 4.5, '#fff');
    P.points([x[0]], [x[1]], C.navy, 7, '#fff');
    P.points([gt[0]], [gt[1]], C.c2, 7, '#fff');
    P.text(x[0], x[1] - 0.28, 'x', C.navy, 'center', 'top', 'italic 600 13px serif');
    j1.set((Math.sqrt(d) / n).toFixed(3)); j2.set(Math.abs(gdot).toFixed(3)); j3.set(Math.hypot(...back).toFixed(3));
    { const ip = x[0] * back[0] + x[1] * back[1]; j4.set((Math.abs(ip) < 5e-5 ? 0 : ip).toFixed(4)); }
  });
  const j1 = LAB.stat('#n-jstats', '缩放 $\\sqrt d/\\|\\mathbf x\\|$');
  const j2 = LAB.stat('#n-jstats', '径向分量（丢弃）', 'coral');
  const j3 = LAB.stat('#n-jstats', '$\\|\\mathbf J^\\top\\mathbf g\\|$', 'plum');
  const j4 = LAB.stat('#n-jstats', '$\\langle\\mathbf x,\\mathbf J^\\top\\mathbf g\\rangle$', 'teal');
  pointer('#n-jac', {
    down: (px, py) => {
      const P = J.P; if (!P) return;
      const n = Math.hypot(...J.x), yh = J.x.map((v) => (Math.SQRT2 * v) / n), gt = [yh[0] + J.g[0], yh[1] + J.g[1]];
      const dx = Math.hypot(P.tx(J.x[0]) - px, P.ty(J.x[1]) - py), dg = Math.hypot(P.tx(gt[0]) - px, P.ty(gt[1]) - py);
      J.drag = dg < dx ? 'g' : 'x';
      J.move(px, py);
    },
    move: (px, py) => J.move(px, py),
    up: () => { J.drag = null; },
  });
  J.move = (px, py) => {
    const P = J.P; if (!P || !J.drag) return;
    const v = [M.clamp(P.ix(px), -2.9, 2.9), M.clamp(P.iy(py), -2.9, 2.9)];
    if (J.drag === 'x') { if (Math.hypot(...v) > 0.15) J.x = v; }
    else { const n = Math.hypot(...J.x), yh = J.x.map((t) => (Math.SQRT2 * t) / n); J.g = [v[0] - yh[0], v[1] - yh[1]]; }
    jac.redraw();
  };

  /* ================= 实验 3：SwiGLU 水龙头车间 ================= */
  const st3 = { beta: 1, deriv: false, kind: 0, probe: [-1, 2] };
  const sig = (z) => 1 / (1 + Math.exp(-z));
  const swish = (z, b) => z * sig(b * z);
  const dswish = (z, b) => { const s = sig(b * z); return s + b * z * s * (1 - s); };
  const gelu = (z) => z * M.normcdf(z);
  const dgelu = (z) => M.normcdf(z) + (z * Math.exp(-z * z / 2)) / Math.sqrt(2 * Math.PI);
  const relu = (z) => (z > 0 ? z : 0);
  const phi = (z) => (st3.kind === 0 ? swish(z, st3.beta) : st3.kind === 1 ? gelu(z) : relu(z));
  LAB.slider('#g-beta', { label: 'Swish 的 $\\beta$', min: 0, max: 10, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), hint: '$\\beta=1$ 即 SiLU（SwiGLU 默认）', onInput: (v) => { st3.beta = v; upd3(); } });
  LAB.checkbox('#g-deriv', '显示导数（虚线）', false, (v) => { st3.deriv = v; act.redraw(); });
  LAB.segmented('#g-kind', ['SwiGLU', 'GeGLU', 'ReGLU'], 0, (i) => { st3.kind = i; upd3(); });
  const act = LAB.canvas('#g-act', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -4, xmax: 4, ymin: -1.2, ymax: 3.6, xlabel: 'z', pad: { l: 40, r: 12, t: 12, b: 36 } }).axes();
    P.hline(0, '#9aa5b1', null, 1); P.vline(0, '#9aa5b1', null, 1);
    P.clip();
    const b = st3.beta;
    P.fn(relu, C.slate, 2, null, 400);
    P.fn(gelu, C.c2, 2.2);
    P.fn((z) => swish(z, b), C.c6, 2.8);
    if (st3.deriv) {
      P.fn((z) => (z > 0 ? 1 : 0), C.slate, 1.4, [5, 4], 800);
      P.fn(dgelu, C.c2, 1.4, [5, 4]);
      P.fn((z) => dswish(z, b), C.c6, 1.6, [5, 4]);
    }
    P.unclip();
    if (b > 0.05) {
      const zm = -1.27846 / b, vm = -0.278465 / b;
      if (zm > -4) { P.points([zm], [vm], C.c4, 4.5, '#fff'); P.text(zm, vm - 0.15, `最低点 (${zm.toFixed(2)}, ${vm.toFixed(3)})`, C.c4, zm < -2.5 ? 'left' : 'center', 'top', '11.5px Avenir Next, sans-serif'); }
    }
  });
  const g1 = LAB.stat('#g-stats', '$\\operatorname{Swish}_\\beta$ 最小值', 'teal');
  const g2 = LAB.stat('#g-stats', '最小值位置 $z^*$', 'teal');
  const g3 = LAB.stat('#g-stats', '$z=-1$ 处的 $\\operatorname{Swish}$ 值', 'leaf');
  const g4 = LAB.stat('#g-stats', '$z=-1$ 处的 Swish 导数', 'leaf');
  const g5 = LAB.stat('#g-stats', '$z=-1$ 处 ReLU 的值 / 导数', 'coral');
  g5.set('0 / 0');
  // 门控曲面
  const NG = 121, AMAX = 4;
  const surf = LAB.canvas('#g-surf', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -AMAX, xmax: AMAX, ymin: -AMAX, ymax: AMAX, xticks: 4, yticks: 4, xlabel: 'a（门控）', ylabel: 'b（内容）', pad: { l: 40, r: 10, t: 10, b: 36 } });
    surf._P = P;
    const grid = new Float64Array(NG * NG); let vmax = 0;
    for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) { const a = -AMAX + (2 * AMAX * i) / (NG - 1), b = AMAX - (2 * AMAX * j) / (NG - 1), v = phi(a) * b; grid[j * NG + i] = v; vmax = Math.max(vmax, Math.abs(v)); }
    const W0 = rgbOf('#ffffff'), CB = rgbOf(C.c1), CR = rgbOf(C.c4);
    paintField(ctx, P.x0, P.y1, P.x1 - P.x0, P.y0 - P.y1, NG, NG, (i, j) => { const v = grid[j * NG + i] / vmax, t = Math.sqrt(Math.abs(v)); return v < 0 ? lerp3(W0, CB, t) : lerp3(W0, CR, t); });
    const toX = (i) => P.x0 + (i / (NG - 1)) * (P.x1 - P.x0), toY = (j) => P.y1 + (j / (NG - 1)) * (P.y0 - P.y1);
    ctx.save(); ctx.lineWidth = 0.8;
    [-8, -4, -2, -1, -0.5, 0.5, 1, 2, 4, 8].forEach((lv) => { if (Math.abs(lv) < vmax) { ctx.strokeStyle = 'rgba(29,53,87,.35)'; contour(ctx, grid, NG, NG, lv, toX, toY); } });
    ctx.restore();
    P.axes();
    const [a, b] = st3.probe;
    P.vline(a, 'rgba(31,35,41,.5)', [3, 3], 1); P.hline(b, 'rgba(31,35,41,.5)', [3, 3], 1);
    P.points([a], [b], C.ink, 5, '#fff');
  });
  pointer('#g-surf', { down: (x, y) => probeAt(x, y), move: (x, y) => probeAt(x, y) });
  function probeAt(x, y) { const P = surf._P; if (!P) return; st3.probe = [M.clamp(P.ix(x), -AMAX, AMAX), M.clamp(P.iy(y), -AMAX, AMAX)]; showProbe(); surf.redraw(); }
  function showProbe() {
    const [a, b] = st3.probe, name = ['\\operatorname{Swish}_{' + +st3.beta.toFixed(2) + '}', '\\operatorname{GELU}', '\\operatorname{ReLU}'][st3.kind];
    const dphi = st3.kind === 0 ? dswish(a, st3.beta) : st3.kind === 1 ? dgelu(a) : (a > 0 ? 1 : 0);
    $('#g-probe').innerHTML = LAB.tex(`\\begin{gathered}a=${a.toFixed(2)},\\quad b=${b.toFixed(2)}\\\\ y=${name}(a)\\cdot b=${phi(a).toFixed(3)}\\times${b.toFixed(2)}=${(phi(a) * b).toFixed(3)}\\\\ \\tfrac{\\partial y}{\\partial a}=${dphi.toFixed(3)}\\times${b.toFixed(2)}=${(dphi * b).toFixed(3)},\\quad \\tfrac{\\partial y}{\\partial b}=${phi(a).toFixed(3)}\\end{gathered}`, true);
  }
  function upd3() {
    const b = st3.beta;
    if (b > 0.05) { g1.set((-0.278465 / b).toFixed(3)); g2.set((-1.27846 / b).toFixed(3)); } else { g1.set('−∞'); g2.set('无'); }
    g3.set(swish(-1, b).toFixed(3)); g4.set(dswish(-1, b).toFixed(3));
    act.redraw(); surf.redraw(); showProbe();
  }
  upd3();

  // 手算一层：x → RMSNorm → SwiGLU → 加回主干道（书中 7.4 节）
  const stT = { x: [3, 4] };
  const Wg = [[1.1785, 0], [0, 0]], Wu = [[2.357, 0], [0, 0.8839]];
  const vm = (v, W) => [v[0] * W[0][0] + v[1] * W[1][0], v[0] * W[0][1] + v[1] * W[1][1]];
  const tX = [1, 2].map((k) => LAB.slider('#t-x' + k, { label: `$x_${k}$`, min: -6, max: 6, step: 0.1, value: stT.x[k - 1], fmt: (v) => v.toFixed(1), onInput: (v) => { stT.x[k - 1] = v; updT(); } }));
  $('#t-reset').onclick = () => { stT.x = [3, 4]; tX.forEach((sl, i) => sl.set(stT.x[i])); updT(); };
  const tsa = LAB.stat('#t-stats', '$\\operatorname{RMS}(\\mathbf x)$', 'teal');
  const tsb = LAB.stat('#t-stats', '支线输出 $\\operatorname{FFN}$', 'amber');
  const tsc = LAB.stat('#t-stats', '下一层 $\\mathbf x_{\\text{next}}$', 'leaf');
  function updT() {
    const x = stT.x, r = Math.sqrt((x[0] * x[0] + x[1] * x[1]) / 2), xh = x.map((v) => (r > 0 ? v / r : 0));
    const z = vm(xh, Wg), u = vm(xh, Wu), g = z.map((v) => swish(v, 1)), y = g.map((v, i) => v * u[i]), nx = x.map((v, i) => v + y[i]);
    const f = (a, dg) => '(' + a.map((v) => v.toFixed(dg == null ? 4 : dg)).join(',\\ ') + ')';
    const p = (a, dg) => '(' + a.map((v) => v.toFixed(dg)).join(', ') + ')';
    $('#t-table').innerHTML = `<tr><th>步骤</th><th>算式</th><th>结果</th></tr>
      <tr><td>第 1 步：RMSNorm</td><td>$\\operatorname{RMS}=\\sqrt{(x_1^2+x_2^2)/2}$，$\\hat{\\mathbf x}=\\mathbf x/\\operatorname{RMS}$</td><td>$${r.toFixed(4)}$，$${f(xh)}$</td></tr>
      <tr><td>第 2 步：门控</td><td>$\\mathbf z=\\hat{\\mathbf x}\\mathbf W_{\\text{gate}}$，$\\mathbf g=\\operatorname{Swish}(\\mathbf z)$</td><td>$${f(z)}$，$${f(g)}$</td></tr>
      <tr><td>第 2 步：内容</td><td>$\\mathbf u=\\hat{\\mathbf x}\\mathbf W_{\\text{up}}$</td><td>$${f(u)}$</td></tr>
      <tr><td>第 2 步：相乘</td><td>$(\\mathbf g\\odot\\mathbf u)\\mathbf W_{\\text{down}}$</td><td>$${f(y)}$</td></tr>
      <tr><td>第 3 步：加回</td><td>$\\mathbf x+\\operatorname{FFN}$</td><td>$${f(nx)}$</td></tr>`;
    LAB.renderMath($('#t-table'));
    tsa.set(r.toFixed(4)); tsb.set(p(y, 4)); tsc.set(p(nx, 4));
  }
  updT();
})();
