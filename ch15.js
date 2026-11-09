/* 第 15 章：大模型的不确定性量化：交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §15.1 三个同桌与熵分解 · §15.2 温度校准与 ECE · §15.3 共形预测与 APS · 问 15.3 语义熵 · 练习 15.1–15.2' });

  const $ = (s) => document.querySelector(s);
  const FONT = getComputedStyle(document.body).getPropertyValue('--font');
  const NUM = '600 12px Avenir Next, Avenir, sans-serif';
  const GREY = LAB.mix(C.slate, '#ffffff', 0.55);
  const isOn = (id) => document.getElementById(id).classList.contains('active');
  function anim(secId, frame, onStop) {
    let raf = 0;
    const o = {
      running: false,
      start() { if (o.running) return; o.running = true; const tick = () => { if (!o.running) return; if (!isOn(secId) || frame() === false) { o.stop(); return; } raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); },
      stop() { if (!o.running) return; o.running = false; cancelAnimationFrame(raf); onStop && onStop(); },
    };
    return o;
  }
  function drag(cv, on) {
    cv.style.touchAction = 'none'; cv.style.cursor = 'crosshair';
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let active = false;
    cv.addEventListener('pointerdown', (e) => { active = true; cv.setPointerCapture(e.pointerId); on('down', ...pos(e)); e.preventDefault(); });
    cv.addEventListener('pointermove', (e) => { if (active) on('move', ...pos(e)); });
    const end = () => { if (active) { active = false; on('up'); } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }

  /* ---------- 模拟的 10 分类器：标签按 Softmax(z*) 抽取 ---------- */
  const K = 10, LET = 'ABCDEFGHIJ'.split('');
  function genSet(n, seed) {
    const R = LAB.rng(seed), Z = new Float64Array(n * K), Y = new Int8Array(n), p = new Float64Array(K);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < K; j++) Z[i * K + j] = 0.8 * R.normal();
      Z[i * K + R.int(K)] += 1 + 7 * R();
      let mx = -Infinity; for (let j = 0; j < K; j++) mx = Math.max(mx, Z[i * K + j]);
      let s = 0; for (let j = 0; j < K; j++) { p[j] = Math.exp(Z[i * K + j] - mx); s += p[j]; }
      for (let j = 0; j < K; j++) p[j] /= s;
      Y[i] = R.choice(Array.from(p));
    }
    return { n, Z, Y };
  }
  // 以缩放系数 b 计算第 i 个样本的概率
  function probs(D, i, b, out) {
    let mx = -Infinity; for (let j = 0; j < K; j++) mx = Math.max(mx, b * D.Z[i * K + j]);
    let s = 0; for (let j = 0; j < K; j++) { out[j] = Math.exp(b * D.Z[i * K + j] - mx); s += out[j]; }
    for (let j = 0; j < K; j++) out[j] /= s;
    return out;
  }
  const pb = new Float64Array(K);

  /* ================= 实验 1：温度缩放 ================= */
  const CAL = genSet(2000, 1), TEST = genSet(2000, 2);
  const cS = LAB.slider('#c-s', { label: '过度自信倍数 $s$（模型 Logits $=s\\,\\mathbf z^*$）', min: 0.5, max: 4, step: 0.05, value: 2.5, fmt: (v) => v.toFixed(2), onInput: () => { newton = null; nllCache = null; update1(); } });
  const cT = LAB.slider('#c-t', { label: '温度 $T$', min: 0.3, max: 6, step: 0.01, value: 1, fmt: (v) => v.toFixed(2), onInput: () => update1() });
  let newton = null, nllCache = null;
  // 校准集上的 NLL 及其一二阶导（关于作用在模型 Logits 上的 β）
  function nllStats(beta) {
    const s = cS.get(); let L = 0, d1 = 0, d2 = 0;
    for (let i = 0; i < CAL.n; i++) {
      probs(CAL, i, s * beta, pb);
      let ez = 0, ez2 = 0; for (let j = 0; j < K; j++) { const z = s * CAL.Z[i * K + j]; ez += pb[j] * z; ez2 += pb[j] * z * z; }
      const zy = s * CAL.Z[i * K + CAL.Y[i]];
      L -= Math.log(Math.max(pb[CAL.Y[i]], 1e-300)); d1 += -zy + ez; d2 += ez2 - ez * ez;
    }
    return { L: L / CAL.n, d1: d1 / CAL.n, d2: d2 / CAL.n };
  }
  function evalTest(T) {
    const s = cS.get(), B = 10, cnt = new Array(B).fill(0), acc = new Array(B).fill(0), conf = new Array(B).fill(0);
    let nll = 0, A = 0, Cf = 0;
    for (let i = 0; i < TEST.n; i++) {
      probs(TEST, i, s / T, pb);
      let k = 0; for (let j = 1; j < K; j++) if (pb[j] > pb[k]) k = j;
      const b = Math.min(B - 1, Math.floor(pb[k] * B));
      cnt[b]++; conf[b] += pb[k]; Cf += pb[k];
      if (k === TEST.Y[i]) { acc[b]++; A++; }
      nll -= Math.log(Math.max(pb[TEST.Y[i]], 1e-300));
    }
    let ece = 0; for (let b = 0; b < B; b++) if (cnt[b]) ece += Math.abs(acc[b] - conf[b]) / TEST.n;
    return { cnt, acc: acc.map((a, b) => (cnt[b] ? a / cnt[b] : 0)), conf: conf.map((c, b) => (cnt[b] ? c / cnt[b] : 0)), ece, nll: nll / TEST.n, A: A / TEST.n, Cf: Cf / TEST.n };
  }
  const cst = { e: LAB.stat('#c-stats', 'ECE（测试集）', 'coral'), n: LAB.stat('#c-stats', 'NLL（测试集）', 'plum'), a: LAB.stat('#c-stats', '准确率', 'leaf'), c: LAB.stat('#c-stats', '平均置信度', 'amber') };
  let EV = null;
  const rel = LAB.canvas('#c-rel', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: 0, ymax: 1, xlabel: '置信度（最大概率）', ylabel: '准确率', xticks: 5, yticks: 5, pad: { l: 42, r: 10, t: 10, b: 38 } }).axes();
    const e = EV, bw = P.tx(0.1) - P.tx(0) - 3;
    e.cnt.forEach((c, b) => {
      if (!c) return;
      const xc = (b + 0.5) / 10;
      P.bars([xc], [e.acc[b]], C.c1, bw);
      const y0 = P.ty(e.acc[b]), y1 = P.ty(e.conf[b]);
      ctx.save(); ctx.fillStyle = C.c4; ctx.globalAlpha = 0.28; ctx.fillRect(P.tx(xc) - bw / 2, Math.min(y0, y1), bw, Math.abs(y1 - y0)); ctx.restore();
      ctx.save(); ctx.fillStyle = C.c2; ctx.globalAlpha = 0.85; const hh = (P.y0 - P.y1) * 0.4 * c / TEST.n; ctx.fillRect(P.tx(xc) - bw * 0.2, P.y0 - hh, bw * 0.4, hh); ctx.restore();
    });
    P.line([0, 1], [0, 1], C.slate, 1.4, [5, 4]);
    P.text(0.04, 0.94, `ECE = ${(e.ece * 100).toFixed(1)}%`, C.coral, 'left', 'middle', '600 13px Avenir Next, sans-serif');
  });
  const nllCv = LAB.canvas('#c-nll', (ctx, w, h) => {
    if (!nllCache) { const bs = M.linspace(0.1, 2.2, 71); nllCache = { bs, L: bs.map((b) => nllStats(b).L) }; }
    const { bs, L } = nllCache, lo = Math.min(...L), hi = Math.min(Math.max(...L), lo + 3);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.1, xmax: 2.2, ymin: Math.floor(lo * 10) / 10 - 0.05, ymax: Math.ceil(hi * 10) / 10, xlabel: 'β = 1/T', ylabel: '校准集 NLL', yticks: 4, pad: { l: 46, r: 10, t: 10, b: 38 } }).axes();
    P.clip(); P.line(bs, L, C.c5, 2.6); P.unclip();
    const b = 1 / cT.get();
    if (b >= 0.1 && b <= 2.2) { P.vline(b, C.amber, [4, 3], 1.4); P.points([b], [nllStats(b).L], C.c2, 5.5, '#fff'); }
    if (newton && newton.shown > 0) {
      const pts = newton.path.slice(0, newton.shown).filter((p) => p[0] >= 0.1 && p[0] <= 2.2);
      P.line(pts.map((p) => p[0]), pts.map((p) => p[1]), C.c3, 1.4, [3, 3]);
      pts.forEach((p, i) => { P.points([p[0]], [p[1]], C.c3, 4); P.text(p[0], p[1], ' ' + i, C.leaf, 'left', 'bottom', '600 11px Avenir Next, sans-serif'); });
    }
  });
  function bookCard() {
    const T = cT.get(), d = 8 / T, pA = 1 / (1 + Math.exp(-d));
    $('#c-book').innerHTML = `<div class="formula">$$\\frac{\\mathbf z}{T}=\\Big(\\frac{10}{${T.toFixed(2)}},\\ \\frac{2}{${T.toFixed(2)}}\\Big)=(${(10 / T).toFixed(2)},\\ ${(2 / T).toFixed(2)}),\\qquad \\hat p_A=\\frac{e^{${d.toFixed(2)}}}{e^{${d.toFixed(2)}}+1}=${(pA * 100).toFixed(2)}\\%$$</div>` +
      `<p class="muted" style="margin:6px 0 0">书中：$T=1$ 时 $99.97\\%$，$T=4$ 时 $88.1\\%$；无论 $T$ 取多少，第一名都是 A。两筐考题的 ECE：$\\tfrac{60}{100}\\times0.20+\\tfrac{40}{100}\\times0.05=0.14$。</p>`;
    LAB.renderMath($('#c-book'));
  }
  function update1() {
    bookCard();
    EV = evalTest(cT.get());
    cst.e.set(`${(EV.ece * 100).toFixed(1)}<small>%</small>`); cst.n.set(EV.nll.toFixed(3));
    cst.a.set(`${(EV.A * 100).toFixed(1)}<small>%</small>`); cst.c.set(`${(EV.Cf * 100).toFixed(1)}<small>%</small>`);
    rel.redraw(); nllCv.redraw();
  }
  let nTick = 0;
  const nRun = anim('calibration', () => {
    if (++nTick % 24) return true;
    newton.shown++;
    const [b] = newton.path[newton.shown - 1];
    cT.set(+(1 / b).toFixed(2)); update1();
    return newton.shown < newton.path.length;
  });
  $('#c-opt').onclick = () => {
    nRun.stop();
    let b = 1; const path = [[b, nllStats(b).L]];
    for (let k = 0; k < 10; k++) {
      // 牛顿步，限制每步 β 最多减半或加倍；若损失没有下降，再把步长减半
      const st = nllStats(b); let stepB = M.clamp(-st.d1 / st.d2, -b / 2, b), nb = b + stepB, Ln = nllStats(nb).L;
      while (Ln > st.L && Math.abs(stepB) > 1e-9) { stepB /= 2; nb = b + stepB; Ln = nllStats(nb).L; }
      if (Math.abs(nb - b) < 1e-6) break; b = nb; path.push([b, Ln]);
    }
    newton = { path, shown: 1 };
    $('#c-newton').innerHTML = `牛顿迭代 $\\beta$（每步最多减半或加倍）：${path.map((p) => p[0].toFixed(4)).join(' → ')}。最优温度 $T^*=1/\\beta^*=${(1 / b).toFixed(3)}$（$s=${cS.get().toFixed(2)}$）。`;
    LAB.renderMath($('#c-newton'));
    nTick = 0; nRun.start(); update1();
  };
  $('#c-reset').onclick = () => { nRun.stop(); newton = null; cT.set(1); update1(); };
  update1();

  /* ================= 实验 2：共形预测 ================= */
  const HAND = [0.02, 0.05, 0.08, 0.12, 0.15, 0.20, 0.25, 0.31, 0.40];
  const TESTS = [{ name: '书中第 10 号病人', p: [0.65, 0.62, 0.20, 0.05] }, { name: '胸片模糊', p: [0.72, 0.66, 0.61, 0.30] }, { name: '胸片清晰', p: [0.95, 0.12, 0.05, 0.02] }];
  let testI = 0;
  const aS = LAB.slider('#cp-alpha', { label: '$\\alpha$（目标覆盖率 $1-\\alpha$）', min: 0.01, max: 0.5, step: 0.01, value: 0.1, fmt: (v) => `${v.toFixed(2)}（${Math.round((1 - v) * 100)}%）`, onInput: () => { trials = []; update2(); } });
  LAB.segmented('#cp-test', TESTS.map((t) => t.name), 0, (i) => { testI = i; update2(); });
  const nS = LAB.slider('#cp-n', { label: '校准集大小 $n$', min: 9, max: 999, step: 10, value: 99, onInput: () => { trials = []; update2(); } });
  const mOf = (n, a) => Math.ceil((n + 1) * (1 - a) - 1e-9);
  const qOf = (sorted, a) => { const m = mOf(sorted.length, a); return m > sorted.length ? Infinity : sorted[m - 1]; };
  // 模拟池：s = 2.5、T = 1 的盲目自信模型
  const POOL = genSet(20000, 7), PP = new Float64Array(POOL.n * K), SC = new Float64Array(POOL.n);
  for (let i = 0; i < POOL.n; i++) { probs(POOL, i, 2.5, pb); for (let j = 0; j < K; j++) PP[i * K + j] = pb[j]; SC[i] = 1 - pb[POOL.Y[i]]; }
  const FIXCAL = (n) => Float64Array.from({ length: n }, (_, i) => SC[i]).sort();
  let trials = [], trialR = LAB.rng(99);
  function oneTrial() {
    const n = nS.get(), a = aS.get(), cal = new Float64Array(n);
    for (let i = 0; i < n; i++) cal[i] = SC[trialR.int(10000)];
    cal.sort(); const q = qOf(cal, a);
    let cov = 0; for (let t = 0; t < 200; t++) { const i = 10000 + trialR.int(10000); if (SC[i] <= q) cov++; }
    trials.push(cov / 200);
  }
  const cpRun = anim('conformal', () => { for (let k = 0; k < 10 && trials.length < 500; k++) oneTrial(); drawSim(); return trials.length < 500; }, () => { $('#cp-run').innerHTML = '▶ 重复 500 次试验'; });
  $('#cp-run').onclick = () => { if (cpRun.running) { cpRun.stop(); return; } if (trials.length >= 500) trials = []; cpRun.start(); $('#cp-run').innerHTML = '❚❚ 暂停'; };
  $('#cp-clear').onclick = () => { cpRun.stop(); trials = []; drawSim(); };
  const cps = { m: LAB.stat('#cp-stats', '名次 $k$'), q: LAB.stat('#cp-stats', '阈值 $\\hat q$', 'coral'), sz: LAB.stat('#cp-stats', '平均集合大小', 'amber'), cov: LAB.stat('#cp-stats', '实测覆盖率（累计）', 'leaf') };
  const hand = LAB.canvas('#cp-hand', (ctx, w, h) => {
    const a = aS.get(), n = HAND.length, m = mOf(n, a), q = m > n ? Infinity : HAND[m - 1], tp = TESTS[testI].p;
    const top = Math.round(h * 0.4);
    // 上：分数数轴
    const P1 = new LAB.Plot(ctx, w, top, { xmin: 0, xmax: 1, ymin: 0, ymax: 1, xtickValues: [0, 0.2, 0.4, 0.6, 0.8, 1], grid: false, pad: { l: 30, r: 16, t: 26, b: 22 } });
    ctx.save(); ctx.strokeStyle = C.slate; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(P1.x0, P1.ty(0.3)); ctx.lineTo(P1.x1, P1.ty(0.3)); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.fillStyle = C.slate; ctx.font = '11px Avenir Next, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; [0, 0.2, 0.4, 0.6, 0.8, 1].forEach((v) => ctx.fillText(String(v), P1.tx(v), P1.ty(0.3) + 14)); ctx.restore();
    HAND.forEach((s, i) => {
      const inside = i < m;
      P1.points([s], [0.3], inside ? C.c1 : GREY, 6, '#fff');
      ctx.save(); ctx.fillStyle = i === m - 1 ? C.coral : C.slate; ctx.font = (i === m - 1 ? '600 ' : '') + '11px Avenir Next, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const narrow = w < 560;
      if (!narrow || i === 0 || i >= 3 || i === m - 1) ctx.fillText(String(s), P1.tx(s), P1.ty(0.3) - (i % 2 ? 21 : 9));
      ctx.restore();
    });
    ctx.save(); ctx.fillStyle = C.ink; ctx.font = '12px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(w < 560 ? '惊讶罚分 s₍ᵢ₎' : `惊讶罚分 s₍ᵢ₎　k = ⌈10 × ${(1 - a).toFixed(2)}⌉ = ${m}`, P1.x0, 4); ctx.restore();
    if (isFinite(q)) { ctx.save(); ctx.strokeStyle = C.coral; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P1.tx(q), P1.ty(0.3) - 6); ctx.lineTo(P1.tx(q), P1.ty(0.3) + 10); ctx.stroke(); ctx.fillStyle = C.coral; ctx.font = NUM; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(`q̂ = s₍${m}₎ = ${q}`, P1.x1, 4); ctx.restore(); }
    else { ctx.save(); ctx.fillStyle = C.coral; ctx.font = NUM; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('k > n：q̂ = +∞', P1.x1, 4); ctx.restore(); }
    // 下：测试题概率与阈值
    const thr = isFinite(q) ? 1 - q : 0;
    ctx.save(); ctx.translate(0, top);
    const P2 = new LAB.Plot(ctx, w, h - top, { xmin: -0.6, xmax: 3.6, ymin: 0, ymax: 1, xtickValues: [], yticks: 2, pad: { l: 30, r: 16, t: 10, b: 24 } }).axes();
    const bw = (P2.tx(1) - P2.tx(0)) * 0.42;
    tp.forEach((p, i) => {
      const ins = p >= thr - 1e-12;
      P2.bars([i], [p], ins ? C.c6 : GREY, bw);
      P2.text(i, p + 0.03, (p * 100).toFixed(0) + '%', ins ? C.teal : C.slate, 'center', 'bottom', NUM);
      ctx.fillStyle = C.ink; ctx.font = '13px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('ABCD'[i], P2.tx(i), P2.y0 + 5);
    });
    P2.hline(thr, C.coral, [5, 4], 1.6);
    P2.text(3.55, thr + 0.03, `1 − q̂ = ${thr.toFixed(2)}`, C.coral, 'right', 'bottom', NUM);
    ctx.restore();
  });
  const hist = LAB.canvas('#cp-hist', (ctx, w, h) => {
    const n = nS.get(), cal = FIXCAL(n), q = qOf(cal, aS.get()), nb = 20, c = new Array(nb).fill(0);
    cal.forEach((s) => c[Math.min(nb - 1, Math.floor(s * nb))]++);
    const f = c.map((x) => x / n), Y = Math.max(0.1, Math.ceil(Math.max(...f) * 10) / 10);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: 0, ymax: Y, xlabel: '分数 s = 1 − P(真实答案)', ylabel: '占比', yticks: 4, pad: { l: 42, r: 10, t: 10, b: 38 } }).axes();
    P.bars(M.range(nb).map((k) => (k + 0.5) / nb), f, M.range(nb).map((k) => ((k + 0.5) / nb <= q ? C.c1 : GREY)), P.tx(1 / nb) - P.tx(0) - 2);
    if (isFinite(q)) { P.vline(q, C.coral, null, 2); P.text(q, Y * 0.92, ` q̂ = ${q.toFixed(3)}`, C.coral, q > 0.7 ? 'right' : 'left', 'middle', NUM); }
  });
  const covCv = LAB.canvas('#cp-cov', (ctx, w, h) => {
    const a = aS.get(), n = nS.get(), lo = Math.max(0, 1 - a - 0.2);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 500, ymin: lo, ymax: 1, xlabel: '试验次数', ylabel: '覆盖率', yticks: 4, pad: { l: 46, r: 10, t: 10, b: 38 } }).axes();
    ctx.save(); ctx.fillStyle = C.c3l; ctx.fillRect(P.x0, P.ty(Math.min(1, 1 - a + 1 / (n + 1))), P.x1 - P.x0, P.ty(1 - a) - P.ty(Math.min(1, 1 - a + 1 / (n + 1)))); ctx.restore();
    P.hline(1 - a, C.leaf, [4, 3], 1.2);
    const m = mOf(n, a); if (m <= n) P.hline(m / (n + 1), C.teal, [2, 3], 1);
    if (trials.length) {
      P.clip();
      P.points(trials.map((_, i) => i + 1), trials, LAB.mix(C.c1, '#ffffff', 0.45), 1.8);
      let s = 0; const run = trials.map((c, i) => { s += c; return s / (i + 1); });
      P.line(trials.map((_, i) => i + 1), run, C.navy, 2.4);
      P.unclip();
    }
    P.text(495, 1 - a, `1 − α = ${(1 - a).toFixed(2)}`, C.leaf, 'right', 'top', '11.5px ' + FONT);
  });
  function drawSim() {
    const n = nS.get(), a = aS.get(), m = mOf(n, a);
    if (trials.length) { const avg = M.mean(trials); cps.cov.set(`${(avg * 100).toFixed(1)}<small>% 理论 ${m <= n ? (m / (n + 1) * 100).toFixed(1) : '100'}%</small>`); }
    else cps.cov.set(`–<small>理论 ${m <= n ? (m / (n + 1) * 100).toFixed(1) : '100'}%</small>`);
    covCv.redraw();
  }
  function update2() {
    const a = aS.get(), n = nS.get(), cal = FIXCAL(n), q = qOf(cal, a), m = mOf(n, a);
    // 书中手算
    const hm = mOf(9, a), hq = hm > 9 ? Infinity : HAND[hm - 1], tp = TESTS[testI].p;
    const set = tp.map((p, i) => (isFinite(hq) ? (p >= 1 - hq - 1e-12 ? 'ABCD'[i] : null) : 'ABCD'[i])).filter(Boolean);
    $('#cp-m').textContent = `k = ${hm}`;
    $('#cp-hand-cap').innerHTML = `$k=\\lceil (9+1)(1-${a.toFixed(2)})\\rceil=${hm}$，` + (isFinite(hq) ? `分数线 $\\hat q=s_{(${hm})}=${hq}$，只收概率 $\\ge ${(1 - hq).toFixed(2)}$ 的病` : `$k&gt;9$，阈值为 $+\\infty$，所有病都写进诊断单`) + `：$\\mathcal C(x_{10})=\\{${set.join(',')}\\}$。`;
    LAB.renderMath($('#cp-hand-cap'));
    // 大规模
    let sz = 0; for (let i = 10000; i < 12000; i++) { let c = 0; for (let j = 0; j < K; j++) if (1 - PP[i * K + j] <= q) c++; sz += c; }
    cps.m.set(`${m}<small>/ ${n}</small>`); cps.q.set(isFinite(q) ? q.toFixed(3) : '+∞'); cps.sz.set(`${(sz / 2000).toFixed(2)}<small>个答案</small>`);
    // 测试题的集合
    const ex = [10003, 10011, 10024, 10040, 10057, 10071];
    $('#cp-sets').innerHTML = `<table class="data"><tr><th>测试题</th><th>模型前三名</th><th>预测集合 $\\mathcal C$</th><th>真实答案</th></tr>` + ex.map((i, r) => {
      const ps = M.range(K).map((j) => [j, PP[i * K + j]]).sort((u, v) => v[1] - u[1]);
      const inSet = ps.filter(([, p]) => 1 - p <= q).map(([j]) => j), y = POOL.Y[i], hit = inSet.includes(y);
      return `<tr><td>#${r + 1}</td><td class="num">${ps.slice(0, 3).map(([j, p]) => `${LET[j]} ${(p * 100).toFixed(0)}%`).join('　')}</td><td>${inSet.map((j) => `<span class="tag ${j === y ? 'teal' : ''}">${LET[j]}</span>`).join('')}${inSet.length === K ? '<span class="muted">（全部）</span>' : ''}</td><td>${LET[y]} ${hit ? '<span style="color:var(--leaf)">✓</span>' : '<span style="color:var(--coral)">✗</span>'}</td></tr>`;
    }).join('') + '</table>';
    LAB.renderMath($('#cp-sets'));
    hand.redraw(); hist.redraw(); drawSim();
  }
  update2();

  /* ================= 实验 3：偶然 vs 认知 ================= */
  const fTrue = (x) => 0.8 * Math.sin(1.5 * x) + 0.3 * x, sigT = (x) => 0.06 + 0.22 * (x + 4) / 8;
  const uM = LAB.slider('#u-m', { label: '集成成员数 $M$', min: 1, max: 20, step: 1, value: 8, onInput: () => build3() });
  const uN = LAB.slider('#u-noise', { label: '数据噪声倍数', min: 0, max: 2, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), onInput: () => build3(true) });
  const uGap = LAB.checkbox('#u-opts', '挖掉中间的数据（$-0.8&lt;x&lt;1.2$）', true, () => build3(true));
  const uX = LAB.slider('#u-x', { label: '查询点 $x$', min: -5, max: 5, step: 0.01, value: 0.2, fmt: (v) => v.toFixed(2), onInput: () => draw3() });
  let seed3 = 1, data3 = null, members = [], XS = M.linspace(-5, 5, 201), ens = null;
  $('#u-reseed').onclick = () => { seed3++; build3(true); };
  function makeData() {
    const R = LAB.rng(seed3), x = [], y = [];
    while (x.length < 120) { const xx = -4 + 8 * R(); if (uGap.get() && xx > -0.8 && xx < 1.2) continue; x.push(xx); y.push(fTrue(xx) + uN.get() * sigT(xx) * R.normal()); }
    return { x, y };
  }
  function solve(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
      for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
    return x;
  }
  // 一个集成成员：自助重采样 + 随机傅里叶特征岭回归（均值），残差平方的核平滑（方差）
  function member(seed) {
    const d = data3, R = LAB.rng(seed), n = d.x.length, D = 40, ell = 0.9, lam = 0.1, hb = 0.5;
    const idx = d.x.map(() => R.int(n)), om = [], ph = [];
    for (let k = 0; k < D; k++) { om.push(R.normal() / ell); ph.push(R() * 2 * Math.PI); }
    const phi = (x) => [1, ...om.map((o, k) => Math.sqrt(2 / D) * Math.cos(o * x + ph[k]))];
    const m = D + 1, A = [...Array(m)].map(() => new Array(m).fill(0)), b = new Array(m).fill(0);
    idx.forEach((i) => { const p = phi(d.x[i]); for (let r = 0; r < m; r++) { b[r] += p[r] * d.y[i]; for (let c = 0; c < m; c++) A[r][c] += p[r] * p[c]; } });
    for (let r = 1; r < m; r++) A[r][r] += lam; A[0][0] += 1e-6;
    const wv = solve(A, b), mu = (x) => { const p = phi(x); let s = 0; for (let r = 0; r < m; r++) s += p[r] * wv[r]; return s; };
    const xs = idx.map((i) => d.x[i]), r2 = idx.map((i) => (d.y[i] - mu(d.x[i])) ** 2);
    const v = (x) => { let s = 0, W = 0; xs.forEach((xi, k) => { const kk = Math.exp(-((x - xi) ** 2) / (2 * hb * hb)); s += kk * r2[k]; W += kk; }); return Math.max(1e-6, W > 1e-300 ? s / W : M.mean(r2)); };
    return { mu: XS.map(mu), v: XS.map(v) };
  }
  function build3(newData) {
    if (newData || !data3) { data3 = makeData(); members = []; }
    const Mn = uM.get();
    while (members.length < Mn) members.push(member(1000 * seed3 + members.length));
    const use = members.slice(0, Mn);
    const mean = XS.map((_, i) => M.mean(use.map((m) => m.mu[i])));
    const ale = XS.map((_, i) => M.mean(use.map((m) => m.v[i])));
    const epi = XS.map((_, i) => M.mean(use.map((m) => (m.mu[i] - mean[i]) ** 2)));
    ens = { use, mean, ale, epi };
    draw3();
  }
  let fitPlot = null;
  const fitCv = LAB.canvas('#u-fit', (ctx, w, h) => {
    if (!ens) return;
    const P = new LAB.Plot(ctx, w, h, { xmin: -5, xmax: 5, ymin: -2.6, ymax: 2.6, xlabel: 'x', ylabel: 'y', pad: { l: 40, r: 10, t: 10, b: 36 } }).axes();
    fitPlot = P;
    if (uGap.get()) { ctx.save(); ctx.fillStyle = C.mist; ctx.globalAlpha = 0.6; ctx.fillRect(P.tx(-0.8), P.y1, P.tx(1.2) - P.tx(-0.8), P.y0 - P.y1); ctx.restore(); }
    ctx.save(); ctx.fillStyle = C.mist; ctx.globalAlpha = 0.6; ctx.fillRect(P.x0, P.y1, P.tx(-4) - P.x0, P.y0 - P.y1); ctx.fillRect(P.tx(4), P.y1, P.x1 - P.tx(4), P.y0 - P.y1); ctx.restore();
    P.clip();
    const tot = ens.ale.map((a, i) => a + ens.epi[i]);
    const band = (v, col, al) => { ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = al; ctx.beginPath(); XS.forEach((x, i) => (i ? ctx.lineTo(P.tx(x), P.ty(ens.mean[i] + 2 * Math.sqrt(v[i]))) : ctx.moveTo(P.tx(x), P.ty(ens.mean[i] + 2 * Math.sqrt(v[i]))))); for (let i = XS.length - 1; i >= 0; i--) ctx.lineTo(P.tx(XS[i]), P.ty(ens.mean[i] - 2 * Math.sqrt(v[i]))); ctx.closePath(); ctx.fill(); ctx.restore(); };
    band(tot, C.c5l, 0.9); band(ens.ale, C.c2l, 0.95);
    ens.use.forEach((m) => P.line(XS, m.mu, GREY, 1));
    P.fn(fTrue, C.slate, 1.3, [5, 4]);
    P.points(data3.x, data3.y, C.ink, 1.9);
    P.line(XS, ens.mean, C.navy, 2.4);
    P.unclip();
    const xq = uX.get(); P.vline(xq, C.coral, [3, 3], 1.4);
  });
  drag(fitCv.canvas, (type, px) => { if (type === 'up' || !fitPlot) return; uX.set(M.clamp(+fitPlot.ix(px).toFixed(2), -5, 5)); draw3(); });
  const decCv = LAB.canvas('#u-dec', (ctx, w, h) => {
    if (!ens) return;
    const tot = ens.ale.map((a, i) => a + ens.epi[i]), Y = Math.max(0.1, Math.min(1.5, Math.max(...tot) * 1.1));
    const P = new LAB.Plot(ctx, w, h, { xmin: -5, xmax: 5, ymin: 0, ymax: Y, xlabel: 'x', ylabel: '方差', yticks: 4, pad: { l: 44, r: 10, t: 10, b: 36 } }).axes();
    P.clip();
    P.area(XS, ens.ale, C.c2, 0.75);
    ctx.save(); ctx.fillStyle = C.c5; ctx.globalAlpha = 0.6; ctx.beginPath(); XS.forEach((x, i) => (i ? ctx.lineTo(P.tx(x), P.ty(tot[i])) : ctx.moveTo(P.tx(x), P.ty(tot[i])))); for (let i = XS.length - 1; i >= 0; i--) ctx.lineTo(P.tx(XS[i]), P.ty(ens.ale[i])); ctx.closePath(); ctx.fill(); ctx.restore();
    P.line(XS, tot, C.plum, 1.6);
    P.fn((x) => (uN.get() * sigT(Math.max(-4, Math.min(4, x)))) ** 2, C.slate, 1.2, [4, 4]);
    P.unclip();
    P.vline(uX.get(), C.coral, [3, 3], 1.4);
    P.text(-4.9, Y * 0.92, '虚线：真实噪声方差', C.slate, 'left', 'middle', '11.5px ' + FONT);
  });
  const ust = { t: LAB.stat('#u-stats', '总方差'), a: LAB.stat('#u-stats', '偶然方差', 'amber'), e: LAB.stat('#u-stats', '认知方差', 'plum'), r: LAB.stat('#u-stats', '认知占比', 'coral') };
  function draw3() {
    if (!ens) return;
    const i = Math.round((uX.get() + 5) / 10 * 200), a = ens.ale[i], e = ens.epi[i];
    ust.t.set((a + e).toFixed(4)); ust.a.set(a.toFixed(4)); ust.e.set(e.toFixed(4)); ust.r.set(`${(e / (a + e) * 100).toFixed(0)}<small>%</small>`);
    fitCv.redraw(); decCv.redraw();
  }
  build3(true);

  // ---- 两位专家的熵分解 ----
  const Hb = (p) => -(p > 0 ? p * Math.log(p) : 0) - (p < 1 ? (1 - p) * Math.log(1 - p) : 0);
  const dS = LAB.slider('#u-exp-s', { label: '同桌分歧度 $d$（三人投 $0.5+d,\\ 0.5-d,\\ 0.5$）', min: 0, max: 0.5, step: 0.01, value: 0.4, fmt: (v) => v.toFixed(2), onInput: () => expCv.redraw() });
  const expCv = LAB.canvas('#u-exp', (ctx, w, h) => {
    const d = dS.get(), e1 = [0.5 + d, 0.5 - d], e2 = [0.5 - d, 0.5 + d], e3 = [0.5, 0.5], avg = [0.5, 0.5];
    const tot = Math.LN2, ale = (Hb(e1[0]) + Hb(e2[0]) + Hb(0.5)) / 3, epi = tot - ale, vr = (2 * d * d) / 3;
    const top = h - 70;
    const P = new LAB.Plot(ctx, w, top, { xmin: -0.6, xmax: 11.6, ymin: 0, ymax: 1, xtickValues: [], yticks: 2, pad: { l: 32, r: 8, t: 8, b: 22 } }).axes();
    [[e1, 0, '同桌 1'], [e2, 3, '同桌 2'], [e3, 6, '同桌 3'], [avg, 9, '平均']].forEach(([p, x0, lab]) => {
      P.bars([x0 + 0.5, x0 + 1.5], p, [C.c1, C.c2], (P.tx(1) - P.tx(0)) * 0.7);
      P.text(x0 + 1, -0.02, lab, C.ink, 'center', 'top', '12px ' + FONT);
    });
    // 下方堆叠条
    const y = top + 18, x0 = 32, x1 = w - 8, sc = (x1 - x0) / Math.LN2;
    ctx.save();
    ctx.fillStyle = C.c5; ctx.fillRect(x0, y, epi * sc, 20);
    ctx.fillStyle = C.c2; ctx.fillRect(x0 + epi * sc, y, ale * sc, 20);
    ctx.font = '600 12px ' + FONT; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillStyle = C.plum; ctx.fillText(`分歧 ${epi.toFixed(3)}`, x0, y + 26);
    ctx.fillStyle = C.amber; ctx.textAlign = 'right'; ctx.fillText(`固有 ${ale.toFixed(3)}`, x1, y + 26);
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.font = '12px ' + FONT; ctx.fillText('总熵 ln 2 ≈ 0.693', (x0 + x1) / 2, y + 26);
    ctx.restore();
    $('#u-exp-cap').innerHTML = `分歧方差 $=\\frac{(${(0.5 + d).toFixed(2)}-0.5)^2+(${(0.5 - d).toFixed(2)}-0.5)^2+0}{3}=${vr.toFixed(4)}$。` + (d < 0.005 ? '三人都说五五开（抛硬币）：没有分歧，全部是题目固有的模糊。' : 'A 蓝 B 琥珀。平均始终是五五开、总熵不变，变的是“各自犹豫”和“互相吵架”之间的分配。书中冰岛语题对应 $d=0.4$。');
    LAB.renderMath($('#u-exp-cap'));
  });

  // ---- 语义熵 ----
  const CL_COL = [C.teal, C.coral, C.amber, C.plum];
  const SCEN = [
    [['1080 年', 0.2, 0], ['元丰三年，即公元 1080 年', 0.2, 0], ['公元 1080 年', 0.2, 0], ['1080 年（元丰三年）', 0.2, 0], ['元丰三年', 0.2, 0]],
    [['1075 年', 0.2, 0], ['1082 年', 0.2, 1], ['1090 年', 0.2, 2], ['1082 年', 0.2, 1], ['1078 年', 0.2, 3]],
  ];
  let ans = SCEN[0].map((r) => r.slice());
  LAB.segmented('#se-seg', ['模型真懂', '模型在瞎编'], 0, (i) => { ans = SCEN[i].map((r) => r.slice()); renderSE(); });
  function renderSE() {
    $('#se-list').innerHTML = ans.map((r, i) => `<div class="se-row"><span class="txt">“${r[0]}”</span><span class="p">${r[1].toFixed(2)}</span><button class="se-chip" data-i="${i}" style="background:${CL_COL[r[2]]}">簇 ${r[2] + 1}</button></div>`).join('');
    $('#se-list').querySelectorAll('.se-chip').forEach((b) => { b.onclick = () => { const i = +b.dataset.i; ans[i][2] = (ans[i][2] + 1) % 4; renderSE(); }; });
    seCv.redraw();
  }
  const seCv = LAB.canvas('#se-bars', (ctx, w, h) => {
    const pc = [0, 0, 0, 0]; ans.forEach((r) => (pc[r[2]] += r[1]));
    const H = M.entropy(ans.map((r) => r[1])), SE = M.entropy(pc);
    const n = ans.length, gap = 1.2, xmax = n + gap + 4;
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.6, xmax: xmax - 0.4, ymin: 0, ymax: 1.15, xtickValues: [], yticks: 2, pad: { l: 32, r: 8, t: 26, b: 24 } }).axes();
    const bw = (P.tx(1) - P.tx(0)) * 0.7;
    ans.forEach((r, i) => { P.bars([i], [r[1]], LAB.mix(CL_COL[r[2]], '#ffffff', 0.25), bw); });
    pc.forEach((p, k) => { if (p > 0) P.bars([n + gap + k], [p], CL_COL[k], bw); P.text(n + gap + k, -0.02, p > 0 ? '簇' + (k + 1) : '', C.slate, 'center', 'top', '11px ' + FONT); });
    ans.forEach((r, i) => P.text(i, -0.02, String(i + 1), C.slate, 'center', 'top', '11px ' + FONT));
    P.text((n - 1) / 2, 1.13, `字面 H = ${H.toFixed(3)}`, C.navy, 'center', 'bottom', NUM);
    P.text(n + gap + 1.5, 1.13, `语义 SE = ${SE.toFixed(3)}`, SE > 0.3 ? C.coral : C.leaf, 'center', 'bottom', NUM);
  });
  renderSE();
})();
