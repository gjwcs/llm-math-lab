/* 第 11 章：低资源微调的线性代数奇迹：交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §11.2 LoRA 低秩重参数化与非对称初始化 · Eckart-Young-Mirsky 定理 · §11.3 QLoRA 的 NF4 量化与 DoRA' });

  const $ = (s) => document.querySelector(s);
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (e) => String(e).split('').map((c) => SUP[c]).join('');
  const fe = (x) => { if (!isFinite(x)) return '–'; if (x === 0) return '0'; const a = Math.abs(x); if (a >= 1000 && a < 1e4) return String(Math.round(x)); if (a >= 0.01 && a < 1e4) return x.toPrecision(3); const e = Math.floor(Math.log10(a)); return (x / Math.pow(10, e)).toFixed(1) + '×10' + sup(e); };
  const big = (x) => { const u = [['B', 1e9], ['M', 1e6], ['K', 1e3]]; for (const [s, v] of u) if (x >= v) return (x / v).toPrecision(3) + s; return String(Math.round(x)); };
  const gb = (b) => (b / 1e9 >= 100 ? (b / 1e9).toFixed(0) : (b / 1e9).toPrecision(3)) + ' GB';
  const rgbOf = (hex) => { hex = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(hex.substr(i, 2), 16)); };
  const lerp3 = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));

  /* ================= 实验 1：参数量与显存 ================= */
  const MODELS = [
    { name: 'LLaMA-7B', d: 4096, ff: 11008, L: 32, kv: 4096, V: 32000 },
    { name: 'LLaMA-2-70B', d: 8192, ff: 28672, L: 80, kv: 1024, V: 32000 },
  ];
  const MODSETS = [['q', 'v'], ['q', 'k', 'v', 'o'], ['q', 'k', 'v', 'o', 'gate', 'up', 'down']];
  const P1 = { model: 0, r: 8, alpha: 16, mods: 0, which: 0 };
  const shape = (m, name) => ({ q: [m.d, m.d], k: [m.kv, m.d], v: [m.kv, m.d], o: [m.d, m.d], gate: [m.ff, m.d], up: [m.ff, m.d], down: [m.d, m.ff] }[name]); // [d_out, k_in]
  const totalParams = (m) => m.L * (2 * m.d * m.d + 2 * m.kv * m.d + 3 * m.d * m.ff + 2 * m.d) + 2 * m.V * m.d + m.d;
  const loraParams = () => { const m = MODELS[P1.model]; return m.L * M.sum(MODSETS[P1.mods].map((n) => { const [d, k] = shape(m, n); return P1.r * (d + k); })); };
  LAB.segmented('#p-model', MODELS.map((m) => m.name), 0, (i) => { P1.model = i; upd1(); });
  LAB.slider('#p-r', { label: '秩 $r$', min: 0, max: 8, step: 1, value: 3, fmt: (v) => String(Math.pow(2, v)), onInput: (v) => { P1.r = Math.pow(2, v); upd1(); } });
  LAB.slider('#p-alpha', { label: '缩放 $\\alpha$', min: 1, max: 64, step: 1, value: P1.alpha, onInput: (v) => { P1.alpha = v; upd1(); } });
  LAB.segmented('#p-mods', ['$\\mathbf W_q,\\mathbf W_v$', '注意力 4 个', '全部 7 个线性层'], 0, (i) => { P1.mods = i; upd1(); });
  LAB.segmented('#p-which', ['$\\mathbf W_q$', '$\\mathbf W_{\\text{down}}$'], 0, (i) => { P1.which = i; upd1(); });
  const drawCv = LAB.canvas('#p-draw', (ctx, w, h) => {
    const m = MODELS[P1.model], [d, k] = shape(m, P1.which ? 'down' : 'q'), r = P1.r, narrow = w < 520;
    const fs = narrow ? 11 : 12.5, gapOp = narrow ? 48 : 74;
    const u = Math.min((w - 28 - gapOp - 10) / (2 * k + r), (h - 92) / d);
    const W0w = k * u, W0h = d * u, rw = Math.max(3, r * u), y0 = 28;
    let x = 14;
    const label = (txt, cx, cy, col, font, align) => { ctx.fillStyle = col; ctx.font = font || `${fs}px PingFang SC, sans-serif`; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, cx, cy); };
    // W0
    ctx.fillStyle = '#e9edf2'; ctx.fillRect(x, y0, W0w, W0h); ctx.strokeStyle = '#9aa5b1'; ctx.lineWidth = 1; ctx.strokeRect(x, y0, W0w, W0h);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y0, W0w, W0h); ctx.clip(); ctx.strokeStyle = 'rgba(92,103,115,.18)';
    for (let t = -W0h; t < W0w; t += 9) { ctx.beginPath(); ctx.moveTo(x + t, y0 + W0h); ctx.lineTo(x + t + W0h, y0); ctx.stroke(); }
    ctx.restore();
    label('W₀ 冻结', x + W0w / 2, y0 + W0h / 2, C.slate, `600 ${fs + 0.5}px PingFang SC, sans-serif`);
    label(`${d.toLocaleString()}×${k.toLocaleString()}`, x, y0 + W0h + 16, C.slate, `${fs}px Avenir Next, sans-serif`, 'left');
    label(`${(d * k).toLocaleString()} 个参数`, x, y0 + W0h + 34, C.ink, `600 ${fs}px Avenir Next, sans-serif`, 'left');
    x += W0w + 6;
    label('+', x + gapOp * 0.22, y0 + W0h / 2, C.ink, '600 20px Avenir Next, sans-serif');
    label(`${P1.alpha}/${r}`, x + gapOp * 0.62, y0 + W0h / 2, C.c5, `600 ${fs}px Avenir Next, sans-serif`);
    x += gapOp;
    // B (d×r)
    ctx.fillStyle = C.c3; ctx.fillRect(x, y0, rw, W0h);
    label('B', x + rw / 2, y0 - 12, C.c3, '600 14px Avenir Next, sans-serif');
    const bx = x; x += rw + 6;
    // A (r×k)
    ctx.fillStyle = C.c6; ctx.fillRect(x, y0, W0w, rw);
    label('A', x + W0w / 2, y0 - 12, C.c6, '600 14px Avenir Next, sans-serif');
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(47,143,91,.55)'; ctx.strokeRect(x, y0, W0w, W0h); ctx.restore();
    if (W0w > 150) label('BA 与 W₀ 同形，但秩 ≤ r', x + W0w / 2, y0 + W0h / 2, C.c3);
    else { label('BA 同形', x + W0w / 2, y0 + W0h / 2 - 8, C.c3); label('秩 ≤ r', x + W0w / 2, y0 + W0h / 2 + 8, C.c3); }
    label(`${d.toLocaleString()}×${r} + ${r}×${k.toLocaleString()}`, bx, y0 + W0h + 16, C.slate, `${fs}px Avenir Next, sans-serif`, 'left');
    label(`${(r * (d + k)).toLocaleString()} 个参数`, bx, y0 + W0h + 34, C.c3, `600 ${fs}px Avenir Next, sans-serif`, 'left');
  });
  const memCv = LAB.canvas('#p-mem', (ctx, w, h) => {
    const m = MODELS[P1.model], P = totalParams(m), Pl = loraParams();
    const rows = [
      ['全量微调', [[2 * P, C.slate], [2 * P, C.c2], [8 * P, C.c4], [4 * P, C.c5]]],
      ['LoRA（BF16 底座）', [[2 * P + 2 * Pl, C.slate], [2 * Pl, C.c2], [8 * Pl, C.c4], [4 * Pl, C.c5]]],
      ['QLoRA（NF4 底座）', [[P * (4 + 8 / 64 + 32 / (64 * 256)) / 8 + 2 * Pl, C.slate], [2 * Pl, C.c2], [8 * Pl, C.c4], [4 * Pl, C.c5]]],
    ];
    const tot = rows.map((r) => M.sum(r[1].map((s) => s[0]))), maxT = tot[0];
    const narrow = w < 480, l = narrow ? 8 : 128, rpad = 70, bh = narrow ? 28 : Math.min(38, (h - 30) / 3 - 18);
    rows.forEach(([name, segs], q) => {
      const y = (narrow ? 26 : 12) + q * ((h - 20) / 3);
      ctx.fillStyle = C.ink; ctx.font = '12.5px PingFang SC, sans-serif'; ctx.textBaseline = 'middle';
      if (narrow) { ctx.textAlign = 'left'; ctx.fillText(name, l, y - 11); } else { ctx.textAlign = 'right'; ctx.fillText(name, l - 10, y + bh / 2); }
      let x = l;
      segs.forEach(([v, col]) => { const ww = (v / maxT) * (w - l - rpad); ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(ww, v > 0 ? 1 : 0), bh); x += ww; });
      ctx.fillStyle = C.navy; ctx.font = '600 13px Avenir Next, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(gb(tot[q]), x + 6, y + bh / 2);
    });
  });
  const p1 = LAB.stat('#p-stats', '单矩阵 $dk\\to r(d+k)$');
  const p2 = LAB.stat('#p-stats', '单矩阵压缩比', 'teal');
  const p3 = LAB.stat('#p-stats', '全模型可训练参数', 'leaf');
  const p4 = LAB.stat('#p-stats', '占全模型比例', 'amber');
  const p5 = LAB.stat('#p-stats', '缩放 $\\alpha/r$', 'plum');
  function upd1() {
    const m = MODELS[P1.model], [d, k] = shape(m, P1.which ? 'down' : 'q'), r = P1.r, Pl = loraParams(), P = totalParams(m);
    p1.set(`${big(d * k)}<small>→</small>${big(r * (d + k))}`);
    p2.set(((100 * r * (d + k)) / (d * k)).toPrecision(3) + '<small>%</small>');
    p3.set(big(Pl)); p4.set(((100 * Pl) / P).toPrecision(3) + '<small>%</small>'); p5.set((P1.alpha / r).toPrecision(3));
    drawCv.redraw(); memCv.redraw();
  }
  upd1();

  /* ================= 实验 2：低秩谱与初始化 ================= */
  const N2 = 48;
  const S2 = { gamma: 1.2, noise: 0.02, r: 8, log: false, seed: 4 };
  let SV = null;
  function orthCols(R, n) { const Q = []; for (let j = 0; j < n; j++) { let v = Float64Array.from({ length: n }, () => R.normal()); for (const q of Q) { let p = 0; for (let i = 0; i < n; i++) p += v[i] * q[i]; for (let i = 0; i < n; i++) v[i] -= p * q[i]; } let nn = 0; for (let i = 0; i < n; i++) nn += v[i] * v[i]; nn = Math.sqrt(nn); for (let i = 0; i < n; i++) v[i] /= nn; Q.push(v); } return Q; }
  // 单边 Jacobi SVD：输入按列存储的方阵，返回降序奇异值与左右奇异向量（列）
  function svd(cols) {
    const n = cols.length, U = cols.map((c) => Float64Array.from(c)), V = M.range(n).map((j) => { const v = new Float64Array(n); v[j] = 1; return v; });
    for (let sweep = 0; sweep < 40; sweep++) {
      let off = 0;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        const up = U[p], uq = U[q]; let a = 0, b = 0, g = 0;
        for (let i = 0; i < n; i++) { a += up[i] * up[i]; b += uq[i] * uq[i]; g += up[i] * uq[i]; }
        if (Math.abs(g) <= 1e-15 * Math.sqrt(a * b)) continue;
        off = Math.max(off, Math.abs(g) / Math.sqrt(a * b));
        const z = (b - a) / (2 * g), t = Math.sign(z || 1) / (Math.abs(z) + Math.sqrt(1 + z * z)), c = 1 / Math.sqrt(1 + t * t), s = c * t;
        for (let i = 0; i < n; i++) { const x = up[i], y = uq[i]; up[i] = c * x - s * y; uq[i] = s * x + c * y; }
        const vp = V[p], vq = V[q];
        for (let i = 0; i < n; i++) { const x = vp[i], y = vq[i]; vp[i] = c * x - s * y; vq[i] = s * x + c * y; }
      }
      if (off < 1e-12) break;
    }
    const sig = U.map((u) => Math.hypot(...u)), order = M.range(n).sort((i, j) => sig[j] - sig[i]);
    return { s: order.map((i) => sig[i]), U: order.map((i) => U[i].map((v) => v / (sig[i] || 1))), V: order.map((i) => V[i]) };
  }
  function build2() {
    const R = LAB.rng(40 + S2.seed), n = N2;
    const Uo = orthCols(R, n), Vo = orthCols(R, n), st = M.range(n).map((i) => Math.pow(i + 1, -S2.gamma));
    const Rn = LAB.rng(900 + S2.seed);
    const cols = M.range(n).map((j) => { const c = new Float64Array(n); for (let i = 0; i < n; i++) { let v = 0; for (let q = 0; q < n; q++) v += Uo[q][i] * st[q] * Vo[q][j]; c[i] = v + (S2.noise / Math.sqrt(n)) * Rn.normal(); } return c; });
    const res = svd(cols);
    SV = { cols, st, ...res, tot: M.sum(res.s.map((v) => v * v)) };
  }
  LAB.slider('#s-decay', { label: '谱衰减指数 $\\gamma$（$\\sigma_i=i^{-\\gamma}$）', min: 0, max: 3, step: 0.05, value: S2.gamma, fmt: (v) => v.toFixed(2), onInput: (v) => { S2.gamma = v; build2(); upd2(); } });
  LAB.slider('#s-noise', { label: '噪声强度', min: 0, max: 0.5, step: 0.005, value: S2.noise, fmt: (v) => v.toFixed(3), onInput: (v) => { S2.noise = v; build2(); upd2(); } });
  LAB.slider('#s-r', { label: 'LoRA 秩 $r$', min: 1, max: N2, step: 1, value: S2.r, onInput: (v) => { S2.r = v; upd2(); } });
  LAB.checkbox('#s-log', '奇异值用对数纵轴', false, (v) => { S2.log = v; barsCv.redraw(); });
  $('#s-resample').onclick = () => { S2.seed++; build2(); buildInit(); upd2(); };
  const energyAt = (r) => M.sum(SV.s.slice(0, r).map((v) => v * v)) / SV.tot;
  const barsCv = LAB.canvas('#s-bars', (ctx, w, h) => {
    const s = SV.s, lg = S2.log, mx = Math.max(s[0], SV.st[0]) * 1.1;
    const mn = lg ? Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, Math.min(...s, ...SV.st))))) : 0;
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.3, xmax: N2 + 0.7, ymin: lg ? mn : 0, ymax: lg ? Math.pow(10, Math.ceil(Math.log10(mx))) : mx, logy: lg, xtickValues: [1, 8, 16, 24, 32, 40, 48], xlabel: '奇异值序号 i', ylabel: 'σ_i', pad: { l: 48, r: 12, t: 12, b: 36 } }).axes();
    const bw = (P.tx(2) - P.tx(1)) * 0.72, xs = M.range(N2).map((i) => i + 1);
    P.bars(xs, s, xs.map((i) => (i <= S2.r ? C.c6 : '#cfd6de')), bw, lg ? mn : 0);
    P.points(xs, SV.st, C.navy, 2.2);
    P.vline(S2.r + 0.5, C.c4, [4, 3], 1.4);
    P.text(S2.r + 0.7, lg ? Math.pow(10, Math.ceil(Math.log10(mx))) * 0.7 : mx * 0.95, ` r = ${S2.r}`, C.c4, 'left', 'top', '600 12px Avenir Next, sans-serif');
  });
  const enCv = LAB.canvas('#s-energy', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: N2, ymin: 0, ymax: 1, xtickValues: [0, 8, 16, 24, 32, 40, 48], yfmt: (v) => v * 100 + '%', xlabel: '秩 r', pad: { l: 46, r: 12, t: 12, b: 36 } }).axes();
    const rs = M.range(N2 + 1), en = rs.map(energyAt);
    P.line(rs, en, C.c6, 2.4); P.line(rs, en.map((e) => Math.sqrt(Math.max(0, 1 - e))), C.c4, 2.4);
    P.vline(S2.r, C.ink, [2, 3], 1);
    P.points([S2.r, S2.r], [energyAt(S2.r), Math.sqrt(Math.max(0, 1 - energyAt(S2.r)))], C.ink, 4, '#fff');
  });
  const heatCv = LAB.canvas('#s-heat', (ctx, w, h) => {
    const n = N2, r = S2.r, gap = 10, side = Math.min((w - 2 * gap) / 3, h - 28), y0 = 4;
    const full = (i, j) => SV.cols[j][i];
    const approx = (i, j) => { let v = 0; for (let q = 0; q < r; q++) v += SV.s[q] * SV.U[q][i] * SV.V[q][j]; return v; };
    const A = [], Ar = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { A.push(full(i, j)); Ar.push(approx(i, j)); }
    const mx = Math.max(...A.map(Math.abs)) || 1;
    const W0 = rgbOf('#ffffff'), CB = rgbOf(C.c1), CR = rgbOf(C.c4);
    const col = (v) => { const t = Math.min(1, Math.abs(v) / mx); return v < 0 ? lerp3(W0, CB, Math.sqrt(t)) : lerp3(W0, CR, Math.sqrt(t)); };
    [['ΔW', A], [`秩 ${r} 近似`, Ar], ['残差', A.map((v, k) => v - Ar[k])]].forEach(([name, arr], q) => {
      const off = document.createElement('canvas'); off.width = n; off.height = n;
      const oc = off.getContext('2d'), img = oc.createImageData(n, n);
      arr.forEach((v, k) => { const c = col(v); img.data[4 * k] = c[0]; img.data[4 * k + 1] = c[1]; img.data[4 * k + 2] = c[2]; img.data[4 * k + 3] = 255; });
      oc.putImageData(img, 0, 0);
      const x0 = q * (side + gap);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(off, x0, y0, side, side);
      ctx.strokeStyle = C.line; ctx.strokeRect(x0 + 0.5, y0 + 0.5, side - 1, side - 1);
      ctx.fillStyle = C.ink; ctx.font = '12px PingFang SC, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(name, x0 + side / 2, y0 + side + 6);
    });
  });
  const s1 = LAB.stat('#s-stats', '能量占比 $\\sum_{i\\le r}\\sigma_i^2/\\sum\\sigma_i^2$', 'teal');
  const s2 = LAB.stat('#s-stats', '相对 Frobenius 误差', 'coral');
  const s3 = LAB.stat('#s-stats', 'LoRA 参数 $r(d+k)$', 'leaf');
  const s4 = LAB.stat('#s-stats', '原矩阵参数 $dk$');
  function upd2() {
    const e = energyAt(S2.r);
    s1.set((e * 100).toFixed(2) + '<small>%</small>'); s2.set((Math.sqrt(Math.max(0, 1 - e)) * 100).toFixed(2) + '<small>%</small>');
    s3.set(String(S2.r * 2 * N2)); s4.set(String(N2 * N2));
    barsCv.redraw(); enCv.redraw(); heatCv.redraw();
  }
  // 初始化对比：min ½‖BA − T‖²
  const INITS = [['lora', 'LoRA', C.c3], ['zero', '全零', C.c4], ['both', '都随机', C.c2]];
  let INIT = null;
  function buildInit() {
    const d = 16, k = 16, r = 4, lr = 0.05, steps = 150, R = LAB.rng(70 + S2.seed);
    const mat = (m, n, f) => M.range(m).map(() => M.range(n).map(f));
    const mm = (A, B) => A.map((row) => B[0].map((_, j) => { let t = 0; for (let q = 0; q < row.length; q++) t += row[q] * B[q][j]; return t; }));
    const tr = (A) => A[0].map((_, j) => A.map((rw) => rw[j]));
    const fro = (A) => Math.sqrt(A.reduce((a, rw) => a + rw.reduce((b, v) => b + v * v, 0), 0));
    let T = mm(mat(d, 2, () => R.normal()), mat(2, k, () => R.normal())); const tn = fro(T); T = T.map((rw) => rw.map((x) => (x * 3) / tn));
    INIT = INITS.map(([mode]) => {
      const R2 = LAB.rng(11 + S2.seed);
      let A = mode === 'zero' ? mat(r, k, () => 0) : mat(r, k, () => R2.normal() / Math.sqrt(k));
      let B = mode === 'both' ? mat(d, r, () => R2.normal() / Math.sqrt(r)) : mat(d, r, () => 0);
      const loss = []; let first = null;
      for (let t = 0; t <= steps; t++) {
        const W = mm(B, A), G = W.map((rw, i) => rw.map((x, j) => x - T[i][j]));
        loss.push(0.5 * fro(G) ** 2);
        const gB = mm(G, tr(A)), gA = mm(tr(B), G);
        if (t === 0) first = { w0: fro(W), gA: fro(gA), gB: fro(gB) };
        B = B.map((rw, i) => rw.map((x, j) => x - lr * gB[i][j])); A = A.map((rw, i) => rw.map((x, j) => x - lr * gA[i][j]));
      }
      return { loss, first };
    });
  }
  const initCv = LAB.canvas('#s-init', (ctx, w, h) => {
    if (!INIT) return;
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 150, ymin: 1e-10, ymax: 100, logy: true, ytickValues: [1e-10, 1e-8, 1e-6, 1e-4, 0.01, 1, 100], xlabel: '梯度下降步数', ylabel: '损失', pad: { l: 50, r: 10, t: 12, b: 36 } }).axes();
    P.clip(); INIT.forEach((it, q) => P.line(M.range(it.loss.length), it.loss.map((v) => Math.max(v, 1e-11)), INITS[q][2], 2.4, q === 1 ? [6, 4] : null)); P.unclip();
  });
  function initTable() {
    let html = '<tr><th>初始化</th><th>$\\|\\Delta\\mathbf W_0\\|_F$</th><th>第 1 步 $\\|\\nabla_{\\mathbf A}\\|$</th><th>第 1 步 $\\|\\nabla_{\\mathbf B}\\|$</th><th>150 步后损失</th></tr>';
    INIT.forEach((it, q) => { html += `<tr><td><b style="color:${INITS[q][2]}">●</b> ${INITS[q][1]}</td><td>${it.first.w0.toFixed(3)}</td><td>${it.first.gA.toFixed(3)}</td><td>${it.first.gB.toFixed(3)}</td><td>${fe(it.loss[it.loss.length - 1])}</td></tr>`; });
    $('#s-init-table').innerHTML = html; LAB.renderMath($('#s-init-table')); initCv.redraw();
  }
  build2(); buildInit(); upd2(); initTable();
  $('#s-resample').addEventListener('click', initTable);

  /* ================= 实验 3：NF4 vs INT4 ================= */
  // QLoRA 的 NF4 刻度：8 个正分位点 + 7 个负分位点 + 0，再除以最大值
  const OFFSET = 0.9677083;
  const lin = (a, b, n) => M.range(n).map((i) => a + ((b - a) * i) / (n - 1));
  const NF4 = (() => { const pos = lin(OFFSET, 0.5, 9).slice(0, 8).map(M.norminv), neg = lin(OFFSET, 0.5, 8).slice(0, 7).map((p) => -M.norminv(p)); const v = pos.concat(neg, [0]).sort((a, b) => a - b), mx = Math.max(...v); return v.map((x) => x / mx); })();
  const INT4 = lin(-1, 1, 16);
  const BLOCKS = [16, 32, 64, 128, 256, 1024, 4096];
  const NS = [4096, 16384, 65536];
  const Q3 = { block: 64, n: 16384, seed: 1, model: 0, dq: false };
  let QR = null;
  function quantize(levels, x) { let best = 0, bd = Infinity; for (let k = 0; k < 16; k++) { const dd = Math.abs(x - levels[k]); if (dd < bd) { bd = dd; best = k; } } return best; }
  function run3() {
    const R = LAB.rng(500 + Q3.seed), n = Q3.n, B = Q3.block;
    const w = Float64Array.from({ length: n }, () => R.normal());
    const xs = new Float64Array(n), res = { nf: { use: new Array(16).fill(0), se: 0 }, i4: { use: new Array(16).fill(0), se: 0 } };
    for (let b0 = 0; b0 < n; b0 += B) {
      let c = 0; for (let i = b0; i < Math.min(n, b0 + B); i++) c = Math.max(c, Math.abs(w[i]));
      for (let i = b0; i < Math.min(n, b0 + B); i++) {
        const x = w[i] / c; xs[i] = x;
        const a = quantize(NF4, x), b = quantize(INT4, x);
        res.nf.use[a]++; res.i4.use[b]++;
        res.nf.se += (w[i] - c * NF4[a]) ** 2; res.i4.se += (w[i] - c * INT4[b]) ** 2;
      }
    }
    ['nf', 'i4'].forEach((k) => { res[k].mse = res[k].se / n; res[k].use = res[k].use.map((u) => u / n); res[k].H = -M.sum(res[k].use.map((p) => (p > 0 ? p * Math.log2(p) : 0))); });
    res.xs = xs; QR = res;
  }
  LAB.slider('#q-block', { label: '量化块大小', min: 0, max: BLOCKS.length - 1, step: 1, value: BLOCKS.indexOf(Q3.block), fmt: (v) => String(BLOCKS[v]), onInput: (v) => { Q3.block = BLOCKS[v]; upd3(); } });
  LAB.slider('#q-n', { label: '权重个数（$w\\sim\\mathcal N(0,1)$）', min: 0, max: NS.length - 1, step: 1, value: 1, fmt: (v) => NS[v].toLocaleString(), onInput: (v) => { Q3.n = NS[v]; upd3(); } });
  $('#q-resample').onclick = () => { Q3.seed++; upd3(); };
  LAB.segmented('#q-model', ['7B', '13B', '70B'], 0, (i) => { Q3.model = i; memCv3.redraw(); });
  LAB.checkbox('#q-dq', '双重量化（缩放常数再量化成 8 比特）', false, (v) => { Q3.dq = v; memCv3.redraw(); });
  const histCv = LAB.canvas('#q-hist', (ctx, w, h) => {
    const nb = 80, cnt = new Array(nb).fill(0);
    QR.xs.forEach((x) => { cnt[Math.min(nb - 1, Math.floor(((x + 1) / 2) * nb))]++; });
    const dens = cnt.map((c) => c / QR.xs.length / (2 / nb)), ymax = Math.max(...dens) * 1.15;
    const P = new LAB.Plot(ctx, w, h, { xmin: -1.05, xmax: 1.05, ymin: 0, ymax, xtickValues: [-1, -0.5, 0, 0.5, 1], xlabel: '块内缩放后的权重 w / c', ylabel: '密度', pad: { l: 44, r: 12, t: 12, b: 50 } }).axes();
    P.bars(M.range(nb).map((i) => -1 + (2 * (i + 0.5)) / nb), dens, '#cfd6de', (P.tx(2 / nb) - P.tx(0)) * 0.92);
    const mid = (P.y0 + P.y1) / 2;
    ctx.save(); ctx.lineWidth = 1.6;
    NF4.forEach((q) => { ctx.strokeStyle = C.c6; ctx.beginPath(); ctx.moveTo(P.tx(q), P.y1); ctx.lineTo(P.tx(q), mid); ctx.stroke(); ctx.fillStyle = C.c6; ctx.beginPath(); ctx.arc(P.tx(q), P.y0 + 22, 3, 0, 7); ctx.fill(); });
    INT4.forEach((q) => { ctx.strokeStyle = C.c2; ctx.beginPath(); ctx.moveTo(P.tx(q), mid); ctx.lineTo(P.tx(q), P.y0); ctx.stroke(); ctx.fillStyle = C.c2; ctx.beginPath(); ctx.arc(P.tx(q), P.y0 + 30, 3, 0, 7); ctx.fill(); });
    ctx.fillStyle = C.c6; ctx.font = '600 11px Avenir Next, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('NF4', P.x0 + 4, P.y1 + 10);
    ctx.fillStyle = C.c2; ctx.fillText('INT4', P.x0 + 4, mid + 10);
    ctx.restore();
  });
  const useCv = LAB.canvas('#q-use', (ctx, w, h) => {
    const ymax = Math.max(...QR.nf.use, ...QR.i4.use) * 1.15;
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.7, xmax: 15.7, ymin: 0, ymax, xtickValues: [0, 3, 6, 9, 12, 15], yfmt: (v) => +(v * 100).toFixed(1) + '%', xlabel: '刻度编号（从 −1 到 +1）', pad: { l: 46, r: 10, t: 12, b: 36 } }).axes();
    const bw = (P.tx(1) - P.tx(0)) * 0.36, dx = P.ix(P.tx(0) + bw * 0.55) - P.ix(P.tx(0));
    P.bars(M.range(16).map((k) => k - dx), QR.nf.use, C.c6, bw);
    P.bars(M.range(16).map((k) => k + dx), QR.i4.use, C.c2, bw);
    P.hline(1 / 16, C.slate, [4, 4]);
  });
  const SIZES = [6.74e9, 13.0e9, 69.0e9];
  const memCv3 = LAB.canvas('#q-mem', (ctx, w, h) => {
    const Pn = SIZES[Q3.model], B = Q3.block;
    const constBits = Q3.dq ? 8 / B + 32 / (B * 256) : 32 / B;
    const rows = [['BF16', [[Pn * 2, C.slate]]], ['INT4 / NF4', [[Pn * 0.5, C.c6], [(Pn * constBits) / 8, C.c4]]]];
    const tot = rows.map((r) => M.sum(r[1].map((s) => s[0]))), mx = tot[0];
    const l = 86, rpad = 64, bh = 34;
    rows.forEach(([name, segs], q) => {
      const y = 22 + q * 70;
      ctx.fillStyle = C.ink; ctx.font = '12.5px PingFang SC, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(name, l - 10, y + bh / 2);
      let x = l; segs.forEach(([v, col]) => { const ww = (v / mx) * (w - l - rpad); ctx.fillStyle = col; ctx.fillRect(x, y, ww, bh); x += ww; });
      ctx.fillStyle = C.navy; ctx.font = '600 13px Avenir Next, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(gb(tot[q]), x + 6, y + bh / 2);
    });
    ctx.fillStyle = C.slate; ctx.font = '12px PingFang SC, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const y = 22 + 2 * 70 - 6;
    ctx.fillText(`每参数 4 + ${constBits.toFixed(3)} 比特（块大小 ${B}）`, 12, y);
    ctx.fillStyle = C.c4; ctx.fillText(`其中缩放常数共 ${gb((Pn * constBits) / 8)}`, 12, y + 20);
  });
  const q1 = LAB.stat('#q-stats', 'NF4 均方误差', 'teal');
  const q2 = LAB.stat('#q-stats', 'INT4 均方误差', 'amber');
  const q3 = LAB.stat('#q-stats', 'INT4 / NF4 误差比', 'coral');
  const q4 = LAB.stat('#q-stats', 'NF4 刻度熵', 'teal');
  const q5 = LAB.stat('#q-stats', 'INT4 刻度熵', 'amber');
  function upd3() {
    run3();
    q1.set(fe(QR.nf.mse) + '<small>σ²</small>'); q2.set(fe(QR.i4.mse) + '<small>σ²</small>'); q3.set((QR.i4.mse / QR.nf.mse).toFixed(2) + '<small>×</small>');
    q4.set(QR.nf.H.toFixed(2) + '<small>bit</small>'); q5.set(QR.i4.H.toFixed(2) + '<small>bit</small>');
    histCv.redraw(); useCv.redraw(); memCv3.redraw();
  }
  upd3();

  // DoRA：二维示意
  const DO = { w0: [1.5, 0.7], v: [1.2, 1.5], m: Math.hypot(1.5, 0.7), P: null, drag: false };
  const doraCv = LAB.canvas('#q-dora', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -2.6, xmax: 2.6, ymin: -2.6, ymax: 2.6, xticks: 4, yticks: 4, pad: { l: 28, r: 10, t: 10, b: 26 } }).axes();
    DO.P = P;
    const px = (p) => [P.tx(p[0]), P.ty(p[1])], nv = Math.hypot(...DO.v) || 1e-9, out = DO.v.map((x) => (DO.m * x) / nv);
    ctx.save(); ctx.strokeStyle = 'rgba(47,143,91,.4)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(P.tx(0), P.ty(0), P.tx(DO.m) - P.tx(0), 0, 7); ctx.stroke(); ctx.restore();
    LAB.arrow(ctx, ...px([0, 0]), ...px(DO.w0), C.slate, 2.4);
    LAB.arrow(ctx, ...px([0, 0]), ...px(DO.v), C.c5, 1.8);
    LAB.arrow(ctx, ...px([0, 0]), ...px(out), C.c3, 3);
    P.points([DO.v[0]], [DO.v[1]], C.c5, 7, '#fff');
  });
  const ds1 = LAB.stat('#q-dora-stats', '方向变化', 'plum');
  const ds2 = LAB.stat('#q-dora-stats', 'LoRA 长度变化', 'coral');
  const ds3 = LAB.stat('#q-dora-stats', 'DoRA 长度变化', 'leaf');
  const mS = LAB.slider('#q-dora-m', { label: '模长 $m$', min: 0.3, max: 2.5, step: 0.01, value: DO.m, fmt: (v) => v.toFixed(2), onInput: (v) => { DO.m = v; updDora(); } });
  function updDora() {
    const n0 = Math.hypot(...DO.w0), nv = Math.hypot(...DO.v);
    const ang = (Math.atan2(DO.v[1], DO.v[0]) - Math.atan2(DO.w0[1], DO.w0[0])) * 180 / Math.PI;
    ds1.set(ang.toFixed(1) + '<small>°</small>'); ds2.set((nv - n0 >= 0 ? '+' : '') + (nv - n0).toFixed(2)); ds3.set((DO.m - n0 >= 0 ? '+' : '') + (DO.m - n0).toFixed(2));
    doraCv.redraw();
  }
  const doraMove = (x, y) => { const P = DO.P; if (!P) return; const v = [M.clamp(P.ix(x), -2.5, 2.5), M.clamp(P.iy(y), -2.5, 2.5)]; if (Math.hypot(...v) > 0.2) { DO.v = v; updDora(); } };
  (() => { const el = $('#q-dora'); let on = false; const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    el.addEventListener('pointerdown', (e) => { on = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} doraMove(...pos(e)); e.preventDefault(); });
    el.addEventListener('pointermove', (e) => { if (on) doraMove(...pos(e)); });
    el.addEventListener('pointerup', () => { on = false; }); el.addEventListener('pointercancel', () => { on = false; }); })();
  updDora();
})();
