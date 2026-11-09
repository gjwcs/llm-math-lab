/* 第 9 章：非凸优化的导航仪：交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §9.1 窄山谷与动量手算 · §9.2 Adam 偏差校正与 AdamW · §9.3 预热 + 余弦退火 · §9.4 全流程手算算例' });

  const $ = (s) => document.querySelector(s);
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (e) => String(e).split('').map((c) => SUP[c]).join('');
  const fe = (x) => { if (!isFinite(x)) return '–'; if (x === 0) return '0'; const a = Math.abs(x); if (a >= 1000 && a < 1e4) return String(Math.round(x)); if (a >= 0.01 && a < 1e4) return x.toPrecision(3); const e = Math.floor(Math.log10(a)); return (x / Math.pow(10, e)).toFixed(1) + '×10' + sup(e); };
  const texNum = (x) => { const a = Math.abs(x); if (a >= 0.01 && a < 1e4) return String(+x.toPrecision(3)); const e = Math.floor(Math.log10(a)), m = +(x / Math.pow(10, e)).toFixed(1); return (m === 1 ? '' : m + '\\times ') + '10^{' + e + '}'; };
  const isOn = (id) => document.getElementById(id).classList.contains('active');
  function pointer(el, h) {
    el = typeof el === 'string' ? $(el) : el;
    const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let on = false;
    el.addEventListener('pointerdown', (e) => { on = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} h.down && h.down(...pos(e)); e.preventDefault(); });
    el.addEventListener('pointermove', (e) => { if (on && h.move) h.move(...pos(e)); });
    const end = () => { if (on) { on = false; h.up && h.up(); } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  function logTicks(e0, e1) { const step = Math.max(1, Math.ceil((e1 - e0) / 6)), t = []; for (let e = Math.ceil(e0 / step) * step; e <= e1; e += step) t.push(Math.pow(10, e)); return t; }
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

  /* ================= 实验 1：地形赛跑 ================= */
  const wellsF = (x, y) => -2 * Math.exp(-((x - 1.5) ** 2 + (y - 1) ** 2) / 0.8) - 1.4 * Math.exp(-((x + 1.6) ** 2 + (y + 0.8) ** 2) / 1.0) - 1.0 * Math.exp(-((x + 0.5) ** 2 + (y - 1.6) ** 2) / 0.3) + 0.06 * (x * x + y * y);
  const LANDS = [
    { name: '窄山谷', tex: 'f(x,y)=x^2+25y^2', f: (x, y) => x * x + 25 * y * y, g: (x, y) => [2 * x, 50 * y], dom: [-3, 11, -1.6, 1.6], start: [10, 1], mins: [[0, 0]], steps: 60, lr: [0.035, 0.035, 1.0, 1.0], beta: 0.5, lam: 0.1, book: true },
    { name: '鞍点', tex: 'f=\\tfrac12x^2-\\tfrac12y^2+\\tfrac14y^4', f: (x, y) => 0.5 * x * x - 0.5 * y * y + 0.25 * y ** 4, g: (x, y) => [x, -y + y ** 3], dom: [-3, 3, -1.6, 1.6], start: [-2.8, 0.0005], mins: [[0, 1], [0, -1]], steps: 300, lr: [0.1, 0.08, 0.05, 0.05], beta: 0.9, lam: 0.05, snap: true },
    { name: '香蕉谷', tex: 'f=(1-x)^2+100(y-x^2)^2', f: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2, g: (x, y) => [-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)], dom: [-2, 2, -1, 3], start: [-1.2, 1], mins: [[1, 1]], steps: 1000, lr: [0.002, 0.002, 0.1, 0.1], beta: 0.9, lam: 0.02 },
    { name: '多井', tex: 'f=-\\textstyle\\sum_{j=1}^3 a_je^{-\\|(x,y)-\\mathbf c_j\\|^2/s_j}+0.06(x^2+y^2)', f: wellsF, g: (x, y) => { const h = 1e-5; return [(wellsF(x + h, y) - wellsF(x - h, y)) / (2 * h), (wellsF(x, y + h) - wellsF(x, y - h)) / (2 * h)]; }, dom: [-3, 3, -3, 3], start: [-2.5, 2.5], mins: null, steps: 400, lr: [0.2, 0.15, 0.05, 0.05], beta: 0.9, lam: 0.05 },
  ];
  // 多井地形的全局最小值：网格搜索 + 梯度下降精修
  { const Ld = LANDS[3]; let best = [0, 0], bv = Infinity; for (let i = 0; i <= 120; i++) for (let j = 0; j <= 120; j++) { const x = -3 + i / 20, y = -3 + j / 20, v = Ld.f(x, y); if (v < bv) { bv = v; best = [x, y]; } } for (let k = 0; k < 2000; k++) { const g = Ld.g(...best); best = [best[0] - 0.05 * g[0], best[1] - 0.05 * g[1]]; } Ld.mins = [best]; }
  LANDS.forEach((Ld) => { Ld.fmin = Math.min(...Ld.mins.map((m) => Ld.f(...m))); });
  const OPTS = [
    { key: 'sgd', name: 'SGD', color: C.c4, range: [-4, 0], cls: 'coral' },
    { key: 'mom', name: '动量法', color: C.c2, range: [-4, 0.5], cls: 'amber' },
    { key: 'adam', name: 'Adam', color: C.c1, range: [-3.5, 0], cls: '' },
    { key: 'adamw', name: 'AdamW', color: C.c3, range: [-3.5, 0], cls: 'leaf' },
  ];
  const O = { land: 0, start: LANDS[0].start.slice(), lr: LANDS[0].lr.slice(), on: [true, true, true, true], beta: LANDS[0].beta, lam: LANDS[0].lam, noise: false, sigma: 0.3, speed: 1, running: false, t: 0 };
  let racers = [];
  function resetRacers() {
    O.t = 0;
    racers = OPTS.map((o, i) => ({ x: O.start[0], y: O.start[1], m: [0, 0], v: [0, 0], path: [O.start.slice()], loss: [lossAt(...O.start)], dead: false, R: LAB.rng(500 + i * 17) }));
  }
  const lossAt = (x, y) => Math.max(LANDS[O.land].f(x, y) - LANDS[O.land].fmin, 1e-16);
  function stepAll() {
    const Ld = LANDS[O.land], b1 = 0.9, b2 = 0.999, eps = 1e-8;
    O.t++;
    const t = O.t, span = Math.max(Ld.dom[1] - Ld.dom[0], Ld.dom[3] - Ld.dom[2]);
    racers.forEach((r, i) => {
      if (!O.on[i] || r.dead) return;
      let g = Ld.g(r.x, r.y);
      if (O.noise) g = [g[0] + O.sigma * r.R.normal(), g[1] + O.sigma * r.R.normal()];
      const lr = O.lr[i], key = OPTS[i].key;
      if (key === 'sgd') { r.x -= lr * g[0]; r.y -= lr * g[1]; }
      else if (key === 'mom') { r.m = r.m.map((a, k) => O.beta * a + g[k]); r.x -= lr * r.m[0]; r.y -= lr * r.m[1]; }
      else {
        r.m = r.m.map((a, k) => b1 * a + (1 - b1) * g[k]); r.v = r.v.map((a, k) => b2 * a + (1 - b2) * g[k] * g[k]);
        const u = r.m.map((a, k) => (a / (1 - Math.pow(b1, t))) / (Math.sqrt(r.v[k] / (1 - Math.pow(b2, t))) + eps));
        const lam = key === 'adamw' ? O.lam : 0;
        r.x -= lr * (u[0] + lam * r.x); r.y -= lr * (u[1] + lam * r.y);
      }
      if (!isFinite(r.x) || !isFinite(r.y) || Math.abs(r.x) > 40 * span || Math.abs(r.y) > 40 * span) { r.dead = true; return; }
      r.path.push([r.x, r.y]); r.loss.push(lossAt(r.x, r.y));
    });
  }
  // 控件
  LAB.segmented('#o-land', LANDS.map((l) => l.name), 0, (i) => { O.land = i; const Ld = LANDS[i]; O.start = Ld.start.slice(); O.lr = Ld.lr.slice(); O.lam = Ld.lam; O.beta = Ld.beta; lrSliders.forEach((s, k) => s.set(Math.log10(O.lr[k]))); lamS.set(O.lam); betaS.set(O.beta); fieldCache = null; showFormula(); restart(true); });
  function showFormula() { $('#o-formula').innerHTML = LAB.tex(LANDS[O.land].tex, true); }
  const optHost = $('#o-opts');
  const pills = document.createElement('div'); pills.className = 'pill-row'; pills.style.margin = '6px 0 2px'; optHost.appendChild(pills);
  OPTS.forEach((o, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pill on'; b.style.background = o.color; b.style.borderColor = o.color; b.textContent = o.name;
    b.onclick = () => { O.on[i] = !O.on[i]; b.classList.toggle('on', O.on[i]); b.style.background = O.on[i] ? o.color : '#fff'; b.style.color = O.on[i] ? '#fff' : o.color; mapCv.redraw(); lossCv.redraw(); stats1(); };
    pills.appendChild(b);
  });
  const lrSliders = OPTS.map((o, i) => LAB.slider(optHost, { label: `<b style="color:${o.color}">●</b> ${o.name} 的学习率 $\\eta$`, min: o.range[0], max: o.range[1], step: 0.001, value: Math.log10(O.lr[i]), fmt: (v) => fe(Math.pow(10, v)), onInput: (v) => { O.lr[i] = Math.pow(10, v); restart(true); } }));
  const betaS = LAB.slider('#o-beta', { label: '动量系数 $\\beta$（$m_t=\\beta m_{t-1}+g_t$）', min: 0, max: 0.95, step: 0.05, value: O.beta, fmt: (v) => v.toFixed(2), onInput: (v) => { O.beta = v; restart(true); } });
  const lamS = LAB.slider('#o-lam', { label: 'AdamW 权重衰减 $\\lambda$', min: 0, max: 0.5, step: 0.01, value: O.lam, fmt: (v) => v.toFixed(2), onInput: (v) => { O.lam = v; restart(true); } });
  LAB.checkbox('#o-noise', '给梯度加噪声（模拟小批量 SGD）', false, (v) => { O.noise = v; restart(true); });
  LAB.slider('#o-sigma', { label: '噪声标准差 $\\sigma$', min: -2, max: 1, step: 0.05, value: Math.log10(O.sigma), fmt: (v) => fe(Math.pow(10, v)), onInput: (v) => { O.sigma = Math.pow(10, v); if (O.noise) restart(true); } });
  LAB.slider('#o-speed', { label: '动画速度（步 / 帧）', min: 1, max: 10, step: 1, value: O.speed, onInput: (v) => { O.speed = v; } });
  const playBtn = $('#o-play');
  function setRunning(on) { O.running = on; playBtn.textContent = on ? '⏸ 暂停' : (O.t >= LANDS[O.land].steps ? '▶ 再跑一次' : '▶ 开始'); if (on) requestAnimationFrame(loop); }
  function loop() {
    if (!O.running) return;
    if (!isOn('race')) { setRunning(false); return; }
    const Ld = LANDS[O.land];
    for (let k = 0; k < O.speed && O.t < Ld.steps; k++) stepAll();
    mapCv.redraw(); lossCv.redraw(); stats1();
    if (O.t >= Ld.steps || racers.every((r, i) => !O.on[i] || r.dead)) { setRunning(false); return; }
    requestAnimationFrame(loop);
  }
  function restart(autoplay) { resetRacers(); mapCv.redraw(); lossCv.redraw(); stats1(); if (autoplay && !O.running) setRunning(true); }
  playBtn.onclick = () => { if (O.running) setRunning(false); else { if (O.t >= LANDS[O.land].steps) resetRacers(); setRunning(true); } };
  $('#o-reset').onclick = () => { setRunning(false); const Ld = LANDS[O.land]; O.start = Ld.start.slice(); O.lr = Ld.lr.slice(); O.lam = Ld.lam; O.beta = Ld.beta; lrSliders.forEach((s, k) => s.set(Math.log10(O.lr[k]))); lamS.set(O.lam); betaS.set(O.beta); restart(false); };
  // 等高线底图（缓存）
  let fieldCache = null;
  function field(P) {
    const Ld = LANDS[O.land], key = O.land + ':' + Math.round(P.x1 - P.x0) + 'x' + Math.round(P.y0 - P.y1);
    if (fieldCache && fieldCache.key === key) return fieldCache;
    const nx = 160, ny = 110, [x0, x1, y0, y1] = Ld.dom, grid = new Float64Array(nx * ny);
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = x0 + ((x1 - x0) * i) / (nx - 1), y = y1 - ((y1 - y0) * j) / (ny - 1), v = Math.log(Ld.f(x, y) - Ld.fmin + 0.02); grid[j * nx + i] = v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    for (let k = 0; k < grid.length; k++) grid[k] = (grid[k] - lo) / (hi - lo);
    const off = document.createElement('canvas'); off.width = nx; off.height = ny;
    const oc = off.getContext('2d'), img = oc.createImageData(nx, ny), Bands = 14;
    const c0 = [255, 255, 255], c1 = [206, 221, 238];
    for (let k = 0; k < grid.length; k++) { const t = Math.floor(grid[k] * Bands) / Bands; for (let q = 0; q < 3; q++) img.data[4 * k + q] = Math.round(c0[q] + (c1[q] - c0[q]) * t); img.data[4 * k + 3] = 255; }
    oc.putImageData(img, 0, 0);
    fieldCache = { key, off, grid, nx, ny, Bands };
    return fieldCache;
  }
  const mapCv = LAB.canvas('#o-map', (ctx, w, h) => {
    const Ld = LANDS[O.land], [x0, x1, y0, y1] = Ld.dom;
    const P = new LAB.Plot(ctx, w, h, { xmin: x0, xmax: x1, ymin: y0, ymax: y1, grid: false, xlabel: 'x（东西）', ylabel: 'y（南北）', pad: { l: 40, r: 10, t: 10, b: 34 } });
    mapCv._P = P;
    const F = field(P);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(F.off, P.x0, P.y1, P.x1 - P.x0, P.y0 - P.y1); ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(44,79,124,.22)'; ctx.lineWidth = 0.9;
    const toX = (i) => P.x0 + (i / (F.nx - 1)) * (P.x1 - P.x0), toY = (j) => P.y1 + (j / (F.ny - 1)) * (P.y0 - P.y1);
    for (let b = 1; b < F.Bands; b++) contour(ctx, F.grid, F.nx, F.ny, b / F.Bands, toX, toY);
    ctx.restore();
    P.axes();
    P.clip();
    Ld.mins.forEach((m) => { ctx.save(); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(P.tx(m[0]), P.ty(m[1]), 4.5, 0, 7); ctx.fill(); ctx.restore(); });
    racers.forEach((r, i) => {
      if (!O.on[i]) return;
      const xs = r.path.map((p) => p[0]), ys = r.path.map((p) => p[1]);
      P.line(xs, ys, OPTS[i].color, 2, null);
      const last = r.path[r.path.length - 1];
      if (r.dead) { ctx.save(); ctx.strokeStyle = OPTS[i].color; ctx.lineWidth = 3; const X = P.tx(last[0]), Y = P.ty(last[1]); ctx.beginPath(); ctx.moveTo(X - 6, Y - 6); ctx.lineTo(X + 6, Y + 6); ctx.moveTo(X + 6, Y - 6); ctx.lineTo(X - 6, Y + 6); ctx.stroke(); ctx.restore(); }
      else P.points([last[0]], [last[1]], OPTS[i].color, 5.5, '#fff');
    });
    P.unclip();
    ctx.save(); ctx.fillStyle = C.navy; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P.tx(O.start[0]), P.ty(O.start[1]), 6, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
    $('#o-step').textContent = `第 ${O.t} / ${Ld.steps} 步`;
  });
  function setStart(px, py) {
    const P = mapCv._P; if (!P) return;
    const Ld = LANDS[O.land]; let x = M.clamp(P.ix(px), Ld.dom[0], Ld.dom[1]), y = M.clamp(P.iy(py), Ld.dom[2], Ld.dom[3]);
    if (Ld.snap && Math.abs(y) < 0.08) y = y < 0 ? -0.0005 : 0.0005;
    O.start = [x, y]; setRunning(false); resetRacers(); mapCv.redraw(); lossCv.redraw(); stats1();
  }
  pointer('#o-map', { down: setStart, move: setStart, up: () => setRunning(true) });
  const lossCv = LAB.canvas('#o-loss', (ctx, w, h) => {
    const Ld = LANDS[O.land], vis = racers.filter((r, i) => O.on[i]);
    let lo = Infinity, hi = -Infinity;
    vis.forEach((r) => r.loss.forEach((v) => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
    if (!isFinite(lo)) { lo = 1e-6; hi = 1; }
    const e1 = Math.ceil(Math.log10(hi) + 0.01), e0 = Math.max(Math.floor(Math.log10(lo)), e1 - 16);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: Ld.steps, ymin: Math.pow(10, e0), ymax: Math.pow(10, Math.max(e1, e0 + 1)), logy: true, ytickValues: logTicks(e0, Math.max(e1, e0 + 1)), xlabel: '步数 t', pad: { l: 52, r: 12, t: 12, b: 36 } }).axes();
    P.clip();
    racers.forEach((r, i) => { if (O.on[i]) P.line(M.range(r.loss.length), r.loss.map((v) => Math.max(v, Math.pow(10, e0))), OPTS[i].color, 2.2); });
    P.unclip();
  });
  const ost = OPTS.map((o) => LAB.stat('#o-stats', o.name, o.cls));
  function stats1() { racers.forEach((r, i) => ost[i].set(!O.on[i] ? '<small>未启用</small>' : r.dead ? '发散' : fe(r.loss[r.loss.length - 1]))); hand(); }
  // 前两步落点：独立重算（不受动画进度影响），与书中手算对照
  function twoSteps(i) {
    const Ld = LANDS[O.land], key = OPTS[i].key, lr = O.lr[i], b1 = 0.9, b2 = 0.999, eps = 1e-8;
    let x = O.start[0], y = O.start[1], m = [0, 0], v = [0, 0]; const out = [];
    for (let t = 1; t <= 2; t++) {
      const g = Ld.g(x, y);
      if (key === 'sgd') { x -= lr * g[0]; y -= lr * g[1]; }
      else if (key === 'mom') { m = m.map((a, k) => O.beta * a + g[k]); x -= lr * m[0]; y -= lr * m[1]; }
      else { m = m.map((a, k) => b1 * a + (1 - b1) * g[k]); v = v.map((a, k) => b2 * a + (1 - b2) * g[k] * g[k]); const u = m.map((a, k) => (a / (1 - Math.pow(b1, t))) / (Math.sqrt(v[k] / (1 - Math.pow(b2, t))) + eps)); const lam = key === 'adamw' ? O.lam : 0; x -= lr * (u[0] + lam * x); y -= lr * (u[1] + lam * y); }
      out.push([x, y]);
    }
    return out;
  }
  const BOOK = [[[9.3, -0.75], [8.649, 0.5625]], [[9.3, -0.75], [8.299, -0.3125]], null, [[8.0, -0.1], null]];
  const f4 = (v) => (Math.abs(v) < 5e-5 ? '0' : String(+v.toFixed(4)));
  function hand() {
    const Ld = LANDS[O.land];
    let html = '<tr><th>优化器</th><th>第 1 步 $(x_1,y_1)$</th><th>第 2 步 $(x_2,y_2)$</th><th>书中手算</th></tr>';
    OPTS.forEach((o, i) => {
      const s = twoSteps(i), bk = Ld.book ? BOOK[i] : null;
      const bt = bk ? bk.filter(Boolean).map((p) => `(${p[0]}, ${p[1]})`).join(' → ') : '–';
      html += `<tr><td><b style="color:${o.color}">●</b> ${o.name}</td>${s.map((p) => `<td>(${f4(p[0])}, ${f4(p[1])})</td>`).join('')}<td>${bt}</td></tr>`;
    });
    $('#o-hand').innerHTML = html; LAB.renderMath($('#o-hand'));
    const sameStart = O.start[0] === 10 && O.start[1] === 1;
    $('#o-handnote').innerHTML = Ld.book ? (sameStart ? `南北方向 SGD 每步乘 $1-50\\eta=${(1 - 50 * O.lr[0]).toFixed(3)}$：${Math.abs(1 - 50 * O.lr[0]) < 1 ? '绝对值小于 1，撞墙越撞越低' : '绝对值不小于 1，越撞越高，迟早炸飞'}。书中数值对应 $\\eta_{\\text{SGD}}=\\eta_{\\text{动量}}=0.035$、$\\beta=0.5$、$\\eta_{\\text{AdamW}}=1$、$\\lambda=0.1$。` : '起点已改动，书中手算的数字只适用于起点 $(10,1)$；点“重置”回到书中设定。') : '这是附赠地形，书中没有对应的手算。';
    LAB.renderMath($('#o-handnote'));
  }
  showFormula(); resetRacers(); stats1();
  // 等高线图第一次进入视野时自动开跑（手机上控件在上方，避免还没看到就跑完）
  const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting) && isOn('race')) { io.disconnect(); if (!O.running && O.t === 0) setRunning(true); } }, { threshold: 0.5 });
  io.observe($('#o-map'));

  /* ================= 实验 2：两个记账本与橡皮筋 ================= */
  const BOOKD = { gde: 10, gsh: 0.001, b2: 0.999, w: 2, lam: 1, eta: 0.1 };
  const D = Object.assign({}, BOOKD, { scale: 1, lam2: 0.1, steps: 1000 });
  const B2S = [0.9, 0.95, 0.99, 0.995, 0.999, 0.9995, 0.9999];
  const sGde = LAB.slider('#d-gde', { label: '“的”字的斜率 $g_{\\text{的}}$', min: -4, max: 2, step: 0.1, value: Math.log10(D.gde), fmt: (v) => fe(Math.pow(10, v)), onInput: (v) => { D.gde = Math.pow(10, v); upd2a(); } });
  const sGsh = LAB.slider('#d-gsh', { label: '“熵”字的斜率 $g_{\\text{熵}}$', min: -4, max: 2, step: 0.1, value: Math.log10(D.gsh), fmt: (v) => fe(Math.pow(10, v)), onInput: (v) => { D.gsh = Math.pow(10, v); upd2a(); } });
  const sB2 = LAB.slider('#d-b2', { label: '二号账本留存率 $\\beta_2$', min: 0, max: B2S.length - 1, step: 1, value: B2S.indexOf(D.b2), fmt: (v) => String(B2S[v]), onInput: (v) => { D.b2 = B2S[v]; upd2a(); } });
  const sW = LAB.slider('#d-w', { label: '两个旋钮的刻度 $w$', min: -3, max: 3, step: 0.1, value: D.w, fmt: (v) => v.toFixed(1), onInput: (v) => { D.w = v; upd2a(); } });
  const sL = LAB.slider('#d-lam', { label: '橡皮筋紧度 $\\lambda$', min: 0, max: 2, step: 0.05, value: D.lam, fmt: (v) => v.toFixed(2), onInput: (v) => { D.lam = v; upd2a(); } });
  const sE = LAB.slider('#d-eta', { label: '学习率 $\\eta$', min: 0.01, max: 0.5, step: 0.01, value: D.eta, fmt: (v) => v.toFixed(2), onInput: (v) => { D.eta = v; upd2a(); } });
  $('#d-book').onclick = () => { Object.assign(D, BOOKD); sGde.set(Math.log10(D.gde)); sGsh.set(Math.log10(D.gsh)); sB2.set(B2S.indexOf(D.b2)); sW.set(D.w); sL.set(D.lam); sE.set(D.eta); upd2a(); };
  const ds1 = LAB.stat('#d-stats', '未校正第 1 步步幅', 'coral');
  const ds2 = LAB.stat('#d-stats', '校正后第 1 步步幅', 'leaf');
  const ds3 = LAB.stat('#d-stats', '$L_2$ 拉回：的 / 熵', 'coral');
  const ds4 = LAB.stat('#d-stats', 'AdamW 拉回：的 / 熵', 'leaf');
  const tn = (x) => { if (x === 0) return '0'; const a = Math.abs(x); if (a >= 0.01 && a < 1e5) return String(+x.toPrecision(4)); const e = Math.floor(Math.log10(a)), m = +(x / Math.pow(10, e)).toFixed(3); return (m === 1 ? '' : m + '\\times ') + '10^{' + e + '}'; };
  function upd2a() {
    const b1 = 0.9, b2 = D.b2, rows = [['的', D.gde], ['熵', D.gsh]];
    const raw = (1 - b1) / Math.sqrt(1 - b2);
    $('#d-bias').innerHTML = LAB.tex('\\begin{aligned}' + rows.map(([n, g]) => {
      const m1 = (1 - b1) * g, v1 = (1 - b2) * g * g;
      return `&\\text{“${n}”：}\\ m_1=${tn(m1)},\\ v_1=${tn(v1)},\\quad \\tfrac{m_1}{\\sqrt{v_1}}=\\mathbf{${tn(m1 / Math.sqrt(v1))}},\\quad \\tfrac{\\hat m_1}{\\sqrt{\\hat v_1}}=\\tfrac{${tn(m1 / (1 - b1))}}{\\sqrt{${tn(v1 / (1 - b2))}}}=\\mathbf{1}`;
    }).join('\\\\') + '\\end{aligned}', true);
    const pull = (g) => (D.eta * D.lam * D.w) / Math.abs(g), pw = D.eta * D.lam * D.w;
    $('#d-l2').innerHTML = LAB.tex('\\begin{aligned}' + rows.map(([n, g]) => `&\\text{“${n}”：}\\ \\eta\\cdot\\frac{\\lambda w}{\\sqrt{\\hat v}}=${D.eta}\\times\\frac{${tn(D.lam * D.w)}}{${tn(Math.abs(g))}}=\\mathbf{${tn(pull(g))}}`).join('\\\\') + '\\end{aligned}', true);
    $('#d-wd').innerHTML = LAB.tex(`\\text{两个字都是：}\\ \\eta\\lambda w=${D.eta}\\times${tn(D.lam)}\\times${tn(D.w)}=\\mathbf{${tn(pw)}}`, true);
    ds1.set(raw.toFixed(3)); ds2.set('1.000');
    ds3.set(`${tn(pull(D.gde)).replace('\\times ', '×').replace(/10\^\{(-?\d+)\}/, (_, e) => '10' + sup(e))}<small> / </small>${tn(pull(D.gsh)).replace('\\times ', '×').replace(/10\^\{(-?\d+)\}/, (_, e) => '10' + sup(e))}`);
    ds4.set(`${tn(pw)}<small> / </small>${tn(pw)}`);
  }
  upd2a();
  // 多坐标长程实验
  const NSEED = 32, ETA2 = 0.01;
  let LR = null;
  function longRun() {
    const T = D.steps, sig = M.range(6).map((i) => D.scale * Math.pow(10, i - 3)), b1 = 0.9, b2 = 0.999, eps = 1e-8;
    const res = { sig, L2: [], W: [] };
    sig.forEach((s, ci) => {
      ['L2', 'W'].forEach((meth) => {
        const mean = new Float64Array(T + 1);
        for (let sd = 0; sd < NSEED / 2; sd++) { // 对偶采样：同一串噪声取 ±ξ 各跑一次
          const R = LAB.rng(9000 + ci * 101 + sd);
          const th = [1, 1], m = [0, 0], v = [0, 0]; mean[0] += 2;
          for (let t = 1; t <= T; t++) {
            const xi = s * R.normal(), c1 = 1 - Math.pow(b1, t), c2 = 1 - Math.pow(b2, t);
            for (let q = 0; q < 2; q++) {
              let g = q ? -xi : xi;
              if (meth === 'L2') g += D.lam2 * th[q];
              m[q] = b1 * m[q] + (1 - b1) * g; v[q] = b2 * v[q] + (1 - b2) * g * g;
              const u = m[q] / c1 / (Math.sqrt(v[q] / c2) + eps);
              th[q] -= ETA2 * (u + (meth === 'W' ? D.lam2 * th[q] : 0));
              mean[t] += th[q];
            }
          }
        }
        for (let t = 0; t <= T; t++) mean[t] /= NSEED;
        res[meth].push(mean);
      });
    });
    // 实测每步衰减率：用半衰期，未衰减到一半时用终值
    const rate = (arr) => { const k = arr.findIndex((v) => v <= 0.5); return k > 0 ? Math.LN2 / k : Math.max(-Math.log(Math.max(arr[T], 1e-9)) / T, 1e-9); };
    res.rL2 = res.L2.map(rate); res.rW = res.W.map(rate);
    LR = res;
  }
  const SCOL = M.range(6).map((i) => LAB.mix(C.c2, C.navy, i / 5));
  function thetaPlot(ctx, w, h, arrs, title) {
    const T = D.steps, xs = M.range(T + 1);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: T, ymin: -0.1, ymax: 1.08, yticks: 4, xlabel: '步数 t', ylabel: 'E[θ_t]', pad: { l: 44, r: 10, t: 22, b: 36 } }).axes();
    P.hline(0, '#9aa5b1', null, 1);
    P.clip(); arrs.forEach((a, i) => P.line(xs, Array.from(a), SCOL[i], 2)); P.unclip();
    ctx.save(); ctx.fillStyle = C.ink; ctx.font = '600 12.5px PingFang SC, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(title, P.x0 + 4, 14); ctx.restore();
    return P;
  }
  const l2Cv = LAB.canvas('#d-l2plot', (ctx, w, h) => { if (LR) thetaPlot(ctx, w, h, LR.L2, 'Adam + L2'); });
  const wCv = LAB.canvas('#d-wplot', (ctx, w, h) => { if (!LR) return; const P = thetaPlot(ctx, w, h, LR.W, 'AdamW'); P.fn((t) => Math.pow(1 - ETA2 * D.lam2, t), C.slate, 1.2, [4, 4]); });
  const rateCv = LAB.canvas('#d-rate', (ctx, w, h) => {
    if (!LR) return;
    const s = LR.sig, xmin = s[0] / 4, xmax = s[5] * 4, el = ETA2 * D.lam2;
    const all = LR.rL2.concat(LR.rW, [el, el / xmax]), e0 = Math.floor(Math.log10(Math.min(...all))), e1 = Math.ceil(Math.log10(Math.max(...all)) + 0.01);
    const P = new LAB.Plot(ctx, w, h, { xmin, xmax, ymin: Math.pow(10, e0), ymax: Math.pow(10, e1), logx: true, logy: true, ytickValues: logTicks(e0, e1), xlabel: '梯度尺度 σ', ylabel: '每步衰减率', pad: { l: 52, r: 12, t: 12, b: 36 } }).axes();
    P.clip();
    P.hline(el, C.slate, [4, 4]);
    P.fn((x) => el / x, C.slate, 1.2, [4, 4]);
    P.line(s, LR.rW, C.c3, 2); P.line(s, LR.rL2, C.c4, 2);
    P.unclip();
    P.points(s, LR.rW, C.c3, 5, '#fff'); P.points(s, LR.rL2, C.c4, 5, '#fff');
  });
  function upd2b() {
    longRun();
    $('#d-legend').innerHTML = LR.sig.map((sg, i) => `<span><i style="background:${SCOL[i]}"></i>$\\sigma=${texNum(sg)}$</span>`).join('');
    LAB.renderMath($('#d-legend'));
    l2Cv.redraw(); wCv.redraw(); rateCv.redraw();
  }
  let pend2 = false; const sched2 = () => { if (pend2) return; pend2 = true; setTimeout(() => { pend2 = false; upd2b(); }, 0); };
  LAB.slider('#d-scale', { label: '梯度尺度倍率', min: -2, max: 2, step: 0.1, value: 0, fmt: (v) => fe(Math.pow(10, v)), hint: '六个坐标的 $\\sigma_i=$ 倍率 $\\times\\{10^{-3},\\dots,10^{2}\\}$', onInput: (v) => { D.scale = Math.pow(10, v); sched2(); } });
  LAB.slider('#d-lam2', { label: '$\\lambda$（长程实验）', min: 0.01, max: 0.5, step: 0.01, value: D.lam2, fmt: (v) => v.toFixed(2), onInput: (v) => { D.lam2 = v; sched2(); } });
  LAB.slider('#d-steps', { label: '步数', min: 200, max: 3000, step: 100, value: D.steps, onInput: (v) => { D.steps = v; sched2(); } });
  upd2b();

  /* ================= 实验 3：学习率调度设计台 ================= */
  const S = { pick: 0, T: 10000, warm: 0.2, peak: 1e-3, rmin: 0.1, wsd: 0.2, cursor: 6000 };
  const SCH = [
    { name: '预热 + 余弦', color: C.c5 },
    { name: 'WSD', color: C.c2 },
    { name: '阶梯衰减', color: C.c4 },
    { name: '逆平方根', color: C.c6 },
    { name: '预热 + 常数', color: C.slate },
  ];
  function lrAt(k, t) {
    const T = S.T, Tw = Math.round(S.warm * T), emax = S.peak, emin = S.rmin * emax;
    if (Tw > 0 && t <= Tw) return (emax * t) / Tw;
    const q = (t - Tw) / Math.max(1, T - Tw);
    switch (k) {
      case 0: return emin + 0.5 * (emax - emin) * (1 + Math.cos(Math.PI * q));
      case 1: { const td = T - S.wsd * T; return t <= td ? emax : emax - (emax - emin) * ((t - td) / Math.max(1, T - td)); }
      case 2: return emax * (q < 0.5 ? 1 : q < 0.75 ? 0.1 : 0.01);
      case 3: return emax * Math.sqrt(Math.max(Tw, 1) / Math.max(t, 1));
      default: return emax;
    }
  }
  const HS = [1, 0.3, 0.1, 0.03, 0.01], TOY = 0.5 / 3e-4;
  let SC = null;
  function compute3() {
    const T = S.T, stride = Math.max(1, Math.floor(T / 600));
    SC = SCH.map((_, k) => {
      const ts = [], lrs = [], loss = [];
      const e = HS.map(() => 4);
      let sum = 0, Lfin = 0;
      for (let t = 0; t <= T; t++) {
        const eta = lrAt(k, t);
        if (t > 0) { sum += eta; const et = eta * TOY; for (let j = 0; j < HS.length; j++) e[j] = Math.min((1 - et * HS[j]) ** 2 * e[j] + et * et * HS[j], 1e12); }
        if (t % stride === 0 || t === T) { const L = 0.5 * M.sum(HS.map((h, j) => h * e[j])); ts.push(t); lrs.push(eta); loss.push(L); Lfin = L; }
      }
      return { ts, lrs, loss, mean: sum / (T * S.peak), Lfin };
    });
  }
  LAB.segmented('#l-pick', SCH.map((s) => s.name), 0, (i) => { S.pick = i; upd3(); });
  const fmtSteps = (v) => Math.round(v).toLocaleString();
  LAB.slider('#l-T', { label: '总步数 $T_{\\max}$', min: 1000, max: 50000, step: 1000, value: S.T, fmt: fmtSteps, onInput: (v) => { S.cursor = Math.round((S.cursor / S.T) * v); S.T = v; upd3(); } });
  LAB.slider('#l-warm', { label: '预热比例 $T_w/T_{\\max}$', min: 0, max: 0.3, step: 0.005, value: S.warm, fmt: (v) => (v * 100).toFixed(1) + '%', onInput: (v) => { S.warm = v; upd3(); } });
  const PEAKS = [1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 3e-4, 5e-4, 8e-4, 1e-3, 1.2e-3, 1.5e-3, 2e-3, 3e-3];
  LAB.slider('#l-peak', { label: '峰值 $\\eta_{\\max}$', min: 0, max: PEAKS.length - 1, step: 1, value: PEAKS.indexOf(S.peak), fmt: (v) => fe(PEAKS[v]), onInput: (v) => { S.peak = PEAKS[v]; upd3(); } });
  LAB.slider('#l-min', { label: '$\\eta_{\\min}/\\eta_{\\max}$', min: 0, max: 0.5, step: 0.01, value: S.rmin, fmt: (v) => v.toFixed(2), onInput: (v) => { S.rmin = v; upd3(); } });
  LAB.slider('#l-wsd', { label: 'WSD 衰减段占比', min: 0.05, max: 0.5, step: 0.01, value: S.wsd, fmt: (v) => (v * 100).toFixed(0) + '%', onInput: (v) => { S.wsd = v; upd3(); } });
  const lrCv = LAB.canvas('#l-plot', (ctx, w, h) => {
    if (!SC) return;
    const ymax = Math.max(...SC.map((s) => Math.max(...s.lrs))) * 1.1;
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: S.T, ymin: 0, ymax, xlabel: '训练步 t', ylabel: '学习率', yfmt: (v) => (v === 0 ? '0' : fe(v)), pad: { l: 62, r: 14, t: 12, b: 36 } }).axes();
    lrCv._P = P;
    const Tw = Math.round(S.warm * S.T);
    if (Tw > 0) { P.vline(Tw, C.amber, [4, 4]); P.text(Tw, ymax * 0.97, ' T_w', C.amber, 'left', 'top', '11px Avenir Next, sans-serif'); }
    SC.forEach((s, k) => { if (k !== S.pick) P.line(s.ts, s.lrs, SCH[k].color, 1.4, null); });
    const s = SC[S.pick]; P.area(s.ts, s.lrs, SCH[S.pick].color, 0.1); P.line(s.ts, s.lrs, SCH[S.pick].color, 3);
    P.vline(S.cursor, C.ink, [2, 3], 1);
    P.points([S.cursor], [lrAt(S.pick, S.cursor)], SCH[S.pick].color, 5, '#fff');
  });
  const curPick = (px) => { const P = lrCv._P; if (!P) return; S.cursor = Math.round(M.clamp(P.ix(px), 0, S.T)); lrCv.redraw(); lossCv3.redraw(); stats3(); };
  pointer('#l-plot', { down: curPick, move: curPick });
  const lossCv3 = LAB.canvas('#l-loss', (ctx, w, h) => {
    if (!SC) return;
    const all = SC.flatMap((s) => s.loss).filter((v) => isFinite(v) && v > 0);
    const e0 = Math.floor(Math.log10(Math.min(...all))), e1 = Math.min(Math.ceil(Math.log10(Math.max(...all))), e0 + 8);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: S.T, ymin: Math.pow(10, e0), ymax: Math.pow(10, Math.max(e1, e0 + 1)), logy: true, ytickValues: logTicks(e0, Math.max(e1, e0 + 1)), xlabel: '训练步 t', ylabel: '期望损失', pad: { l: 52, r: 14, t: 12, b: 36 } }).axes();
    P.clip();
    SC.forEach((s, k) => { if (k !== S.pick) P.line(s.ts, s.loss, SCH[k].color, 1.4); });
    P.line(SC[S.pick].ts, SC[S.pick].loss, SCH[S.pick].color, 3);
    P.unclip();
    P.vline(S.cursor, C.ink, [2, 3], 1);
  });
  const ls1 = LAB.stat('#l-stats', '游标所在步 $t$');
  const ls2 = LAB.stat('#l-stats', '$\\eta_t$（高亮调度）', 'plum');
  const ls3 = LAB.stat('#l-stats', '$\\eta_t/\\eta_{\\max}$', 'teal');
  const ls4 = LAB.stat('#l-stats', '平均学习率 $/\\eta_{\\max}$', 'amber');
  const ls5 = LAB.stat('#l-stats', '玩具损失终值', 'coral');
  function stats3() {
    const e = lrAt(S.pick, S.cursor);
    ls1.set(S.cursor.toLocaleString()); ls2.set(fe(e)); ls3.set((e / S.peak).toFixed(3)); ls4.set(SC[S.pick].mean.toFixed(3)); ls5.set(fe(SC[S.pick].Lfin));
  }
  function upd3() {
    compute3();
    $('#l-legend').innerHTML = SCH.map((s, k) => `<span><i style="background:${s.color}${k === S.pick ? ';height:5px' : ''}"></i>${s.name}</span>`).join('');
    const T = S.T, Tw = Math.round(S.warm * T), pts = [['$T_w/2$', Math.max(Math.round(Tw / 2), 1)], ['$T_w$', Math.max(Tw, 1)], ['退火中点', Math.round(Tw + (T - Tw) / 2)], ['$T_{\\max}$', T]];
    let rows = `<tr><th>调度</th>${pts.map((p) => `<th>$\\eta$ @ ${p[0]}<br><small>$t=${p[1]}$</small></th>`).join('')}<th>平均 $\\eta/\\eta_{\\max}$</th><th>玩具终值损失</th></tr>`;
    SC.forEach((s, k) => { rows += `<tr${k === S.pick ? ' style="background:var(--mist)"' : ''}><td><b style="color:${SCH[k].color}">●</b> ${SCH[k].name}</td>${pts.map((p) => `<td>${fe(lrAt(k, p[1]))}</td>`).join('')}<td>${s.mean.toFixed(3)}</td><td>${fe(s.Lfin)}</td></tr>`; });
    $('#l-table').innerHTML = rows; LAB.renderMath($('#l-table'));
    lrCv.redraw(); lossCv3.redraw(); stats3();
  }
  upd3();
})();
