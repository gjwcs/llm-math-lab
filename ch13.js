/* 第 13 章：连续生成模型的随机微积分：交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §13.2 前向扩散 · §13.3 得分与 Tweedie · §13.4 流匹配 · §13.5 CFG · §13.6 手算算例' });

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
  // 等比例的二维视图：短边对应 ±R，长边按宽高比扩展
  function view(w, h, R, pad) {
    pad = pad == null ? 8 : pad;
    const s = (Math.min(w, h) - 2 * pad) / (2 * R), cx = w / 2, cy = h / 2;
    return { s, R: (h / 2 - pad) / s, Rx: (w / 2 - pad) / s, X: (x) => cx + x * s, Y: (y) => cy - y * s, ix: (px) => (px - cx) / s, iy: (py) => (cy - py) / s };
  }
  function dots(ctx, V, xs, ys, cols, r, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    for (let i = 0; i < xs.length; i++) { ctx.fillStyle = Array.isArray(cols) ? cols[i] : cols; ctx.beginPath(); ctx.arc(V.X(xs[i]), V.Y(ys[i]), r, 0, 6.2832); ctx.fill(); }
    ctx.restore();
  }
  function frame2d(ctx, V, w, h) { // 坐标轴十字与外框
    ctx.save(); ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(V.X(-V.Rx), V.Y(0)); ctx.lineTo(V.X(V.Rx), V.Y(0)); ctx.moveTo(V.X(0), V.Y(-V.R)); ctx.lineTo(V.X(0), V.Y(V.R)); ctx.stroke();
    ctx.strokeStyle = C.line; LAB.roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 10); ctx.stroke(); ctx.restore();
  }

  /* ---------- 形状：等权混合高斯的中心 ---------- */
  function makeShape(name) {
    const c = [];
    let s0 = 0.08;
    if (name === 'moons') {
      const K = 50;
      for (let i = 0; i < K; i++) {
        const th = Math.PI * i / (K - 1), s = i / (K - 1);
        c.push({ x: (Math.cos(th) - 0.5) * 1.3, y: (Math.sin(th) - 0.25) * 1.3, col: LAB.mix(C.c1, C.c6, s), cls: 0 });
        c.push({ x: (1 - Math.cos(th) - 0.5) * 1.3, y: (0.5 - Math.sin(th) - 0.25) * 1.3, col: LAB.mix(C.c2, C.c4, s), cls: 1 });
      }
    } else if (name === 'smile') {
      s0 = 0.07;
      for (let i = 0; i < 64; i++) { const a = 2 * Math.PI * i / 64; c.push({ x: 1.75 * Math.cos(a), y: 1.75 * Math.sin(a), col: LAB.mix(C.c1, C.c5, i / 63), cls: 0 }); }
      [-0.62, 0.62].forEach((ex) => { for (let i = 0; i < 6; i++) { const a = 2 * Math.PI * i / 6; c.push({ x: ex + 0.1 * Math.cos(a), y: 0.55 + 0.1 * Math.sin(a), col: C.c4, cls: 0 }); } });
      for (let i = 0; i < 24; i++) { const a = (200 + 140 * i / 23) * Math.PI / 180; c.push({ x: 0.95 * Math.cos(a), y: 0.15 + 0.95 * Math.sin(a), col: C.c2, cls: 0 }); }
    } else {
      s0 = 0.06;
      for (let i = 0; i < 90; i++) { const s = i / 89, th = 0.6 + 3.2 * Math.PI * s, r = 0.3 + 1.5 * s; c.push({ x: r * Math.cos(th), y: r * Math.sin(th), col: LAB.mix(C.c5, C.c2, s), cls: 0 }); }
    }
    const K = c.length, cx = new Float64Array(K), cy = new Float64Array(K), cls = new Int8Array(K);
    c.forEach((p, k) => { cx[k] = p.x; cy[k] = p.y; cls[k] = p.cls; });
    return { c, K, cx, cy, cls, s0, L: new Float64Array(K) };
  }
  const SHAPES = ['moons', 'smile', 'spiral'], SHAPE_NAMES = ['两个月牙', '笑脸', '螺旋'];
  // 混合高斯后验均值 E[μ_k | x]，各分量均值为 a·μ_k、方差 s2（可选只用某一类）
  function postMean(g, x, y, a, s2, out, onlyCls) {
    const L = g.L; let lm = -Infinity;
    for (let k = 0; k < g.K; k++) {
      if (onlyCls != null && g.cls[k] !== onlyCls) { L[k] = -Infinity; continue; }
      const dx = x - a * g.cx[k], dy = y - a * g.cy[k]; const v = -(dx * dx + dy * dy) / (2 * s2); L[k] = v; if (v > lm) lm = v;
    }
    let W = 0, mx = 0, my = 0;
    for (let k = 0; k < g.K; k++) { if (L[k] === -Infinity) continue; const wt = Math.exp(L[k] - lm); W += wt; mx += wt * g.cx[k]; my += wt * g.cy[k]; }
    out[0] = mx / W; out[1] = my / W;
  }
  const tmp = new Float64Array(2);
  // 加噪边缘分布 q_t 的精确得分：-(x - √ᾱ E[μ|x]) / s_t²
  function score(g, x, y, ab, out) {
    const a = Math.sqrt(ab), s2 = ab * g.s0 * g.s0 + 1 - ab;
    postMean(g, x, y, a, s2, tmp);
    out[0] = -(x - a * tmp[0]) / s2; out[1] = -(y - a * tmp[1]) / s2;
  }
  function nearestDist(g, xs, ys) {
    let s = 0;
    for (let i = 0; i < xs.length; i++) { let m = Infinity; for (let k = 0; k < g.K; k++) { const d = (xs[i] - g.cx[k]) ** 2 + (ys[i] - g.cy[k]) ** 2; if (d < m) m = d; } s += Math.sqrt(m); }
    return s / xs.length;
  }
  // 噪声调度
  const T = 1000;
  const AB_LIN = new Float64Array(T + 1), AB_COS = new Float64Array(T + 1);
  AB_LIN[0] = 1; for (let t = 1; t <= T; t++) AB_LIN[t] = AB_LIN[t - 1] * (1 - (1e-4 + (0.02 - 1e-4) * (t - 1) / (T - 1)));
  { const s = 0.008, f = (t) => Math.cos(((t / T + s) / (1 + s)) * Math.PI / 2) ** 2; for (let t = 0; t <= T; t++) AB_COS[t] = f(t) / f(0); AB_COS[T] = Math.max(AB_COS[T], 1e-8); }

  /* ================= 实验 1：前向加噪 ================= */
  let fShape = makeShape('moons'), fSched = 0, fData = null, fSeed = 11;
  function sampleData(g, n, seed) {
    const R = LAB.rng(seed), x0 = new Float64Array(n), y0 = new Float64Array(n), ex = new Float64Array(n), ey = new Float64Array(n), col = [];
    for (let i = 0; i < n; i++) { const k = R.int(g.K); x0[i] = g.cx[k] + g.s0 * R.normal(); y0[i] = g.cy[k] + g.s0 * R.normal(); ex[i] = R.normal(); ey[i] = R.normal(); col.push(g.c[k].col); }
    return { n, x0, y0, ex, ey, col };
  }
  const AB = () => (fSched === 0 ? AB_LIN : AB_COS);
  LAB.segmented('#f-shape', SHAPE_NAMES, 0, (i) => { fShape = makeShape(SHAPES[i]); fData = sampleData(fShape, 900, fSeed); update1(); });
  LAB.segmented('#f-sched', ['线性', '余弦'], 0, (i) => { fSched = i; update1(); });
  const fT = LAB.slider('#f-t', { label: '时间步 $t$', min: 0, max: T, step: 1, value: 80, onInput: update1 });
  $('#f-reseed').onclick = () => { fSeed++; fData = sampleData(fShape, 900, fSeed); update1(); };
  const fPlay = anim('forward', () => { const t = fT.get() + 6; fT.set(Math.min(T, t)); update1(); return t < T; }, () => { $('#f-play').innerHTML = '▶ 播放'; });
  $('#f-play').onclick = () => { if (fPlay.running) { fPlay.stop(); return; } if (fT.get() >= T) fT.set(0); fPlay.start(); $('#f-play').innerHTML = '❚❚ 暂停'; };
  fData = sampleData(fShape, 900, fSeed);
  const fs = { a: LAB.stat('#f-stats', '信号 $\\sqrt{\\bar\\alpha_t}$', 'teal'), b: LAB.stat('#f-stats', '噪声 $\\sqrt{1-\\bar\\alpha_t}$', 'coral'), s: LAB.stat('#f-stats', '平方和', 'plum'), snr: LAB.stat('#f-stats', '信噪比 $\\frac{\\bar\\alpha_t}{1-\\bar\\alpha_t}$', 'amber') };
  const cloud = LAB.canvas('#f-cloud', (ctx, w, h) => {
    const V = view(w, h, 3.2), t = fT.get(), ab = AB()[t], a = Math.sqrt(ab), b = Math.sqrt(1 - ab), d = fData;
    frame2d(ctx, V, w, h);
    if (t > 0) dots(ctx, V, d.x0, d.y0, GREY, 1.4, 0.35);
    const xs = new Float64Array(d.n), ys = new Float64Array(d.n);
    for (let i = 0; i < d.n; i++) { xs[i] = a * d.x0[i] + b * d.ex[i]; ys[i] = a * d.y0[i] + b * d.ey[i]; }
    dots(ctx, V, xs, ys, d.col, 2.1, 0.85);
    ctx.save(); ctx.fillStyle = C.navy; ctx.font = NUM; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`t = ${t}`, 12, 10); ctx.restore();
  });
  const fcurve = LAB.canvas('#f-curve', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: T, ymin: 0, ymax: 1.02, xlabel: '时间步 t', yticks: 5, pad: { l: 36, r: 10, t: 10, b: 38 } }).axes();
    const ts = M.range(T + 1).filter((t) => t % 5 === 0);
    const other = fSched === 0 ? AB_COS : AB_LIN, cur = AB();
    P.line(ts, ts.map((t) => Math.sqrt(other[t])), C.c1, 1.2, [4, 4]); P.line(ts, ts.map((t) => Math.sqrt(1 - other[t])), C.c4, 1.2, [4, 4]);
    P.line(ts, ts.map((t) => Math.sqrt(cur[t])), C.c1, 2.6); P.line(ts, ts.map((t) => Math.sqrt(1 - cur[t])), C.c4, 2.6);
    let tx = 0; while (tx < T && cur[tx] > 0.5) tx++;
    P.points([tx], [Math.SQRT1_2], C.slate, 3.5);
    P.text(tx, Math.SQRT1_2 - 0.06, `ᾱ = 0.5 @ t≈${tx}`, C.slate, tx > 600 ? 'right' : 'left', 'top', '11.5px ' + FONT);
    const t = fT.get();
    P.vline(t, C.amber, [4, 3], 1.5);
    P.points([t], [Math.sqrt(cur[t])], C.c1, 5, '#fff');
    P.points([t], [Math.sqrt(1 - cur[t])], C.c4, 5, '#fff');
    P.text(T * 0.98, 0.96, fSched === 0 ? '实线：线性调度' : '实线：余弦调度', C.slate, 'right', 'middle', '11.5px ' + FONT);
  });
  function update1() {
    const t = fT.get(), ab = AB()[t];
    fs.a.set(Math.sqrt(ab).toFixed(3)); fs.b.set(Math.sqrt(1 - ab).toFixed(3));
    fs.s.set((Math.sqrt(ab) ** 2 + Math.sqrt(1 - ab) ** 2).toFixed(3)); fs.snr.set(M.fmt(ab / (1 - ab || 1e-300), 3).replace('Infinity', '∞'));
    if (t === 0) fs.snr.set('∞');
    cloud.redraw(); fcurve.redraw();
  }
  // 书中手算：x0 = 10, β1 = 0.19, β2 = 17/81
  const two = (() => {
    const R = LAB.rng(2024), n = 20000, a = [], b = [];
    for (let i = 0; i < n; i++) {
      const x1 = 0.9 * 10 + Math.sqrt(0.19) * R.normal();
      a.push((8 / 9) * x1 + (Math.sqrt(17) / 9) * R.normal());
      b.push(0.8 * 10 + 0.6 * R.normal());
    }
    return { a, b };
  })();
  const ms = (v) => { const m = M.mean(v); return [m, M.std(v)]; };
  const [ma, sa] = ms(two.a), [mb, sb] = ms(two.b);
  $('#f-two-cap').innerHTML = `两步走：均值 <b>${ma.toFixed(3)}</b>，标准差 <b>${sa.toFixed(3)}</b>；一步跳：均值 <b>${mb.toFixed(3)}</b>，标准差 <b>${sb.toFixed(3)}</b>。理论合成方差 $\\frac{64\\times0.19+17}{81}=\\frac{29.16}{81}=0.36$，标准差 $0.6$。`;
  LAB.renderMath($('#f-two-cap'));
  LAB.canvas('#f-two', (ctx, w, h) => {
    const lo = 5.6, hi = 10.4, nb = 48, bw = (hi - lo) / nb;
    const hist = (v) => { const c = new Array(nb).fill(0); v.forEach((x) => { const k = Math.floor((x - lo) / bw); if (k >= 0 && k < nb) c[k]++; }); return c.map((x) => x / (v.length * bw)); };
    const ha = hist(two.a), hb = hist(two.b), xs = M.range(nb).map((k) => lo + (k + 0.5) * bw);
    const P = new LAB.Plot(ctx, w, h, { xmin: lo, xmax: hi, ymin: 0, ymax: 0.75, xlabel: 'x₂', ylabel: '密度', yticks: 3, pad: { l: 42, r: 10, t: 10, b: 38 } }).axes();
    ctx.save(); ctx.globalAlpha = 0.55; P.bars(xs, ha, C.c2, (P.tx(bw) - P.tx(0)) * 0.92); ctx.restore();
    const stepX = [], stepY = []; xs.forEach((x, k) => { stepX.push(x - bw / 2, x + bw / 2); stepY.push(hb[k], hb[k]); });
    P.line(stepX, stepY, C.c6, 2);
    P.fn((x) => Math.exp(-((x - 8) ** 2) / (2 * 0.36)) / Math.sqrt(2 * Math.PI * 0.36), C.navy, 1.8, [5, 3]);
  });
  update1();

  /* ================= 实验 2：得分场与反向去噪 ================= */
  let rShape = makeShape('moons'), rSampler = 0;
  const STEP_CHOICES = [10, 20, 50, 100, 200, 500, 1000];
  LAB.segmented('#r-shape', SHAPE_NAMES, 0, (i) => { rRun.stop(); rShape = makeShape(SHAPES[i]); parts = null; drawR(); });
  LAB.segmented('#r-sampler', ['DDPM', 'DDIM', '退火朗之万'], 0, (i) => { rSampler = i; });
  const rSteps = LAB.slider('#r-steps', { label: '采样步数', min: 0, max: STEP_CHOICES.length - 1, step: 1, value: 6, fmt: (v) => STEP_CHOICES[v], onInput: () => {} });
  const rT = LAB.slider('#r-t', { label: '查看时刻 $t$', min: 0, max: T, step: 1, value: 120, onInput: () => { if (!rRun.running) drawR(); } });
  const optArrows = LAB.checkbox('#r-opts', '显示得分箭头', true, () => drawR());
  const optTrails = LAB.checkbox('#r-opts', '显示粒子轨迹', true, () => drawR());
  let parts = null, probe = [0.35, 0.1], rView = null;
  const rs = { t: LAB.stat('#r-stats', '当前 $t$'), n: LAB.stat('#r-stats', '噪声 $\\sqrt{1-\\bar\\alpha_t}$', 'coral'), d: LAB.stat('#r-stats', '粒子离数据的平均距离', 'teal'), e: LAB.stat('#r-stats', '探针处 $\\|\\hat{\\boldsymbol\\epsilon}\\|$', 'amber') };
  const NP = 420, NTRAIL = 8;
  function initParts(seed) {
    const R = LAB.rng(seed), x = new Float64Array(NP), y = new Float64Array(NP);
    for (let i = 0; i < NP; i++) { x[i] = R.normal(); y[i] = R.normal(); }
    return { x, y, R, trails: M.range(NTRAIL).map((i) => [[x[i], y[i]]]) };
  }
  let plan = null, rSeed = 5;
  function makePlan() {
    const Ns = STEP_CHOICES[rSteps.get()];
    if (rSampler < 2) { const ts = []; for (let i = 0; i <= Ns; i++) ts.push(Math.round(T * i / Ns)); return { kind: rSampler, ts, i: Ns, total: Ns, done: 0 }; }
    const levels = Math.max(2, Math.round(Ns / 5)), ts = [];
    for (let i = 0; i < levels; i++) ts.push(Math.max(1, Math.round(T * (1 - i / levels))));
    return { kind: 2, ts, i: 0, inner: 0, total: levels * 5, done: 0 };
  }
  const g2 = new Float64Array(2);
  function stepOnce() { // 返回当前显示时刻；全部完成返回 -1
    const p = parts, g = rShape;
    if (plan.kind < 2) {
      if (plan.i <= 0) return -1;
      const t = plan.ts[plan.i], s = plan.ts[plan.i - 1], abt = AB_LIN[t], abs = AB_LIN[s];
      for (let j = 0; j < NP; j++) {
        score(g, p.x[j], p.y[j], abt, g2);
        if (plan.kind === 0) { // DDPM 祖先采样（跨步时用 ᾱ 之比）
          const a = abt / abs, b = 1 - a;
          p.x[j] = (p.x[j] + b * g2[0]) / Math.sqrt(a); p.y[j] = (p.y[j] + b * g2[1]) / Math.sqrt(a);
          if (s > 0) { const sd = Math.sqrt((1 - abs) / (1 - abt) * b); p.x[j] += sd * p.R.normal(); p.y[j] += sd * p.R.normal(); }
        } else { // DDIM：Tweedie 估计 x̂0，再一步跳到 s
          const sq = Math.sqrt(1 - abt), ex = -sq * g2[0], ey = -sq * g2[1];
          const x0 = (p.x[j] - sq * ex) / Math.sqrt(abt), y0 = (p.y[j] - sq * ey) / Math.sqrt(abt);
          p.x[j] = Math.sqrt(abs) * x0 + Math.sqrt(1 - abs) * ex; p.y[j] = Math.sqrt(abs) * y0 + Math.sqrt(1 - abs) * ey;
        }
      }
      plan.i--; plan.done++;
      return s;
    }
    if (plan.i >= plan.ts.length) return -1;
    const t = plan.ts[plan.i], ab = AB_LIN[t], eta = 0.25 * (ab * g.s0 * g.s0 + 1 - ab);
    for (let j = 0; j < NP; j++) {
      score(g, p.x[j], p.y[j], ab, g2);
      p.x[j] += 0.5 * eta * g2[0] + Math.sqrt(eta) * p.R.normal(); p.y[j] += 0.5 * eta * g2[1] + Math.sqrt(eta) * p.R.normal();
    }
    plan.done++;
    if (++plan.inner >= 5) { plan.inner = 0; plan.i++; }
    return t;
  }
  const rRun = anim('reverse', () => {
    const per = Math.max(1, Math.ceil(plan.total / 140));
    let t = 0;
    for (let k = 0; k < per; k++) { t = stepOnce(); if (t < 0) break; }
    for (let i = 0; i < NTRAIL; i++) parts.trails[i].push([parts.x[i], parts.y[i]]);
    if (t >= 0) rT.set(plan.kind === 2 && plan.i >= plan.ts.length ? 0 : t);
    if (t < 0) { rT.set(0); drawR(); return false; }
    drawR();
    return true;
  }, () => { $('#r-run').innerHTML = '▶ 从纯噪声开始去噪'; });
  $('#r-run').onclick = () => {
    if (rRun.running) { rRun.stop(); return; }
    parts = initParts(rSeed++); plan = makePlan(); rT.set(T); drawR();
    rRun.start(); $('#r-run').innerHTML = '❚❚ 暂停';
  };
  $('#r-clear').onclick = () => { rRun.stop(); parts = null; drawR(); };
  const field = LAB.canvas('#r-field', (ctx, w, h) => {
    const V = view(w, h, 2.7), g = rShape, t = rT.get(), ab = Math.max(AB_LIN[t], 1e-12), sq = Math.sqrt(1 - ab), st = Math.sqrt(ab * g.s0 * g.s0 + 1 - ab);
    rView = V;
    frame2d(ctx, V, w, h);
    // 目标形状（淡色）
    ctx.save(); ctx.globalAlpha = 0.45; for (let k = 0; k < g.K; k++) { ctx.fillStyle = g.c[k].col; ctx.beginPath(); ctx.arc(V.X(g.cx[k]), V.Y(g.cy[k]), Math.max(2.5, g.s0 * V.s * 0.9), 0, 6.2832); ctx.fill(); } ctx.restore();
    if (optArrows.get()) {
      const step = Math.max(24, Math.min(w, h) / 17), cell = step * 0.88;
      for (let px = step / 2 + ((w / 2) % step); px < w; px += step) for (let py = step / 2 + ((h / 2) % step); py < h; py += step) {
        const x = V.ix(px), y = V.iy(py);
        score(g, x, y, ab, g2);
        const vx = g2[0] * st, vy = g2[1] * st;
        const m = Math.hypot(vx, vy); if (m < 1e-6) continue;
        const L = cell * Math.min(1, m / 2.2), ux = vx / m, uy = vy / m;
        LAB.arrow(ctx, px - ux * L / 2, py + uy * L / 2, px + ux * L / 2, py - uy * L / 2, LAB.mix(GREY, C.navy2, Math.min(1, m / 2.5)), 1.3, 5);
      }
    }
    if (parts) {
      if (optTrails.get()) parts.trails.forEach((tr) => { ctx.save(); ctx.strokeStyle = 'rgba(209,73,91,.4)'; ctx.lineWidth = 1.1; ctx.beginPath(); tr.forEach((p, i) => (i ? ctx.lineTo(V.X(p[0]), V.Y(p[1])) : ctx.moveTo(V.X(p[0]), V.Y(p[1])))); ctx.stroke(); ctx.restore(); });
      dots(ctx, V, parts.x, parts.y, C.navy, 2, 0.8);
    }
    // 探针
    const [qx, qy] = probe;
    score(g, qx, qy, ab, g2);
    const a = Math.sqrt(ab), x0x = (qx + (1 - ab) * g2[0]) / a, x0y = (qy + (1 - ab) * g2[1]) / a;
    ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = C.coral; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(V.X(qx), V.Y(qy)); ctx.lineTo(V.X(x0x), V.Y(x0y)); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.strokeStyle = C.coral; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(V.X(x0x), V.Y(x0y), 7, 0, 6.2832); ctx.stroke(); ctx.restore();
    const ev = Math.hypot(g2[0], g2[1]) * sq, en = Math.hypot(g2[0], g2[1]) * st;
    const ang = Math.atan2(g2[1], g2[0]), AL = 22 + 18 * Math.min(1, en / 2.5);
    LAB.arrow(ctx, V.X(qx), V.Y(qy), V.X(qx) + Math.cos(ang) * AL, V.Y(qy) - Math.sin(ang) * AL, C.coral, 2.6, 9);
    ctx.save(); ctx.fillStyle = C.coral; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(V.X(qx), V.Y(qy), 6.5, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.fillStyle = C.navy; ctx.font = NUM; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`t = ${t}`, 12, 10); ctx.restore();
    rs.e.set(ev.toFixed(2));
  });
  drag(field.canvas, (type, px, py) => { if (type === 'up' || !rView) return; probe = [M.clamp(rView.ix(px), -rView.Rx, rView.Rx), M.clamp(rView.iy(py), -rView.R, rView.R)]; drawR(); });
  function drawR() {
    const t = rT.get();
    rs.t.set(t); rs.n.set(Math.sqrt(1 - AB_LIN[t]).toFixed(3));
    rs.d.set(parts ? nearestDist(rShape, parts.x, parts.y).toFixed(3) : '–');
    $('#r-sub').textContent = parts && plan ? `已走 ${plan.done} / ${plan.total} 步` : '';
    field.redraw();
  }
  drawR();

  /* ================= 实验 3：流匹配 vs 扩散 + CFG ================= */
  const G3 = makeShape('moons'), N3 = 260, NT3 = 26;
  const BMIN = 0.1, BMAX = 20, abC = (t) => Math.exp(-(BMIN * t + 0.5 * (BMAX - BMIN) * t * t)), betaC = (t) => BMIN + t * (BMAX - BMIN);
  const v3 = new Float64Array(2), v3b = new Float64Array(2);
  function velFM(x, y, t, out, cls) { // v* = A(x - (1-t)m) - m
    const s0 = G3.s0, s2 = (1 - t) * (1 - t) * s0 * s0 + t * t, A = (t - (1 - t) * s0 * s0) / s2;
    postMean(G3, x, y, 1 - t, s2, tmp, cls);
    out[0] = A * (x - (1 - t) * tmp[0]) - tmp[0]; out[1] = A * (y - (1 - t) * tmp[1]) - tmp[1];
  }
  function velPF(x, y, t, out) { score(G3, x, y, abC(t), out); const b = betaC(t); out[0] = -0.5 * b * (x + out[0]); out[1] = -0.5 * b * (y + out[1]); }
  const EPS = 1e-3;
  function integrate(kind, N, X0, Y0, keepTrail) {
    const n = X0.length, x = Float64Array.from(X0), y = Float64Array.from(Y0), trails = keepTrail ? M.range(keepTrail).map((i) => [[x[i], y[i]]]) : null;
    const t0 = 1, t1 = kind === 'fm' ? 0 : EPS, dt = (t0 - t1) / N;
    for (let k = 0; k < N; k++) {
      const t = t0 - k * dt;
      for (let i = 0; i < n; i++) { if (kind === 'fm') velFM(x[i], y[i], t, v3); else velPF(x[i], y[i], t, v3); x[i] -= dt * v3[0]; y[i] -= dt * v3[1]; }
      if (trails) trails.forEach((tr, i) => tr.push([x[i], y[i]]));
    }
    return { x, y, trails };
  }
  let noise3 = null, fine3 = null, res3 = null, seed3 = 77;
  function makeNoise() {
    const R = LAB.rng(seed3), x = new Float64Array(N3), y = new Float64Array(N3);
    for (let i = 0; i < N3; i++) { x[i] = R.normal(); y[i] = R.normal(); }
    noise3 = { x, y };
    const fx = x.slice(0, NT3), fy = y.slice(0, NT3);
    fine3 = { fm: integrate('fm', 200, fx, fy, NT3).trails, pf: integrate('pf', 400, fx, fy, NT3).trails };
    computeErr();
  }
  const fmSteps = LAB.slider('#fm-steps', { label: '欧拉步数 $N$', min: 1, max: 50, step: 1, value: 4, onInput: () => sched3() });
  const optPaths = LAB.checkbox('#fm-opts', '显示生成轨迹', false, () => { d3a.redraw(); d3b.redraw(); });
  const optPairs = LAB.checkbox('#fm-opts', '显示训练用的直线配对（右图）', false, () => d3b.redraw());
  let cfgCls = 0;
  LAB.segmented('#cfg-cls', ['上月牙', '下月牙'], 0, (i) => { cfgCls = i; sched3(true); });
  const cfgW = LAB.slider('#cfg-w', { label: '引导强度 $w$', min: 0, max: 8, step: 0.1, value: 3, fmt: (v) => v.toFixed(1), onInput: () => sched3(true) });
  $('#fm-reseed').onclick = () => { seed3++; makeNoise(); sched3(); };
  const st3 = { fm: LAB.stat('#fm-stats', '流匹配：平均距离', 'leaf'), pf: LAB.stat('#fm-stats', '扩散：平均距离', 'coral'), nfm: LAB.stat('#fm-stats', '流匹配达标步数', 'teal'), npf: LAB.stat('#fm-stats', '扩散达标步数', 'amber') };
  const stc = { hit: LAB.stat('#cfg-stats', '落在目标类的比例', 'leaf'), d: LAB.stat('#cfg-stats', '离数据平均距离', 'coral'), sp: LAB.stat('#cfg-stats', '样本散布（标准差）', 'plum') };
  // 训练配对（右图虚线）：随机 x0 ~ 数据，x1 ~ 噪声
  const pairs = (() => { const R = LAB.rng(9), a = []; for (let i = 0; i < 26; i++) { const k = R.int(G3.K); a.push([G3.cx[k] + G3.s0 * R.normal(), G3.cy[k] + G3.s0 * R.normal(), R.normal(), R.normal()]); } return a; })();
  const dataPts = (() => { const R = LAB.rng(3), x = [], y = [], c = []; for (let i = 0; i < 500; i++) { const k = R.int(G3.K); x.push(G3.cx[k] + G3.s0 * R.normal()); y.push(G3.cy[k] + G3.s0 * R.normal()); c.push(G3.c[k].col); } return { x, y, c }; })();
  function drawPanel(ctx, w, h, kind) {
    const V = view(w, h, 2.9);
    frame2d(ctx, V, w, h);
    dots(ctx, V, dataPts.x, dataPts.y, GREY, 1.5, 0.4);
    if (kind === 'fm' && optPairs.get()) pairs.forEach((p) => { ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(47,143,91,.45)'; ctx.beginPath(); ctx.moveTo(V.X(p[0]), V.Y(p[1])); ctx.lineTo(V.X(p[2]), V.Y(p[3])); ctx.stroke(); ctx.restore(); });
    if (!res3) return;
    const r = res3[kind], col = kind === 'fm' ? C.c3 : C.c4;
    if (optPaths.get()) {
      fine3[kind].forEach((tr) => { ctx.save(); ctx.strokeStyle = LAB.mix(col, '#ffffff', 0.45); ctx.lineWidth = 1.1; ctx.beginPath(); tr.forEach((p, i) => (i ? ctx.lineTo(V.X(p[0]), V.Y(p[1])) : ctx.moveTo(V.X(p[0]), V.Y(p[1])))); ctx.stroke(); ctx.restore(); });
      r.trails.forEach((tr) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.beginPath(); tr.forEach((p, i) => (i ? ctx.lineTo(V.X(p[0]), V.Y(p[1])) : ctx.moveTo(V.X(p[0]), V.Y(p[1])))); ctx.stroke(); tr.forEach((p) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(V.X(p[0]), V.Y(p[1]), 1.8, 0, 6.2832); ctx.fill(); }); ctx.restore(); });
    }
    dots(ctx, V, r.x, r.y, kind === 'fm' ? C.leaf : C.coral, 2.2, 0.85);
    ctx.save(); ctx.fillStyle = C.navy; ctx.font = NUM; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`N = ${fmSteps.get()} 步`, 12, 10); ctx.restore();
  }
  const d3a = LAB.canvas('#fm-diff', (ctx, w, h) => drawPanel(ctx, w, h, 'pf'));
  const d3b = LAB.canvas('#fm-flow', (ctx, w, h) => drawPanel(ctx, w, h, 'fm'));
  let cfgRes = null;
  const cfgCanvas = LAB.canvas('#cfg-plot', (ctx, w, h) => {
    const V = view(w, h, 2.6);
    frame2d(ctx, V, w, h);
    dots(ctx, V, dataPts.x, dataPts.y, GREY, 1.6, 0.45);
    if (!cfgRes) return;
    dots(ctx, V, cfgRes.x, cfgRes.y, cfgRes.col, 2.3, 0.85);
    ctx.save(); ctx.fillStyle = C.navy; ctx.font = NUM; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`w = ${cfgW.get().toFixed(1)}　目标：${cfgCls === 0 ? '上月牙' : '下月牙'}`, 12, 10); ctx.restore();
  });
  function runCFG() {
    const w = cfgW.get(), N = 40, n = N3, x = Float64Array.from(noise3.x), y = Float64Array.from(noise3.y), dt = 1 / N;
    for (let k = 0; k < N; k++) {
      const t = 1 - k * dt;
      for (let i = 0; i < n; i++) {
        velFM(x[i], y[i], t, v3); velFM(x[i], y[i], t, v3b, cfgCls);
        x[i] -= dt * (v3[0] + w * (v3b[0] - v3[0])); y[i] -= dt * (v3[1] + w * (v3b[1] - v3[1]));
      }
    }
    let hit = 0; const col = [];
    for (let i = 0; i < n; i++) { let m = Infinity, cl = 0; for (let k = 0; k < G3.K; k++) { const d = (x[i] - G3.cx[k]) ** 2 + (y[i] - G3.cy[k]) ** 2; if (d < m) { m = d; cl = G3.cls[k]; } } if (cl === cfgCls) hit++; col.push(cl === 0 ? C.c1 : C.c2); }
    const sp = Math.sqrt((M.std(Array.from(x)) ** 2 + M.std(Array.from(y)) ** 2));
    cfgRes = { x, y, col };
    stc.hit.set(`${(hit / n * 100).toFixed(0)}<small>%</small>`); stc.d.set(nearestDist(G3, x, y).toFixed(3)); stc.sp.set(sp.toFixed(3));
    cfgCanvas.redraw();
  }
  function run3() {
    const N = fmSteps.get();
    res3 = { fm: integrate('fm', N, noise3.x, noise3.y, NT3), pf: integrate('pf', N, noise3.x, noise3.y, NT3) };
    st3.fm.set(nearestDist(G3, res3.fm.x, res3.fm.y).toFixed(3)); st3.pf.set(nearestDist(G3, res3.pf.x, res3.pf.y).toFixed(3));
    d3a.redraw(); d3b.redraw(); errCv.redraw();
  }
  // 误差随步数变化（换噪声时重算一次）
  const NS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50];
  let errCurve = null;
  const dStar = nearestDist(G3, dataPts.x, dataPts.y);
  function computeErr() {
    const sx = noise3.x.slice(0, 120), sy = noise3.y.slice(0, 120);
    const fm = NS.map((N) => { const r = integrate('fm', N, sx, sy, 0); return nearestDist(G3, r.x, r.y); });
    const pf = NS.map((N) => { const r = integrate('pf', N, sx, sy, 0); return nearestDist(G3, r.x, r.y); });
    const need = (a) => { const i = a.findIndex((d) => d <= 1.25 * dStar); return i < 0 ? '> 50' : NS[i]; };
    errCurve = { fm, pf };
    st3.nfm.set(need(fm)); st3.npf.set(need(pf));
  }
  const errCv = LAB.canvas('#fm-err', (ctx, w, h) => {
    if (!errCurve) return;
    const ymax = Math.max(0.3, Math.ceil(Math.max(...errCurve.fm, ...errCurve.pf) * 10) / 10);
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: 50, logx: true, ymin: 0, ymax, xtickValues: [1, 2, 5, 10, 20, 50], xlabel: '欧拉步数 N（对数刻度）', ylabel: '离数据平均距离', yticks: 4, pad: { l: 46, r: 12, t: 12, b: 38 } }).axes();
    P.hline(1.25 * dStar, C.slate, [4, 4], 1);
    P.text(48, 1.25 * dStar, '达标线（真实数据的 1.25 倍）', C.slate, 'right', 'bottom', '11.5px ' + FONT);
    P.line(NS, errCurve.pf, C.c4, 2.2); P.points(NS, errCurve.pf, C.c4, 3);
    P.line(NS, errCurve.fm, C.c3, 2.4); P.points(NS, errCurve.fm, C.c3, 3);
    P.vline(fmSteps.get(), C.amber, [4, 3], 1.4);
  });
  let pending = 0, pendCfg = false, pendMain = false;
  function sched3(cfgOnly) { if (cfgOnly) pendCfg = true; else { pendMain = true; pendCfg = true; } if (pending) return; pending = setTimeout(() => { pending = 0; if (pendMain) run3(); if (pendCfg) runCFG(); pendMain = pendCfg = false; }, 16); }
  makeNoise(); run3(); runCFG();
})();
