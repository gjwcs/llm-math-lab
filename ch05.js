/* 第 5 章：注意力：让每个词回头查找上文 · 交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §5.1 图书馆借书 · §5.2 Softmax 求导 · §5.3 为什么除以 √dₖ · §5.4 多头、因果掩码与 KV 缓存 · §5.5 完整算例' });
  // 窄屏下长公式与宽表格改为横向滚动，不撑破版面
  document.querySelectorAll('.formula, [style*="overflow-x"]').forEach((f) => { f.style.width = '0'; f.style.minWidth = '100%'; });
  const FONT = getComputedStyle(document.body).getPropertyValue('--font');
  const NUMF = getComputedStyle(document.body).getPropertyValue('--font-num');
  const softmax = (z) => { const m = Math.max(...z.filter((v) => isFinite(v))); const e = z.map((v) => (isFinite(v) ? Math.exp(v - m) : 0)); const s = M.sum(e); return e.map((v) => v / s); };
  function schedule(fn) { let p = false; return () => { if (p) return; p = true; requestAnimationFrame(() => { p = false; fn(); }); }; }
  function histogram(vals, lo, hi, nb) { const h = new Float64Array(nb), bw = (hi - lo) / nb; for (const v of vals) { const k = Math.floor((v - lo) / bw); if (k >= 0 && k < nb) h[k]++; } for (let k = 0; k < nb; k++) h[k] /= vals.length * bw; return { h, bw, lo }; }


  /* ================= 实验 1：图书馆借书三步走 ================= */
  const LIB = [
    { name: '数码科技', k: [1, 0], v: [10, 20], col: C.c1 },
    { name: '生鲜水果', k: [0, 1], v: [0, 100], col: C.c3 },
    { name: '数码与水果跨界', k: [1, 1], v: [30, 40], col: C.c5 },
  ];
  let libMode = 0, libRound = false, lib = null;
  const lq1 = LAB.slider('#l-q1', { label: '查询的“科技”分量 $q_1$', min: -2, max: 3, step: 0.1, value: 1, fmt: (v) => v.toFixed(1), onInput: () => updLib() });
  const lq2 = LAB.slider('#l-q2', { label: '查询的“美食”分量 $q_2$', min: -2, max: 3, step: 0.1, value: 0, fmt: (v) => v.toFixed(1), onInput: () => updLib() });
  LAB.segmented('#l-mode', ['Softmax（先取指数）', '直接除以总分'], 0, (i) => { libMode = i; updLib(); });
  LAB.checkbox('#l-round', '按书中手算：取 $e\\approx2.7$，百分比保留两位小数', false, (v) => { libRound = v; updLib(); });
  document.querySelector('#l-book').onclick = () => { lq1.set(1); lq2.set(0); updLib(); };
  document.querySelector('#l-neg').onclick = () => { lq1.set(-1); lq2.set(2); updLib(); };
  const sl = [LAB.stat('#l-stats', '指数总和 $Z$', 'amber'), LAB.stat('#l-stats', '笔记“售价”$o_1$', 'teal'), LAB.stat('#l-stats', '笔记“好评”$o_2$', 'plum'), LAB.stat('#l-stats', '百分比之和', 'coral')];
  function updLib() {
    const q = [lq1.get(), lq2.get()];
    const s = LIB.map((b) => M.dot(q, b.k));
    const base = libRound ? 2.7 : Math.E;
    let e = null, Z = null, a, ok = true, warn = '';
    if (libMode === 0) {
      e = s.map((v) => Math.pow(base, v)); Z = M.sum(e); a = e.map((v) => v / Z);
      if (libRound) a = a.map((v) => Math.round(v * 100) / 100);
    } else {
      const tot = M.sum(s);
      if (Math.abs(tot) < 0.05) { ok = false; a = s.map(() => NaN); warn = `总分 $=${tot.toFixed(2)}$，几乎为 $0$：除以它当场崩溃！`; }
      else { a = s.map((v) => v / tot); if (a.some((v) => v < 0)) warn = '出现了负百分比：书被“倒着抄”了，这就是书中说的荒唐事。'; }
    }
    const o = ok ? [0, 1].map((k) => M.sum(LIB.map((b, i) => a[i] * b.v[k]))) : [NaN, NaN];
    lib = { q, s, e, Z, a, o, ok };
    sl[0].set(libMode === 0 ? Z.toFixed(3) : '–');
    sl[1].set(ok ? o[0].toFixed(2) : '–'); sl[2].set(ok ? o[1].toFixed(2) : '–');
    sl[3].set(ok ? M.sum(a).toFixed(2) : '–');
    const wEl = document.querySelector('#l-warn'); wEl.innerHTML = warn; LAB.renderMath(wEl); wEl.style.color = warn ? 'var(--coral)' : '';
    const f2 = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
    const vec = (v) => `\\begin{bmatrix}${v.map(f2).join('\\\\')}\\end{bmatrix}`;
    const parts = [];
    parts.push(`s=(${s.map(f2).join(',\\ ')})`);
    if (libMode === 0) parts.push(`e^{s}${libRound ? '\\approx' : '='}(${e.map((v) => v.toFixed(2)).join(',\\ ')}),\\ Z=${Z.toFixed(2)}`);
    if (ok) {
      parts.push(`\\boldsymbol\\alpha${libRound ? '\\approx' : '='}(${a.map((v) => v.toFixed(libRound ? 2 : 3)).join(',\\ ')})`);
      parts.push(`\\mathbf o=${a.map((v, i) => `${v.toFixed(libRound ? 2 : 3)}${vec(LIB[i].v)}`).join('+')}=${vec(o.map((v) => +v.toFixed(2)))}`);
    }
    const el = document.querySelector('#l-steps');
    el.innerHTML = parts.map((t) => `<div style="margin:4px 0 8px">${LAB.tex(t)}</div>`).join('');
    lsc.redraw(); lw.redraw();
  }
  const libBars = (ctx, w, h, vals, lo, hi, fmt, ylabel) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.6, xmax: 2.6, ymin: lo, ymax: hi, xtickValues: [], ylabel, yticks: 4, pad: { l: 44, r: 10, t: 16, b: 34 } }).axes();
    const bw = (P.tx(1) - P.tx(0)) * 0.5;
    if (lo < 0) P.hline(0, C.slate, null, 1);
    LIB.forEach((b, i) => {
      const v = vals[i]; if (!isFinite(v)) return;
      P.bars([i], [v], v < 0 ? C.coral : b.col, bw, 0);
      P.text(i, v, fmt(v), v < 0 ? C.coral : C.navy, 'center', v < 0 ? 'top' : 'bottom', '600 12px ' + NUMF);
      ctx.save(); ctx.fillStyle = C.ink; ctx.font = '12px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`第 ${i + 1} 本`, P.tx(i), P.y0 + 8); ctx.restore();
    });
  };
  const lsc = LAB.canvas('#l-score', (ctx, w, h) => { if (!lib) return; const m = Math.max(3, ...lib.s.map(Math.abs)); libBars(ctx, w, h, lib.s, Math.min(0, -m * (lib.s.some((v) => v < 0) ? 1 : 0)), m * 1.15, (v) => v.toFixed(1), '打分 s'); });
  const lw = LAB.canvas('#l-weight', (ctx, w, h) => {
    if (!lib) return;
    const a = lib.a.filter((v) => isFinite(v)), lo = Math.min(0, ...a), hi = Math.max(1, ...a);
    libBars(ctx, w, h, lib.a, lo < 0 ? lo * 1.25 : 0, hi * 1.12, (v) => (v * 100).toFixed(libRound ? 0 : 1) + '%', '百分比 α');
  });
  updLib();

  /* ================= 实验 3（上）：因果掩码热力图 ================= */
  const BOOK = {
    tok: ['我', '喝', '水'],
    Q: [[2, 0, 0, 0], [2, 2, 0, 0], [0, 2, 2, 0]],
    K: [[2, 0, 0, 0], [0, 2, 0, 0], [0, 0, 2, 0]],
    V: [[10, 0], [0, 20], [30, 30]],
  };
  const SENT = ['小明', '把', '刚', '买', '的', '苹果', '吃掉', '了', '，', '因为', '它', '太', '甜', '了'];
  const IT = 10, APPLE = 5;
  const DK = [2, 4, 8, 16, 32, 64, 128, 256];
  let mode = 0, scale = true, mask = true, fillZero = false, coref = true, seed = 3, sel = 2, hover = null, cur = null;
  const segData = LAB.segmented('#h-data', ['书中“我 / 喝 / 水”', '“它”指的是谁？'], 0, (i) => { mode = i; sel = i === 0 ? 2 : IT; document.querySelector('#h-dk').style.display = i === 0 ? 'none' : ''; document.querySelector('#h-coref').style.display = i === 0 ? 'none' : ''; compute(); });
  const sDk = LAB.slider('#h-dk', { label: '向量维度 $d_k$', min: 0, max: DK.length - 1, step: 1, value: 3, fmt: (i) => DK[i], onInput: () => compute() });
  LAB.checkbox('#h-scale', '除以 $\\sqrt{d_k}$', true, (v) => { scale = v; compute(); });
  LAB.checkbox('#h-mask', '因果掩码 $\\mathbf M$（看不见未来）', true, (v) => { mask = v; document.querySelector('#h-fill-label').style.display = document.querySelector('#h-fill').style.display = v ? '' : 'none'; compute(); });
  LAB.segmented('#h-fill', ['填 $-\\infty$（正确）', '填 $0$（新手坑）'], 0, (i) => { fillZero = i === 1; compute(); });
  LAB.checkbox('#h-coref', '让“它”的查询向量对齐“苹果”的键向量', true, (v) => { coref = v; compute(); });
  document.querySelector('#h-dk').style.display = 'none'; document.querySelector('#h-coref').style.display = 'none';
  document.querySelector('#h-reseed').onclick = () => { seed++; if (mode === 0) segData.set(1); else compute(); };
  function sentenceQKV(d) {
    const R = LAB.rng(seed * 101 + d), T = SENT.length;
    const g = () => M.range(d).map(() => R.normal());
    const Q = M.range(T).map(g), K = M.range(T).map(g), V = M.range(T).map(() => M.range(4).map(() => R.normal()));
    if (coref) { const rho = 0.75; Q[IT] = Q[IT].map((v, i) => Math.sqrt(1 - rho * rho) * v + rho * K[APPLE][i]); }
    return { tok: SENT, Q, K, V, d };
  }
  function attention(X) {
    const T = X.tok.length, d = X.Q[0].length, c = scale ? Math.sqrt(d) : 1;
    const S = X.Q.map((q) => X.K.map((k) => M.dot(q, k)));
    const Z = S.map((r, t) => r.map((s, j) => (mask && j > t ? (fillZero ? 0 : -Infinity) : s / c)));
    const A = Z.map(softmax);
    const O = A.map((a) => X.V[0].map((_, k) => a.reduce((acc, w, j) => acc + w * X.V[j][k], 0)));
    return { ...X, T, d, c, S, Z, A, O };
  }
  const sh = [LAB.stat('#h-stats', '该行的熵 $H(\\mathbf a_t)$', 'plum'), LAB.stat('#h-stats', '有效关注词数 $e^{H}$', 'teal'), LAB.stat('#h-stats', '最大权重', 'coral'), LAB.stat('#h-stats', '可见得分的标准差', 'amber')];
  function compute() {
    cur = attention(mode === 0 ? { tok: BOOK.tok, Q: BOOK.Q, K: BOOK.K, V: BOOK.V } : sentenceQKV(DK[sDk.get()]));
    sel = Math.min(sel, cur.T - 1);
    renderBook(); updRow(); heat.redraw();
  }
  function updRow() {
    const a = cur.A[sel], z = cur.Z[sel].filter((v) => isFinite(v)), H = M.entropy(a.filter((v) => v > 0));
    sh[0].set(`${H.toFixed(3)}<small>nats</small>`); sh[1].set(`${Math.exp(H).toFixed(2)}<small>/ ${z.length} 个可见词</small>`);
    sh[2].set(`${(Math.max(...a) * 100).toFixed(1)}%`); sh[3].set(z.length > 1 ? M.std(z).toFixed(2) : '–');
    document.querySelector('#h-rowtitle').textContent = `第 ${sel + 1} 个词“${cur.tok[sel]}”把注意力分给了谁`;
    rowc.redraw();
  }
  let geo = null;
  const heat = LAB.canvas('#h-heat', (ctx, w, h) => {
    if (!cur) return;
    const T = cur.T, lw = T > 4 ? 46 : 54, th = 30;
    const side = Math.min(w - lw - 8, h - th - 8), cs = side / T, x0 = lw + Math.max(0, (w - lw - side) / 2 - 20), y0 = th;
    geo = { x0, y0, cs, T };
    ctx.save(); ctx.font = (T > 4 ? 12 : 14) + 'px ' + FONT; ctx.textBaseline = 'middle';
    for (let t = 0; t < T; t++) {
      ctx.fillStyle = t === sel ? C.coral : C.ink; ctx.textAlign = 'right'; ctx.fillText(cur.tok[t], x0 - 6, y0 + (t + 0.5) * cs);
      ctx.save(); ctx.translate(x0 + (t + 0.5) * cs, y0 - 6); ctx.rotate(T > 6 ? -Math.PI / 4 : 0); ctx.textAlign = T > 6 ? 'left' : 'center'; ctx.fillStyle = C.ink; ctx.fillText(cur.tok[t], 0, 0); ctx.restore();
    }
    for (let t = 0; t < T; t++) for (let j = 0; j < T; j++) {
      const X = x0 + j * cs, Y = y0 + t * cs, a = cur.A[t][j];
      if (!isFinite(cur.Z[t][j])) {
        ctx.fillStyle = '#F2F4F7'; ctx.fillRect(X, Y, cs, cs);
        ctx.strokeStyle = '#E1E6EC'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = -cs; k < cs; k += 6) { ctx.moveTo(X + Math.max(0, k), Y + Math.max(0, -k)); ctx.lineTo(X + Math.min(cs, k + cs), Y + Math.min(cs, cs - k)); } ctx.stroke();
      } else { ctx.fillStyle = LAB.heat(Math.pow(a, 0.7)); ctx.fillRect(X, Y, cs, cs); }
      if (mask && fillZero && j > t) { ctx.save(); ctx.strokeStyle = C.coral; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect(X + 2, Y + 2, cs - 4, cs - 4); ctx.restore(); }
      if (cs >= 30 && isFinite(cur.Z[t][j])) { ctx.fillStyle = a > 0.45 ? '#fff' : C.navy; ctx.font = '600 ' + Math.min(15, cs * 0.3) + 'px ' + NUMF; ctx.textAlign = 'center'; ctx.fillText(a.toFixed(T > 4 ? 2 : 3), X + cs / 2, Y + cs / 2); }
    }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; for (let i = 0; i <= T; i++) { ctx.beginPath(); ctx.moveTo(x0 + i * cs, y0); ctx.lineTo(x0 + i * cs, y0 + side); ctx.moveTo(x0, y0 + i * cs); ctx.lineTo(x0 + side, y0 + i * cs); ctx.stroke(); }
    ctx.strokeStyle = C.coral; ctx.lineWidth = 2.2; ctx.strokeRect(x0 + 1, y0 + sel * cs + 1, side - 2, cs - 2);
    if (hover) {
      const [t, j] = hover, s = cur.Z[t][j], txt1 = `${cur.tok[t]} → ${cur.tok[j]}`, txt2 = isFinite(s) ? `得分 ${s.toFixed(2)} · 权重 ${(cur.A[t][j] * 100).toFixed(1)}%${mask && fillZero && j > t ? '（偷看了未来！）' : ''}` : '未来位置：得分 −∞，权重 0';
      ctx.strokeStyle = C.navy; ctx.lineWidth = 2; ctx.strokeRect(x0 + j * cs, y0 + t * cs, cs, cs);
      ctx.font = '12.5px ' + FONT; const bw = Math.max(ctx.measureText(txt1).width, ctx.measureText(txt2).width) + 18;
      let bx = x0 + (j + 1) * cs + 6, by = y0 + t * cs - 4; if (bx + bw > w) bx = x0 + j * cs - bw - 6; if (bx < 2) bx = 2; by = M.clamp(by, 2, h - 46);
      ctx.fillStyle = 'rgba(29,53,87,.94)'; LAB.roundRect(ctx, bx, by, bw, 42, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(txt1, bx + 9, by + 13); ctx.fillStyle = '#cfe3f3'; ctx.fillText(txt2, bx + 9, by + 30);
    }
    ctx.restore();
  });
  // 窄屏时让热力图容器高度贴合方形网格，避免下方大片留白
  const heatHost = document.querySelector('#h-heat');
  const fitHeat = () => { const w = heatHost.clientWidth; if (w > 0) heatHost.style.height = Math.round(Math.min(420, Math.max(240, w - 10))) + 'px'; };
  window.addEventListener('resize', fitHeat); fitHeat();
  const cellAt = (e) => { if (!geo) return null; const r = heat.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; const j = Math.floor((x - geo.x0) / geo.cs), t = Math.floor((y - geo.y0) / geo.cs); return t >= 0 && j >= 0 && t < geo.T && j < geo.T ? [t, j] : null; };
  heat.canvas.addEventListener('pointermove', (e) => { const c = cellAt(e); if (String(c) !== String(hover)) { hover = c; heat.redraw(); } });
  heat.canvas.addEventListener('pointerleave', () => { hover = null; heat.redraw(); });
  heat.canvas.addEventListener('pointerdown', (e) => { const c = cellAt(e); if (c) { hover = c; sel = c[0]; updRow(); heat.redraw(); } });
  heat.canvas.style.cursor = 'pointer';
  const rowc = LAB.canvas('#h-row', (ctx, w, h) => {
    if (!cur) return;
    const a = cur.A[sel], T = cur.T;
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.6, xmax: T - 0.4, ymin: 0, ymax: 1.08, xtickValues: [], ylabel: '权重', yticks: 4, pad: { l: 44, r: 10, t: 12, b: 42 } }).axes();
    const bw = (P.tx(1) - P.tx(0)) * 0.6;
    P.bars(M.range(T), a, a.map((_, j) => (isFinite(cur.Z[sel][j]) ? C.c1 : '#E1E6EC')), bw);
    ctx.save(); ctx.textAlign = 'center';
    for (let j = 0; j < T; j++) {
      const vis = isFinite(cur.Z[sel][j]);
      if (vis && a[j] > 0.005) P.text(j, a[j], (a[j] * 100).toFixed(a[j] > 0.995 ? 0 : 1) + '%', C.navy, 'center', 'bottom', '600 ' + (T > 8 ? 10 : 12) + 'px ' + NUMF);
      ctx.fillStyle = C.ink; ctx.font = (T > 8 ? 11.5 : 13) + 'px ' + FONT; ctx.textBaseline = 'top'; ctx.fillText(cur.tok[j], P.tx(j), P.y0 + 5);
      ctx.fillStyle = vis ? C.amber : '#b8c1cc'; ctx.font = (T > 8 ? 10 : 11.5) + 'px ' + NUMF; ctx.fillText(vis ? cur.Z[sel][j].toFixed(T > 8 ? 1 : 2) : '−∞', P.tx(j), P.y0 + 22);
    }
    ctx.restore();
  });
  function mat(A, f) { return '\\begin{bmatrix}' + A.map((r) => r.map(f || ((v) => v)).join(' & ')).join(' \\\\ ') + '\\end{bmatrix}'; }
  function renderBook() {
    const X = attention({ tok: BOOK.tok, Q: BOOK.Q, K: BOOK.K, V: BOOK.V });
    const f3 = (v) => (isFinite(v) ? (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(3)) : '-\\infty');
    const blk = (label, tex) => `<div style="display:inline-block;vertical-align:top;margin:4px 14px 10px 0"><div class="small muted" style="margin-bottom:2px">${label}</div>${LAB.tex(tex)}</div>`;
    const zl = `${scale ? '\\frac{\\mathbf Q\\mathbf K^\\top}{\\sqrt{4}}' : '\\mathbf Q\\mathbf K^\\top'}${mask ? (fillZero ? '\\ (j>i\\text{ 填 }0)' : '\\ (j>i\\text{ 填 }-\\infty)') : ''}`;
    document.querySelector('#h-book').innerHTML =
      blk('① 查询 / 键 / 值', `\\mathbf Q=${mat(BOOK.Q)},\\ \\mathbf K=${mat(BOOK.K)},\\ \\mathbf V=${mat(BOOK.V)}`) +
      blk('② 内积打分', `\\mathbf Q\\mathbf K^\\top=${mat(X.S)}`) +
      blk(`③ ${scale ? '除以 √dₖ = 2' : '不缩放'}${mask ? '，盖上因果挡板' : ''}`, `${zl}=${mat(X.Z, f3)}`) +
      blk('④ 逐行 Softmax', `\\mathbf A=${mat(X.A, (v) => v.toFixed(3))}`) +
      blk('⑤ 按百分比抄笔记', `\\mathbf O=\\mathbf A\\mathbf V=${mat(X.O, (v) => v.toFixed(2))}`);
  }
  compute();

  /* ================= 实验 2：√dₖ 救活导数 ================= */
  const DK2 = [2, 4, 8, 16, 32, 64, 100, 128, 256, 512, 1024];
  let scale2 = false, seed2 = 1;
  const s2dk = LAB.slider('#s-dk', { label: '头维度 $d_k$', min: 0, max: DK2.length - 1, step: 1, value: 6, fmt: (i) => DK2[i], onInput: () => run2() });
  LAB.checkbox('#s-scale', '除以 $\\sqrt{d_k}$', false, (v) => { scale2 = v; run2(); });
  const s2T = LAB.slider('#s-T', { label: '键的个数 $T$', min: 2, max: 64, step: 1, value: 8, onInput: () => { buildMC(); run2(); } });
  s2dk.set(DK2.indexOf(100));
  const s2tau = LAB.slider('#s-tau', { label: '温度 $\\tau$', min: 0.1, max: 4, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), onInput: () => run2() });
  document.querySelector('#s-resample').onclick = () => { seed2++; buildMC(); run2(); };
  // 蒙特卡洛：给定 q，各 z_j = qᵀk_j 独立同分布 N(0, ‖q‖²)，故只需抽 ‖q‖ 与标准正态 ε_j
  let MC = [];
  function buildMC() {
    const R = LAB.rng(seed2 * 7 + 11), T = s2T.get();
    MC = DK2.map((d) => M.range(80).map(() => { let s = 0; for (let i = 0; i < d; i++) { const v = R.normal(); s += v * v; } return { qn: Math.sqrt(s), eps: M.range(T).map(() => R.normal()) }; }));
  }
  function jacStats(d, sc, tau) {
    const c = (sc ? Math.sqrt(d) : 1) * tau; let J = 0, mx = 0, sat = 0;
    MC[DK2.indexOf(d)].forEach(({ qn, eps }) => { const a = softmax(eps.map((e) => qn * e / c)); let s2 = 0, s3 = 0; a.forEach((v) => { s2 += v * v; s3 += v * v * v; }); J += Math.sqrt(Math.max(0, s2 - 2 * s3 + s2 * s2)); const m = Math.max(...a); mx += m; if (m > 0.99) sat++; });
    return { J: J / 80, mx: mx / 80, sat: sat / 80 };
  }
  let scores = [], ex = null;
  const run2 = schedule(() => {
    const d = DK2[s2dk.get()], T = s2T.get(), R = LAB.rng(seed2 * 13 + d);
    scores = [];
    for (let n = 0; n < 3000; n++) { let s = 0; for (let i = 0; i < d; i++) s += R.normal() * R.normal(); scores.push(s); }
    const q = M.range(d).map(() => R.normal()), K = M.range(T).map(() => M.range(d).map(() => R.normal()));
    ex = K.map((k) => M.dot(q, k));
    upd2();
  });
  const st2 = [LAB.stat('#s-stats', '得分标准差', 'amber'), LAB.stat('#s-stats', '平均最大权重', 'coral'), LAB.stat('#s-stats', '平均 $\\|\\mathbf J\\|_F$', 'teal'), LAB.stat('#s-stats', '饱和比例 $\\max_j a_j&gt;0.99$', 'plum')];
  function upd2() {
    const d = DK2[s2dk.get()], tau = s2tau.get(), c = (scale2 ? Math.sqrt(d) : 1) * tau, z = scores.map((s) => s / c);
    const js = jacStats(d, scale2, tau);
    st2[0].set(`${M.std(z).toFixed(2)}<small>理论 ${(Math.sqrt(d) / c).toFixed(2)}</small>`);
    st2[1].set(`${(js.mx * 100).toFixed(1)}%<small>均匀 ${(100 / s2T.get()).toFixed(1)}%</small>`);
    st2[2].set(js.J.toFixed(3)); st2[3].set(`${(js.sat * 100).toFixed(0)}%`);
    document.querySelector('#s-hcap').innerHTML = LAB.tex(`z=\\mathbf q^\\top\\mathbf k/(${scale2 ? '\\sqrt{d_k}' : '1'}\\cdot\\tau)`) + `，3000 次抽样；虚线为 ${LAB.tex(`\\mathcal N(0,\\ ${(Math.sqrt(d) / c).toFixed(2)}^2)`)}。`;
    // 书中算例：两个候选词，得分 (2σ, 0)，σ = √dₖ
    const s1 = 2 * Math.sqrt(d), sig = (x) => 1 / (1 + Math.exp(-x));
    const pU = sig(s1 / tau), pS = sig(s1 / (Math.sqrt(d) * tau)), gU = pU * (1 - pU), gS = pS * (1 - pS);
    document.querySelector('#s-two-sub').textContent = `dₖ = ${d}，2 个标准差 = ${s1.toFixed(d === 100 ? 0 : 2)} 分`;
    const fe = (x) => (x < 1e-3 ? M.fmt(x, 2) : x.toFixed(4));
    document.querySelector('#s-two').innerHTML = `<table class="data"><thead><tr><th></th><th>送进 Softmax 的得分</th><th>$p_1$</th><th>导数 $p_1(1-p_1)$</th></tr></thead><tbody>
      <tr><td><b style="color:${C.c4}">不除 $\\sqrt{d_k}$</b></td><td class="num">(${(s1 / tau).toFixed(2)}, 0)</td><td class="num">${pU > 0.999999 ? (1 - (1 - pU)).toFixed(9) : pU.toFixed(4)}</td><td class="num">${fe(gU)}</td></tr>
      <tr><td><b style="color:${C.c3}">除以 $\\sqrt{d_k}$</b></td><td class="num">(${(s1 / (Math.sqrt(d) * tau)).toFixed(2)}, 0)</td><td class="num">${pS.toFixed(4)}</td><td class="num">${fe(gS)}</td></tr>
      </tbody></table><div class="caption">两者相差 ${M.fmt(gS / gU, 2)} 倍。$d_k=100$、$\\tau=1$ 时正是书中的 $2.1\\times10^{-9}$ 对 $0.105$。</div>`;
    LAB.renderMath(document.querySelector('#s-two'));
    hist2.redraw(); bars2.redraw(); jac.redraw(); maxc.redraw();
  }
  const hist2 = LAB.canvas('#s-hist', (ctx, w, h) => {
    if (!scores.length) return;
    const d = DK2[s2dk.get()], tau = s2tau.get(), c = (scale2 ? Math.sqrt(d) : 1) * tau, sig = Math.sqrt(d) / c, R = Math.max(5, 4 * sig);
    const H = histogram(scores.map((s) => s / c), -R, R, 60), pk = 1 / (sig * Math.sqrt(2 * Math.PI));
    const P = new LAB.Plot(ctx, w, h, { xmin: -R, xmax: R, ymin: 0, ymax: Math.max(...H.h, pk) * 1.12, xlabel: '得分 z', ylabel: '密度', pad: { l: 44, r: 10, t: 10, b: 36 } }).axes();
    ctx.save(); ctx.fillStyle = scale2 ? C.c3 : C.c4; ctx.globalAlpha = 0.5;
    for (let k = 0; k < 60; k++) { if (!H.h[k]) continue; const X0 = P.tx(H.lo + k * H.bw), X1 = P.tx(H.lo + (k + 1) * H.bw), Y = P.ty(H.h[k]); ctx.fillRect(X0 + 0.3, Y, X1 - X0 - 0.6, P.y0 - Y); }
    ctx.restore();
    P.fn((x) => Math.exp(-x * x / (2 * sig * sig)) * pk, C.navy, 1.6, [6, 4]);
    P.vline(-1, C.slate, [2, 3], 1); P.vline(1, C.slate, [2, 3], 1);
  });
  const bars2 = LAB.canvas('#s-bars', (ctx, w, h) => {
    if (!ex) return;
    const d = DK2[s2dk.get()], tau = s2tau.get(), T = ex.length;
    const aU = softmax(ex.map((s) => s / tau)), aS = softmax(ex.map((s) => s / (Math.sqrt(d) * tau)));
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.4, xmax: T + 0.6, ymin: 0, ymax: 1.05, xtickValues: T <= 16 ? M.range(T).map((i) => i + 1) : [1, 8, 16, 32, 48, 64].filter((v) => v <= T), xfmt: (v) => 'k' + v, ylabel: '权重 a_j', yticks: 4, pad: { l: 44, r: 10, t: 10, b: 30 } }).axes();
    const bw = (P.tx(2) - P.tx(1)) * 0.38;
    P.bars(M.range(T).map((i) => i + 1 - 0.2), aU, scale2 ? LAB.mix(C.c4, '#ffffff', 0.5) : C.c4, bw);
    P.bars(M.range(T).map((i) => i + 1 + 0.2), aS, scale2 ? C.c3 : LAB.mix(C.c3, '#ffffff', 0.5), bw);
    P.text(T + 0.5, 0.97, `红：不缩放（max ${(Math.max(...aU) * 100).toFixed(1)}%）`, C.c4, 'right', 'middle', '600 11.5px ' + FONT);
    P.text(T + 0.5, 0.88, `绿：除以 √dₖ（max ${(Math.max(...aS) * 100).toFixed(1)}%）`, C.c3, 'right', 'middle', '600 11.5px ' + FONT);
  });
  const jac = LAB.canvas('#s-jac', (ctx, w, h) => {
    if (!MC.length) return;
    const tau = s2tau.get(), T = s2T.get(), S = DK2.map((d) => jacStats(d, true, tau).J), U = DK2.map((d) => jacStats(d, false, tau).J);
    const top = Math.max(0.1, ...S, ...U) * 1.15;
    const P = new LAB.Plot(ctx, w, h, { xmin: 2, xmax: 1024, logx: true, ymin: 0, ymax: top, xtickValues: [2, 8, 32, 128, 512], xfmt: (v) => v, xlabel: '头维度 dₖ', ylabel: '‖J‖_F', pad: { l: 46, r: 12, t: 10, b: 36 } }).axes();
    const unif = Math.sqrt(1 / T - 2 / (T * T) + 1 / (T * T));
    P.hline(unif, C.slate, [2, 3], 1); P.text(1000, unif, `均匀分布 ${unif.toFixed(3)} `, C.slate, 'right', 'top', '11px ' + NUMF);
    P.line(DK2, S, C.c3, 2.4); P.points(DK2, S, C.c3, 3.2);
    P.line(DK2, U, C.c4, 2.4, [6, 3]); P.points(DK2, U, C.c4, 3.2);
    const d = DK2[s2dk.get()]; P.points([d], [scale2 ? S[DK2.indexOf(d)] : U[DK2.indexOf(d)]], scale2 ? C.c3 : C.c4, 6.5, '#fff');
  });
  const maxc = LAB.canvas('#s-max', (ctx, w, h) => {
    if (!MC.length) return;
    const tau = s2tau.get(), T = s2T.get(), S = DK2.map((d) => jacStats(d, true, tau).mx), U = DK2.map((d) => jacStats(d, false, tau).mx);
    const P = new LAB.Plot(ctx, w, h, { xmin: 2, xmax: 1024, logx: true, ymin: 0, ymax: 1.02, xtickValues: [2, 8, 32, 128, 512], xfmt: (v) => v, xlabel: '头维度 dₖ', ylabel: 'E[max a]', yfmt: (v) => Math.round(v * 100) + '%', pad: { l: 46, r: 12, t: 10, b: 36 } }).axes();
    P.hline(1 / T, C.slate, [2, 3], 1);
    P.line(DK2, S, C.c3, 2.4); P.points(DK2, S, C.c3, 3.2);
    P.line(DK2, U, C.c4, 2.4, [6, 3]); P.points(DK2, U, C.c4, 3.2);
    const d = DK2[s2dk.get()]; P.points([d], [scale2 ? S[DK2.indexOf(d)] : U[DK2.indexOf(d)]], scale2 ? C.c3 : C.c4, 6.5, '#fff');
  });
  buildMC(); run2();

  /* ================= 实验 3：KV Cache 计算器 ================= */
  const PRESETS = [
    { name: 'LLaMA-2-7B（MHA）', L: 32, H: 32, dk: 128, G: 32, dc: 512, dR: 64, v: 0 },
    { name: 'LLaMA-3-8B（GQA，8 组）', L: 32, H: 32, dk: 128, G: 8, dc: 512, dR: 64, v: 1 },
    { name: 'LLaMA-3-70B（GQA，8 组）', L: 80, H: 64, dk: 128, G: 8, dc: 512, dR: 64, v: 1 },
    { name: 'Qwen2.5-7B（GQA，4 组）', L: 28, H: 28, dk: 128, G: 4, dc: 512, dR: 64, v: 1 },
    { name: 'Falcon-7B（MQA）', L: 32, H: 71, dk: 64, G: 1, dc: 512, dR: 64, v: 2 },
    { name: 'DeepSeek-V3（MLA）', L: 61, H: 128, dk: 128, G: 8, dc: 512, dR: 64, v: 3 },
  ];
  const VAR = [{ n: 'MHA', col: C.c1 }, { n: 'GQA', col: C.c3 }, { n: 'MQA', col: C.c2 }, { n: 'MLA', col: C.c5 }];
  const TL = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576];
  const BYTES = [4, 2, 1, 0.5];
  let pv = 0, bIdx = 1;
  const presetSel = document.querySelector('#kv-preset');
  presetSel.innerHTML = PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('') + '<option value="-1">自定义</option>';
  const custom = () => { presetSel.value = '-1'; upd3(); };
  const kL = LAB.slider('#kv-L', { label: '层数 $L$', min: 1, max: 128, step: 1, value: 32, onInput: custom });
  const kH = LAB.slider('#kv-H', { label: '查询头数 $H$', min: 1, max: 128, step: 1, value: 32, onInput: () => { if (kG.get() > kH.get()) kG.set(kH.get()); custom(); } });
  const kdk = LAB.slider('#kv-dk', { label: '单头维度 $d_k$', min: 32, max: 256, step: 16, value: 128, onInput: custom });
  const kG = LAB.slider('#kv-G', { label: 'GQA 组数 $G$', min: 1, max: 128, step: 1, value: 8, onInput: () => { if (kG.get() > kH.get()) kG.set(kH.get()); custom(); } });
  const kdc = LAB.slider('#kv-dc', { label: 'MLA 潜在维度 $d_c$', min: 64, max: 2048, step: 64, value: 512, onInput: custom });
  const kdR = LAB.slider('#kv-dR', { label: 'MLA 解耦 RoPE 维度 $d_R$', min: 0, max: 256, step: 16, value: 64, onInput: custom });
  const kT = LAB.slider('#kv-T', { label: '上下文长度 $T$', min: 0, max: TL.length - 1, step: 1, value: 7, fmt: (i) => (TL[i] >= 1048576 ? '1M' : TL[i] / 1024 + 'K'), onInput: () => upd3() });
  const kB = LAB.slider('#kv-B', { label: '并发请求数（批大小）$B$', min: 1, max: 64, step: 1, value: 1, onInput: () => upd3() });
  LAB.segmented('#kv-bytes', ['FP32 · 4', 'BF16 · 2', 'FP8 · 1', 'INT4 · ½'], 1, (i) => { bIdx = i; upd3(); });
  presetSel.onchange = () => { const i = +presetSel.value; if (i < 0) return; const p = PRESETS[i]; kL.set(p.L); kH.set(p.H); kdk.set(p.dk); kG.set(p.G); kdc.set(p.dc); kdR.set(p.dR); pv = p.v; upd3(); };
  const per = () => { const H = kH.get(), dk = kdk.get(), G = Math.min(kG.get(), H); return [2 * H * dk, 2 * G * dk, 2 * dk, kdc.get() + kdR.get()]; };
  const GiB = 1024 ** 3;
  const fmtB = (b) => (b >= GiB ? (b / GiB).toFixed(b >= 100 * GiB ? 0 : 1) + ' GB' : b >= 1024 ** 2 ? (b / 1024 ** 2).toFixed(1) + ' MB' : (b / 1024).toFixed(1) + ' KB');
  const sk = VAR.map((v, i) => LAB.stat('#kv-stats', `${v.n} 总显存`, ['', 'leaf', 'amber', 'plum'][i]));
  function upd3() {
    const e = per(), L = kL.get(), T = TL[kT.get()], B = kB.get(), by = BYTES[bIdx];
    e.forEach((x, i) => sk[i].set(`${fmtB(x * L * T * B * by).replace(' ', '<small>')}</small>`));
    sk.forEach((s, i) => { s.el.style.outline = i === pv && presetSel.value !== '-1' ? `2px solid ${VAR[i].col}` : 'none'; });
    document.querySelector('#kv-sub').textContent = `H = ${kH.get()}，dₖ = ${kdk.get()}，G = ${Math.min(kG.get(), kH.get())}，d_c + d_R = ${kdc.get() + kdR.get()}`;
    const rows = VAR.map((v, i) => {
      const r = e[i] / e[0], tok = e[i] * L * by;
      const formula = ['2Hd_k', '2Gd_k', '2d_k', 'd_c+d_R'][i];
      const maxT = Math.floor(80 * GiB / (e[i] * L * by * B));
      return `<tr><td><b style="color:${v.col}">${v.n}</b></td><td>${LAB.tex(formula)} <span class="muted">= ${e[i].toLocaleString()}</span></td><td class="num">${(r * 100).toFixed(r < 0.1 ? 2 : 1)}%</td><td class="num">${fmtB(tok)}</td><td class="num">${maxT >= 1e6 ? (maxT / 1e6).toFixed(1) + 'M' : maxT >= 1e3 ? (maxT / 1e3).toFixed(0) + 'K' : maxT}</td><td>${['GPT-3、LLaMA-1', 'LLaMA-2/3、Qwen-2.5', 'PaLM、Falcon', 'DeepSeek-V2/V3'][i]}</td></tr>`;
    });
    document.querySelector('#kv-table').innerHTML = `<thead><tr><th>变体</th><th>每词元每层缓存的数</th><th>相对 MHA</th><th>每词元（全部 ${L} 层）</th><th>80 GB 能装的词元数（B=${B}）</th><th>代表模型</th></tr></thead><tbody>${rows.join('')}</tbody>`;
    kvBars.redraw(); kvCurve.redraw();
  }
  const kvBars = LAB.canvas('#kv-bars', (ctx, w, h) => {
    const e = per(), top = e[0] * 1.18;
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.6, xmax: 3.6, ymin: 0, ymax: top, xtickValues: [], ylabel: '个数', yticks: 4, pad: { l: 56, r: 10, t: 14, b: 30 } }).axes();
    const bw = (P.tx(1) - P.tx(0)) * 0.5;
    P.bars([0, 1, 2, 3], e, VAR.map((v, i) => (i === pv && presetSel.value !== '-1' ? v.col : LAB.mix(v.col, '#ffffff', 0.25))), bw);
    e.forEach((x, i) => {
      P.text(i, x, `${x.toLocaleString()}（${(x / e[0] * 100).toFixed(x / e[0] < 0.1 ? 1 : 0)}%）`, C.navy, 'center', 'bottom', '600 12px ' + NUMF);
      ctx.save(); ctx.fillStyle = VAR[i].col; ctx.font = '600 13px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(VAR[i].n, P.tx(i), P.y0 + 7); ctx.restore();
    });
  });
  const kvCurve = LAB.canvas('#kv-curve', (ctx, w, h) => {
    const e = per(), L = kL.get(), B = kB.get(), by = BYTES[bIdx];
    const gb = (i, T) => e[i] * L * T * B * by / GiB;
    const ymax = Math.pow(10, Math.ceil(Math.log10(Math.max(100, gb(0, 1048576)))));
    const ymin = Math.pow(10, Math.floor(Math.log10(Math.max(1e-3, gb(2, 1024)))));
    const P = new LAB.Plot(ctx, w, h, { xmin: 1024, xmax: 1048576, logx: true, logy: true, ymin, ymax, xtickValues: [1024, 4096, 16384, 65536, 262144, 1048576], xfmt: (v) => (v >= 1048576 ? '1M' : v / 1024 + 'K'), xlabel: '上下文长度 T', ylabel: 'KV Cache（GB）', pad: { l: 56, r: 12, t: 10, b: 38 } }).axes();
    [24, 80].forEach((g) => { if (g > ymin && g < ymax) { P.hline(g, C.slate, [4, 4], 1.2); P.text(1100, g, ` ${g} GB`, C.slate, 'left', 'bottom', '11px ' + NUMF); } });
    VAR.forEach((v, i) => P.fn((T) => gb(i, T), v.col, i === pv ? 3 : 2));
    const T = TL[kT.get()]; P.vline(T, C.slate, [3, 3]);
    VAR.forEach((v, i) => P.points([T], [gb(i, T)], v.col, 5, '#fff'));
  });
  presetSel.value = '0'; upd3();
  // 练习 5.3：KV Cache 省下的乘法
  const xd = LAB.slider('#x-d', { label: '向量维度 $d$', min: 10, max: 400, step: 10, value: 100, onInput: () => updX() });
  const xt = LAB.slider('#x-t', { label: '正在生成第 $t$ 个词', min: 2, max: 1000, step: 1, value: 100, onInput: () => updX() });
  const sx = [LAB.stat('#x-stats', '不用缓存', 'coral'), LAB.stat('#x-stats', '用缓存', 'leaf'), LAB.stat('#x-stats', '省掉的比例', 'teal')];
  function updX() {
    const d = xd.get(), t = xt.get(), a = t * d * d, b = d * d;
    sx[0].set(`${a.toLocaleString()}<small>次</small>`); sx[1].set(`${b.toLocaleString()}<small>次</small>`);
    sx[2].set(`${((1 - b / a) * 100).toFixed(t >= 1000 ? 1 : 0)}%<small>快 ${t} 倍</small>`);
  }
  updX();
})();
