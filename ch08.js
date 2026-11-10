/* 第 8 章：效率：让大模型又大又快 · 交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §8.1 专科医院分诊台 · §8.2 负载均衡与动态补贴 · §8.3 Mamba 随身备忘录 · §8.4 完整算例 · §8.5 本章小结：效率对比' });

  const $ = (s) => document.querySelector(s);
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (e) => String(e).split('').map((c) => SUP[c]).join('');
  const fe = (x) => { if (!isFinite(x)) return '–'; if (x === 0) return '0'; const a = Math.abs(x); if (a >= 1000 && a < 1e4) return String(Math.round(x)); if (a >= 0.01 && a < 1e4) return x.toPrecision(3); const e = Math.floor(Math.log10(a)); return (x / Math.pow(10, e)).toFixed(1) + '×10' + sup(e); };
  const bytes = (b) => { const u = [['TB', 1e12], ['GB', 1e9], ['MB', 1e6], ['KB', 1e3]]; for (const [s, v] of u) if (b >= v) return (b / v).toPrecision(3).replace(/\.?0+$/, '') + ' ' + s; return Math.round(b) + ' B'; };
  const isOn = (id) => document.getElementById(id).classList.contains('active');
  function pointer(el, h) {
    el = typeof el === 'string' ? $(el) : el;
    const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let on = false;
    el.addEventListener('pointerdown', (e) => { on = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} h.down && h.down(...pos(e)); e.preventDefault(); });
    el.addEventListener('pointermove', (e) => { if (on && h.move) h.move(...pos(e)); });
    const end = () => { on = false; }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  /* ================= 实验 1：Top-k 路由与负载均衡 ================= */
  const st = { E: 8, k: 2, T: 64, skew: 1.6, gamma: 0.05, book: false, batch: 0, bias: new Array(8).fill(0), sel: 0, hist: [], running: false };
  let B = null, Rt = null;
  function makeBatch() {
    if (st.book) {
      const logits = [[3, 3, -5, -8]]; // 书中 8.1 节：x=(2,1) 的分诊打分
      return { logits, probs: logits.map((z) => M.softmax(z)) };
    }
    const R = LAB.rng(100 + st.batch * 131 + st.E * 7 + st.T), E = st.E;
    const logits = M.range(st.T).map(() => M.range(E).map((i) => st.skew * (1 - (2 * i) / (E - 1)) + R.normal()));
    return { logits, probs: logits.map((z) => M.softmax(z)) };
  }
  function route(batch) {
    const E = batch.probs[0].length, T = batch.probs.length, k = st.k;
    const counts = new Array(E).fill(0), Psum = new Array(E).fill(0), picks = [], gates = [];
    batch.probs.forEach((p, t) => {
      const sc = batch.logits[t].map((z, i) => z + st.bias[i]);
      const idx = M.range(E).sort((a, b) => sc[b] - sc[a]).slice(0, k);
      const tot = M.sum(idx.map((i) => p[i]));
      picks.push(idx); gates.push(idx.map((i) => p[i] / tot));
      idx.forEach((i) => counts[i]++);
      p.forEach((v, i) => (Psum[i] += v));
    });
    const f = counts.map((c) => c / (T * k)), P = Psum.map((s) => s / T);
    const L = E * M.sum(f.map((v, i) => v * P[i]));
    const mean = (T * k) / E;
    return { E, T, k, counts, f, P, L, picks, gates, maxLoad: Math.max(...counts) / mean, idle: counts.filter((c) => c === 0).length };
  }
  function refresh1() { B = makeBatch(); Rt = route(B); st.sel = Math.min(st.sel, Rt.T - 1); draw1(); }
  function stepBias() {
    if (st.book) { setBook(false); }
    st.batch++;
    B = makeBatch(); Rt = route(B);
    const mean = (Rt.T * Rt.k) / Rt.E;
    st.bias = st.bias.map((b, i) => b + st.gamma * Math.sign(mean - Rt.counts[i]));
    st.hist.push({ load: Rt.maxLoad, L: Rt.L });
    if (st.hist.length > 200) st.hist.shift();
    draw1();
  }
  const sE = LAB.slider('#m-E', { label: '专家数 $E$', min: 4, max: 16, step: 1, value: st.E, onInput: (v) => { st.E = v; st.bias = new Array(v).fill(0); st.hist = []; const km = Math.min(4, v - 1); sK.setRange(1, km); if (st.k > km) { st.k = km; sK.set(km); } refresh1(); } });
  const sK = LAB.slider('#m-k', { label: 'Top-$k$', min: 1, max: 4, step: 1, value: st.k, onInput: (v) => { st.k = v; st.hist = []; refresh1(); } });
  const sT = LAB.slider('#m-T', { label: '一批词元数 $T$', min: 8, max: 256, step: 8, value: st.T, onInput: (v) => { st.T = v; refresh1(); } });
  const sS = LAB.slider('#m-skew', { label: '路由偏好倾斜度', min: 0, max: 3, step: 0.05, value: st.skew, fmt: (v) => v.toFixed(2), hint: '打分 $s_{t,i}=\\text{倾斜度}\\times(1-2i/(E-1))+\\mathcal N(0,1)$', onInput: (v) => { st.skew = v; st.hist = []; refresh1(); } });
  LAB.slider('#m-gamma', { label: '偏置更新速率 $\\gamma$', min: 0.005, max: 0.2, step: 0.005, value: st.gamma, fmt: (v) => v.toFixed(3), onInput: (v) => { st.gamma = v; } });
  const ctrls = [sE, sK, sT, sS];
  function setBook(on) {
    st.book = on; st.bias = new Array(on ? 4 : st.E).fill(0); st.hist = [];
    ctrls.forEach((c) => { c.input.disabled = on; c.el.style.opacity = on ? 0.45 : 1; });
    if (on) { st.k = 2; st.sel = 0; stopRun(); }
    else { st.k = sK.get(); }
    refresh1();
  }
  $('#m-book').onclick = () => setBook(true);
  $('#m-random').onclick = () => setBook(false);
  function stopRun() { st.running = false; $('#m-run').textContent = '▶ 自动更新偏置'; }
  $('#m-run').onclick = () => {
    if (st.running) { stopRun(); return; }
    if (st.book) setBook(false);
    st.running = true; $('#m-run').textContent = '⏸ 暂停';
    let last = 0;
    const loop = (now) => {
      if (!st.running) return;
      if (!isOn('router')) { stopRun(); return; }
      if (now - last > 90) { last = now; stepBias(); if (st.hist.length >= 200) { stopRun(); return; } }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
  $('#m-step').onclick = () => stepBias();
  $('#m-reset').onclick = () => { st.bias = st.bias.map(() => 0); st.hist = []; refresh1(); };

  const gridCv = LAB.canvas('#m-grid', (ctx, w, h) => {
    if (!Rt) return;
    const E = Rt.E, T = Rt.T, l = 34, r = 8, t = 8, b = 22;
    const cw = (w - l - r) / T, ch = (h - t - b) / E;
    gridCv._geo = { l, cw, T };
    const pmax = Math.max(...B.probs.flat());
    for (let j = 0; j < T; j++) for (let i = 0; i < E; i++) {
      const x = l + j * cw, y = t + i * ch;
      ctx.fillStyle = LAB.heat((B.probs[j][i] / pmax) * 0.95);
      ctx.fillRect(x, y, Math.ceil(cw) + 0.5, Math.ceil(ch) + 0.5);
      if (Rt.picks[j].includes(i)) {
        if (cw > 18) { ctx.strokeStyle = C.amber; ctx.lineWidth = 3; ctx.strokeRect(x + 2.5, y + 2.5, cw - 5, ch - 5); }
        else { ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(x + cw / 2, y + ch / 2, Math.max(1.4, Math.min(cw, ch) * 0.32), 0, 7); ctx.fill(); }
      }
      if (cw > 40) { ctx.fillStyle = B.probs[j][i] / pmax > 0.55 ? '#fff' : C.ink; ctx.font = '600 13px Avenir Next, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(B.probs[j][i].toFixed(2), x + cw / 2, y + ch / 2); }
    }
    const xs = l + st.sel * cw;
    ctx.strokeStyle = C.navy; ctx.lineWidth = 2; ctx.strokeRect(xs, t, cw, E * ch);
    ctx.fillStyle = C.slate; ctx.font = '11px Avenir Next, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const stepE = ch < 12 ? 2 : 1;
    for (let i = 0; i < E; i += stepE) ctx.fillText('E' + (i + 1), l - 5, t + (i + 0.5) * ch);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const stepT = Math.max(1, Math.ceil(T / 8));
    for (let j = 0; j < T; j += stepT) ctx.fillText(T <= 8 ? '词元 ' + (j + 1) : String(j + 1), l + (j + 0.5) * cw, t + E * ch + 5);
  });
  pointer('#m-grid', { down: pick, move: pick });
  function pick(x) { const g = gridCv._geo; if (!g) return; const j = Math.floor((x - g.l) / g.cw); if (j >= 0 && j < g.T && j !== st.sel) { st.sel = j; draw1(); } }
  const loadCv = LAB.canvas('#m-load', (ctx, w, h) => {
    if (!Rt) return;
    const E = Rt.E, ymax = Math.max(Math.max(...Rt.f), Math.max(...Rt.P), 1.6 / E) * 1.12;
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.4, xmax: E + 0.6, ymin: 0, ymax, xtickValues: M.range(E).map((i) => i + 1), xfmt: (v) => 'E' + v, ylabel: '比例', pad: { l: 44, r: 10, t: 12, b: 30 } }).axes();
    const bw = Math.min(16, (P.tx(2) - P.tx(1)) * 0.36);
    const dx = P.ix(P.tx(1) + bw * 0.55) - 1;
    P.bars(M.range(E).map((i) => i + 1 - dx), Rt.f, C.c2, bw);
    P.bars(M.range(E).map((i) => i + 1 + dx), Rt.P, C.c1, bw);
    P.hline(1 / E, C.slate, [5, 4], 1.2);
  });
  const histCv = LAB.canvas('#m-hist', (ctx, w, h) => {
    const H = st.hist, n = Math.max(20, H.length);
    const ymax = Math.max(2, ...H.map((v) => Math.max(v.load, v.L))) * 1.08;
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: n, ymin: 0.8, ymax, xlabel: '偏置更新步数', pad: { l: 40, r: 10, t: 12, b: 36 } }).axes();
    P.hline(1, C.slate, [4, 4]);
    if (H.length) {
      const xs = H.map((_, i) => i + 1);
      P.line(xs, H.map((v) => v.load), C.c4, 2.2); P.line(xs, H.map((v) => v.L), C.c5, 2.2);
    } else P.text(n / 2, (0.8 + ymax) / 2, '点“自动更新偏置”开始', C.slate, 'center');
  });
  const m1 = LAB.stat('#m-stats', '$\\mathcal L_{\\text{aux}}=E\\sum_i f_iP_i$', 'coral');
  const m2 = LAB.stat('#m-stats', '理想最小值', 'leaf');
  const m3 = LAB.stat('#m-stats', '最大负载 / 平均负载', 'amber');
  const m4 = LAB.stat('#m-stats', '一单没接的专家', 'plum');
  function draw1() {
    m1.set(Rt.L.toFixed(3)); m2.set('1'); m3.set(Rt.maxLoad.toFixed(2) + '<small>×</small>'); m4.set(Rt.idle + '<small>/ ' + Rt.E + '</small>');
    const t = st.sel, p = B.probs[t], idx = Rt.picks[t], g = Rt.gates[t];
    const biasTxt = st.bias.some((b) => b !== 0) ? `；当前偏置 $b=(${st.bias.map((b) => b.toFixed(2)).join(',\\,')})$` : '';
    $('#m-token').innerHTML = `词元 ${t + 1}：选中 ${idx.map((i) => 'E' + (i + 1)).join('、')}，门控权重 ` + LAB.tex(idx.map((i, q) => `g_{${t + 1},${i + 1}}=\\tfrac{${p[i].toFixed(2)}}{${M.sum(idx.map((j) => p[j])).toFixed(2)}}=${g[q].toFixed(3)}`).join(',\\;')) + biasTxt;
    LAB.renderMath($('#m-token'));
    let rows = `<tr><th>专家 $i$</th><th>接单数 $c_i$</th><th>$f_i=c_i/(Tk)$</th><th>$P_i$</th><th>$f_i\\cdot P_i$</th><th>对 $P_i$ 的惩罚系数 $Ef_i$</th></tr>`;
    for (let i = 0; i < Rt.E; i++) rows += `<tr><td>E${i + 1}</td><td>${Rt.counts[i]}</td><td>${Rt.f[i].toFixed(3)}</td><td>${Rt.P[i].toFixed(3)}</td><td>${(Rt.f[i] * Rt.P[i]).toFixed(4)}</td><td>${(Rt.E * Rt.f[i]).toFixed(2)}</td></tr>`;
    const sfp = M.sum(Rt.f.map((v, i) => v * Rt.P[i]));
    rows += `<tr><td><b>合计</b></td><td>${Rt.T * Rt.k}</td><td>${M.sum(Rt.f).toFixed(2)}</td><td>${M.sum(Rt.P).toFixed(2)}</td><td>${sfp.toFixed(4)}</td><td>$\\mathcal L_{\\text{aux}}=${Rt.E}\\times${sfp.toFixed(4)}=${Rt.L.toFixed(3)}$</td></tr>`;
    $('#m-table').innerHTML = rows; LAB.renderMath($('#m-table'));
    gridCv.redraw(); loadCv.redraw(); histCv.redraw();
  }
  refresh1();

  // 2 位医生的拥堵罚款 L = 2(P1^2 + (1-P1)^2)（书中 8.2 节）
  const stP = { P1: 0.9 };
  LAB.slider('#p-P1', { label: '1 号医生的份额 $P_1=f_1$', min: 0, max: 1, step: 0.01, value: stP.P1, fmt: (v) => v.toFixed(2), onInput: (v) => { stP.P1 = v; updP(); } });
  const Lp = (p) => 2 * (p * p + (1 - p) * (1 - p));
  const pPlot = LAB.canvas('#p-plot', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: 0.8, ymax: 2.1, xtickValues: [0, 0.1, 0.5, 0.9, 1], ytickValues: [1, 1.64, 2], xlabel: 'P₁', pad: { l: 44, r: 12, t: 12, b: 36 } }).axes();
    P.hline(1, C.slate, [4, 4], 1);
    P.fn(Lp, C.c5, 2.6);
    P.points([0.5], [1], C.c3, 4.5, '#fff'); P.points([0.9, 0.1], [1.64, 1.64], C.c2, 4.5, '#fff'); P.points([0, 1], [2, 2], C.c4, 4.5, '#fff');
    P.points([stP.P1], [Lp(stP.P1)], C.navy, 6, '#fff');
  });
  function updP() {
    const p = stP.P1;
    $('#p-formula').innerHTML = LAB.tex(`\\mathcal L_{\\text{aux}}=2\\times(${p.toFixed(2)}^2+${(1 - p).toFixed(2)}^2)=${Lp(p).toFixed(2)}`, true);
    pPlot.redraw();
  }
  updP();

  /* ================= 实验 2：SSM 选择性记忆 ================= */
  const TT = 96;
  const S = { mode: 1, dfix: 0.15, dlow: 0.003, dhigh: 3, N: 4, tstar: TT - 1, spikes: {}, noise: [] };
  const DEFAULT_SPIKES = { 10: 1.0, 38: -0.8, 66: 0.9 };
  { const R = LAB.rng(21); S.noise = M.range(TT).map(() => M.clamp(R.normal() * 0.05, -0.12, 0.12)); }
  S.spikes = Object.assign({}, DEFAULT_SPIKES);
  const xAt = (t) => (S.spikes[t] != null ? S.spikes[t] : S.noise[t]);
  const sigm = (z) => 1 / (1 + Math.exp(-z));
  const deltaAt = (x) => (S.mode === 0 ? S.dfix : S.dlow + (S.dhigh - S.dlow) * sigm(50 * (Math.abs(x) - 0.25)));
  let SR = null;
  function runSSM() {
    const N = S.N, a = M.range(N).map((n) => n + 1), Cn = a.map((v) => v / N);
    const xs = M.range(TT).map(xAt), ds = xs.map(deltaAt);
    const Ab = ds.map((d) => a.map((an) => Math.exp(-d * an))), Bb = Ab.map((row) => row.map((ab, n) => (1 - ab) / a[n]));
    const h = M.range(N).map(() => 0), H = M.range(N).map(() => []), y = [];
    for (let t = 0; t < TT; t++) { let yt = 0; for (let n = 0; n < N; n++) { h[n] = Ab[t][n] * h[n] + Bb[t][n] * xs[t]; H[n].push(h[n]); yt += Cn[n] * h[n]; } y.push(yt); }
    // 半可分矩阵第 t* 行
    const ts = S.tstar, wts = new Array(ts + 1).fill(0);
    for (let n = 0; n < N; n++) { let prod = 1; for (let j = ts; j >= 0; j--) { wts[j] += Cn[n] * prod * Bb[j][n]; prod *= Ab[j][n]; } }
    SR = { xs, ds, H, y, wts, a, Cn };
  }
  LAB.segmented('#s-mode', ['固定 $\\Delta$（S4）', '选择性 $\\Delta_t$（Mamba）'], S.mode, (i) => { S.mode = i; showModeCtrls(); upd2(); });
  const sDf = LAB.slider('#s-dfix', { label: '固定步长 $\\Delta$', min: -3, max: 0.5, step: 0.01, value: Math.log10(S.dfix), fmt: (v) => fe(Math.pow(10, v)), onInput: (v) => { S.dfix = Math.pow(10, v); upd2(); } });
  const sDl = LAB.slider('#s-dlow', { label: '废话词的 $\\Delta$', min: -3.5, max: -0.3, step: 0.01, value: Math.log10(S.dlow), fmt: (v) => fe(Math.pow(10, v)), onInput: (v) => { S.dlow = Math.pow(10, v); upd2(); } });
  const sDh = LAB.slider('#s-dhigh', { label: '关键词的 $\\Delta$', min: -1, max: 1, step: 0.01, value: Math.log10(S.dhigh), fmt: (v) => fe(Math.pow(10, v)), hint: '$\\Delta_t=\\Delta_{\\text{低}}+(\\Delta_{\\text{高}}-\\Delta_{\\text{低}})\\,\\sigma\\big(50(|x_t|-0.25)\\big)$', onInput: (v) => { S.dhigh = Math.pow(10, v); upd2(); } });
  LAB.slider('#s-N', { label: '状态维 $N$', min: 1, max: 8, step: 1, value: S.N, onInput: (v) => { S.N = v; upd2(); } });
  const sTs = LAB.slider('#s-tstar', { label: '观察时刻 $t^*$', min: 1, max: TT - 1, step: 1, value: S.tstar, onInput: (v) => { S.tstar = v; upd2(); } });
  function showModeCtrls() { sDf.el.style.display = S.mode === 0 ? '' : 'none'; sDl.el.style.display = sDh.el.style.display = S.mode === 1 ? '' : 'none'; }
  showModeCtrls();
  $('#s-reset').onclick = () => { S.spikes = Object.assign({}, DEFAULT_SPIKES); upd2(); };
  $('#s-clear').onclick = () => { S.spikes = {}; upd2(); };
  const inCv = LAB.canvas('#s-input', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -1, xmax: TT, ymin: -1.3, ymax: 1.3, yticks: 4, xlabel: '时间步 t', pad: { l: 40, r: 44, t: 12, b: 36 } }).axes();
    inCv._P = P;
    // Δ 的对数右轴：1e-4 … 10
    const lo = -4, hi = 1, dy = (d) => P.y0 - ((Math.log10(d) - lo) / (hi - lo)) * (P.y0 - P.y1);
    ctx.save(); ctx.fillStyle = 'rgba(26,140,140,.12)'; ctx.strokeStyle = 'rgba(26,140,140,.7)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(P.tx(-0.5), P.y0);
    SR.ds.forEach((d, t) => { ctx.lineTo(P.tx(t - 0.5), dy(d)); ctx.lineTo(P.tx(t + 0.5), dy(d)); });
    ctx.lineTo(P.tx(TT - 0.5), P.y0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); SR.ds.forEach((d, t) => { if (t === 0) ctx.moveTo(P.tx(t - 0.5), dy(d)); else ctx.lineTo(P.tx(t - 0.5), dy(d)); ctx.lineTo(P.tx(t + 0.5), dy(d)); }); ctx.stroke();
    ctx.fillStyle = C.c6; ctx.font = '11px Avenir Next, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    [1e-4, 1e-3, 1e-2, 0.1, 1, 10].forEach((d) => ctx.fillText(d >= 1 ? String(d) : '10' + sup(Math.round(Math.log10(d))), P.x1 + 6, dy(d)));
    ctx.restore();
    P.hline(0, '#9aa5b1', null, 1);
    const bw = Math.max(1.5, (P.tx(1) - P.tx(0)) * 0.6);
    SR.xs.forEach((x, t) => { const key = S.spikes[t] != null; P.bars([t], [x], key ? C.c2 : '#b8c4d2', key ? Math.max(bw, 4) : bw); });
    P.vline(S.tstar, C.c5, [3, 3], 1.2);
  });
  pointer('#s-input', {
    down: (px, py) => {
      const P = inCv._P; if (!P) return;
      const t = Math.round(P.ix(px)), v = P.iy(py);
      if (t < 0 || t >= TT) return;
      if (Math.abs(v) < 0.3) { delete S.spikes[t]; delete S.spikes[t - 1]; delete S.spikes[t + 1]; }
      else S.spikes[t] = M.clamp(v, -1.2, 1.2);
      upd2();
    },
  });
  const stCv = LAB.canvas('#s-state', (ctx, w, h) => {
    const all = SR.H.flat().concat(SR.y), m = Math.max(0.3, ...all.map(Math.abs)) * 1.12;
    const P = new LAB.Plot(ctx, w, h, { xmin: -1, xmax: TT, ymin: -m, ymax: m, yticks: 4, xlabel: '时间步 t', pad: { l: 40, r: 44, t: 12, b: 36 } }).axes();
    const ts = M.range(TT);
    P.hline(0, '#9aa5b1', null, 1);
    Object.keys(S.spikes).forEach((t) => P.vline(+t, 'rgba(224,154,45,.35)', null, 6));
    SR.H.forEach((hn, n) => P.line(ts, hn, LAB.SERIES[(n + 2) % 6], 1.2, [3, 2]));
    P.line(ts, SR.y, C.navy, 2.6);
    P.vline(S.tstar, C.c5, [3, 3], 1.2);
    P.points([S.tstar], [SR.y[S.tstar]], C.c5, 4.5, '#fff');
  });
  const kCv = LAB.canvas('#s-kernel', (ctx, w, h) => {
    const ts = S.tstar, wv = SR.wts, m = Math.max(1e-3, ...wv) * 1.12;
    const P = new LAB.Plot(ctx, w, h, { xmin: -1, xmax: TT, ymin: 0, ymax: m, yticks: 4, xlabel: '历史位置 j', ylabel: '权重 w(t*, j)', pad: { l: 52, r: 44, t: 12, b: 36 } }).axes();
    const bw = Math.max(1.5, (P.tx(1) - P.tx(0)) * 0.7);
    P.bars(M.range(ts + 1), wv, M.range(ts + 1).map((j) => (S.spikes[j] != null ? C.c2 : C.c1)), bw);
    P.vline(ts, C.c5, [3, 3], 1.2);
    P.text(ts, m * 0.95, ' t*', C.c5, 'left', 'top', '600 12px Avenir Next, sans-serif');
  });
  const s1 = LAB.stat('#s-stats', '废话词处 $\\bar a_1=e^{-\\Delta}$', 'teal');
  const s2 = LAB.stat('#s-stats', '关键词处 $\\bar a_1$', 'amber');
  const s3 = LAB.stat('#s-stats', '通道 1 记忆半衰期', 'plum');
  const s4 = LAB.stat('#s-stats', '$y_{t^*}$ / 最近关键词', 'coral');
  function upd2() {
    runSSM();
    const dl = S.mode === 0 ? S.dfix : deltaAt(0.03), dh = S.mode === 0 ? S.dfix : deltaAt(1);
    s1.set(Math.exp(-dl).toFixed(4)); s2.set(Math.exp(-dh).toFixed(4));
    const hl = Math.LN2 / dl; s3.set((hl >= 1e4 ? fe(hl) : hl.toFixed(hl < 10 ? 1 : 0)) + '<small>步</small>');
    const keys = Object.keys(S.spikes).map(Number).filter((t) => t <= S.tstar).sort((a, b) => a - b);
    if (keys.length) { const kv = S.spikes[keys[keys.length - 1]]; s4.set((SR.y[S.tstar] / kv * 100).toFixed(1) + '<small>%</small>'); } else s4.set('–');
    const L = $('#s-state-legend');
    L.innerHTML = `<span><i style="background:var(--navy)"></i>输出 $y_t$</span>` + SR.a.map((a, n) => `<span><i style="background:${LAB.SERIES[(n + 2) % 6]};height:2px"></i>$h_{${n + 1}}$（$a_{${n + 1}}=${a}$）</span>`).join('');
    LAB.renderMath(L);
    inCv.redraw(); stCv.redraw(); kCv.redraw();
  }
  upd2();

  // 书中 4 词算例：x=(5,100,-80,2)，Mamba (a_t,b_t)=(0.2,1),(1,0),(1,0),(0.8,1)；对照固定系数 (a,b)
  const BK = { xs: [5, 100, -80, 2], words: ['密码', '嗡嗡', '咔嚓', '解锁'], as: [0.2, 1, 1, 0.8], bs: [1, 0, 0, 1], a: 0.8, b: 1 };
  LAB.slider('#b-a', { label: '固定保留系数 $a$', min: 0, max: 1, step: 0.01, value: BK.a, fmt: (v) => v.toFixed(2), onInput: (v) => { BK.a = v; updB(); } });
  LAB.slider('#b-b', { label: '固定写入系数 $b$', min: 0, max: 1, step: 0.01, value: BK.b, fmt: (v) => v.toFixed(2), onInput: (v) => { BK.b = v; updB(); } });
  const runRec = (as, bs) => { let hh = 0; return BK.xs.map((x, t) => (hh = as[t] * hh + bs[t] * x)); };
  let BR = null;
  const bPlot = LAB.canvas('#b-plot', (ctx, w, h) => {
    if (!BR) return;
    const all = BR.sel.concat(BR.fix), m = Math.max(8, ...all.map(Math.abs)) * 1.12;
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 4, ymin: -m, ymax: m, xtickValues: [0, 1, 2, 3, 4], xlabel: '步 t', pad: { l: 44, r: 12, t: 12, b: 36 } }).axes();
    P.hline(0, '#9aa5b1', null, 1);
    const ts = [0, 1, 2, 3, 4];
    P.line(ts, [0].concat(BR.fix), C.c4, 2.2); P.points(ts, [0].concat(BR.fix), C.c4, 4, '#fff');
    P.line(ts, [0].concat(BR.sel), C.c3, 2.6); P.points(ts, [0].concat(BR.sel), C.c3, 4.5, '#fff');
  });
  function updB() {
    BR = { sel: runRec(BK.as, BK.bs), fix: runRec(BK.xs.map(() => BK.a), BK.xs.map(() => BK.b)) };
    const n = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(2));
    let rows = `<tr><th></th>${BK.words.map((wd, t) => `<th>${wd} $x_${t + 1}=${BK.xs[t]}$</th>`).join('')}</tr>`;
    rows += `<tr><td>Mamba：$(a_t,b_t)$</td>${BK.as.map((a, t) => `<td>$(${a},\\ ${BK.bs[t]})$</td>`).join('')}</tr>`;
    rows += `<tr><td><b>Mamba：$h_t$</b></td>${BR.sel.map((v) => `<td><b>$${n(v)}$</b></td>`).join('')}</tr>`;
    rows += `<tr><td>固定 $(a,b)=(${BK.a.toFixed(2)},\\ ${BK.b.toFixed(2)})$：$h_t$</td>${BR.fix.map((v) => `<td>$${n(v)}$</td>`).join('')}</tr>`;
    rows += `<tr><td>“密码”留在 $h_4$ 里的份额</td><td colspan="2">Mamba：$1\\times1\\times0.8\\times5=${(0.8 * 5).toFixed(2)}$</td><td colspan="2">固定：$a^3b\\times5=${(Math.pow(BK.a, 3) * BK.b * 5).toFixed(2)}$</td></tr>`;
    $('#b-table').innerHTML = rows; LAB.renderMath($('#b-table'));
    bPlot.redraw();
  }
  updB();

  /* ================= 实验 3：复杂度墙与激活参数 ================= */
  const W = { lt: 17, d: 4096, lw: 12, N: 16, preset: 0, E: 256, k: 8 };
  const PRESETS = [
    { name: 'DeepSeek-V3', V: 129280, d: 7168, L: 61, dense: 3, dffDense: 18432, dff: 2048, E: 256, k: 8, shared: 1, attn: 7168 * 1536 + 1536 * 24576 + 7168 * 576 + 512 * 32768 + 16384 * 7168 + 1536 + 512, tied: false },
    { name: 'Mixtral 8×7B', V: 32000, d: 4096, L: 32, dense: 0, dffDense: 0, dff: 14336, E: 8, k: 2, shared: 0, attn: 4096 * (4096 + 1024 + 1024) + 4096 * 4096, tied: false },
  ];
  const fmtT = (v) => { const t = Math.pow(2, v); return t >= 1048576 ? (t / 1048576).toFixed(2).replace(/\.?0+$/, '') + 'M' : Math.round(t / 1024) + 'K'; };
  LAB.slider('#w-T', { label: '序列长度 $T$', min: 10, max: 20, step: 0.5, value: W.lt, fmt: fmtT, onInput: (v) => { W.lt = v; upd3(); } });
  LAB.segmented('#w-d', ['1024', '4096', '8192'], 1, (i) => { W.d = [1024, 4096, 8192][i]; upd3(); });
  LAB.slider('#w-W', { label: '滑动窗口 $W$', min: 9, max: 15, step: 0.5, value: W.lw, fmt: (v) => Math.round(Math.pow(2, v)).toLocaleString(), onInput: (v) => { W.lw = v; upd3(); } });
  LAB.segmented('#w-N', ['16', '64', '128'], 0, (i) => { W.N = [16, 64, 128][i]; upd3(); });
  const sEw = LAB.slider('#w-E', { label: '每层路由专家数 $E$', min: 2, max: 256, step: 1, value: W.E, onInput: (v) => { W.E = v; sKw.setRange(1, Math.min(16, v)); if (W.k > v) { W.k = v; sKw.set(v); } upd3(); } });
  const sKw = LAB.slider('#w-k', { label: '每个词元激活 Top-$k$', min: 1, max: 16, step: 1, value: W.k, onInput: (v) => { W.k = Math.min(v, W.E); upd3(); } });
  LAB.segmented('#w-preset', PRESETS.map((p) => p.name), 0, (i) => { W.preset = i; W.E = PRESETS[i].E; W.k = PRESETS[i].k; sEw.set(W.E); sKw.setRange(1, Math.min(16, W.E)); sKw.set(W.k); upd3(); });
  const cost = {
    attn: (T, d) => 4 * T * T * d,
    win: (T, d, w) => 4 * T * Math.min(T, w) * d,
    ssm: (T, d, N) => 6 * T * N * d,
    proj: (T, d) => 8 * T * d * d,
  };
  const mem = { attn: (T, d) => 2 * T * d * 2, win: (T, d, w) => 2 * Math.min(T, w) * d * 2, ssm: (T, d, N) => N * d * 2 };
  function loglog(ctx, w, h, fns, yfmt, mark) {
    const T0 = 1e3, T1 = 1.1e6, Ts = M.range(121).map((i) => T0 * Math.pow(T1 / T0, i / 120));
    let lo = Infinity, hi = -Infinity;
    fns.forEach(([f]) => Ts.forEach((t) => { const v = f(t); lo = Math.min(lo, v); hi = Math.max(hi, v); }));
    const e0 = Math.floor(Math.log10(lo)), e1 = Math.ceil(Math.log10(hi)), step = Math.max(1, Math.ceil((e1 - e0) / 6));
    const yt = []; for (let e = e0; e <= e1; e += step) yt.push(Math.pow(10, e));
    const P = new LAB.Plot(ctx, w, h, { xmin: T0, xmax: T1, ymin: Math.pow(10, e0), ymax: Math.pow(10, e1), logx: true, logy: true, ytickValues: yt, yfmt, xtickValues: [1e3, 1e4, 1e5, 1e6], xfmt: (v) => (v >= 1e6 ? '1M' : v / 1e3 + 'K'), xlabel: '序列长度 T', pad: { l: 58, r: 12, t: 12, b: 36 } }).axes();
    P.clip();
    fns.forEach(([f, col, wd, dash]) => P.line(Ts, Ts.map(f), col, wd, dash));
    P.unclip();
    const T = Math.pow(2, W.lt);
    P.vline(T, C.slate, [3, 3]);
    fns.forEach(([f, col, , dash]) => { if (!dash) P.points([T], [f(T)], col, 4.5, '#fff'); });
    return P;
  }
  const flCv = LAB.canvas('#w-flops', (ctx, w, h) => {
    const d = W.d, wd = Math.pow(2, W.lw);
    loglog(ctx, w, h, [[(T) => cost.proj(T, d), C.slate, 1.4, [5, 4]], [(T) => cost.attn(T, d), C.c4, 2.4], [(T) => cost.win(T, d, wd), C.c2, 2.2], [(T) => cost.ssm(T, d, W.N), C.c6, 2.4]], null);
  });
  const memCv = LAB.canvas('#w-mem', (ctx, w, h) => {
    const d = W.d, wd = Math.pow(2, W.lw);
    loglog(ctx, w, h, [[(T) => mem.attn(T, d), C.c4, 2.4], [(T) => mem.win(T, d, wd), C.c2, 2.2], [(T) => mem.ssm(T, d, W.N), C.c6, 2.4]], (v) => bytes(v).replace(' ', ''));
  });
  const w1 = LAB.stat('#w-stats', '注意力打分 FLOPs / 层', 'coral');
  const w2 = LAB.stat('#w-stats', 'SSM 扫描 FLOPs / 层', 'teal');
  const w3 = LAB.stat('#w-stats', '注意力 / SSM', 'plum');
  const w4 = LAB.stat('#w-stats', 'KV 缓存 / 层', 'coral');
  const w5 = LAB.stat('#w-stats', 'SSM 状态 / 层', 'teal');
  function moeParams() {
    const p = PRESETS[W.preset], E = W.E, k = Math.min(W.k, E), moeL = p.L - p.dense;
    const exp = 3 * p.d * p.dff, emb = p.V * p.d * (p.tied ? 1 : 2);
    const parts = [
      ['嵌入与输出头', emb, emb, C.slate],
      ['注意力', p.L * p.attn, p.L * p.attn, C.c1],
      ['稠密 FFN 层', p.dense * 3 * p.d * p.dffDense, p.dense * 3 * p.d * p.dffDense, C.c3],
      ['路由器', moeL * E * p.d, moeL * E * p.d, C.c6],
      ['共享专家', moeL * p.shared * exp, moeL * p.shared * exp, C.c5],
      ['路由专家', moeL * E * exp, moeL * k * exp, C.c2],
    ];
    return { parts, total: M.sum(parts.map((q) => q[1])), active: M.sum(parts.map((q) => q[2])) };
  }
  const moeCv = LAB.canvas('#w-moe', (ctx, w, h) => {
    const mp = moeParams(), narrow = w < 480, l = narrow ? 8 : 128, r = 12, rowH = narrow ? 26 : 34;
    const top = narrow ? 18 : 8, gap = (h - top - 3 * rowH - 10) / 3;
    const rows = [['总参数', 1, mp.total], ['激活参数（同比例）', 2, mp.total], ['激活参数（放大）', 2, mp.active]];
    rows.forEach(([name, col, scale], q) => {
      const y = top + q * (rowH + gap), W0 = w - l - r, tot = col === 1 ? mp.total : mp.active;
      ctx.textBaseline = 'middle';
      if (narrow) {
        ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = '12px PingFang SC, sans-serif'; ctx.fillText(name, l, y - 10);
        const tw = ctx.measureText(name).width; ctx.fillStyle = C.navy; ctx.font = '600 12.5px Avenir Next, sans-serif'; ctx.fillText(M.big(tot), l + tw + 8, y - 10);
      } else {
        ctx.textAlign = 'right';
        ctx.fillStyle = C.ink; ctx.font = '12px PingFang SC, sans-serif'; ctx.fillText(name, l - 10, y + rowH / 2 - 8);
        ctx.fillStyle = C.navy; ctx.font = '600 12.5px Avenir Next, sans-serif'; ctx.fillText(M.big(tot), l - 10, y + rowH / 2 + 9);
      }
      let x = l;
      mp.parts.forEach((pt) => { const v = pt[col], ww = (v / scale) * W0; if (ww <= 0) return; ctx.fillStyle = pt[3]; ctx.fillRect(x, y, Math.max(ww, 0.8), rowH); if (ww > 46) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '600 11.5px Avenir Next, sans-serif'; ctx.fillText(M.big(v), x + ww / 2, y + rowH / 2); } x += ww; });
    });
  });
  const v1 = LAB.stat('#w-stats2', '总参数', 'plum');
  const v2 = LAB.stat('#w-stats2', '每词元激活参数', 'teal');
  const v3 = LAB.stat('#w-stats2', '激活比例', 'amber');
  const v4 = LAB.stat('#w-stats2', '每词元 FLOPs $\\approx 2N_{\\text{act}}$', 'coral');
  function upd3() {
    const T = Math.pow(2, W.lt), d = W.d;
    const a = cost.attn(T, d), s = cost.ssm(T, d, W.N);
    w1.set(fe(a)); w2.set(fe(s)); w3.set(fe(a / s) + '<small>×</small>'); w4.set(bytes(mem.attn(T, d))); w5.set(bytes(mem.ssm(T, d, W.N)));
    const mp = moeParams();
    v1.set(M.big(mp.total)); v2.set(M.big(mp.active)); v3.set((100 * mp.active / mp.total).toFixed(1) + '<small>%</small>'); v4.set(fe(2 * mp.active));
    $('#w-moe-legend').innerHTML = mp.parts.filter((q) => q[1] > 0).map((q) => `<span><i style="background:${q[3]}"></i>${q[0]}</span>`).join('');
    flCv.redraw(); memCv.redraw(); moeCv.redraw();
  }
  upd3();
})();
