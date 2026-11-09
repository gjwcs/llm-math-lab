/* 第 2 章：高维空间的几何学 · 交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §2.3 内积与余弦 · §2.4 正交祝福 · §2.5 JL 引理 · §2.6 手算算例' });
  // 窄屏下长公式与宽表格改为横向滚动，不撑破版面
  document.querySelectorAll('.formula, [style*="overflow-x"]').forEach((f) => { f.style.width = '0'; f.style.minWidth = '100%'; });
  const FONT = getComputedStyle(document.body).getPropertyValue('--font');
  const NUMF = getComputedStyle(document.body).getPropertyValue('--font-num');

  // ---------- 小工具 ----------
  function lgamma(x) {
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1; let a = c[0]; const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  // 单位球面上随机两向量内积 t 的精确密度 C_d (1-t^2)^{(d-3)/2}
  const logCd = (d) => lgamma(d / 2) - 0.5 * Math.log(Math.PI) - lgamma((d - 1) / 2);
  const exactPdf = (d, t) => (Math.abs(t) >= 1 ? (d < 3 ? Infinity : d === 3 ? 0.5 : 0) : Math.exp(logCd(d) + (d - 3) / 2 * Math.log(1 - t * t)));
  // P(|t| >= eps) = 2 C_d ∫_{asin eps}^{π/2} cos^{d-2}φ dφ （非均匀网格 + 对数域 Simpson）
  function exactTail(d, eps) {
    if (eps <= 0) return 1; if (eps >= 1) return 0;
    const p0 = Math.asin(eps), span = Math.PI / 2 - p0, K = 1200, lg = new Float64Array(K + 1);
    let mx = -Infinity;
    for (let k = 0; k <= K; k++) {
      const u = k / K, phi = p0 + span * u * u, c = Math.max(Math.cos(phi), 1e-300);
      lg[k] = (d === 2 ? 0 : (d - 2) * Math.log(c)) + Math.log(Math.max(2 * span * u, 1e-300));
      if (lg[k] > mx) mx = lg[k];
    }
    let s = 0;
    for (let k = 0; k <= K; k++) s += (k === 0 || k === K ? 1 : k % 2 ? 4 : 2) * Math.exp(lg[k] - mx);
    s *= 1 / (3 * K);
    return Math.min(1, Math.exp(Math.log(2) + logCd(d) + mx + Math.log(s)));
  }
  const gauss = (x, s) => Math.exp(-x * x / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
  function histogram(vals, lo, hi, nb) {
    const h = new Float64Array(nb), bw = (hi - lo) / nb; let n = 0;
    for (const v of vals) { const k = Math.floor((v - lo) / bw); if (k >= 0 && k < nb) h[k]++; n++; }
    for (let k = 0; k < nb; k++) h[k] /= Math.max(1, n) * bw;
    return { h, bw, lo };
  }
  function drawHist(P, H, color, alpha) {
    const c = P.ctx; c.save(); c.fillStyle = color; c.globalAlpha = alpha == null ? 0.55 : alpha;
    for (let k = 0; k < H.h.length; k++) {
      if (!H.h[k]) continue;
      const x0 = P.tx(H.lo + k * H.bw), x1 = P.tx(H.lo + (k + 1) * H.bw), y = P.ty(Math.min(H.h[k], P.o.ymax));
      c.fillRect(x0 + 0.3, y, Math.max(0.8, x1 - x0 - 0.6), P.y0 - y);
    }
    c.restore();
  }
  function schedule(fn) { let pending = false; return () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; fn(); }); }; }
  function pointer(cv, h) {
    cv.style.touchAction = 'none';
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let active = false;
    cv.addEventListener('pointerdown', (e) => { if (h.down && h.down(pos(e)) !== false) { active = true; cv.setPointerCapture(e.pointerId); e.preventDefault(); } });
    cv.addEventListener('pointermove', (e) => { if (active) h.move && h.move(pos(e)); else h.hover && h.hover(pos(e)); });
    const end = () => { if (active) { active = false; h.up && h.up(); } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }
  const DLIST = [2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096];

  /* ================= 实验 1：正交祝福 ================= */
  let seed1 = 11, mode = 0, zoom = false;
  const sD = LAB.slider('#o-d', { label: '维度 $d$', min: 0, max: DLIST.length - 1, step: 1, value: DLIST.indexOf(256), fmt: (i) => DLIST[i], hint: '对数刻度：2, 3, 4, … 4096', onInput: () => run1() });
  const sN = LAB.slider('#o-n', { label: '向量个数 $N$', min: 20, max: 200, step: 10, value: 100, fmt: (v) => `${v}（${(v * (v - 1) / 2).toLocaleString()} 对）`, onInput: () => run1() });
  const sE = LAB.slider('#o-eps', { label: '正交容忍度 $\\varepsilon$', min: 0.01, max: 0.5, step: 0.01, value: 0.1, fmt: (v) => `${v.toFixed(2)}（${(Math.acos(v) * 180 / Math.PI).toFixed(1)}°～${(180 - Math.acos(v) * 180 / Math.PI).toFixed(1)}°）`, onInput: () => { stats1(); tail.redraw(); } });
  LAB.segmented('#o-mode', ['单位向量 $\\cos\\theta$', '未归一化 $\\mathbf x^\\top\\mathbf y$'], 0, (i) => { mode = i; setLabels(); run1(); stdc.redraw(); });
  LAB.checkbox('#o-zoom', '横轴自适应（$\\pm4.5$ 个理论标准差）', false, (v) => { zoom = v; hist.redraw(); });
  document.querySelector('#o-resample').onclick = () => { seed1++; run1(); };
  const st1 = [LAB.stat('#o-stats', '', 'teal'), LAB.stat('#o-stats', '', 'amber'), LAB.stat('#o-stats', '', 'plum'), LAB.stat('#o-stats', '', 'coral')];
  function setLabels() {
    const L = mode === 0
      ? ['实测标准差（理论 $1/\\sqrt d$）', '平均 $|\\cos\\theta|$', '$|\\cos\\theta|&lt;\\varepsilon$ 的比例', '95% 的夹角落在']
      : ['实测标准差（理论 $\\sqrt d$）', '平均 $|\\mathbf x^\\top\\mathbf y|$', '最大 $|\\mathbf x^\\top\\mathbf y|$', '平均模长 $\\|\\mathbf x\\|$（理论 $\\approx\\sqrt d$）'];
    st1.forEach((s, i) => { const l = s.el.querySelector('.label'); l.innerHTML = L[i]; LAB.renderMath(l); });
    document.querySelector('#o-lg1').style.display = document.querySelector('#o-lg2').style.display = mode === 0 ? '' : 'none';
    document.querySelector('#o-lg3').style.display = mode === 0 ? 'none' : '';
    const t = document.querySelector('#o-title');
    t.innerHTML = mode === 0 ? '两两夹角余弦 $\\cos\\theta$ 的分布' : '未归一化内积 $\\mathbf x^\\top\\mathbf y$ 的分布（$x_k,y_k\\sim\\mathcal N(0,1)$）';
    LAB.renderMath(t);
  }
  setLabels();

  let vals = new Float64Array(0), curD = 256, meanNorm = 0;
  // 生成 N 个 d 维高斯向量，返回所有点对的内积（normalize 时为夹角余弦）
  function sampleDots(d, N, seed, normalize) {
    const R = LAB.rng(seed * 7919 + d), X = new Float64Array(N * d), nr = new Float64Array(N);
    for (let i = 0; i < N; i++) { let s = 0; for (let k = 0; k < d; k++) { const z = R.normal(); X[i * d + k] = z; s += z * z; } nr[i] = Math.sqrt(s); }
    const raw = new Float64Array(N * (N - 1) / 2), cos = new Float64Array(raw.length); let p = 0;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      let s = 0; const a = i * d, b = j * d; for (let k = 0; k < d; k++) s += X[a + k] * X[b + k];
      raw[p] = s; cos[p++] = s / (nr[i] * nr[j]);
    }
    return { out: normalize ? cos : raw, raw, cos, meanNorm: M.mean(Array.from(nr)) };
  }
  const run1 = schedule(() => {
    curD = DLIST[sD.get()];
    const r = sampleDots(curD, sN.get(), seed1, mode === 0);
    vals = r.out; meanNorm = r.meanNorm;
    document.querySelector('#o-pairs').textContent = `${vals.length.toLocaleString()} 对 · d = ${curD}`;
    stats1(); hist.redraw(); stdc.redraw(); tail.redraw();
  });
  function stats1() {
    const d = curD, n = vals.length; if (!n) return;
    let s2 = 0, sa = 0, mx = 0; const abs = new Float64Array(n);
    for (let i = 0; i < n; i++) { const v = vals[i]; s2 += v * v; sa += Math.abs(v); abs[i] = Math.abs(v); if (abs[i] > mx) mx = abs[i]; }
    const sd = Math.sqrt(s2 / n);
    if (mode === 0) {
      const eps = sE.get(); let inside = 0; for (let i = 0; i < n; i++) if (abs[i] < eps) inside++;
      abs.sort(); const q = abs[Math.min(n - 1, Math.floor(0.95 * n))];
      st1[0].set(`${sd.toFixed(4)}<small>理论 ${(1 / Math.sqrt(d)).toFixed(4)}</small>`);
      st1[1].set(`${(sa / n).toFixed(4)}<small>理论 ${(2 * Math.exp(logCd(d)) / (d - 1)).toFixed(4)}</small>`);
      st1[2].set(`${(inside / n * 100).toFixed(inside === n ? 0 : 1)}%`);
      st1[3].set(`90° ± ${(Math.asin(Math.min(1, q)) * 180 / Math.PI).toFixed(1)}°`);
    } else {
      st1[0].set(`${sd.toFixed(2)}<small>理论 ${Math.sqrt(d).toFixed(2)}</small>`);
      st1[1].set(`${(sa / n).toFixed(2)}<small>理论 ${Math.sqrt(2 * d / Math.PI).toFixed(2)}</small>`);
      st1[2].set(mx.toFixed(1));
      st1[3].set(`${meanNorm.toFixed(2)}<small>√d = ${Math.sqrt(d).toFixed(2)}</small>`);
    }
  }
  const hist = LAB.canvas('#o-hist', (ctx, w, h) => {
    const d = curD, sig = mode === 0 ? 1 / Math.sqrt(d) : Math.sqrt(d);
    let R = mode === 0 ? 1 : 4.5 * Math.sqrt(4096);
    if (zoom) R = Math.min(R, 4.5 * sig);
    const nb = 90, H = histogram(vals, -R, R, nb);
    const peak = gauss(0, sig);
    const ymax = Math.max(...H.h, peak) * 1.15 || 1;
    const P = new LAB.Plot(ctx, w, h, { xmin: -R, xmax: R, ymin: 0, ymax, xlabel: mode === 0 ? 'cos θ' : 'xᵀy', ylabel: '概率密度', pad: { l: 52, r: 14, t: 12, b: 38 } }).axes();
    P.clip();
    drawHist(P, H, C.c1, 0.55);
    if (mode === 0) P.fn((t) => exactPdf(d, t), C.c4, 2.2, null, 600);
    P.fn((t) => gauss(t, sig), C.c2, 1.8, [6, 4], 600);
    P.unclip();
    if (mode === 0 && !zoom && d >= 64) P.text(0, ymax * 0.92, `  标准差 1/√d = ${(1 / Math.sqrt(d)).toFixed(4)}`, C.navy, 'left', 'middle', '600 12px ' + NUMF);
  });

  // 标准差 vs d（固定 60 个向量的小样本，覆盖整张维度表）
  const small = DLIST.map((d) => {
    const r = sampleDots(d, 60, 999, true), a = r.cos, b = r.raw;
    return { d, cosv: a, sdN: Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length), sdU: Math.sqrt(b.reduce((s, v) => s + v * v, 0) / b.length) };
  });
  const stdc = LAB.canvas('#o-std', (ctx, w, h) => {
    const un = mode === 1;
    const P = new LAB.Plot(ctx, w, h, { xmin: 2, xmax: 4096, logx: true, logy: true, ymin: un ? 1 : 0.01, ymax: un ? 100 : 1, xtickValues: [2, 16, 128, 1024, 4096], xfmt: (v) => v, xlabel: '维度 d', ylabel: '标准差', pad: { l: 48, r: 12, t: 10, b: 38 } }).axes();
    P.fn((d) => (un ? Math.sqrt(d) : 1 / Math.sqrt(d)), C.c2, 1.8, [6, 4]);
    P.points(small.map((s) => s.d), small.map((s) => (un ? s.sdU : s.sdN)), C.c1, 3.2);
    const cur = small.find((s) => s.d === curD);
    if (cur) P.points([curD], [un ? cur.sdU : cur.sdN], C.c4, 6, '#fff');
    P.text(un ? 2.5 : 900, un ? 60 : 0.6, un ? '√d' : '1/√d', C.amber, 'left', 'middle', '600 12px ' + NUMF);
  });
  const tail = LAB.canvas('#o-tail', (ctx, w, h) => {
    const eps = sE.get(), ymin = 1e-10;
    const P = new LAB.Plot(ctx, w, h, { xmin: 2, xmax: 4096, logx: true, logy: true, ymin, ymax: 2, xtickValues: [2, 16, 128, 1024, 4096], xfmt: (v) => v, ytickValues: [1e-10, 1e-8, 1e-6, 1e-4, 1e-2, 1], xlabel: '维度 d', ylabel: '概率', pad: { l: 52, r: 12, t: 10, b: 38 } }).axes();
    P.clip();
    const xs = [], ex = [], bd = [];
    for (let i = 0; i <= 140; i++) { const d = 2 * Math.pow(2048, i / 140); xs.push(d); const e = exactTail(d, eps); ex.push(e > ymin * 0.5 ? e : NaN); const b = Math.min(1, 2 * Math.exp(-d * eps * eps / 2)); bd.push(b > ymin * 0.5 ? b : NaN); }
    P.line(xs, bd, C.c2, 1.8, [6, 4]);
    P.line(xs, ex, C.c4, 2.4);
    const px = [], py = [];
    small.forEach((s) => { let c = 0; for (const v of s.cosv) if (Math.abs(v) >= eps) c++; if (c > 0) { px.push(s.d); py.push(c / s.cosv.length); } });
    P.points(px, py, C.c1, 3);
    P.unclip();
    P.vline(curD, C.slate, [3, 3]);
    const e = exactTail(curD, eps);
    P.text(curD, 0.5e-9, ` d=${curD}: ${e < 1e-10 ? '< 10⁻¹⁰' : M.fmt(e, 2)}`, C.coral, curD > 300 ? 'right' : 'left', 'middle', '600 11.5px ' + NUMF);
  });
  run1();

  /* ================= 实验 2：词向量与余弦 ================= */
  const SETS = [
    { name: '王室与性别', ax: ['男性特征 →', '女性特征 ↑'], view: [1.2, 1.2, 4.6], words: { 国王: [2.8, 1.4], 王后: [1.4, 2.8], 男人: [2.2, 0.5], 女人: [0.5, 2.2], 男孩: [1.7, -0.3], 女孩: [-0.3, 1.7] }, a: '国王', b: '王后', an: ['国王', '男人', '女人'] },
    { name: '动物与机器', ax: ['亲人程度 →', '机械属性 ↑'], view: [0, 0, 6.6], words: { 猫: [1.6, -1.8], 狗: [1.8, -1.8], 老虎: [-1.0, -1.8], 拖拉机: [-1.6, 2.0], 汽车: [-0.6, 1.8] }, a: '猫', b: '拖拉机', an: ['狗', '猫', '老虎'] },
  ];
  let setIdx = 0, W = {}, selA, selB, showAn = false, dragW = null, view = null;
  const an = ['#w-an1', '#w-an2', '#w-an3'].map((s) => document.querySelector(s));
  const anBtn = document.querySelector('#w-analogy'), anOut = document.querySelector('#w-analogy-out');
  function loadSet(i) {
    setIdx = i; const S = SETS[i];
    W = {}; Object.keys(S.words).forEach((k) => (W[k] = S.words[k].slice()));
    selA = S.a; selB = S.b; showAn = false; anOut.innerHTML = '';
    const names = Object.keys(W);
    an.forEach((el, j) => { el.innerHTML = names.map((n) => `<option ${n === S.an[j] ? 'selected' : ''}>${n}</option>`).join(''); });
    pills('#w-a', () => selA, (n) => (selA = n)); pills('#w-b', () => selB, (n) => (selB = n));
    updAnBtn(); upd2();
  }
  function pills(host, get, set) {
    const el = document.querySelector(host); el.innerHTML = '';
    Object.keys(W).forEach((n) => {
      const b = document.createElement('button'); b.className = 'pill' + (n === get() ? ' on' : ''); b.textContent = n;
      b.onclick = () => { set(n); el.querySelectorAll('.pill').forEach((p) => p.classList.toggle('on', p.textContent === n)); upd2(); };
      el.appendChild(b);
    });
  }
  function updAnBtn() { anBtn.textContent = `${an[0].value} − ${an[1].value} + ${an[2].value} = ?`; }
  an.forEach((el) => (el.onchange = () => { updAnBtn(); if (showAn) upd2(); }));
  anBtn.onclick = () => { showAn = true; upd2(); };
  document.querySelector('#w-reset').onclick = () => loadSet(setIdx);
  LAB.segmented('#w-set', SETS.map((s) => s.name), 0, (i) => loadSet(i));
  const ws = [LAB.stat('#w-stats', '内积 $\\mathbf a^\\top\\mathbf b$'), LAB.stat('#w-stats', '模长 $\\|\\mathbf a\\|$ · $\\|\\mathbf b\\|$', 'teal'), LAB.stat('#w-stats', '余弦 $\\cos\\theta$', 'coral'), LAB.stat('#w-stats', '夹角 $\\theta$', 'amber')];
  function analogy() {
    const [x1, x2, x3] = an.map((e) => (W[e.value] ? e.value : Object.keys(W)[0]));
    const r = [W[x1][0] - W[x2][0] + W[x3][0], W[x1][1] - W[x2][1] + W[x3][1]];
    const nr = Math.hypot(r[0], r[1]) || 1e-9;
    const ranked = Object.keys(W).filter((n) => ![x1, x2, x3].includes(n)).map((n) => ({ n, c: (W[n][0] * r[0] + W[n][1] * r[1]) / (nr * Math.hypot(...W[n])) })).sort((a, b) => b.c - a.c);
    return { x1, x2, x3, r, ranked };
  }
  function upd2() {
    if (!W[selA]) selA = SETS[setIdx].a;
    if (!W[selB]) selB = SETS[setIdx].b;
    const a = W[selA], b = W[selB];
    const dot = a[0] * b[0] + a[1] * b[1], na = Math.hypot(...a), nb = Math.hypot(...b), cs = dot / (na * nb);
    ws[0].set(dot.toFixed(2)); ws[1].set(`${na.toFixed(2)}<small>·</small>${nb.toFixed(2)}`);
    ws[2].set(cs.toFixed(3)); ws[3].set(`${(Math.acos(M.clamp(cs, -1, 1)) * 180 / Math.PI).toFixed(1)}°`);
    if (showAn) {
      const A = analogy();
      anOut.innerHTML = `结果 $\\mathbf r=(${A.r[0].toFixed(2)},\\ ${A.r[1].toFixed(2)})$，按余弦排序：` + A.ranked.slice(0, 3).map((x, i) => `<span class="tag ${i === 0 ? 'plum' : ''}">${x.n} ${x.c.toFixed(3)}</span>`).join(' ');
      LAB.renderMath(anOut);
    }
    plane.redraw();
  }
  const plane = LAB.canvas('#w-plane', (ctx, w, h) => {
    const V = SETS[setIdx].view, s = Math.min(w, h) / V[2], cx = w / 2 - V[0] * s, cy = h / 2 + V[1] * s;
    view = { s, cx, cy, X: (v) => cx + v[0] * s, Y: (v) => cy - v[1] * s, ix: (px) => (px - cx) / s, iy: (py) => (cy - py) / s };
    ctx.save(); ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    for (let i = Math.ceil(view.ix(0)); i <= view.ix(w); i++) { ctx.beginPath(); ctx.moveTo(cx + i * s, 0); ctx.lineTo(cx + i * s, h); ctx.stroke(); }
    for (let i = Math.ceil(view.iy(h)); i <= view.iy(0); i++) { ctx.beginPath(); ctx.moveTo(0, cy - i * s); ctx.lineTo(w, cy - i * s); ctx.stroke(); }
    ctx.strokeStyle = '#9aa5b1'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    ctx.fillStyle = C.slate; ctx.font = '12px ' + FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(SETS[setIdx].ax[0], w - 6, cy - 4); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(SETS[setIdx].ax[1], cx + 6, 6);
    ctx.restore();
    const a = W[selA], b = W[selB];
    // 夹角弧
    const ta = Math.atan2(a[1], a[0]), tb = Math.atan2(b[1], b[0]);
    let d = tb - ta; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    ctx.save(); ctx.fillStyle = 'rgba(224,154,45,.16)'; ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, s * 0.62, -ta, -ta - d, d > 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, -ta, -ta - d, d > 0); ctx.stroke(); ctx.restore();
    // 投影
    const na2 = a[0] * a[0] + a[1] * a[1], pr = (a[0] * b[0] + a[1] * b[1]) / na2, foot = [a[0] * pr, a[1] * pr];
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = C.slate; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(view.X(b), view.Y(b)); ctx.lineTo(view.X(foot), view.Y(foot)); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.strokeStyle = pr >= 0 ? C.c3 : C.c4; ctx.lineWidth = 6; ctx.globalAlpha = 0.45; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(view.X(foot), view.Y(foot)); ctx.stroke(); ctx.restore();
    // 类比
    let A = null;
    if (showAn) {
      A = analogy();
      const p1 = W[A.x1], p2 = W[A.x2], p3 = W[A.x3];
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = C.plum; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(view.X(p2), view.Y(p2)); ctx.lineTo(view.X(p1), view.Y(p1)); ctx.moveTo(view.X(p3), view.Y(p3)); ctx.lineTo(view.X(A.r), view.Y(A.r)); ctx.stroke(); ctx.restore();
      LAB.arrow(ctx, cx, cy, view.X(A.r), view.Y(A.r), C.plum, 2.2, 10);
      const nn = W[A.ranked[0].n];
      ctx.save(); ctx.strokeStyle = C.plum; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(view.X(nn), view.Y(nn), 14, 0, 7); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.fillStyle = C.plum; ctx.font = '600 12.5px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('r', view.X(A.r) + 12, view.Y(A.r) - 12); ctx.restore();
    }
    Object.keys(W).forEach((n) => {
      const v = W[n], isA = n === selA, isB = n === selB;
      const col = isA ? C.c1 : isB ? C.c2 : '#9aa5b1';
      LAB.arrow(ctx, cx, cy, view.X(v), view.Y(v), col, isA || isB ? 3 : 1.8, isA || isB ? 12 : 9);
      ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(view.X(v), view.Y(v), dragW === n ? 7 : 5, 0, 7); ctx.fill(); ctx.stroke();
      const ang = Math.atan2(v[1], v[0]);
      ctx.fillStyle = isA || isB ? col : C.ink; ctx.font = (isA || isB ? '600 ' : '') + '14px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n + (isA ? '  a' : isB ? '  b' : ''), view.X(v) + Math.cos(ang) * 24, view.Y(v) - Math.sin(ang) * 18);
      ctx.restore();
    });
  });
  pointer(plane.canvas, {
    down: ([x, y]) => {
      if (!view) return false;
      let best = null, bd = 24;
      Object.keys(W).forEach((n) => { const dd = Math.hypot(view.X(W[n]) - x, view.Y(W[n]) - y); if (dd < bd) { bd = dd; best = n; } });
      if (!best) return false; dragW = best; plane.redraw(); return true;
    },
    move: ([x, y]) => {
      const pad = 0.15;
      let vx = M.clamp(view.ix(x), view.ix(0) + pad, view.ix(plane.w) - pad), vy = M.clamp(view.iy(y), view.iy(plane.h) + pad, view.iy(0) - pad);
      if (Math.hypot(vx, vy) < 0.08) { vx = 0.08; }
      W[dragW] = [vx, vy]; upd2();
    },
    up: () => { dragW = null; plane.redraw(); },
    hover: ([x, y]) => { if (!view) return; const near = Object.keys(W).some((n) => Math.hypot(view.X(W[n]) - x, view.Y(W[n]) - y) < 24); plane.canvas.style.cursor = near ? 'grab' : 'default'; },
  });
  loadSet(0);

  // 三维特征打分表
  const FEAT = ['体型大小', '亲人程度', '机械属性'];
  const BOOK3 = [['猫', [-0.6, 0.8, -0.9]], ['狗', [-0.4, 0.9, -0.9]], ['拖拉机', [0.9, -0.8, 1.0]]];
  const HAND = [['猫', [1, 2, 2]], ['狗', [2, 1, 2]], ['汽车', [2, -2, 1]]];
  let rows3 = BOOK3.map(([n, v]) => [n, v.slice()]);
  const tbl = document.querySelector('#w-table');
  function render3() {
    tbl.innerHTML = `<thead><tr><th>词</th>${FEAT.map((f) => `<th>${f}</th>`).join('')}<th>模长</th>${rows3.map(([n]) => `<th>cos(·, ${n})</th>`).join('')}</tr></thead><tbody>` +
      rows3.map(([n, v], i) => `<tr><td><b>${n}</b></td>${v.map((x, k) => `<td><input type="number" step="0.1" value="${x}" data-i="${i}" data-k="${k}" style="width:72px;padding:4px 6px"></td>`).join('')}<td class="num" id="w-n${i}"></td>${rows3.map((_, j) => `<td class="num" id="w-c${i}${j}" style="border-radius:6px"></td>`).join('')}</tr>`).join('') + '</tbody>';
    tbl.querySelectorAll('input').forEach((inp) => (inp.oninput = () => { const v = parseFloat(inp.value); if (isFinite(v)) { rows3[+inp.dataset.i][1][+inp.dataset.k] = v; upd3(); } }));
    upd3();
  }
  function upd3() {
    rows3.forEach(([, v], i) => {
      document.querySelector(`#w-n${i}`).textContent = M.norm(v).toFixed(3);
      rows3.forEach(([, u], j) => {
        const dot = M.dot(v, u), c = dot / (M.norm(v) * M.norm(u) || 1), el = document.querySelector(`#w-c${i}${j}`);
        el.innerHTML = `<b>${c.toFixed(3)}</b><br><span class="small muted">内积 ${+dot.toFixed(3)} · ${(Math.acos(M.clamp(c, -1, 1)) * 180 / Math.PI).toFixed(1)}°</span>`;
        el.style.background = LAB.mix('#ffffff', c >= 0 ? C.c3 : C.c4, Math.min(1, Math.abs(c)) * 0.32);
      });
    });
  }
  document.querySelector('#w-book3').onclick = () => { rows3 = BOOK3.map(([n, v]) => [n, v.slice()]); document.querySelector('#w-cap').textContent = '书中 §2.1 的打分（范围 −1 到 +1）：猫和狗挤在同一个角落，拖拉机指向相反方向。'; render3(); };
  document.querySelector('#w-hand').onclick = () => { rows3 = HAND.map(([n, v]) => [n, v.slice()]); document.querySelector('#w-cap').textContent = '书中 §2.6 手算算例：三个向量模长都是 3；猫·狗 = 8，cos = 8/9；猫·汽车 = 0，恰好正交。'; render3(); };
  render3();

  /* ================= 实验 3：维度诅咒与 JL ================= */
  const DL3 = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096];
  let seed3 = 5;
  const cD = LAB.slider('#c-d', { label: '维度 $d$', min: 0, max: DL3.length - 1, step: 1, value: DL3.indexOf(64), fmt: (i) => DL3[i], onInput: () => { runDist(); radial.redraw(); shell.redraw(); st3(); } });
  const cE = LAB.slider('#c-eps', { label: '外壳厚度 $\\varepsilon$（半径的比例）', min: 0.005, max: 0.5, step: 0.005, value: 0.05, fmt: (v) => v.toFixed(3), onInput: () => { radial.redraw(); shell.redraw(); st3(); } });
  const cN = LAB.slider('#c-n', { label: '随机点个数 $n$', min: 40, max: 200, step: 10, value: 120, onInput: () => { runDist(); runContrast(); } });
  const KL = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1000];
  const cM = LAB.slider('#c-M', { label: '点的个数 $M$', min: 10, max: 150, step: 10, value: 50, onInput: () => { jl.redraw(); st3(); } });
  const cK = LAB.slider('#c-k', { label: '投影维度 $k$', min: 0, max: KL.length - 1, step: 1, value: KL.indexOf(128), fmt: (i) => KL[i], onInput: () => { jl.redraw(); st3(); } });
  const cJ = LAB.slider('#c-jeps', { label: '允许畸变 $\\varepsilon$', min: 0.05, max: 0.5, step: 0.01, value: 0.2, fmt: (v) => v.toFixed(2), onInput: () => { jl.redraw(); st3(); } });
  document.querySelector('#c-resample').onclick = () => { seed3++; runDist(); runContrast(); buildJL(); jl.redraw(); st3(); };
  const s3 = [LAB.stat('#c-stats', '外壳体积占比', 'coral'), LAB.stat('#c-stats', '$D_{\\max}/D_{\\min}$'), LAB.stat('#c-stats', 'JL：落在 $1\\pm\\varepsilon$ 内', 'leaf'), LAB.stat('#c-stats', '理论所需 $k\\ge 16\\ln M/\\varepsilon^2$', 'amber')];

  function pairDists(d, n, seed) {
    const R = LAB.rng(seed * 104729 + d), X = new Float64Array(n * d);
    for (let i = 0; i < X.length; i++) X[i] = R();
    const out = new Float64Array(n * (n - 1) / 2); let p = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let s = 0; const a = i * d, b = j * d; for (let k = 0; k < d; k++) { const t = X[a + k] - X[b + k]; s += t * t; } out[p++] = Math.sqrt(s); }
    return out;
  }
  let dists = new Float64Array(0), dmin = 0, dmax = 0, contrast = [];
  const runDist = schedule(() => {
    dists = pairDists(DL3[cD.get()], cN.get(), seed3);
    dmin = Infinity; dmax = 0; for (const v of dists) { if (v < dmin) dmin = v; if (v > dmax) dmax = v; }
    distc.redraw(); contr.redraw(); st3();
  });
  const runContrast = schedule(() => {
    contrast = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096].map((d) => { const a = pairDists(d, cN.get(), seed3 + 1000); let mn = Infinity, mx = 0; for (const v of a) { if (v < mn) mn = v; if (v > mx) mx = v; } return { d, c: (mx - mn) / mn }; });
    contr.redraw();
  });
  const radial = LAB.canvas('#c-radial', (ctx, w, h) => {
    const d = DL3[cD.get()], eps = cE.get();
    const ymax = Math.max(1.3, d * 1.08);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: 0, ymax, xlabel: '半径 r', ylabel: '体积密度', pad: { l: 48, r: 12, t: 10, b: 38 } }).axes();
    const xs = [], ys = [];
    for (let i = 0; i <= 400; i++) { const u = i / 400, r = 1 - Math.pow(1 - u, 3); xs.push(r); ys.push(d * Math.pow(r, d - 1)); }
    const sx = xs.filter((r) => r >= 1 - eps), sy = sx.map((r) => d * Math.pow(r, d - 1));
    sx.unshift(1 - eps); sy.unshift(d * Math.pow(1 - eps, d - 1));
    P.clip(); P.area(sx, sy, C.c4, 0.28); P.line(xs, ys, C.c4, 2.2); P.unclip();
    P.vline(1 - eps, C.c4, [3, 3]);
    const f = 1 - Math.pow(1 - eps, d);
    P.text(0.04, ymax * 0.86, `d = ${d}：最外 ${(eps * 100).toFixed(1)}% 的半径装了 ${(f * 100).toFixed(f > 0.999 ? 3 : 1)}% 的体积`, C.ink, 'left', 'middle', '600 12px ' + FONT);
  });
  const shell = LAB.canvas('#c-shell', (ctx, w, h) => {
    const d = DL3[cD.get()], eps = cE.get();
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: 4096, logx: true, ymin: 0, ymax: 1, xtickValues: [1, 4, 16, 64, 256, 1024, 4096], xfmt: (v) => v, xlabel: '维度 d', ylabel: '外壳占比', pad: { l: 44, r: 12, t: 10, b: 38 } }).axes();
    P.fn((x) => 1 - Math.pow(0.99, x), C.c1, 1.6, [5, 4]);
    P.fn((x) => 1 - Math.pow(0.9, x), C.c3, 1.6, [5, 4]);
    P.fn((x) => 1 - Math.pow(1 - eps, x), C.c4, 2.6);
    P.points([d], [1 - Math.pow(1 - eps, d)], C.c4, 6, '#fff');
  });
  const distc = LAB.canvas('#c-dist', (ctx, w, h) => {
    if (!dists.length) return;
    const mean = M.mean(Array.from(dists)), H = histogram(Array.from(dists, (v) => v / mean), 0, 2.2, 66);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 2.2, ymin: 0, ymax: Math.max(...H.h) * 1.12, xlabel: '距离 / 平均距离', ylabel: '密度', pad: { l: 44, r: 12, t: 10, b: 38 } }).axes();
    drawHist(P, H, C.c1, 0.6);
    P.vline(dmin / mean, C.c3, [4, 3], 1.6); P.vline(dmax / mean, C.c4, [4, 3], 1.6);
    P.text(dmin / mean, P.o.ymax * 0.92, ' 最近 ', C.c3, 'right', 'middle', '600 11.5px ' + FONT);
    P.text(dmax / mean, P.o.ymax * 0.92, ' 最远', C.c4, 'left', 'middle', '600 11.5px ' + FONT);
  });
  const contr = LAB.canvas('#c-contrast', (ctx, w, h) => {
    if (!contrast.length) return;
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: 4096, logx: true, logy: true, ymin: 0.01, ymax: 1e5, xtickValues: [1, 4, 16, 64, 256, 1024, 4096], xfmt: (v) => v, ytickValues: [0.01, 1, 100, 1e4], xlabel: '维度 d', ylabel: '相对反差', pad: { l: 50, r: 12, t: 10, b: 38 } }).axes();
    P.clip();
    const ref = contrast.find((c) => c.d === 64);
    if (ref) P.fn((x) => ref.c * Math.sqrt(64 / x), C.c2, 1.5, [6, 4]);
    P.line(contrast.map((c) => c.d), contrast.map((c) => c.c), C.c1, 2.2);
    P.points(contrast.map((c) => c.d), contrast.map((c) => c.c), C.c1, 3);
    P.unclip();
    const d = DL3[cD.get()];
    if (dists.length) P.points([d], [(dmax - dmin) / dmin], C.c4, 6, '#fff');
  });

  // JL：一次性生成 1000 行的投影，k 维只取前 k 行（元素 N(0,1)/√k 与 N(0,1/k) 同分布）
  const DJ = 1000, MMAX = 150, KMAX = 1000;
  let Y = null, orig = null;
  function buildJL() {
    const R = LAB.rng(seed3 * 31 + 3), U = new Float64Array(MMAX * DJ);
    for (let i = 0; i < U.length; i++) U[i] = R.normal();
    orig = new Float64Array(MMAX * MMAX);
    for (let i = 0; i < MMAX; i++) for (let j = i + 1; j < MMAX; j++) { let s = 0; for (let t = 0; t < DJ; t++) { const z = U[i * DJ + t] - U[j * DJ + t]; s += z * z; } orig[i * MMAX + j] = s; }
    Y = new Float64Array(KMAX * MMAX); const row = new Float64Array(DJ);
    for (let r = 0; r < KMAX; r++) {
      for (let t = 0; t < DJ; t++) row[t] = R.normal();
      for (let i = 0; i < MMAX; i++) { let s = 0; const o = i * DJ; for (let t = 0; t < DJ; t++) s += row[t] * U[o + t]; Y[r * MMAX + i] = s; }
    }
  }
  let jlRatios = [];
  function ratios() {
    if (!Y) buildJL();
    const m = cM.get(), k = KL[cK.get()], out = [];
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) { let s = 0; for (let r = 0; r < k; r++) { const z = Y[r * MMAX + i] - Y[r * MMAX + j]; s += z * z; } out.push(s / k / orig[i * MMAX + j]); }
    return out;
  }
  const jl = LAB.canvas('#c-jl', (ctx, w, h) => {
    jlRatios = ratios();
    const eps = cJ.get(), k = KL[cK.get()], H = histogram(jlRatios, 0, 3, 120);
    const ymax = Math.max(...H.h, 0.5) * 1.12;
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 3, ymin: 0, ymax, xlabel: '投影后距离² / 原始距离²', ylabel: '密度', pad: { l: 44, r: 12, t: 10, b: 38 } }).axes();
    ctx.save(); ctx.fillStyle = C.c3l; ctx.fillRect(P.tx(1 - eps), P.y1, P.tx(1 + eps) - P.tx(1 - eps), P.y0 - P.y1); ctx.restore();
    drawHist(P, H, C.c3, 0.75);
    P.vline(1, C.leaf, [4, 3]);
    P.text(2.95, ymax * 0.9, `k = ${k}，标准差 √(2/k) = ${Math.sqrt(2 / k).toFixed(3)}`, C.ink, 'right', 'middle', '600 12px ' + NUMF);
    st3();
  });
  function st3() {
    const d = DL3[cD.get()], eps = cE.get(), f = 1 - Math.pow(1 - eps, d);
    s3[0].set(`${(f * 100).toFixed(f > 0.9999 ? 3 : f > 0.99 ? 2 : 1)}%`);
    s3[1].set(dists.length ? (dmax / dmin).toFixed(dmax / dmin > 100 ? 0 : 2) : '–');
    if (jlRatios.length) { const e = cJ.get(); const ok = jlRatios.filter((r) => r >= 1 - e && r <= 1 + e).length; s3[2].set(`${(ok / jlRatios.length * 100).toFixed(1)}%<small>${ok}/${jlRatios.length} 对</small>`); }
    const need = Math.ceil(16 * Math.log(cM.get()) / (cJ.get() ** 2));
    s3[3].set(`${need}<small>当前 k = ${KL[cK.get()]}</small>`);
  }
  runDist(); runContrast(); st3();
})();
