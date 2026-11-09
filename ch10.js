/* 第 10 章：泛化理论与 Scaling Laws：交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §10.1 三位考生与最小平方和 · §10.2 Chinchilla 求导 · §10.3 给 6×10²¹ FLOPs 算模型大小' });

  const $ = (s) => document.querySelector(s);
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (e) => String(e).split('').map((c) => SUP[c]).join('');
  const fe = (x) => { if (!isFinite(x)) return '–'; if (x === 0) return '0'; const a = Math.abs(x); if (a >= 1000 && a < 1e4) return String(Math.round(x)); if (a >= 0.01 && a < 1e4) return x.toPrecision(3); const e = Math.floor(Math.log10(a)); return (x / Math.pow(10, e)).toFixed(1) + '×10' + sup(e); };
  const big = (x) => { const u = [['T', 1e12], ['B', 1e9], ['M', 1e6]]; for (const [s, v] of u) if (x >= v) return (x / v).toPrecision(3) + s; return fe(x); };
  function pointer(el, h) {
    el = typeof el === 'string' ? $(el) : el;
    const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let on = false;
    el.addEventListener('pointerdown', (e) => { on = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} h.down && h.down(...pos(e)); e.preventDefault(); });
    el.addEventListener('pointermove', (e) => { if (on && h.move) h.move(...pos(e)); });
    const end = () => { on = false; }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  const decades = (a, b) => { const t = []; for (let e = a; e <= b; e++) t.push(Math.pow(10, e)); return t; };
  const powFmt = (v) => { const e = Math.round(Math.log10(v)); return '10' + sup(e); };
  function contour(ctx, grid, nx, ny, level, toX, toY) {
    ctx.beginPath();
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = grid[j * nx + i], b = grid[j * nx + i + 1], c = grid[(j + 1) * nx + i + 1], d = grid[(j + 1) * nx + i], p = [];
      const e = (v1, v2, x1, y1, x2, y2) => { if ((v1 < level) !== (v2 < level)) { const t = (level - v1) / (v2 - v1); p.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]); } };
      e(a, b, i, j, i + 1, j); e(b, c, i + 1, j, i + 1, j + 1); e(c, d, i + 1, j + 1, i, j + 1); e(d, a, i, j + 1, i, j);
      for (let q = 0; q + 1 < p.length; q += 2) { ctx.moveTo(toX(p[q][0]), toY(p[q][1])); ctx.lineTo(toX(p[q + 1][0]), toY(p[q + 1][1])); }
    }
    ctx.stroke();
  }

  /* ================= 实验 1：Chinchilla 计算器 ================= */
  const PRE = [
    { name: 'Chinchilla 拟合', E: 1.69, A: 406.4, B: 410.7, a: 0.34, b: 0.28 },
    { name: 'Epoch AI 重新拟合', E: 1.82, A: 482.01, B: 2085.43, a: 0.3478, b: 0.3658 },
  ];
  const S = { pre: 0, C: 6e21, E: 1.69, A: 406.4, B: 410.7, a: 0.34, b: 0.28, selN: null };
  const NR = [1e7, 1e13], DR = [1e8, 1e14];
  const Lf = (N, D) => S.E + S.A / Math.pow(N, S.a) + S.B / Math.pow(D, S.b);
  const optN = (C) => Math.pow((S.a * S.A) / (S.b * S.B), 1 / (S.a + S.b)) * Math.pow(C / 6, S.b / (S.a + S.b));
  const ruleN = (C) => Math.sqrt(C / 120);
  const sC = LAB.slider('#c-C', { label: '算力预算 $C$（FLOPs）', min: 18, max: 26, step: 0.01, value: Math.log10(S.C), fmt: () => fe(S.C), onInput: (v) => { S.C = Math.pow(10, v); S.selN = null; upd1(); } });
  const sA = LAB.slider('#c-alpha', { label: '$\\alpha$（参数幂指数）', min: 0.15, max: 0.6, step: 0.01, value: S.a, fmt: (v) => v.toFixed(2), onInput: (v) => { S.a = v; S.selN = null; field = null; upd1(); } });
  const sB = LAB.slider('#c-beta', { label: '$\\beta$（数据幂指数）', min: 0.15, max: 0.6, step: 0.01, value: S.b, fmt: (v) => v.toFixed(2), onInput: (v) => { S.b = v; S.selN = null; field = null; upd1(); } });
  LAB.segmented('#c-preset', PRE.map((p) => p.name), 0, (i) => { const p = PRE[i]; Object.assign(S, { pre: i, E: p.E, A: p.A, B: p.B, a: p.a, b: p.b, selN: null }); sA.set(p.a); sB.set(p.b); field = null; upd1(); });
  $('#c-book').onclick = () => { S.C = 6e21; sC.set(Math.log10(6e21)); S.selN = null; upd1(); };
  let field = null;
  const mapCv = LAB.canvas('#c-map', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: NR[0], xmax: NR[1], ymin: DR[0], ymax: DR[1], logx: true, logy: true, grid: false, xtickValues: decades(7, 13), ytickValues: decades(8, 14), xfmt: powFmt, yfmt: powFmt, xlabel: '参数量 N', ylabel: '训练词元数 D', pad: { l: 50, r: 12, t: 10, b: 36 } });
    mapCv._P = P;
    const nx = 130, ny = 110;
    if (!field || field.key !== [S.E, S.A, S.B, S.a, S.b].join()) {
      const grid = new Float64Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const N = Math.pow(10, 7 + (6 * i) / (nx - 1)), D = Math.pow(10, 14 - (6 * j) / (ny - 1)); grid[j * nx + i] = Lf(N, D); }
      const off = document.createElement('canvas'); off.width = nx; off.height = ny;
      const oc = off.getContext('2d'), img = oc.createImageData(nx, ny);
      const lo = Math.log(Math.min(...grid) - S.E), hi = Math.log(Math.max(...grid) - S.E);
      const c0 = [255, 255, 255], c1 = [150, 190, 228];
      for (let k = 0; k < grid.length; k++) { const t = 1 - (Math.log(grid[k] - S.E) - lo) / (hi - lo); for (let q = 0; q < 3; q++) img.data[4 * k + q] = Math.round(c0[q] + (c1[q] - c0[q]) * t); img.data[4 * k + 3] = 255; }
      oc.putImageData(img, 0, 0);
      field = { key: [S.E, S.A, S.B, S.a, S.b].join(), off, grid };
    }
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(field.off, P.x0, P.y1, P.x1 - P.x0, P.y0 - P.y1); ctx.restore();
    const toX = (i) => P.x0 + (i / (nx - 1)) * (P.x1 - P.x0), toY = (j) => P.y1 + (j / (ny - 1)) * (P.y0 - P.y1);
    const levels = [1.8, 1.9, 2.0, 2.2, 2.5, 3, 4, 5];
    ctx.save(); ctx.strokeStyle = 'rgba(29,53,87,.28)'; ctx.lineWidth = 1;
    levels.forEach((lv) => contour(ctx, field.grid, nx, ny, lv, toX, toY));
    ctx.fillStyle = 'rgba(29,53,87,.7)'; ctx.font = '10.5px Avenir Next, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    levels.forEach((lv) => { const rest = lv - S.E - S.A / Math.pow(NR[1], S.a); if (rest <= 0) return; const D = Math.pow(S.B / rest, 1 / S.b); if (D > DR[0] && D < DR[1] * 0.7) ctx.fillText('L=' + lv, P.x1 - 3, P.ty(D) - 1); });
    ctx.restore();
    P.axes();
    P.clip();
    const Ns = M.range(161).map((i) => Math.pow(10, 7 + (6 * i) / 160));
    P.line(Ns, Ns.map((N) => 20 * N), C.slate, 1.2, [5, 4]);
    const Cs = M.range(121).map((i) => Math.pow(10, 15 + (15 * i) / 120));
    P.line(Cs.map(optN), Cs.map((c) => c / (6 * optN(c))), C.plum, 1.6, [2, 3]);
    P.line(Ns, Ns.map((N) => S.C / (6 * N)), C.coral, 2.4);
    const No = optN(S.C), Nr = ruleN(S.C);
    P.points([Nr], [20 * Nr], C.amber, 6, '#fff');
    P.points([No], [S.C / (6 * No)], C.navy, 6.5, '#fff');
    if (S.selN) { P.points([S.selN], [S.C / (6 * S.selN)], C.plum, 6, '#fff'); }
    P.unclip();
  });
  function pickN(px) { const P = mapCv._P; if (!P) return; let N = P.ix(px); const lo = Math.max(NR[0], S.C / (6 * DR[1])), hi = Math.min(NR[1], S.C / (6 * DR[0])); S.selN = M.clamp(N, lo, hi); upd1(); }
  pointer('#c-map', { down: pickN, move: pickN });
  const profCv = LAB.canvas('#c-profile', (ctx, w, h) => {
    const No = optN(S.C), Lo = Lf(No, S.C / (6 * No));
    const lo = Math.max(No / 1000, S.C / (6 * 1e16), 1e5), hi = Math.min(No * 1000, 1e15);
    const Ns = M.range(201).map((i) => lo * Math.pow(hi / lo, i / 200)), Ls = Ns.map((N) => Lf(N, S.C / (6 * N)));
    const ymax = Math.min(Math.max(...Ls), Lo + 1.2);
    const e0 = Math.ceil(Math.log10(lo)), e1 = Math.floor(Math.log10(hi));
    const P = new LAB.Plot(ctx, w, h, { xmin: lo, xmax: hi, ymin: Lo - 0.03 * (ymax - Lo), ymax, logx: true, xtickValues: decades(e0, e1).filter((_, i, a) => a.length < 7 || i % 2 === 0), xfmt: powFmt, xlabel: '参数量 N（D = C/6N）', ylabel: '损失 L', pad: { l: 46, r: 12, t: 12, b: 36 } }).axes();
    P.clip(); P.line(Ns, Ls, C.coral, 2.4); P.unclip();
    const Nr = ruleN(S.C);
    P.points([Nr], [Lf(Nr, 20 * Nr)], C.amber, 5.5, '#fff');
    P.points([No], [Lo], C.navy, 6, '#fff');
    if (S.selN) P.points([S.selN], [Lf(S.selN, S.C / (6 * S.selN))], C.plum, 5.5, '#fff');
  });
  const c1 = LAB.stat('#c-stats', '最优参数量 $N_{\\text{opt}}$');
  const c2 = LAB.stat('#c-stats', '最优词元数 $D_{\\text{opt}}$', 'teal');
  const c3 = LAB.stat('#c-stats', '每个参数的词元数 $D/N$', 'amber');
  const c4 = LAB.stat('#c-stats', '最低损失 $L$', 'coral');
  const c5 = LAB.stat('#c-stats', '困惑度 $e^{L}$', 'plum');
  function upd1() {
    const No = optN(S.C), Do = S.C / (6 * No), Lo = Lf(No, Do);
    c1.set(big(No)); c2.set(big(Do)); c3.set((Do / No).toFixed(1)); c4.set(Lo.toFixed(4)); c5.set(Math.exp(Lo).toFixed(3));
    const Nr = ruleN(S.C), rows = [['解析最优', No, C.navy], ['经验法则 D=20N', Nr, C.amber]];
    if (S.selN) rows.push(['你点选的点', S.selN, C.plum]);
    let html = '<tr><th>分配</th><th>$N$</th><th>$D$</th><th>$D/N$</th><th>$L$</th><th>$\\Delta L$</th></tr>';
    rows.forEach(([name, N, col]) => { const D = S.C / (6 * N), L = Lf(N, D); html += `<tr><td><b style="color:${col}">●</b> ${name}</td><td>${big(N)}</td><td>${big(D)}</td><td>${(D / N).toPrecision(3)}</td><td>${L.toFixed(4)}</td><td>${L - Lo < 5e-5 ? '0' : '+' + (L - Lo).toFixed(4)}</td></tr>`; });
    $('#c-table').innerHTML = html; LAB.renderMath($('#c-table'));
    const gn = Math.pow(10, S.b / (S.a + S.b)), gd = Math.pow(10, S.a / (S.a + S.b));
    $('#c-note').innerHTML = `算力翻 10 倍：$N_{\\text{opt}}$ 乘 ${gn.toFixed(2)}，$D_{\\text{opt}}$ 乘 ${gd.toFixed(2)}（指数 $\\beta/(\\alpha+\\beta)=${(S.b / (S.a + S.b)).toFixed(3)}$）。`;
    LAB.renderMath($('#c-note'));
    mapCv.redraw(); profCv.redraw();
  }
  upd1();

  /* ================= 实验 2：旋钮平分与临界爆炸 ================= */
  const SH = { N: 2, y: 2, eps: 0.001, del: 0.099 };
  const EPSS = [1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1];
  const sN = LAB.slider('#s-N', { label: '旋钮个数 $N$', min: 0, max: 3, step: 0.01, value: Math.log10(SH.N), fmt: () => String(SH.N), onInput: (v) => { SH.N = Math.max(1, Math.round(Math.pow(10, v))); upd2(); } });
  const sY = LAB.slider('#s-y', { label: '标准答案 $y$', min: 0.5, max: 5, step: 0.1, value: SH.y, fmt: (v) => v.toFixed(1), onInput: (v) => { SH.y = v; upd2(); } });
  const sEps = LAB.slider('#s-eps', { label: '两道题的差别 $\\varepsilon$', min: 0, max: EPSS.length - 1, step: 1, value: EPSS.indexOf(SH.eps), fmt: (v) => fe(EPSS[v]), hint: '第 2 题的输入是 $(1,\\,1+\\varepsilon)$', onInput: (v) => { SH.eps = EPSS[v]; upd2(); } });
  const sDel = LAB.slider('#s-b2', { label: '第 2 题印错了多少 $\\delta$', min: 0, max: 0.2, step: 0.001, value: SH.del, fmt: (v) => `${v.toFixed(3)}（印成 ${(2 + SH.eps + v).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}）`, onInput: (v) => { SH.del = v; upd2(); } });
  $('#s-book').onclick = () => { Object.assign(SH, { N: 2, y: 2, eps: 0.001, del: 0.099 }); sN.set(Math.log10(2)); sY.set(2); sEps.set(EPSS.indexOf(0.001)); sDel.set(0.099); upd2(); };
  const shareCv = LAB.canvas('#s-curve', (ctx, w, h) => {
    const yy = SH.y * SH.y;
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: 1000, ymin: 1e-3, ymax: 100, logx: true, logy: true, xtickValues: [1, 2, 10, 100, 1000], xfmt: (v) => String(v), ytickValues: [1e-3, 1e-2, 0.1, 1, 10, 100], xlabel: '旋钮个数 N', ylabel: '最小平方和', pad: { l: 50, r: 14, t: 12, b: 36 } }).axes();
    P.clip(); P.fn((N) => yy / N, C.c1, 2.6); P.unclip();
    if (Math.abs(SH.y - 2) < 1e-9) { P.points([1, 2, 100], [4, 2, 0.04], C.amber, 5, '#fff'); P.text(1.1, 4, ' 4', C.amber, 'left', 'bottom'); P.text(2.1, 2, ' 2', C.amber, 'left', 'bottom'); P.text(105, 0.04, ' 0.04', C.amber, 'left', 'bottom'); }
    P.vline(SH.N, C.ink, [2, 3], 1);
    P.points([SH.N], [yy / SH.N], C.coral, 6, '#fff');
  });
  const linesCv = LAB.canvas('#s-lines', (ctx, w, h) => {
    const w2 = 1 + SH.del / SH.eps, w1 = 1 - SH.del / SH.eps;
    const span = Math.max(4, 1.25 * Math.max(Math.abs(w1 - 1), Math.abs(w2 - 1)) + 2);
    const cx = (w1 + 1) / 2, cy = (w2 + 1) / 2;
    const ar = (w - 64) / (h - 48);
    const P = new LAB.Plot(ctx, w, h, { xmin: cx - span * ar / 2, xmax: cx + span * ar / 2, ymin: cy - span / 2, ymax: cy + span / 2, xlabel: 'w₁', ylabel: 'w₂', pad: { l: 50, r: 14, t: 12, b: 36 } }).axes();
    P.clip();
    P.fn((x) => 2 - x, C.c4, 2.6);
    P.fn((x) => (2 + SH.eps + SH.del - x) / (1 + SH.eps), C.c1, 1.8, [7, 5]);
    P.unclip();
    P.points([1], [1], C.leaf, 6, '#fff');
    P.points([w1], [w2], C.navy, 6.5, '#fff');
    P.text(w1, w2, `  (${fe(w1)}, ${fe(w2)})`, C.navy, 'left', 'bottom');
  });
  const s1 = LAB.stat('#s-stats', '每个旋钮 $w_i=y/N$');
  const s2 = LAB.stat('#s-stats', '平方和 $y^2/N$', 'teal');
  const s3 = LAB.stat('#s-stats', '只开 1 个旋钮的平方和', 'coral');
  const t1 = LAB.stat('#s-stats2', '硬解出的 $(w_1,w_2)$', 'plum');
  const t2 = LAB.stat('#s-stats2', '平方和 $w_1^2+w_2^2$', 'coral');
  const t3 = LAB.stat('#s-stats2', '最小奇异值 $\\sigma_{\\min}$');
  const t4 = LAB.stat('#s-stats2', '放大倍数 $\\|\\Delta\\mathbf w\\|/\\delta$', 'amber');
  function upd2() {
    const yy = SH.y * SH.y;
    s1.set(fe(SH.y / SH.N)); s2.set(fe(yy / SH.N)); s3.set(fe(yy));
    const r = SH.del / SH.eps, w1 = 1 - r, w2 = 1 + r, e = SH.eps;
    const smin = ((2 + e) - Math.sqrt((2 + e) * (2 + e) - 4 * e)) / 2;
    t1.set(`(${fe(w1)}, ${fe(w2)})`); const ss = w1 * w1 + w2 * w2; t2.set(ss >= 1000 && ss < 1e8 ? Math.round(ss).toLocaleString() : fe(ss)); t3.set(fe(smin)); t4.set(SH.del > 0 ? fe(Math.SQRT2 * r / SH.del) : '–');
    sDel.set(SH.del);
    shareCv.redraw(); linesCv.redraw();
  }
  upd2();

  /* ================= 实验 3：双下降 ================= */
  const DD = { n: 10, sigma: 0.3, lam: 1e-9, p: 80, seed: 7 };
  const XF = M.range(801).map((i) => -1 + i / 400), FF = XF.map((x) => Math.sin(2.5 * x) + 0.5 * Math.cos(5 * x));
  const NF = 5, MT = 200, Q = 0.2, BWS = 4, BWP = 150, RHO = 0.1;
  const ftrue = (x) => Math.sin(2.5 * x) + 0.5 * Math.cos(5 * x);
  const xt = M.range(MT).map((i) => -1 + (2 * i) / (MT - 1)), ft = xt.map(ftrue);
  let DR3 = null;
  function chol(A, n) { const L = new Float64Array(n * n); for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let s = A[i * n + j]; for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k]; if (i === j) { if (!(s > 0)) return null; L[i * n + i] = Math.sqrt(s); } else L[i * n + j] = s / L[j * n + j]; } return L; }
  function solve(L, b, n) { const y = new Float64Array(n); for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k]; y[i] = s / L[i * n + i]; } const x = new Float64Array(n); for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k]; x[i] = s / L[i * n + i]; } return x; }
  function compute3() {
    const n = DD.n, pmax = 8 * n, R = LAB.rng(DD.seed);
    const xs = [], ys = [];
    for (let i = 0; i < n; i++) { const x = -1 + 2 * R(); xs.push(x); ys.push(ftrue(x) + DD.sigma * R.normal()); }
    const test = new Float64Array(pmax + 1), train = new Float64Array(pmax + 1), norm = new Float64Array(pmax + 1), alphas = [], feats = [], trv = [];
    for (let fs = 0; fs < NF; fs++) {
      const Rf = LAB.rng(100 + fs);
      const K = new Float64Array(n * n), Kt = new Float64Array(MT * n);
      for (let p = 1; p <= pmax; p++) {
        const sm = Rf() < Q, w = Rf.normal() * (sm ? BWS : BWP), b = 2 * Math.PI * Rf(), a = (sm ? 1 : Math.sqrt(RHO)) * Math.SQRT2;
        const ptr = xs.map((x) => a * Math.cos(w * x + b)), pte = xt.map((x) => a * Math.cos(w * x + b));
        if (fs === 0) { feats.push([w, b, a]); trv.push(ptr); }
        for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) K[i * n + k] += ptr[i] * ptr[k];
        for (let i = 0; i < MT; i++) for (let k = 0; k < n; k++) Kt[i * n + k] += pte[i] * ptr[k];
        const Kl = new Float64Array(n * n);
        for (let i = 0; i < n * n; i++) Kl[i] = K[i] / p;
        let lam = DD.lam, L = null;
        for (let tries = 0; tries < 4 && !L; tries++) { const A = Kl.slice(); for (let i = 0; i < n; i++) A[i * n + i] += lam; L = chol(A, n); lam = Math.max(lam * 10, 1e-12); }
        if (!L) { test[p] = NaN; continue; }
        const al = solve(L, ys, n);
        let te = 0;
        for (let i = 0; i < MT; i++) { let t = 0; for (let k = 0; k < n; k++) t += Kt[i * n + k] * al[k]; t /= p; te += (t - ft[i]) ** 2; }
        let tr = 0;
        for (let i = 0; i < n; i++) { let t = 0; for (let k = 0; k < n; k++) t += Kl[i * n + k] * al[k]; tr += (t - ys[i]) ** 2; }
        test[p] += te / MT / NF; train[p] += tr / n / NF;
        if (fs === 0) { // ‖θ‖² = (1/p) Σ_j c_j²，c_j = Σ_i φ_j(x_i) α_i（零空间分量在 c_j 中精确抵消，数值稳定）
          alphas[p] = al; let s2 = 0;
          for (let j = 0; j < p; j++) { const v = trv[j]; let c = 0; for (let i = 0; i < n; i++) c += v[i] * al[i]; s2 += c * c; }
          norm[p] = Math.sqrt(s2 / p);
        }
      }
    }
    DR3 = { xs, ys, test, train, norm, alphas, feats, pmax };
  }
  const sP = LAB.slider('#dd-p', { label: '特征数 $p$', min: 1, max: 8 * DD.n, step: 1, value: DD.p, fmt: (v) => `${v}（${(v / DD.n).toFixed(2)}n）`, onInput: (v) => { DD.p = v; draw3(); } });
  const LAMS = [1e-9, 1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1];
  LAB.slider('#dd-lam', { label: '岭系数 $\\lambda$', min: 0, max: LAMS.length - 1, step: 1, value: 0, fmt: (v) => fe(LAMS[v]), hint: '$10^{-9}$ 近似最小范数插值', onInput: (v) => { DD.lam = LAMS[v]; recompute(); } });
  LAB.slider('#dd-n', { label: '训练样本数（练习题数）$n$', min: 10, max: 50, step: 2, value: DD.n, onInput: (v) => { DD.p = Math.round((DD.p / DD.n) * v); DD.n = v; sP.setRange(1, 8 * v); sP.set(DD.p); recompute(); } });
  LAB.slider('#dd-sigma', { label: '标签噪声 $\\sigma$', min: 0, max: 0.6, step: 0.02, value: DD.sigma, fmt: (v) => v.toFixed(2), onInput: (v) => { DD.sigma = v; recompute(); } });
  $('#dd-resample').onclick = () => { DD.seed++; recompute(); };
  let pend3 = false;
  function recompute() { if (pend3) return; pend3 = true; setTimeout(() => { pend3 = false; compute3(); draw3(); }, 0); }
  const curveCv = LAB.canvas('#dd-curve', (ctx, w, h) => {
    if (!DR3) return;
    const ps = M.range(DR3.pmax).map((i) => i + 1), te = ps.map((p) => DR3.test[p]), tr = ps.map((p) => Math.max(DR3.train[p], 1e-5));
    const e1 = Math.ceil(Math.log10(Math.max(...te)) + 0.05), e0 = -5;
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 8, ymin: 1e-5, ymax: Math.pow(10, Math.max(e1, 0)), logy: true, ytickValues: decades(e0, Math.max(e1, 0)).filter((_, i) => i % 1 === 0), xtickValues: M.range(9), xlabel: '特征数与样本数之比 p / n', ylabel: '均方误差', pad: { l: 50, r: 12, t: 12, b: 36 } }).axes();
    curveCv._P = P;
    const xs = ps.map((p) => p / DD.n);
    P.vline(1, C.slate, [5, 4]);
    P.clip(); P.line(xs, tr, C.c1, 2); P.line(xs, te, C.c4, 2.6); P.unclip();
    P.text(1, Math.pow(10, Math.max(e1, 0)) * 0.6, ' 插值阈值 p = n', C.slate, 'left', 'top', '11px PingFang SC, sans-serif');
    P.vline(DD.p / DD.n, C.ink, [2, 3], 1);
    P.points([DD.p / DD.n], [DR3.test[DD.p]], C.c4, 5, '#fff');
    P.text(4.2, 3e-5, '训练误差 ≈ 0（插值）', C.c1, 'left', 'bottom', '11px PingFang SC, sans-serif');
  });
  pointer('#dd-curve', { down: pickP, move: pickP });
  function pickP(x) { const P = curveCv._P; if (!P || !DR3) return; DD.p = Math.round(M.clamp(P.ix(x), 1 / DD.n, 8) * DD.n); DD.p = M.clamp(DD.p, 1, DR3.pmax); sP.set(DD.p); draw3(); }
  function fitCurve(p) { // f̂(x) = (1/p) Σ_j φ_j(x) c_j，c_j = Σ_i φ_j(x_i) α_i，在 801 个点上细致求值
    const al = DR3.alphas[p]; if (!al) return XF.map(() => NaN);
    const out = new Float64Array(XF.length);
    for (let j = 0; j < p; j++) { const [w, b, a] = DR3.feats[j]; let c = 0; for (let i = 0; i < DR3.xs.length; i++) c += a * Math.cos(w * DR3.xs[i] + b) * al[i]; for (let q = 0; q < XF.length; q++) out[q] += a * Math.cos(w * XF[q] + b) * c; }
    return Array.from(out, (v) => v / p);
  }
  const fitCv = LAB.canvas('#dd-fit', (ctx, w, h) => {
    if (!DR3) return;
    const P = new LAB.Plot(ctx, w, h, { xmin: -1, xmax: 1, ymin: -2.5, ymax: 2.5, yticks: 5, xlabel: 'x', pad: { l: 40, r: 12, t: 12, b: 36 } }).axes();
    P.clip();
    P.line(XF, FF, C.slate, 1.6, [6, 4]);
    P.line(XF, fitCurve(DD.p), C.c1, 2);
    P.unclip();
    P.points(DR3.xs, DR3.ys, C.amber, 4, '#fff');
  });
  const d1 = LAB.stat('#dd-stats', '$p/n$');
  const d2 = LAB.stat('#dd-stats', '训练误差', 'teal');
  const d3 = LAB.stat('#dd-stats', '测试误差', 'coral');
  const d4 = LAB.stat('#dd-stats', '系数范数 $\\|\\hat{\\boldsymbol\\theta}\\|_2$', 'plum');
  function draw3() {
    if (!DR3) return;
    const p = Math.min(DD.p, DR3.pmax);
    d1.set((p / DD.n).toFixed(2)); d2.set(fe(Math.max(DR3.train[p], 0))); d3.set(fe(DR3.test[p])); d4.set(fe(DR3.norm[p]));
    curveCv.redraw(); fitCv.redraw();
  }
  compute3(); draw3();
})();
