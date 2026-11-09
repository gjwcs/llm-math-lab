/* 第 3 章：逼近论与表征学习 · 交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §3.2 万能逼近定理 · §3.3 深度的指数红利 · 思考题 3.1（Yarotsky）· §3.6 GELU' });
  // 窄屏下长公式与宽表格改为横向滚动，不撑破版面
  document.querySelectorAll('.formula, [style*="overflow-x"]').forEach((f) => { f.style.width = '0'; f.style.minWidth = '100%'; });
  const FONT = getComputedStyle(document.body).getPropertyValue('--font');
  const NUMF = getComputedStyle(document.body).getPropertyValue('--font-num');
  const relu = (z) => (z > 0 ? z : 0);
  const fe = (v) => (v < 1e-3 ? M.fmt(v, 2) : v.toFixed(4));
  function pointer(cv, h) {
    cv.style.touchAction = 'none';
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let active = false;
    cv.addEventListener('pointerdown', (e) => { if (h.down && h.down(pos(e)) !== false) { active = true; cv.setPointerCapture(e.pointerId); e.preventDefault(); } });
    cv.addEventListener('pointermove', (e) => { if (active) h.move && h.move(pos(e)); });
    const end = () => { if (active) { active = false; h.up && h.up(); } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }
  // Householder QR 最小二乘：A 为 m×n（按行存储）
  function lsq(A, m, n, y) {
    const Q = Float64Array.from(A), b = Float64Array.from(y), v = new Float64Array(m);
    let rmax = 0;
    for (let k = 0; k < n; k++) {
      let nrm = 0; for (let i = k; i < m; i++) nrm += Q[i * n + k] * Q[i * n + k]; nrm = Math.sqrt(nrm);
      if (nrm < 1e-13) continue;
      const alpha = Q[k * n + k] > 0 ? -nrm : nrm;
      let vn = 0; for (let i = k; i < m; i++) { v[i] = Q[i * n + k] - (i === k ? alpha : 0); vn += v[i] * v[i]; }
      if (vn < 1e-30) continue;
      for (let j = k; j < n; j++) { let s = 0; for (let i = k; i < m; i++) s += v[i] * Q[i * n + j]; s = 2 * s / vn; for (let i = k; i < m; i++) Q[i * n + j] -= s * v[i]; }
      let s = 0; for (let i = k; i < m; i++) s += v[i] * b[i]; s = 2 * s / vn; for (let i = k; i < m; i++) b[i] -= s * v[i];
      rmax = Math.max(rmax, Math.abs(Q[k * n + k]));
    }
    const x = new Float64Array(n);
    for (let k = n - 1; k >= 0; k--) { let s = b[k]; for (let j = k + 1; j < n; j++) s -= Q[k * n + j] * x[j]; const r = Q[k * n + k]; x[k] = Math.abs(r) > 1e-10 * rmax ? s / r : 0; }
    return x;
  }

  /* ================= 实验 1：ReLU 拼图 ================= */
  const G = 400, XS = M.linspace(0, 1, G + 1);
  const TARGETS = [
    { name: '正弦 $\\sin 2\\pi x$', f: (x) => Math.sin(2 * Math.PI * x) },
    { name: '$|2x-1|$', f: (x) => Math.abs(2 * x - 1) },
    { name: '阶跃', f: (x) => (x >= 0.5 ? 1 : 0) },
    { name: '$x^2$', f: (x) => x * x },
    { name: '高频 $\\sin 6\\pi x$', f: (x) => Math.sin(6 * Math.PI * x) },
    { name: '✏️ 手绘', f: null },
  ];
  let tIdx = 0, knotMode = 0, knotSeed = 3, showPieces = true;
  let drawn = XS.map((x) => 0.75 * Math.exp(-Math.pow((x - 0.3) / 0.12, 2)) - 0.45 * Math.exp(-Math.pow((x - 0.72) / 0.09, 2)) + 0.25 * x);
  const segT = LAB.segmented('#r-target', TARGETS.map((t) => t.name), 0, (i) => { tIdx = i; refit(true); });
  const sN = LAB.slider('#r-n', { label: '隐藏神经元个数 $N$', min: 1, max: 64, step: 1, value: 8, onInput: () => refit(false) });
  LAB.segmented('#r-knots', ['均匀分布', '随机分布'], 0, (i) => { knotMode = i; refit(true); });
  LAB.checkbox('#r-pieces', '显示每个 ReLU 分量 $c_m\\sigma(x-t_m)$', true, (v) => { showPieces = v; main1.redraw(); });
  document.querySelector('#r-reroll').onclick = () => { knotSeed++; if (knotMode === 0) { knotMode = 1; document.querySelectorAll('#r-knots button')[1].click(); } else refit(true); };
  document.querySelector('#r-clear').onclick = () => { drawn = XS.map(() => 0); if (tIdx !== 5) segT.set(5); else refit(true); };
  const target = () => (tIdx === 5 ? drawn : XS.map(TARGETS[tIdx].f));
  function knots(N) {
    if (knotMode === 0) return M.range(N).map((m) => m / N);
    const R = LAB.rng(knotSeed * 97 + 1), all = M.range(64).map(() => R());
    return all.slice(0, N).sort((a, b) => a - b);
  }
  function fit(N, y) {
    const t = knots(N), n = N + 1, A = new Float64Array((G + 1) * n);
    for (let g = 0; g <= G; g++) { A[g * n] = 1; for (let m = 0; m < N; m++) A[g * n + m + 1] = relu(XS[g] - t[m]); }
    const c = lsq(A, G + 1, n, y), f = new Float64Array(G + 1);
    for (let g = 0; g <= G; g++) { let s = 0; for (let j = 0; j < n; j++) s += A[g * n + j] * c[j]; f[g] = s; }
    let linf = 0, l2 = 0; for (let g = 0; g <= G; g++) { const e = Math.abs(f[g] - y[g]); linf = Math.max(linf, e); l2 += e * e; }
    return { t, c, f, linf, l2: Math.sqrt(l2 / (G + 1)) };
  }
  let cur = null, curve = [];
  const st1 = [LAB.stat('#r-stats', '隐藏神经元 $N$'), LAB.stat('#r-stats', '线性段数', 'teal'), LAB.stat('#r-stats', '$L_\\infty$ 最大误差', 'coral'), LAB.stat('#r-stats', '$L_2$ 均方根误差', 'amber')];
  function refit(all) {
    const y = target();
    cur = fit(sN.get(), y);
    const inside = new Set(cur.t.filter((t) => t > 1e-9 && t < 1 - 1e-9).map((t) => t.toFixed(9)));
    st1[0].set(`${sN.get()}<small>参数 ${3 * sN.get() + 1} 个</small>`);
    st1[1].set(inside.size + 1);
    st1[2].set(fe(cur.linf)); st1[3].set(fe(cur.l2));
    if (all) { curve = M.range(64).map((i) => { const r = fit(i + 1, y); return { n: i + 1, linf: r.linf, l2: r.l2 }; }); }
    main1.redraw(); err1.redraw();
  }
  let P1 = null, lastG = null;
  const main1 = LAB.canvas('#r-main', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: -1.45, ymax: 1.45, xlabel: 'x', ylabel: 'f(x)', pad: { l: 46, r: 14, t: 12, b: 38 } }).axes();
    P1 = P; if (!cur) return;
    const y = target();
    P.clip();
    if (showPieces) cur.t.forEach((t, m) => { const c = cur.c[m + 1]; P.line([t, 1], [0, c * (1 - t)], LAB.SERIES[m % 6], 1.1); });
    P.line(XS, y, '#B8C1CC', 5);
    P.line(XS, Array.from(cur.f), C.c1, 2.4);
    P.unclip();
    ctx.save(); ctx.fillStyle = C.c4;
    cur.t.forEach((t) => { const X = P.tx(t); ctx.beginPath(); ctx.moveTo(X, P.y0); ctx.lineTo(X - 4, P.y0 - 7); ctx.lineTo(X + 4, P.y0 - 7); ctx.closePath(); ctx.fill(); });
    ctx.restore();
    if (tIdx === 5) P.text(0.99, 1.33, '在图上按住拖动可以改画目标曲线', C.slate, 'right');
  });
  pointer(main1.canvas, {
    down: ([x, y]) => {
      if (!P1) return false;
      if (tIdx !== 5) { drawn = target().slice(); segT.set(5); }
      lastG = null; paint(x, y); return true;
    },
    move: ([x, y]) => paint(x, y),
    up: () => { lastG = null; refit(true); },
  });
  function paint(px, py) {
    const g = Math.round(M.clamp(P1.ix(px), 0, 1) * G), v = M.clamp(P1.iy(py), -1.3, 1.3);
    if (lastG === null) drawn[g] = v;
    else { const [a, b] = lastG.g < g ? [lastG, { g, v }] : [{ g, v }, lastG]; for (let k = a.g; k <= b.g; k++) drawn[k] = b.g === a.g ? v : a.v + (b.v - a.v) * (k - a.g) / (b.g - a.g); }
    lastG = { g, v }; refit(false);
  }
  const err1 = LAB.canvas('#r-err', (ctx, w, h) => {
    if (!curve.length) return;
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: 64, logx: true, logy: true, ymin: 1e-5, ymax: 3, xtickValues: [1, 2, 4, 8, 16, 32, 64], xfmt: (v) => v, ytickValues: [1e-5, 1e-4, 1e-3, 1e-2, 0.1, 1], xlabel: '神经元个数 N', ylabel: '误差', pad: { l: 50, r: 12, t: 10, b: 38 } }).axes();
    const fl = (v) => (v > 1e-6 ? v : NaN);
    P.clip();
    const ref = curve[7] ? curve[7].l2 : 0.01;
    P.fn((n) => ref * 64 / (n * n), C.c2, 1.5, [6, 4]);
    P.line(curve.map((c) => c.n), curve.map((c) => fl(c.linf)), C.c4, 2);
    P.line(curve.map((c) => c.n), curve.map((c) => fl(c.l2)), C.c1, 2);
    P.unclip();
    const c = curve[sN.get() - 1];
    if (c) { P.points([c.n], [Math.max(c.linf, 1.2e-5)], C.c4, 5.5, '#fff'); P.points([c.n], [Math.max(c.l2, 1.2e-5)], C.c1, 5.5, '#fff'); }
  });
  refit(true);

  /* ================= 实验 2：深度折纸 ================= */
  const sec2 = document.querySelector('#folding');
  const g1 = (y) => 2 * relu(y) - 4 * relu(y - 0.5) + 2 * relu(y - 1);
  function gL(L, n) { const xs = M.linspace(0, 1, n), ys = xs.slice(); for (let k = 0; k < L; k++) for (let i = 0; i < n; i++) ys[i] = g1(ys[i]); return { xs, ys }; }
  function SL(L, xs) { return xs.map((x) => { let y = x, s = 0, p = 1; for (let k = 1; k <= L; k++) { y = g1(y); p /= 4; s += y * p; } return s; }); }
  let mode2 = 0, ghost = true, anim = null, playing = false;
  const sL = LAB.slider('#f-L', { label: '层数 $L$', min: 1, max: 10, step: 1, value: 3, onInput: (v) => { const prev = shownL; shownL = v; if (mode2 === 0 && v === prev + 1) startAnim(prev, v); else { anim = null; main2.redraw(); } upd2(); } });
  let shownL = 3;
  LAB.segmented('#f-mode', ['锯齿波 $g_L$', '逼近 $x(1-x)$'], 0, (i) => { mode2 = i; anim = null; title2(); main2.redraw(); });
  LAB.checkbox('#f-ghost', '虚线显示上一层', true, (v) => { ghost = v; main2.redraw(); });
  const playBtn = document.querySelector('#f-play');
  playBtn.onclick = () => {
    if (playing) { playing = false; playBtn.textContent = '▶ 从 1 层折到 10 层'; return; }
    if (mode2 !== 0) document.querySelectorAll('#f-mode button')[0].click();
    playing = true; playBtn.textContent = '⏸ 暂停';
    sL.set(1); shownL = 1; upd2(); startAnim(0, 1);
  };
  function title2() {
    const t = document.querySelector('#f-title');
    t.innerHTML = mode2 === 0 ? '锯齿波 $g_L(x)$' : '锯齿波加权和 $S_L(x)=\\sum_{k=1}^{L} g_k(x)/4^k$ 逼近 $x(1-x)$';
    LAB.renderMath(t);
  }
  function startAnim(from, to) { anim = { from, to, t0: performance.now() }; requestAnimationFrame(tick); }
  function tick() {
    if (!anim) return;
    if (!sec2.classList.contains('active')) { anim = null; playing = false; playBtn.textContent = '▶ 从 1 层折到 10 层'; main2.redraw(); return; }
    const t = (performance.now() - anim.t0) / 700;
    if (t >= 1) {
      anim = null; main2.redraw();
      if (playing) {
        if (shownL < 10) setTimeout(() => { if (!playing) return; const v = shownL + 1; sL.set(v); shownL = v; upd2(); startAnim(v - 1, v); }, 280);
        else { playing = false; playBtn.textContent = '▶ 从 1 层折到 10 层'; }
      }
      return;
    }
    main2.redraw(); requestAnimationFrame(tick);
  }
  const ease = (t) => t * t * (3 - 2 * t);
  const main2 = LAB.canvas('#f-main', (ctx, w, h) => {
    const L = shownL;
    if (mode2 === 0) {
      const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: -0.05, ymax: 1.12, xlabel: 'x', ylabel: 'g_L(x)', pad: { l: 46, r: 14, t: 12, b: 38 } }).axes();
      const n = (1 << L) + 1;
      let xs, ys;
      if (anim) {
        const t = ease(Math.min(1, (performance.now() - anim.t0) / 700));
        const A = gL(anim.from, n), B = gL(anim.to, n);
        xs = A.xs; ys = A.ys.map((v, i) => (1 - t) * v + t * B.ys[i]);
      } else ({ xs, ys } = gL(L, n));
      if (ghost && L > 1 && !anim) { const p = gL(L - 1, (1 << (L - 1)) + 1); P.line(p.xs, p.ys, C.slate, 1.3, [4, 4]); }
      if (ghost && anim && anim.from >= 0) { const p = gL(anim.from, (1 << Math.max(anim.from, 0)) + 1); P.line(p.xs, p.ys, C.slate, 1.3, [4, 4]); }
      for (let i = 0; i + 1 < xs.length; i++) P.line([xs[i], xs[i + 1]], [ys[i], ys[i + 1]], i % 2 ? C.c6 : C.c1, L >= 8 ? 1.4 : 2.4);
      if (L <= 6 && !anim) P.points(xs, ys, C.navy, 2.5);
    } else {
      const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: -0.01, ymax: 0.29, xlabel: 'x', ylabel: 'y', pad: { l: 52, r: 14, t: 12, b: 38 } }).axes();
      const xs = M.linspace(0, 1, 801);
      for (let k = 1; k <= L; k++) { const { xs: gx, ys } = gL(k, (1 << k) + 1); P.line(gx, ys.map((v) => v / Math.pow(4, k)), LAB.mix(C.c6, '#ffffff', 0.15 + 0.6 * (k - 1) / 10), 1.1); }
      P.line(xs, xs.map((x) => x * (1 - x)), '#B8C1CC', 5);
      const sx = M.linspace(0, 1, (1 << L) + 1);
      if (ghost && L > 1) P.line(M.linspace(0, 1, (1 << (L - 1)) + 1), SL(L - 1, M.linspace(0, 1, (1 << (L - 1)) + 1)), C.slate, 1.3, [4, 4]);
      P.line(sx, SL(L, sx), C.c1, 2.4);
      P.text(0.99, 0.275, `S_${L} 用 ${3 * L} 个神经元，误差 ≤ ${M.fmt(1 / (3 * Math.pow(4, L)), 2)}`, C.navy, 'right', 'middle', '600 12px ' + FONT);
    }
  });
  // 实测误差：深层 S_L 与浅层（3L 个神经元 → 3L+1 段均匀插值）
  const fine = M.linspace(0, 1, 4097), tgt = fine.map((x) => x * (1 - x));
  const errDeep = M.range(10).map((i) => { const s = SL(i + 1, fine); return Math.max(...s.map((v, j) => Math.abs(v - tgt[j]))); });
  const errShallow = M.range(10).map((i) => {
    const n = 3 * (i + 1) + 1; let mx = 0;
    for (let k = 0; k <= 20000; k++) { const x = k / 20000, j = Math.min(n - 1, Math.floor(x * n)), a = j / n, b = (j + 1) / n, ya = a * (1 - a), yb = b * (1 - b), yi = ya + (yb - ya) * (x - a) * n; mx = Math.max(mx, Math.abs(yi - x * (1 - x))); }
    return mx;
  });
  const pieces = LAB.canvas('#f-pieces', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.4, xmax: 10.6, ymin: 1, ymax: 2048, logy: true, xtickValues: M.range(10).map((i) => i + 1), xfmt: (v) => v, ytickValues: [1, 10, 100, 1000], xlabel: '层数 L（每层 3 个神经元）', ylabel: '线性段数', pad: { l: 48, r: 10, t: 10, b: 38 } }).axes();
    const bw = (P.tx(2) - P.tx(1)) * 0.36, L = shownL;
    const xs = M.range(10).map((i) => i + 1);
    P.bars(xs.map((x) => x - 0.2), xs.map((x) => Math.pow(2, x)), xs.map((x) => (x === L ? C.c1 : LAB.mix(C.c1, '#ffffff', 0.55))), bw, 1);
    P.bars(xs.map((x) => x + 0.2), xs.map((x) => 3 * x + 1), xs.map((x) => (x === L ? C.c2 : LAB.mix(C.c2, '#ffffff', 0.55))), bw, 1);
    P.text(L - 0.2, Math.pow(2, L) * 1.35, String(Math.pow(2, L)), C.c1, 'center', 'bottom', '600 11.5px ' + NUMF);
  });
  const err2 = LAB.canvas('#f-err', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.6, xmax: 10.4, ymin: 1e-7, ymax: 0.2, logy: true, xtickValues: M.range(10).map((i) => i + 1), xfmt: (v) => v, ytickValues: [1e-7, 1e-5, 1e-3, 1e-1], xlabel: '层数 L（神经元 3L 个）', ylabel: '最大误差', pad: { l: 50, r: 10, t: 10, b: 38 } }).axes();
    const xs = M.range(10).map((i) => i + 1);
    P.line(xs, xs.map((L) => 1 / (3 * Math.pow(4, L))), C.c4, 1.6, [6, 4]);
    P.line(xs, errShallow, C.c2, 2.2); P.points(xs, errShallow, C.c2, 3);
    P.line(xs, errDeep, C.c1, 2.2); P.points(xs, errDeep, C.c1, 3);
    P.points([shownL], [errDeep[shownL - 1]], C.c1, 6.5, '#fff');
  });
  const st2 = [LAB.stat('#f-stats', '神经元总数 $3L$'), LAB.stat('#f-stats', '深层线段数 $2^L$', 'teal'), LAB.stat('#f-stats', '浅层同预算至多', 'amber'), LAB.stat('#f-stats', '$x(1-x)$ 最大误差', 'coral')];
  function upd2() {
    const L = shownL;
    st2[0].set(`${3 * L}<small>${L} 层 × 3</small>`); st2[1].set(Math.pow(2, L).toLocaleString()); st2[2].set(`${3 * L + 1}<small>段</small>`);
    st2[3].set(`${M.fmt(errDeep[L - 1], 2)}<small>浅层 ${M.fmt(errShallow[L - 1], 2)}</small>`);
    document.querySelector('#f-sub').textContent = `${L} 层 · ${Math.pow(2, L)} 段 · ${Math.pow(2, L - 1)} 个锯齿`;
    pieces.redraw(); err2.redraw();
  }
  upd2();

  /* ================= 实验 3：激活函数与 GELU ================= */
  const phi = (z) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI), Phi = M.normcdf, sig = (z) => 1 / (1 + Math.exp(-z));
  const ACT = [
    { name: 'ReLU', color: C.c2, f: relu, d1: (z) => (z > 0 ? 1 : 0), d2: () => 0, gate: (z) => (z > 0 ? 1 : 0), on: true },
    { name: 'GELU', color: C.c1, f: (z) => z * Phi(z), d1: (z) => Phi(z) + z * phi(z), d2: (z) => phi(z) * (2 - z * z), gate: Phi, on: true },
    { name: 'SiLU', color: C.c3, f: (z) => z * sig(z), d1: (z) => sig(z) * (1 + z * (1 - sig(z))), d2: (z) => sig(z) * (1 - sig(z)) * (2 + z * (1 - 2 * sig(z))), gate: sig, on: true },
    { name: 'tanh', color: C.c5, f: Math.tanh, d1: (z) => 1 - Math.tanh(z) ** 2, d2: (z) => -2 * Math.tanh(z) * (1 - Math.tanh(z) ** 2), gate: null, on: true },
  ];
  const geluT = (z) => 0.5 * z * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (z + 0.044715 * z * z * z)));
  let order = 1, noise = [], nseed = 1;
  ACT.forEach((a) => LAB.checkbox('#a-checks', `<span style="display:inline-block;width:14px;height:4px;border-radius:2px;background:${a.color};margin-right:2px;vertical-align:middle"></span>${a.name}`, true, (v) => { a.on = v; redraw3(); }));
  const sZ = LAB.slider('#a-z', { label: '探针位置 $z$', min: -4, max: 4, step: 0.05, value: -0.5, fmt: (v) => v.toFixed(2), onInput: () => redraw3() });
  LAB.segmented('#a-deriv', ['一阶导数', '二阶导数'], 0, (i) => { order = i + 1; const t = document.querySelector('#a-dtitle'); t.innerHTML = i === 0 ? "一阶导数 $\\sigma'(z)$" : "二阶导数 $\\sigma''(z)$"; LAB.renderMath(t); redraw3(); });
  const SL3 = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];
  const sS = LAB.slider('#a-S', { label: '随机噪声采样数 $S$', min: 0, max: SL3.length - 1, step: 1, value: 4, fmt: (i) => SL3[i], onInput: () => redraw3() });
  function drawNoise() { const R = LAB.rng(nseed * 13 + 5); noise = M.range(1000).map(() => R.normal()); }
  document.querySelector('#a-resample').onclick = () => { nseed++; drawNoise(); redraw3(); };
  drawNoise();
  const legend = document.querySelector('#a-legend');
  legend.innerHTML = ACT.map((a) => `<span><i style="background:${a.color}"></i>${a.name}</span>`).join('') + '<span><i style="background:var(--slate)"></i>探针 $z$</span>';
  LAB.renderMath(legend);
  const mcGate = (z) => { const S = SL3[sS.get()]; let c = 0; for (let s = 0; s < S; s++) if (noise[s] <= z) c++; return c / S; };
  const fA = LAB.canvas('#a-f', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -4, xmax: 4, ymin: -1.2, ymax: 3.2, xlabel: 'z', pad: { l: 38, r: 10, t: 10, b: 36 } }).axes();
    const z0 = sZ.get();
    P.vline(z0, C.slate, [4, 3]);
    P.clip(); ACT.filter((a) => a.on).forEach((a) => P.fn(a.f, a.color, 2.3, null, 400)); P.unclip();
    ACT.filter((a) => a.on).forEach((a) => P.points([z0], [a.f(z0)], a.color, 4.5, '#fff'));
  });
  const dA = LAB.canvas('#a-df', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -4, xmax: 4, ymin: order === 1 ? -0.25 : -0.85, ymax: order === 1 ? 1.25 : 1.0, xlabel: 'z', pad: { l: 38, r: 10, t: 10, b: 36 } }).axes();
    const z0 = sZ.get();
    P.vline(z0, C.slate, [4, 3]); P.hline(0, '#9aa5b1');
    P.clip();
    ACT.filter((a) => a.on).forEach((a) => {
      if (a.name === 'ReLU') {
        if (order === 1) { P.line([-4, 0], [0, 0], a.color, 2.3); P.line([0, 4], [1, 1], a.color, 2.3); P.points([0], [0], '#fff', 3.5, a.color); P.points([0], [1], a.color, 3.5); }
        else { P.line([-4, 4], [0, 0], a.color, 2.3); LAB.arrow(ctx, P.tx(0), P.ty(0), P.tx(0), P.ty(0.95), a.color, 2.3, 9); P.text(0.12, 0.88, 'δ(z)', a.color, 'left', 'middle', '600 12px ' + NUMF); }
      } else P.fn(order === 1 ? a.d1 : a.d2, a.color, 2.3, null, 400);
    });
    P.unclip();
  });
  const gA = LAB.canvas('#a-gate', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -4, xmax: 4, ymin: -0.05, ymax: 1.08, xlabel: 'z', ylabel: '放行概率', pad: { l: 44, r: 10, t: 10, b: 36 } }).axes();
    P.line([-4, 0, 0, 4], [0, 0, 1, 1], C.c2, 2);
    P.fn(sig, C.c3, 2, [5, 4]);
    P.fn(Phi, C.c1, 2.6);
    const zs = M.linspace(-4, 4, 41);
    P.points(zs, zs.map(mcGate), C.c4, 3.2);
    P.vline(sZ.get(), C.slate, [4, 3]);
    P.text(-3.9, 0.95, `S = ${SL3[sS.get()]} 次随机门控`, C.c4, 'left', 'middle', '600 12px ' + FONT);
  });
  let maxErr = 0, maxAt = 0;
  for (let z = -6; z <= 6; z += 0.002) { const e = Math.abs(z * Phi(z) - geluT(z)); if (e > maxErr) { maxErr = e; maxAt = z; } }
  const eA = LAB.canvas('#a-err', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -6, xmax: 6, ymin: -6, ymax: 6, xlabel: 'z', ylabel: '误差 ×10⁴', pad: { l: 44, r: 10, t: 10, b: 36 } }).axes();
    P.hline(0, '#9aa5b1');
    P.fn((z) => (z * Phi(z) - geluT(z)) * 1e4, C.plum, 2.2, null, 600);
    P.points([maxAt], [(maxAt * Phi(maxAt) - geluT(maxAt)) * 1e4], C.plum, 4.5, '#fff');
  });
  const st3 = [LAB.stat('#a-stats', '门控 $\\Phi(z)$', 'amber'), LAB.stat('#a-stats', '$\\operatorname{GELU}(z)=z\\Phi(z)$'), LAB.stat('#a-stats', '随机门控估计 $z\\cdot\\widehat{\\Phi}(z)$', 'coral'), LAB.stat('#a-stats', 'tanh 近似最大误差', 'plum')];
  function redraw3() {
    const z0 = sZ.get();
    st3[0].set(Phi(z0).toFixed(4)); st3[1].set(`${(z0 * Phi(z0)).toFixed(4)}<small>ReLU ${relu(z0).toFixed(2)}</small>`);
    st3[2].set(`${(z0 * mcGate(z0)).toFixed(4)}<small>S = ${SL3[sS.get()]}</small>`);
    st3[3].set(`${M.fmt(maxErr, 2)}<small>z ≈ ±${Math.abs(maxAt).toFixed(2)}</small>`);
    fA.redraw(); dA.redraw(); gA.redraw(); eA.redraw();
  }
  redraw3();
})();
