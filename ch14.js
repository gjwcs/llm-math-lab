/* 第 14 章：神经算子：学习从函数到函数的映射（交互实验） */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §14.1 铁棒热量散开算子 · §14.2 DeepONet · §14.3 FNO 与 PINO · 练习 14.1–14.2' });

  const $ = (s) => document.querySelector(s);
  const FONT = getComputedStyle(document.body).getPropertyValue('--font');
  const NUM = '600 12px Avenir Next, Avenir, sans-serif';
  const GREY = LAB.mix(C.slate, '#ffffff', 0.55);
  const TAU = 2 * Math.PI;
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
  function drag(cv, on, cursor) {
    cv.style.touchAction = 'none'; cv.style.cursor = cursor || 'pointer';
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let active = false;
    cv.addEventListener('pointerdown', (e) => { active = true; cv.setPointerCapture(e.pointerId); on('down', ...pos(e)); e.preventDefault(); });
    cv.addEventListener('pointermove', (e) => { if (active) on('move', ...pos(e)); });
    const end = () => { if (active) { active = false; on('up'); } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }
  const PI_TICKS = [0, Math.PI / 2, Math.PI, 1.5 * Math.PI, TAU];
  const piFmt = (v) => ({ 0: '0', 1: 'π/2', 2: 'π', 3: '3π/2', 4: '2π' }[Math.round(v / (Math.PI / 2))] || '');
  const niceMax = (m) => { const e = Math.pow(10, Math.floor(Math.log10(m))); return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((v) => v * e).find((v) => v >= m) || m; };

  /* ================= 实验 1：铁棒的热量散开算子（两端 0 度，正弦模态） ================= */
  const KM = 8, PI = Math.PI, KAP0 = Math.log(2) / (0.1 * PI * PI); // 书中：t=0.1 时 k=1 的乘子恰为 0.5
  let B = new Array(KM + 1).fill(0);
  function preset1(i) {
    B = new Array(KM + 1).fill(0);
    if (i === 0) { B[1] = 10; }
    else if (i === 1) { for (let k = 1; k <= KM; k += 2) B[k] = +(4 * 8 / (PI * k)).toFixed(3); }
    else if (i === 2) { for (let k = 1; k <= KM; k++) B[k] = +(2 * 3 * Math.sin(k * PI * 0.3) * Math.exp(-((0.25 * k) ** 2))).toFixed(3); }
    else { const R = LAB.rng(100 + Math.floor(Math.random() * 1000)); for (let k = 1; k <= KM; k++) B[k] = +(R.normal() * 6 / k).toFixed(2); }
  }
  LAB.segmented('#h-preset', ['书中铁棒', '方波', '尖峰', '随机'], 0, (i) => { preset1(i); update1(); });
  const hK = LAB.slider('#h-kappa', { label: '导热系数 $\\kappa$', min: 0.05, max: 2, step: 0.0001, value: +KAP0.toFixed(4), fmt: (v) => v.toFixed(4), onInput: () => update1() });
  const hT = LAB.slider('#h-t', { label: '时间 $t$', min: 0, max: 0.5, step: 0.005, value: 0.1, fmt: (v) => v.toFixed(3), onInput: () => update1() });
  const hPlay = anim('heat', () => { const t = Math.min(0.5, hT.get() + 0.002); hT.set(t); update1(); return t < 0.5; }, () => { $('#h-play').innerHTML = '▶ 播放'; });
  $('#h-play').onclick = () => { if (hPlay.running) { hPlay.stop(); return; } if (hT.get() >= 0.5) hT.set(0); hPlay.start(); $('#h-play').innerHTML = '❚❚ 暂停'; };
  const mult = (k) => Math.exp(-hK.get() * (k * PI) ** 2 * hT.get());
  const u0 = (x) => { let s = 0; for (let k = 1; k <= KM; k++) s += B[k] * Math.sin(k * PI * x); return s; };
  const ut = (x) => { let s = 0; for (let k = 1; k <= KM; k++) s += mult(k) * B[k] * Math.sin(k * PI * x); return s; };
  // 显式有限差分（两端固定为 0 度）
  function fd() {
    const N = 64, dx = 1 / N, kap = hK.get(), t = hT.get();
    const dtMax = 0.45 * dx * dx / kap, steps = t > 0 ? Math.ceil(t / dtMax) : 0, dt = steps ? t / steps : 0, r = kap * dt / (dx * dx);
    let u = Float64Array.from({ length: N + 1 }, (_, j) => u0(j * dx)), v = new Float64Array(N + 1);
    u[0] = 0; u[N] = 0;
    for (let n = 0; n < steps; n++) { for (let j = 1; j < N; j++) v[j] = u[j] + r * (u[j + 1] - 2 * u[j] + u[j - 1]); v[0] = 0; v[N] = 0; const w = u; u = v; v = w; }
    let err = 0; for (let j = 0; j <= N; j++) err = Math.max(err, Math.abs(u[j] - ut(j * dx)));
    return { xs: M.range(N + 1).map((j) => j * dx), u, steps, err };
  }
  let xq = 0.25, physPlot = null, specPlot = null, FD = null;
  const hs = { m1: LAB.stat('#h-stats', '$k=1$ 乘子 $e^{-\\kappa\\pi^2 t}$', 'teal'), q: LAB.stat('#h-stats', '查询点 $u(y,t)$', 'navy'), m3: LAB.stat('#h-stats', '$k=3$ 乘子 $e^{-9\\kappa\\pi^2 t}$', 'coral'), st: LAB.stat('#h-stats', '有限差分需要的步数', 'amber'), er: LAB.stat('#h-stats', '两种解的最大差', 'plum') };
  const X_TICKS = [0, 0.25, 0.5, 0.75, 1];
  const phys = LAB.canvas('#h-phys', (ctx, w, h) => {
    const xs = M.linspace(0, 1, 301), y0 = xs.map(u0), y1 = xs.map(ut);
    const Y = niceMax(Math.max(1, ...y0.map(Math.abs), ...y1.map(Math.abs)) * 1.1);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: -Y, ymax: Y, xtickValues: X_TICKS, xlabel: '位置 x / y（米）', ylabel: '温度 u', pad: { l: 42, r: 12, t: 12, b: 36 } }).axes();
    physPlot = P;
    P.hline(0, GREY, null, 1);
    P.line(xs, y0, GREY, 1.8, [5, 4]);
    P.area(xs, y1, C.c4, 0.07, 0);
    P.line(xs, y1, C.c4, 2.6);
    if (FD) P.points(FD.xs.filter((_, j) => j % 2 === 0), Array.from(FD.u).filter((_, j) => j % 2 === 0), C.c6, 2.6);
    // 普通网络焊死的 3 个格点
    [0, 0.5, 1].forEach((x) => { [u0(x), ut(x)].forEach((v) => { ctx.save(); ctx.fillStyle = C.slate; ctx.fillRect(P.tx(x) - 4, P.ty(v) - 4, 8, 8); ctx.restore(); }); });
    P.vline(xq, C.navy, [3, 3], 1.2);
    P.points([xq], [ut(xq)], C.navy, 5.5, '#fff');
    P.text(xq + (xq > 0.75 ? -0.015 : 0.015), Y * 0.86, `y = ${xq.toFixed(3)}，u = ${ut(xq).toFixed(3)}`, C.navy, xq > 0.75 ? 'right' : 'left', 'middle', NUM);
  });
  drag(phys.canvas, (type, px) => { if (type === 'up' || !physPlot) return; xq = M.clamp(physPlot.ix(px), 0, 1); phys.redraw(); renderDeepONet(); hs.q.set(ut(xq).toFixed(3)); }, 'crosshair');
  let dragK = null;
  const spec = LAB.canvas('#h-spec', (ctx, w, h) => {
    const Mx = dragK ? dragK.M : niceMax(Math.max(1, ...B.map(Math.abs)) * 1.2);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.4, xmax: KM + 0.6, ymin: -Mx, ymax: Mx, xtickValues: M.range(KM).map((i) => i + 1), xfmt: (v) => 'k=' + v, yticks: 4, pad: { l: 40, r: 10, t: 24, b: 26 } }).axes();
    specPlot = P;
    P.hline(0, GREY, null, 1);
    const bw = Math.min(22, (P.tx(1) - P.tx(0)) * 0.4);
    for (let k = 1; k <= KM; k++) {
      const m = mult(k), v = B[k];
      const X = P.tx(k), Y0 = P.ty(0), Y1 = P.ty(v);
      ctx.save(); ctx.strokeStyle = C.c2; ctx.lineWidth = 1.3; ctx.setLineDash([3, 2]); ctx.strokeRect(X - bw / 2, Math.min(Y0, Y1), bw, Math.abs(Y1 - Y0)); ctx.restore();
      P.bars([k], [v * m], C.c2, bw * 0.78);
      P.text(k, Mx * 1.0, '×' + m.toFixed(3), m < 0.5 ? C.coral : C.leaf, 'center', 'bottom', '600 10.5px Avenir Next, sans-serif');
    }
  });
  drag(spec.canvas, (type, px, py) => {
    if (type === 'up') { dragK = null; spec.redraw(); return; }
    const P = specPlot; if (!P) return;
    if (type === 'down') { const k = M.clamp(Math.round(P.ix(px)), 1, KM); dragK = { k, M: P.o.ymax }; }
    let v = M.clamp(P.iy(py), -dragK.M, dragK.M); if (Math.abs(v) < 0.04 * dragK.M) v = 0;
    B[dragK.k] = +v.toFixed(2);
    update1();
  }, 'ns-resize');
  const fmtN = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(2));
  function renderFormula() {
    const kap = hK.get(), t = hT.get(), terms = [], approx = [];
    for (let k = 1; k <= KM; k++) {
      const c = B[k]; if (Math.abs(c) < 1e-9) continue;
      const f = `\\sin ${k === 1 ? '' : k}\\pi x`, ex = +(kap * (k * PI) ** 2 * t).toFixed(3);
      terms.push(`${fmtN(c)}\\,e^{-${ex}}${f}`); approx.push(`${(c * mult(k)).toFixed(3)}${f}`);
    }
    const join = (a) => (a.length > 4 ? a.slice(0, 4).join('+') + '+\\cdots' : a.join('+')).replace(/\+-/g, '-');
    const tex = `\\begin{aligned} u(x,${+t.toFixed(3)}) &= ${join(terms) || '0'} \\\\ &\\approx ${join(approx) || '0'} \\end{aligned}`;
    $('#h-formula').innerHTML = LAB.tex('\\hat a_k\\ \\xrightarrow{\\ \\times\\, e^{-\\kappa (k\\pi)^2 t}\\ }\\ \\hat u_k(t)\\ \\xrightarrow{\\ \\text{叠回正弦波}\\ }\\ u(x,t)', true) + LAB.tex(tex, true);
  }
  function renderDeepONet() {
    const kap = hK.get(), t = hT.get(), rows = [];
    for (let k = 1; k <= KM; k++) {
      const m = Math.exp(-kap * (k * PI) ** 2 * t);
      if (Math.abs(B[k]) > 1e-9) rows.push([`sin ${k === 1 ? '' : k}πy`, B[k], m * Math.sin(k * PI * xq)]);
    }
    const sum = rows.reduce((s, r) => s + r[1] * r[2], 0);
    const shown = rows.slice(0, 6);
    $('#h-deeponet').innerHTML = `<table class="data"><tr><th>模态</th><th>分支 $b_k(a)$</th><th>主干 $t_k(y)$</th><th>乘积</th></tr>` +
      shown.map((r) => `<tr><td>${r[0]}</td><td class="num">${r[1].toFixed(3)}</td><td class="num">${r[2].toFixed(3)}</td><td class="num">${(r[1] * r[2]).toFixed(3)}</td></tr>`).join('') +
      (rows.length > 6 ? `<tr><td colspan="4" class="muted">… 另有 ${rows.length - 6} 项</td></tr>` : '') +
      `<tr><td colspan="3"><b>内积 $\\langle \\mathbf b(a),\\mathbf t(y)\\rangle = u(y,t)$</b></td><td class="num"><b>${sum.toFixed(3)}</b></td></tr></table>` +
      `<p class="muted" style="margin:8px 0 0">分支网读入初始温度，输出系数 $b_k=\\hat a_k$；主干网只读坐标 $y$（和时间 $t$），输出琴弦 $t_k(y)=e^{-\\kappa (k\\pi)^2t}\\sin k\\pi y$。铁棒的热量散开算子恰好就是一个精确的 DeepONet：书中算例只有一根琴弦，$b_1=10$，$t_1(0.25)=0.5\\sin(\\pi/4)$。</p>`;
    LAB.renderMath($('#h-deeponet'));
  }
  function update1() {
    FD = fd();
    hs.m1.set(mult(1).toFixed(3)); hs.m3.set(mult(3).toFixed(4)); hs.q.set(ut(xq).toFixed(3));
    hs.st.set(`${FD.steps}<small>步 vs 频域 1 次</small>`); hs.er.set(M.fmt(FD.err, 2));
    phys.redraw(); spec.redraw(); renderFormula(); renderDeepONet();
  }
  preset1(0); update1();

  /* ================= 实验 2：FNO 的频谱截断 ================= */
  const PHI = M.range(13).map((i) => (i * 2.399) % TAU);
  // 跳变点取左右极限的平均值 0（傅里叶级数在间断点收敛到的值）
  const FUNCS = [
    (x) => 2 + 3 * Math.cos(x) + 0.5 * Math.cos(10 * x),
    (x) => 1 + 2 * Math.cos(x) - 3 * Math.sin(x) + 0.8 * Math.cos(8 * x),
    (x) => { const m = ((x % TAU) + TAU) % TAU; return Math.abs(m) < 1e-9 || Math.abs(m - Math.PI) < 1e-9 || Math.abs(m - TAU) < 1e-9 ? 0 : m < Math.PI ? 1 : -1; },
    (x) => { const m = ((x % TAU) + TAU) % TAU; return m < 1e-9 || TAU - m < 1e-9 ? 0 : m / Math.PI - 1; },
    (x) => { let s = Math.sin(x) + 0.5 * Math.cos(2 * x); for (let i = 0; i < 13; i++) s += 0.09 * Math.sin((18 + i) * x + PHI[i]); return s; },
  ];
  const ND = 512;
  const NF = FUNCS.length; // 最后一项是手绘
  let nPre = 0, drawn = null, lastDraw = null;
  const fIn = (x) => {
    if (nPre < NF) return FUNCS[nPre](x);
    const u = ((((x % TAU) + TAU) % TAU) / TAU) * ND, i = Math.floor(u), f = u - i;
    return drawn[i % ND] * (1 - f) + drawn[(i + 1) % ND] * f;
  };
  const nPreSeg = LAB.segmented('#n-preset', ['书中算例', '练习 14.2', '方波', '锯齿波', '毛刺正弦', '手绘'], 0, (i) => {
    if (i === NF && !drawn) drawn = Float64Array.from({ length: ND }, (_, j) => FUNCS[nPre](TAU * j / ND));
    nPre = i;
    if (i === 0) { nK.set(1); nW.set(2); rSeg.set(3); return; }
    if (i === 1) { nK.set(1); nW.set(0.5); rSeg.set(4); return; }
    update2();
  });
  const GRIDS = [32, 64, 128, 256];
  let NG = 128;
  LAB.segmented('#n-grid', GRIDS.map(String), 2, (i) => { NG = GRIDS[i]; nK.setRange(0, NG / 2); update2(); });
  const nK = LAB.slider('#n-k', { label: '保留的最高频率 $k_{\\max}$', min: 0, max: 64, step: 1, value: 1, onInput: () => update2() });
  let rMode = 3;
  const rSeg = LAB.segmented('#n-r', ['恒等', '热核', '求导 $ik$', '书中 $\\mathrm{diag}(2.5,2)$', '练习 14.2'], 3, (i) => { rMode = i; update2(); });
  const nW = LAB.slider('#n-w', { label: '局部权重 $W$', min: -1, max: 2.5, step: 0.05, value: 2, fmt: (v) => v.toFixed(2), onInput: () => update2() });
  const nAct = LAB.checkbox('#n-act', '经过激活函数 $\\sigma=\\operatorname{GELU}$', false, () => update2());
  function dft(v, kmax) { // 实傅里叶系数 A_k, B_k（k = 0..kmax）
    const N = v.length, Ak = new Float64Array(kmax + 1), Bk = new Float64Array(kmax + 1);
    for (let k = 0; k <= kmax; k++) {
      let a = 0, b = 0; for (let j = 0; j < N; j++) { const th = TAU * k * j / N; a += v[j] * Math.cos(th); b += v[j] * Math.sin(th); }
      const nyq = 2 * k === N;
      Ak[k] = (k === 0 || nyq ? 1 : 2) * a / N; Bk[k] = nyq || k === 0 ? 0 : 2 * b / N;
    }
    return { Ak, Bk };
  }
  function synth(Ak, Bk, xs) { return xs.map((x) => { let s = 0; for (let k = 0; k < Ak.length; k++) s += Ak[k] * Math.cos(k * x) + Bk[k] * Math.sin(k * x); return s; }); }
  const gelu = (z) => 0.5 * z * (1 + M.erf(z / Math.SQRT2));
  function applyR(Ak, Bk) {
    const a = Float64Array.from(Ak), b = Float64Array.from(Bk);
    for (let k = 0; k < a.length; k++) {
      if (rMode === 1) { const m = Math.exp(-0.05 * k * k); a[k] *= m; b[k] *= m; }
      else if (rMode === 2) { const ak = Ak[k], bk = Bk[k]; a[k] = k * bk; b[k] = -k * ak; }
      else if (rMode === 3) { const m = k === 0 ? 2.5 : k === 1 ? 2 : 1; a[k] *= m; b[k] *= m; }
      else if (rMode === 4) { if (k === 0) { a[k] *= 2; } else if (k === 1) { const ak = Ak[k], bk = Bk[k]; a[k] = -bk; b[k] = ak; } }
    }
    return { a, b };
  }
  function layer(N, K) {
    const xs = M.range(N).map((j) => TAU * j / N), v = Float64Array.from(xs, fIn);
    const { Ak, Bk } = dft(v, K), R = applyR(Ak, Bk), sp = synth(R.a, R.b, xs), Wv = Array.from(v, (x) => nW.get() * x);
    const out = sp.map((s, j) => (nAct.get() ? gelu(s + Wv[j]) : s + Wv[j]));
    return { xs, v, sp, Wv, out };
  }
  let S2 = null, reconPlot = null;
  const ns = { k: LAB.stat('#n-stats', '$k_{\\max}$ / 最高可分辨频率'), e: LAB.stat('#n-stats', '保留的能量', 'teal'), r: LAB.stat('#n-stats', '重构相对误差', 'coral'), p: LAB.stat('#n-stats', '谱权重个数', 'plum') };
  const recon = LAB.canvas('#n-recon', (ctx, w, h) => {
    const s = S2; if (!s) return;
    const Y = niceMax(Math.max(1.2, ...Array.from(s.v, Math.abs), ...s.rec.map(Math.abs)) * 1.1);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: TAU, ymin: -Y, ymax: Y, xtickValues: PI_TICKS, xfmt: piFmt, xlabel: 'x', pad: { l: 40, r: 12, t: 12, b: 36 } }).axes();
    reconPlot = P;
    P.hline(0, GREY, null, 1);
    const fx = M.linspace(0, TAU, 600);
    P.line(fx, fx.map(fIn), GREY, 1.4);
    const xsC = s.xs.concat([TAU]), recC = s.rec.concat([s.rec[0]]), vC = Array.from(s.v).concat([s.v[0]]);
    // 误差阴影
    ctx.save(); ctx.fillStyle = C.c4; ctx.globalAlpha = 0.16; ctx.beginPath();
    xsC.forEach((x, j) => (j ? ctx.lineTo(P.tx(x), P.ty(recC[j])) : ctx.moveTo(P.tx(x), P.ty(recC[j]))));
    for (let j = xsC.length - 1; j >= 0; j--) ctx.lineTo(P.tx(xsC[j]), P.ty(vC[j]));
    ctx.closePath(); ctx.fill(); ctx.restore();
    if (s.N <= 128) P.points(s.xs, Array.from(s.v), C.slate, s.N <= 64 ? 2.4 : 1.6);
    P.line(fx, synth(s.Ak, s.Bk, fx), C.c1, 2.4);
  });
  drag(recon.canvas, (type, px, py) => {
    if (type === 'up') { lastDraw = null; return; }
    const P = reconPlot; if (!P) return;
    if (nPre !== NF) { drawn = Float64Array.from({ length: ND }, (_, j) => fIn(TAU * j / ND)); nPre = NF; nPreSeg.el.querySelectorAll('button').forEach((b, j) => b.classList.toggle('active', j === NF)); }
    const x = M.clamp(P.ix(px), 0, TAU - 1e-9), y = M.clamp(P.iy(py), P.o.ymin, P.o.ymax);
    const i1 = Math.round(x / TAU * ND) % ND;
    if (type === 'down' || !lastDraw) drawn[i1] = y;
    else { const [i0, y0] = lastDraw, n = Math.abs(i1 - i0); for (let s = 0; s <= n; s++) { const i = i0 + Math.sign(i1 - i0) * s; drawn[(i + ND) % ND] = n ? y0 + (y - y0) * s / n : y; } }
    lastDraw = [i1, y];
    update2();
  }, 'crosshair');
  const specN = LAB.canvas('#n-spec', (ctx, w, h) => {
    const s = S2; if (!s) return;
    const kmax = Math.min(s.N / 2, 64), mag = s.fullA.map((a, k) => Math.hypot(a, s.fullB[k]));
    const Y = niceMax(Math.max(0.1, ...mag) * 1.1);
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.8, xmax: kmax + 0.8, ymin: 0, ymax: Y, xlabel: '频率 k', yticks: 4, pad: { l: 40, r: 10, t: 10, b: 36 } }).axes();
    const bw = Math.max(1.5, (P.tx(1) - P.tx(0)) * 0.7);
    P.bars(M.range(kmax + 1), mag.slice(0, kmax + 1), M.range(kmax + 1).map((k) => (k <= s.K ? C.c1 : GREY)), bw);
    P.vline(s.K + 0.5, C.coral, [4, 3], 1.4);
    P.text(s.K + 0.5 + kmax * 0.01, Y * 0.92, ` k_max = ${s.K}`, C.coral, 'left', 'middle', NUM);
  });
  const layerCv = LAB.canvas('#n-layer', (ctx, w, h) => {
    const s = S2; if (!s) return;
    const L = s.L, all = [...L.sp, ...L.Wv, ...L.out].map(Math.abs);
    const Y = niceMax(Math.max(1, ...all) * 1.1);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: TAU, ymin: -Y, ymax: Y, xtickValues: PI_TICKS, xfmt: piFmt, xlabel: 'x', pad: { l: 40, r: 12, t: 12, b: 36 } }).axes();
    P.hline(0, GREY, null, 1);
    const xsC = L.xs.concat([TAU]), cyc = (a) => a.concat([a[0]]);
    P.line(xsC, cyc(L.sp), C.c6, 1.8);
    if (nW.get() !== 0) P.line(xsC, cyc(L.Wv), C.c2, 1.6, [5, 4]);
    P.line(xsC, cyc(L.out), C.navy, 2.6);
  });
  function renderPipe() {
    const rName = ['恒等', '热核 $e^{-0.05k^2}$', '求导 $ik$', '$\\mathrm{diag}(2.5,2)$', '练习 14.2'][rMode];
    const chip = (t, on) => `<span class="fno-chip ${on ? 'on' : ''}">${t}</span>`, ar = '<span class="fno-arrow">→</span>';
    $('#n-pipe').innerHTML = chip('$v(x)$', true) + ar + chip('FFT', true) + ar + chip(`截断 $k\\le${S2.K}$`, true) + ar + chip(`$\\times\\,\\mathbf R_k$：${rName}`, rMode > 0) + ar + chip('iFFT', true) + ar +
      chip(`$+\\,W v(x)$，$W=${nW.get().toFixed(2)}$`, nW.get() !== 0) + ar + chip('$\\sigma$', nAct.get()) + ar + chip('$v_{l+1}(x)$', true);
    LAB.renderMath($('#n-pipe'));
  }
  function update2() {
    const N = NG, K = Math.min(nK.get(), N / 2);
    const xs = M.range(N).map((j) => TAU * j / N), v = Float64Array.from(xs, fIn);
    const full = dft(v, N / 2), Ak = full.Ak.slice(0, K + 1), Bk = full.Bk.slice(0, K + 1);
    const rec = synth(Ak, Bk, xs);
    const eTot = M.sum(Array.from(v, (x) => x * x)), err = Math.sqrt(M.sum(rec.map((r, j) => (r - v[j]) ** 2)) / Math.max(eTot, 1e-12));
    // 帕塞瓦尔：保留能量 = 1 - 残差能量 / 总能量
    const keep = 1 - M.sum(rec.map((r, j) => (r - v[j]) ** 2)) / Math.max(eTot, 1e-12);
    const L = layer(N, K);
    S2 = { N, K, xs, v, rec, Ak, Bk, fullA: full.Ak, fullB: full.Bk, L };
    ns.k.set(`${K}<small>/ ${N / 2}</small>`);
    ns.e.set(`${(keep * 100).toFixed(1)}<small>%</small>`); ns.r.set(`${(err * 100).toFixed(1)}<small>%</small>`);
    ns.p.set(`${K + 1}<small>个复数，与 N 无关</small>`);
    // 分辨率无关性：同一组 R_k 用在 1024 点网格上
    const ref = layer(1024, K), step = 1024 / N;
    let d = 0, sc = 0; L.out.forEach((o, j) => { d = Math.max(d, Math.abs(o - ref.out[j * step])); sc = Math.max(sc, Math.abs(ref.out[j * step])); });
    const bookNote = nPre === 0 && rMode === 3 && K === 1 && Math.abs(nW.get() - 2) < 1e-9 && !nAct.get() ? '书中算例：输出正是 $9+12\\cos x+\\cos 10x$。' : nPre === 1 && rMode === 4 && K === 1 && Math.abs(nW.get() - 0.5) < 1e-9 && !nAct.get() ? '练习 14.2：输出正是 $2.5+4\\cos x+0.5\\sin x+0.4\\cos 8x$。' : '';
    $('#n-res-cap').innerHTML = bookNote + `同一组谱权重分别用在 $N=${N}$ 与 $N=1024$ 的网格上，在共同网格点处输出的最大差为 <b>${M.fmt(d, 2)}</b>（相对 ${M.fmt(d / Math.max(sc, 1e-12) * 100, 2)}%）。${d / Math.max(sc, 1e-12) > 0.01 ? '差距来自粗网格上的高频混叠：输入里高于 N/2 的频率被折叠到低频。' : '只要网格能分辨输入的主要频率，结果就与分辨率无关。'}`;
    LAB.renderMath($('#n-res-cap'));
    renderPipe();
    recon.redraw(); specN.redraw(); layerCv.redraw();
  }
  update2();

  /* ================= 实验 3：PINN 残差与激活函数 ================= */
  const ACT = {
    tanh: (z) => { const s = Math.tanh(z), d1 = 1 - s * s, d2 = -2 * s * d1, d3 = -2 * d1 * d1 + 4 * s * s * d1; return [s, d1, d2, d3]; },
    silu: (z) => { const g = 1 / (1 + Math.exp(-z)), g1 = g * (1 - g), g2 = g1 * (1 - 2 * g), g3 = g2 * (1 - 2 * g) - 2 * g1 * g1; return [z * g, g + z * g1, 2 * g1 + z * g2, 3 * g2 + z * g3]; },
    relu: (z) => [Math.max(0, z), z > 0 ? 1 : 0, 0, 0],
  };
  const ACT_KEYS = ['tanh', 'silu', 'relu'];
  let mode3 = 0, actK = 'tanh';
  const J = 24, NC = 200, ITERS = 3000;
  const R3 = LAB.rng(31);
  const COL = M.range(NC).map(() => [R3() * Math.PI, R3()]);
  const ICX = M.range(40).map((i) => Math.PI * (i + 0.5) / 40), BCT = M.range(20).map((i) => (i + 0.5) / 20);
  const kapS = LAB.slider('#p-kappa', { label: '扩散系数 $\\kappa$', min: 0.1, max: 1, step: 0.05, value: 0.5, fmt: (v) => v.toFixed(2), onInput: () => { if (mode3 === 1) { pRun.stop(); resetNet(); } update3(); } });
  const mA = LAB.slider('#p-manual', { label: '振幅 $A$', min: 0, max: 2, step: 0.01, value: 1, fmt: (v) => v.toFixed(2), onInput: () => update3() });
  const mL = LAB.slider('#p-manual', { label: '衰减率 $\\lambda$', min: 0, max: 2, step: 0.01, value: 0.2, fmt: (v) => v.toFixed(2), onInput: () => update3() });
  const mW = LAB.slider('#p-manual', { label: '频率 $\\omega$', min: 0.5, max: 3, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), onInput: () => update3() });
  $('#p-manual').insertAdjacentHTML('afterbegin', '<div class="small muted" style="margin-top:6px">候选解 $\\hat u(x,t)=A\\,e^{-\\lambda t}\\sin(\\omega x)$：</div>');
  LAB.renderMath($('#p-manual'));
  LAB.segmented('#p-mode', ['手调候选解', '训练小网络'], 0, (i) => { mode3 = i; pRun.stop(); $('#p-manual').style.display = i ? 'none' : ''; $('#p-net').style.display = i ? '' : 'none'; update3(); });
  $('#p-net').style.display = 'none';
  LAB.segmented('#p-act', ['tanh', 'SiLU', 'ReLU'], 0, (i) => { actK = ACT_KEYS[i]; pRun.stop(); resetNet(); update3(); });
  // --- 网络 ---
  let net = null, adam = null, hist = [], iter = 0, seed3 = 5;
  function resetNet() {
    const R = LAB.rng(seed3);
    net = { a: [], b: [], d: [], c: [], c0: 0 };
    for (let j = 0; j < J; j++) { net.a.push(R.normal()); net.b.push(R.normal()); net.d.push(R.normal() * 1.5); net.c.push(R.normal() / Math.sqrt(J)); }
    adam = { m: { a: new Float64Array(J), b: new Float64Array(J), d: new Float64Array(J), c: new Float64Array(J), c0: 0 }, v: { a: new Float64Array(J), b: new Float64Array(J), d: new Float64Array(J), c: new Float64Array(J), c0: 0 } };
    hist = []; iter = 0;
  }
  function netEval(x, t) { // 返回 [u, u_t, u_xx]
    const act = ACT[actK]; let u = net.c0, ut_ = 0, uxx = 0;
    for (let j = 0; j < J; j++) { const s = act(net.a[j] * x + net.b[j] * t + net.d[j]); u += net.c[j] * s[0]; ut_ += net.c[j] * net.b[j] * s[1]; uxx += net.c[j] * net.a[j] * net.a[j] * s[2]; }
    return [u, ut_, uxx];
  }
  function trainStep() {
    const act = ACT[actK], kap = kapS.get(), G = { a: new Float64Array(J), b: new Float64Array(J), d: new Float64Array(J), c: new Float64Array(J), c0: 0 };
    let Lp = 0, Lb = 0; const cache = new Array(J);
    for (const [x, t] of COL) {
      let r = 0;
      for (let j = 0; j < J; j++) { const s = act(net.a[j] * x + net.b[j] * t + net.d[j]); cache[j] = s; r += net.c[j] * (net.b[j] * s[1] - kap * net.a[j] * net.a[j] * s[2]); }
      Lp += r * r / NC; const f = 2 * r / NC;
      for (let j = 0; j < J; j++) {
        const [, s1, s2, s3] = cache[j], a = net.a[j], b = net.b[j], c = net.c[j];
        G.c[j] += f * (b * s1 - kap * a * a * s2);
        G.b[j] += f * c * (s1 + b * s2 * t - kap * a * a * s3 * t);
        G.a[j] += f * c * (b * s2 * x - kap * (2 * a * s2 + a * a * s3 * x));
        G.d[j] += f * c * (b * s2 - kap * a * a * s3);
      }
    }
    const pts = [];
    ICX.forEach((x) => pts.push([x, 0, Math.sin(x), 1 / ICX.length]));
    BCT.forEach((t) => { pts.push([0, t, 0, 0.5 / BCT.length]); pts.push([Math.PI, t, 0, 0.5 / BCT.length]); });
    for (const [x, t, target, wt] of pts) {
      let u = net.c0;
      for (let j = 0; j < J; j++) { const s = act(net.a[j] * x + net.b[j] * t + net.d[j]); cache[j] = s; u += net.c[j] * s[0]; }
      const e = u - target; Lb += wt * e * e; const f = 2 * wt * e; G.c0 += f;
      for (let j = 0; j < J; j++) { const [s0, s1] = cache[j]; G.c[j] += f * s0; G.a[j] += f * net.c[j] * s1 * x; G.b[j] += f * net.c[j] * s1 * t; G.d[j] += f * net.c[j] * s1; }
    }
    iter++;
    const lr = 0.01, b1 = 0.9, b2 = 0.999, c1 = 1 - b1 ** iter, c2 = 1 - b2 ** iter;
    ['a', 'b', 'd', 'c'].forEach((k) => { for (let j = 0; j < J; j++) { const g = G[k][j]; adam.m[k][j] = b1 * adam.m[k][j] + (1 - b1) * g; adam.v[k][j] = b2 * adam.v[k][j] + (1 - b2) * g * g; net[k][j] -= lr * (adam.m[k][j] / c1) / (Math.sqrt(adam.v[k][j] / c2) + 1e-8); } });
    adam.m.c0 = b1 * adam.m.c0 + (1 - b1) * G.c0; adam.v.c0 = b2 * adam.v.c0 + (1 - b2) * G.c0 * G.c0; net.c0 -= lr * (adam.m.c0 / c1) / (Math.sqrt(adam.v.c0 / c2) + 1e-8);
    return [Lp, Lb];
  }
  // --- 统一接口：u, u_t, u_xx ---
  function cand(x, t) {
    if (mode3 === 1) return netEval(x, t);
    const u = mA.get() * Math.exp(-mL.get() * t) * Math.sin(mW.get() * x);
    return [u, -mL.get() * u, -mW.get() * mW.get() * u];
  }
  function losses() {
    const kap = kapS.get(); let Lp = 0, Lb = 0;
    COL.forEach(([x, t]) => { const [, a, b] = cand(x, t); const r = a - kap * b; Lp += r * r / NC; });
    ICX.forEach((x) => { const e = cand(x, 0)[0] - Math.sin(x); Lb += e * e / ICX.length; });
    BCT.forEach((t) => { Lb += (cand(0, t)[0] ** 2 + cand(Math.PI, t)[0] ** 2) * 0.5 / BCT.length; });
    let e2 = 0, n2 = 0;
    for (let i = 0; i <= 24; i++) for (let q = 0; q <= 10; q++) { const x = Math.PI * i / 24, t = q / 10, ex = Math.exp(-kap * t) * Math.sin(x); e2 += (cand(x, t)[0] - ex) ** 2; n2 += ex * ex; }
    return { Lp, Lb, rel: Math.sqrt(e2 / n2) };
  }
  const pRun = anim('pinn', () => {
    let L = null; for (let s = 0; s < 15 && iter < ITERS; s++) L = trainStep();
    if (L) { const ls = losses(); hist.push([iter, L[0], L[1], ls.rel]); }
    update3();
    return iter < ITERS;
  }, () => { $('#p-train').innerHTML = iter >= ITERS ? '✓ 训练完成' : '▶ 继续训练'; });
  $('#p-train').onclick = () => { if (pRun.running) { pRun.stop(); return; } if (iter >= ITERS) { resetNet(); } pRun.start(); $('#p-train').innerHTML = '❚❚ 暂停'; };
  $('#p-reset').onclick = () => { pRun.stop(); seed3++; resetNet(); $('#p-train').innerHTML = '▶ 训练'; update3(); };
  const ps = { lp: LAB.stat('#p-stats', '物理损失 $L_{\\text{pde}}$', 'coral'), lb: LAB.stat('#p-stats', '初值与边界损失', 'amber'), rel: LAB.stat('#p-stats', '与真解的相对误差', 'plum'), it: LAB.stat('#p-stats', '迭代步数') };
  const SCALE = 0.3;
  const resCv = LAB.canvas('#p-res', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: Math.PI, ymin: 0, ymax: 1, xtickValues: [0, Math.PI / 2, Math.PI], xfmt: piFmt, yticks: 2, xlabel: 'x', ylabel: 't', grid: false, pad: { l: 44, r: 10, t: 8, b: 36 } });
    const nx = 48, nt = 24, kap = kapS.get(), cw = (P.x1 - P.x0) / nx, chh = (P.y0 - P.y1) / nt;
    for (let i = 0; i < nx; i++) for (let q = 0; q < nt; q++) {
      const x = Math.PI * (i + 0.5) / nx, t = (q + 0.5) / nt, [, a, b] = cand(x, t);
      ctx.fillStyle = LAB.diverge((a - kap * b) / SCALE); ctx.fillRect(P.x0 + i * cw, P.y0 - (q + 1) * chh, cw + 0.6, chh + 0.6);
    }
    P.axes();
    P.points(COL.map((p) => p[0]), COL.map((p) => p[1]), 'rgba(31,35,41,.45)', 1.3);
    P.text(Math.PI * 0.98, 0.95, `色标 ±${SCALE}`, C.slate, 'right', 'middle', '11px ' + FONT);
  });
  const sliceCv = LAB.canvas('#p-slice', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: Math.PI, ymin: -0.1, ymax: 1.3, xtickValues: [0, Math.PI / 2, Math.PI], xfmt: piFmt, yticks: 4, xlabel: 'x', pad: { l: 34, r: 10, t: 8, b: 36 } }).axes();
    const xs = M.linspace(0, Math.PI, 120), kap = kapS.get();
    [[0, C.c1], [0.5, C.c6], [1, C.c5]].forEach(([t, col]) => {
      P.line(xs, xs.map((x) => Math.exp(-kap * t) * Math.sin(x)), col, 1.4, [5, 4]);
      P.line(xs, xs.map((x) => cand(x, t)[0]), col, 2.4);
    });
  });
  const lossCv = LAB.canvas('#p-loss', (ctx, w, h) => {
    if (mode3 === 0) {
      const kap = kapS.get(), Av = mA.get(), om = mW.get();
      // L_pde(λ) = (κω² − λ)² · mean(A² e^{−2λt} sin²(ωx))
      const f = (lam) => { let s = 0; COL.forEach(([x, t]) => { const u = Av * Math.exp(-lam * t) * Math.sin(om * x); s += (kap * om * om - lam) ** 2 * u * u / NC; }); return s; };
      const ys = M.linspace(0, 2, 101).map(f), Y = niceMax(Math.max(0.05, ...ys) * 1.1);
      const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 2, ymin: 0, ymax: Y, xlabel: '衰减率 λ', ylabel: 'L_pde', yticks: 4, pad: { l: 46, r: 10, t: 10, b: 36 } }).axes();
      P.line(M.linspace(0, 2, 101), ys, C.c4, 2.4);
      const l0 = kap * om * om; if (l0 <= 2) { P.vline(l0, C.leaf, [4, 3], 1.4); P.text(l0, Y * 0.92, ` λ = κω² = ${l0.toFixed(2)}`, C.leaf, l0 > 1.4 ? 'right' : 'left', 'middle', NUM); }
      P.points([mL.get()], [f(mL.get())], C.c4, 5.5, '#fff');
      return;
    }
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: ITERS, ymin: 1e-7, ymax: 10, logy: true, xlabel: '迭代步数', yticks: 4, pad: { l: 46, r: 10, t: 10, b: 36 } }).axes();
    if (hist.length > 1) {
      const it = hist.map((r) => r[0]), cl = (v) => Math.max(1.1e-7, v);
      P.line(it, hist.map((r) => cl(r[1])), C.c4, 2);
      P.line(it, hist.map((r) => cl(r[2])), C.c2, 2);
      P.line(it, hist.map((r) => cl(r[3])), C.c5, 2.2, [5, 3]);
    }
  });
  const actCv = LAB.canvas('#p-actplot', (ctx, w, h) => {
    const act = ACT[actK], zs = M.linspace(-4, 4, 241), v = zs.map(act);
    const P = new LAB.Plot(ctx, w, h, { xmin: -4, xmax: 4, ymin: -1.2, ymax: 1.6, xlabel: 'z', yticks: 4, pad: { l: 36, r: 10, t: 10, b: 36 } }).axes();
    P.hline(0, GREY, null, 1);
    P.line(zs, v.map((r) => r[0]), C.navy, 2.2);
    if (actK === 'relu') { P.line(zs.filter((z) => z < 0), zs.filter((z) => z < 0).map(() => 0), C.c2, 2); P.line(zs.filter((z) => z > 0), zs.filter((z) => z > 0).map(() => 1), C.c2, 2); }
    else P.line(zs, v.map((r) => r[1]), C.c2, 2);
    P.line(zs, v.map((r) => r[2]), C.c4, 2.4);
    P.text(-3.9, 1.45, { tanh: 'tanh', silu: 'SiLU', relu: 'ReLU：σ″ ≡ 0' }[actK], actK === 'relu' ? C.coral : C.navy, 'left', 'middle', NUM);
  });
  function update3() {
    const ls = losses();
    const f0 = (v) => (v < 1e-12 ? '0' : M.fmt(v, 2));
    ps.lp.set(f0(ls.Lp)); ps.lb.set(f0(ls.Lb)); ps.rel.set(`${(ls.rel * 100).toFixed(ls.rel < 0.1 ? 2 : 1)}<small>%</small>`);
    ps.it.set(mode3 === 1 ? `${iter}<small>/ ${ITERS}</small>` : '–');
    $('#p-loss-title').innerHTML = mode3 === 0 ? '物理损失随 $\\lambda$ 的变化' : '训练曲线（对数刻度）';
    $('#p-loss-legend').innerHTML = mode3 === 0 ? '<span><i style="background:var(--c4)"></i>$L_{\\text{pde}}(\\lambda)$，其他参数固定</span><span><i style="background:var(--c3)"></i>残差归零的位置</span>'
      : '<span><i style="background:var(--c4)"></i>物理损失</span><span><i style="background:var(--c2)"></i>初值与边界</span><span><i style="background:var(--c5)"></i>与真解的相对误差（训练中看不到）</span>';
    LAB.renderMath($('#p-loss-title')); LAB.renderMath($('#p-loss-legend'));
    resCv.redraw(); sliceCv.redraw(); lossCv.redraw(); actCv.redraw();
  }
  resetNet(); update3();

  // 书中手算：两端 u(0)=0、u(1)=10 都对上的甲 10y 与乙 10y^2；当前候选 u=(1-c)·10y+c·10y^2，u''=20c
  const bs = { d: LAB.stat('#b-stats', '端点数据误差', 'leaf'), u2: LAB.stat('#b-stats', "$u''(y)=20c$", 'amber'), p: LAB.stat('#b-stats', "物理罚分 $(u'')^2$", 'coral') };
  const bC = LAB.slider('#b-c', { label: '模型乙的成分 $c$（$0$ = 甲，$1$ = 乙）', min: 0, max: 1, step: 0.01, value: 1, fmt: (v) => v.toFixed(2), onInput: () => { bPlot.redraw(); updB(); } });
  function updB() { const c = bC.get(); bs.d.set('0'); bs.u2.set((20 * c).toFixed(1)); bs.p.set((400 * c * c).toFixed(1)); }
  const bPlot = LAB.canvas('#b-plot', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: 0, ymax: 11, xlabel: '位置 y', ylabel: '温度 u', xtickValues: [0, 0.25, 0.5, 0.75, 1], ytickValues: [0, 5, 10], pad: { l: 42, r: 12, t: 10, b: 38 } }).axes();
    const ys = M.linspace(0, 1, 101), c = bC.get();
    P.line(ys, ys.map((y) => 10 * y), C.c6, 1.6, [5, 4]);
    P.line(ys, ys.map((y) => 10 * y * y), C.c4, 1.6, [5, 4]);
    P.line(ys, ys.map((y) => (1 - c) * 10 * y + c * 10 * y * y), C.navy, 2.6);
    P.points([0, 1], [0, 10], C.amber, 5.5, '#fff');
  });
  updB();
})();
