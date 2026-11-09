/* 第 7 章：深层信号传播动力学：交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §7.2 残差流与 Pre-LN · §7.3 RMSNorm · §7.4 SwiGLU · §7.5 雅可比 · §7.6 秩坍缩 · §7.7 1/√(2L) 缩放' });

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

  /* ================= 实验 3：门控激活与秩坍缩 ================= */
  const st3 = { beta: 1, deriv: false, kind: 0, probe: [-1.2, 2.5], layer: 4, tau: 1, seed: 5 };
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
  const g3 = LAB.stat('#g-stats', '$z=-2$ 处导数：Swish', 'leaf');
  const g4 = LAB.stat('#g-stats', '$z=-2$ 处导数：ReLU', 'coral');
  g4.set('0');
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
    $('#g-probe').innerHTML = LAB.tex(`\\begin{gathered}a=${a.toFixed(2)},\\quad b=${b.toFixed(2)}\\\\ ${name}(a)\\cdot b=${phi(a).toFixed(3)}\\times${b.toFixed(2)}=${(phi(a) * b).toFixed(3)}\\end{gathered}`, true);
  }
  function upd3() {
    const b = st3.beta;
    if (b > 0.05) { g1.set((-0.278465 / b).toFixed(3)); g2.set((-1.27846 / b).toFixed(3)); } else { g1.set('−∞'); g2.set('无'); }
    g3.set(dswish(-2, b).toFixed(3));
    act.redraw(); surf.redraw(); showProbe();
  }
  upd3();

  // 秩坍缩
  const T = 8, D = 16, LMAX = 16;
  let RC = null;
  function gauss(R, r, c, s) { return M.range(r).map(() => M.range(c).map(() => R.normal() * s)); }
  const mm = (A, B) => A.map((row) => B[0].map((_, j) => { let t = 0; for (let k = 0; k < row.length; k++) t += row[k] * B[k][j]; return t; }));
  const tr = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  function orth(R, n) { const G = gauss(R, n, n, 1), Q = []; for (let i = 0; i < n; i++) { let v = G[i].slice(); for (const q of Q) { const p = M.dot(v, q); v = v.map((x, k) => x - p * q[k]); } const nn = M.norm(v); Q.push(v.map((x) => x / nn)); } return Q; }
  const softmaxRows = (S) => S.map((r) => M.softmax(r));
  function resid(X) { const mean = X[0].map((_, j) => M.mean(X.map((r) => r[j]))); let n = 0, f = 0; X.forEach((r) => r.forEach((v, j) => { n += (v - mean[j]) ** 2; f += v * v; })); return Math.sqrt(n / f); }
  const rmsRows = (X) => X.map((r) => { const s = Math.sqrt(r.reduce((a, v) => a + v * v, 0) / r.length); return r.map((v) => v / s); });
  function buildRC() {
    const R = LAB.rng(st3.seed), X0 = gauss(R, T, D, 1);
    const layers = M.range(LMAX).map(() => ({ Q: gauss(R, D, D, 1 / Math.sqrt(D)), K: gauss(R, D, D, 1 / Math.sqrt(D)), V: orth(R, D) }));
    // 初始点云的前两个主成分（幂迭代）
    const mean = X0[0].map((_, j) => M.mean(X0.map((r) => r[j]))), Xc = X0.map((r) => r.map((v, j) => v - mean[j]));
    const Cov = mm(tr(Xc), Xc), pcs = [];
    for (let k = 0; k < 2; k++) { let v = M.range(D).map((i) => Math.sin(i + 1 + k)); for (let it = 0; it < 200; it++) { let w = Cov.map((r) => M.dot(r, v)); pcs.forEach((p) => { const c = M.dot(w, p); w = w.map((x, i) => x - c * p[i]); }); const nn = M.norm(w); v = w.map((x) => x / nn); } pcs.push(v); }
    const run = (kind) => {
      let X = X0; const Xs = [X], rs = [resid(X)];
      const t2 = st3.tau * st3.tau;
      for (const Ly of layers) {
        const Z = kind === 'res' ? rmsRows(X) : X;
        const S = mm(mm(Z, Ly.Q), tr(mm(Z, Ly.K))).map((r) => r.map((x) => (x * t2) / Math.sqrt(D)));
        const Y = mm(mm(softmaxRows(S), Z), Ly.V);
        X = kind === 'pure' ? Y : X.map((r, i) => r.map((x, j) => x + Y[i][j]));
        Xs.push(X); rs.push(Math.max(resid(X), 1e-17));
      }
      return { Xs, rs };
    };
    RC = { pcs, pure: run('pure'), res: run('res') };
  }
  const TOK = [C.c1, C.c2, C.c3, C.c4, C.c5, C.c6, C.navy, C.slate];
  const scat = LAB.canvas('#r-scatter', (ctx, w, h) => {
    if (!RC) return;
    const half = w / 2, l = st3.layer;
    [['纯注意力', RC.pure], ['加残差', RC.res]].forEach(([name, run], q) => {
      const ox = q * half, cx = ox + half / 2, cy = h / 2 + 8, sc = Math.min(half, h - 30) / 2 / 1.25;
      ctx.save(); ctx.strokeStyle = C.line; ctx.strokeRect(ox + 4, 22, half - 8, h - 26); ctx.restore();
      ctx.fillStyle = q === 0 ? C.c4 : C.c1; ctx.font = '600 12.5px PingFang SC, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${name} · 第 ${l} 层`, ox + 6, 15);
      const pos = (X, i) => { const s = Math.sqrt(X.reduce((a, r) => a + r.reduce((b, v) => b + v * v, 0), 0) / X.length); return [M.dot(X[i], RC.pcs[0]) / s, M.dot(X[i], RC.pcs[1]) / s]; };
      for (let i = 0; i < T; i++) {
        ctx.strokeStyle = TOK[i]; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let k = 0; k <= l; k++) { const p = pos(run.Xs[k], i), X = cx + sc * M.clamp(p[0], -1.3, 1.3), Y = cy - sc * M.clamp(p[1], -1.3, 1.3); if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      for (let i = 0; i < T; i++) { const p = pos(run.Xs[l], i); ctx.fillStyle = TOK[i]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx + sc * M.clamp(p[0], -1.3, 1.3), cy - sc * M.clamp(p[1], -1.3, 1.3), 4.5, 0, 7); ctx.fill(); ctx.stroke(); }
    });
  });
  const curve = LAB.canvas('#r-curve', (ctx, w, h) => {
    if (!RC) return;
    const xs = M.range(LMAX + 1);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: LMAX, ymin: 1e-17, ymax: 1, logy: true, ytickValues: [1e-16, 1e-12, 1e-8, 1e-4, 1], xlabel: '层 l', ylabel: '到秩 1 的相对距离', pad: { l: 50, r: 10, t: 10, b: 36 } }).axes();
    P.vline(st3.layer, C.slate, [3, 3]);
    P.line(xs, RC.pure.rs, C.c4, 2.4); P.line(xs, RC.res.rs, C.c1, 2.4);
    P.points([st3.layer], [RC.pure.rs[st3.layer]], C.c4, 4.5, '#fff'); P.points([st3.layer], [RC.res.rs[st3.layer]], C.c1, 4.5, '#fff');
  });
  const rs1 = LAB.stat('#r-stats', '纯注意力：第 $l$ 层相对残差', 'coral');
  const rs2 = LAB.stat('#r-stats', '加残差：第 $l$ 层相对残差');
  function upd3r() { const l = st3.layer; rs1.set(fe(RC.pure.rs[l])); rs2.set(fe(RC.res.rs[l])); scat.redraw(); curve.redraw(); }
  LAB.slider('#r-layer', { label: '查看第 $l$ 层', min: 0, max: LMAX, step: 1, value: st3.layer, onInput: (v) => { st3.layer = v; upd3r(); } });
  LAB.slider('#r-tau', { label: '注意力锐度 $\\tau$', min: 0.5, max: 3, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), hint: '打分 $\\tau^2\\,\\mathbf q^\\top\\mathbf k/\\sqrt d$，越大越尖锐', onInput: (v) => { st3.tau = v; buildRC(); upd3r(); } });
  $('#r-resample').onclick = () => { st3.seed++; buildRC(); upd3r(); };
  buildRC(); upd3r();
})();
