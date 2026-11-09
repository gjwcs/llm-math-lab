/* 第 4 章：核方法、特征映射与 NTK · 交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §4.2 核技巧 · §4.3 神经正切核 · §4.4 异或手算 · §4.6 随机傅里叶特征' });
  // 窄屏下长公式与宽表格改为横向滚动，不撑破版面
  document.querySelectorAll('.formula, [style*="overflow-x"]').forEach((f) => { f.style.width = '0'; f.style.minWidth = '100%'; });
  const FONT = getComputedStyle(document.body).getPropertyValue('--font');
  const NUMF = getComputedStyle(document.body).getPropertyValue('--font-num');
  const isActive = (sec) => sec.classList.contains('active');
  function schedule(fn) { let p = false; return () => { if (p) return; p = true; requestAnimationFrame(() => { p = false; fn(); }); }; }
  function pointer(cv, h) {
    cv.style.touchAction = 'none';
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let active = false;
    cv.addEventListener('pointerdown', (e) => { if (h.down && h.down(pos(e)) !== false) { active = true; cv.setPointerCapture(e.pointerId); e.preventDefault(); } });
    cv.addEventListener('pointermove', (e) => { if (active) h.move && h.move(pos(e)); else h.hover && h.hover(pos(e)); });
    const end = (e) => { if (active) { active = false; h.up && h.up(pos(e)); } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }
  // 线性方程组（高斯消元，部分主元）
  function solve(A, b) {
    const n = b.length, a = A.map((r, i) => r.concat([b[i]]));
    for (let k = 0; k < n; k++) {
      let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
      [a[k], a[p]] = [a[p], a[k]];
      const d = a[k][k] || 1e-12;
      for (let i = k + 1; i < n; i++) { const f = a[i][k] / d; for (let j = k; j <= n; j++) a[i][j] -= f * a[k][j]; }
    }
    const x = new Array(n).fill(0);
    for (let k = n - 1; k >= 0; k--) { let s = a[k][n]; for (let j = k + 1; j < n; j++) s -= a[k][j] * x[j]; x[k] = s / (a[k][k] || 1e-12); }
    return x;
  }
  // 对称矩阵特征分解（Jacobi 旋转），返回按特征值降序排列的 {vals, vecs[k][i]}
  function eigSym(A, n) {
    const a = Float64Array.from(A), V = new Float64Array(n * n); for (let i = 0; i < n; i++) V[i * n + i] = 1;
    for (let sweep = 0; sweep < 80; sweep++) {
      let off = 0, tot = 0; for (let p = 0; p < n; p++) for (let q = 0; q < n; q++) { const v = a[p * n + q] * a[p * n + q]; tot += v; if (p !== q) off += v; }
      if (off < 1e-26 * tot) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q]; if (Math.abs(apq) < 1e-300) continue;
        const th = (a[q * n + q] - a[p * n + p]) / (2 * apq), t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const x = a[k * n + p], y = a[k * n + q]; a[k * n + p] = c * x - s * y; a[k * n + q] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = a[p * n + k], y = a[q * n + k]; a[p * n + k] = c * x - s * y; a[q * n + k] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = V[k * n + p], y = V[k * n + q]; V[k * n + p] = c * x - s * y; V[k * n + q] = s * x + c * y; }
      }
    }
    const idx = M.range(n).sort((i, j) => a[j * n + j] - a[i * n + i]);
    return { vals: idx.map((i) => a[i * n + i]), vecs: idx.map((i) => M.range(n).map((k) => V[k * n + i])) };
  }

  /* ================= 实验 1：核技巧 ================= */
  const sec1 = document.querySelector('#kernel-trick');
  const BOOK = [[1, 1, 1], [-1, -1, 1], [1, -1, -1], [-1, 1, -1]];
  const CIRC = [[0.3, 0.2, 1], [-0.2, -0.4, 1], [1.2, 0.3, -1], [-0.5, 1.15, -1]];
  let ds = 0, pts = [], seedK = 2, yaw = 0.7, pitch = 0.35, spinOn = true, spinning = false, drag2 = -1, drag3 = null, model = null;
  const phi = (x) => [x[0] * x[0], Math.SQRT2 * x[0] * x[1], x[1] * x[1]];
  LAB.segmented('#k-data', ['异或 XOR', '同心圆'], 0, (i) => { ds = i; build(); });
  const sExtra = LAB.slider('#k-extra', { label: '每簇附加的随机点', min: 0, max: 20, step: 1, value: 6, onInput: () => build() });
  const sNoise = LAB.slider('#k-noise', { label: '随机点的散布', min: 0.05, max: 0.6, step: 0.01, value: 0.25, fmt: (v) => v.toFixed(2), onInput: () => build() });
  LAB.checkbox('#k-spin', '三维视图自动旋转', true, (v) => { spinOn = v; ensureSpin(); });
  document.querySelector('#k-reset').onclick = () => { sExtra.set(0); build(); };
  document.querySelector('#k-reseed').onclick = () => { seedK++; build(); };
  function build() {
    const R = LAB.rng(seedK * 17 + ds), n = sExtra.get(), s = sNoise.get();
    pts = (ds === 0 ? BOOK : CIRC).map((p) => p.slice());
    if (ds === 0) BOOK.forEach(([x, y, c]) => { for (let i = 0; i < n; i++) pts.push([x + s * R.normal(), y + s * R.normal(), c]); });
    else for (let i = 0; i < 2 * n; i++) {
      const r1 = Math.sqrt(R()) * (0.35 + s), t1 = R() * 2 * Math.PI; pts.push([r1 * Math.cos(t1), r1 * Math.sin(t1), 1]);
      const r2 = 1.25 + s * (R() - 0.5) * 1.2, t2 = R() * 2 * Math.PI; pts.push([r2 * Math.cos(t2), r2 * Math.sin(t2), -1]);
    }
    fitK();
  }
  function lsFit(feat) { // 最小二乘 + 微小岭，返回权重与准确率
    const F = pts.map((p) => feat(p).concat([1])), d = F[0].length;
    const A = M.range(d).map((i) => M.range(d).map((j) => F.reduce((s, f) => s + f[i] * f[j], 0) + (i === j ? 1e-6 : 0)));
    const b = M.range(d).map((i) => F.reduce((s, f, k) => s + f[i] * pts[k][2], 0));
    const w = solve(A, b);
    const acc = pts.filter((p, k) => Math.sign(M.dot(F[k], w) || 1e-9) === p[2]).length / pts.length;
    return { w, acc };
  }
  const sk = [LAB.stat('#k-stats', '数据点', ''), LAB.stat('#k-stats', '二维里用直线分类', 'coral'), LAB.stat('#k-stats', '三维里用平面分类', 'leaf'), LAB.stat('#k-stats', '核值 $(\\mathbf x_1^\\top\\mathbf x_2)^2$', 'plum')];
  function fitK() {
    model = lsFit((p) => phi(p));
    const lin = lsFit((p) => [p[0], p[1]]);
    sk[0].set(`${pts.length}<small>个</small>`);
    sk[1].set(`${(lin.acc * 100).toFixed(0)}%`); sk[2].set(`${(model.acc * 100).toFixed(0)}%`);
    const k12 = M.dot(pts[0], pts[1]) - pts[0][2] * pts[1][2];
    sk[3].set((k12 * k12).toFixed(2));
    const w = model.w, nrm = Math.hypot(w[0], w[1], w[2]) || 1;
    const f = (v) => (v >= 0 ? '+' : '−') + Math.abs(v / nrm).toFixed(2);
    const pl = document.querySelector('#k-plane');
    pl.innerHTML = `分割平面：$${f(w[0])}\\,x_1^2 ${f(w[1])}\\,(\\sqrt2x_1x_2) ${f(w[2])}\\,x_2^2 ${f(w[3])} = 0$`;
    LAB.renderMath(pl);
    renderTable(); k2.redraw(); k3.redraw();
  }
  function renderTable() {
    const A = pts.slice(0, 4), sub = ['₁', '₂', '₃', '₄'];
    const fx = (v) => (Math.abs(v) < 5e-3 ? '0' : (+v.toFixed(2)).toString());
    let h = `<thead><tr><th>点</th><th>$\\mathbf x$</th><th>$\\boldsymbol\\phi(\\mathbf x)$</th>${A.map((_, j) => `<th>与 x${sub[j]}</th>`).join('')}</tr></thead><tbody>`;
    A.forEach((p, i) => {
      const fp = phi(p);
      h += `<tr><td><b style="color:${p[2] > 0 ? C.c4 : C.c1}">x${sub[i]}</b> <span class="tag ${p[2] > 0 ? 'coral' : ''}">${p[2] > 0 ? '+1' : '−1'}</span></td><td class="num">(${fx(p[0])}, ${fx(p[1])})</td><td class="num">(${fp.map(fx).join(', ')})</td>`;
      A.forEach((q) => { const k1 = (p[0] * q[0] + p[1] * q[1]) ** 2, k2v = M.dot(fp, phi(q)); h += `<td class="num" style="background:${LAB.mix('#ffffff', C.c3, Math.min(1, k1 / 6) * 0.35)}"><b>${fx(k1)}</b> <span class="muted small">= ${fx(k2v)}</span></td>`; });
      h += '</tr>';
    });
    const t = document.querySelector('#k-table'); t.innerHTML = h + '</tbody>'; LAB.renderMath(t);
  }
  const decision = (x) => model ? model.w[0] * x[0] * x[0] + model.w[1] * Math.SQRT2 * x[0] * x[1] + model.w[2] * x[1] * x[1] + model.w[3] : 0;
  let v2 = null;
  const k2 = LAB.canvas('#k-2d', (ctx, w, h) => {
    const s = Math.min(w, h) / 4.6, cx = w / 2, cy = h / 2;
    v2 = { s, X: (x) => cx + x * s, Y: (y) => cy - y * s, ix: (px) => (px - cx) / s, iy: (py) => (cy - py) / s };
    const cell = 5;
    for (let px = 0; px < w; px += cell) for (let py = 0; py < h; py += cell) {
      const v = decision([v2.ix(px + cell / 2), v2.iy(py + cell / 2)]);
      ctx.fillStyle = v > 0 ? '#FBEEF0' : '#EAF1FA'; ctx.fillRect(px, py, cell, cell);
    }
    ctx.save(); ctx.strokeStyle = 'rgba(92,103,115,.25)'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(v2.X(i), 0); ctx.lineTo(v2.X(i), h); ctx.moveTo(0, v2.Y(i)); ctx.lineTo(w, v2.Y(i)); ctx.stroke(); }
    ctx.strokeStyle = '#9aa5b1'; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    ctx.fillStyle = C.slate; ctx.font = '12px ' + NUMF; ctx.fillText('x₁', w - 18, cy - 6); ctx.fillText('x₂', cx + 6, 14);
    ctx.restore();
    // 决策边界：二次曲线 w0 x1² + √2 w1 x1 x2 + w2 x2² + w3 = 0，按列、按行求根描点
    if (model) {
      const [a0, a1, a2, a3] = model.w; ctx.save(); ctx.fillStyle = C.navy;
      const roots = (A, B, Cc) => { if (Math.abs(A) < 1e-9) return Math.abs(B) < 1e-9 ? [] : [-Cc / B]; const D = B * B - 4 * A * Cc; if (D < 0) return []; const r = Math.sqrt(D); return [(-B + r) / (2 * A), (-B - r) / (2 * A)]; };
      for (let i = 0; i <= 500; i++) {
        const t = -2.6 + 5.2 * i / 500;
        roots(a2, Math.SQRT2 * a1 * t, a0 * t * t + a3).forEach((y) => { ctx.beginPath(); ctx.arc(v2.X(t), v2.Y(y), 1.2, 0, 7); ctx.fill(); });
        roots(a0, Math.SQRT2 * a1 * t, a2 * t * t + a3).forEach((x) => { ctx.beginPath(); ctx.arc(v2.X(x), v2.Y(t), 1.2, 0, 7); ctx.fill(); });
      }
      ctx.restore();
    }
    pts.forEach((p, i) => {
      ctx.save(); ctx.fillStyle = p[2] > 0 ? C.c4 : C.c1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(v2.X(p[0]), v2.Y(p[1]), i < 4 ? 8 : 5, 0, 7); ctx.fill(); ctx.stroke();
      if (i < 4) { ctx.fillStyle = '#fff'; ctx.font = '600 10px ' + NUMF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i + 1, v2.X(p[0]), v2.Y(p[1]) + 0.5); }
      ctx.restore();
    });
  });
  pointer(k2.canvas, {
    down: ([x, y]) => { if (!v2) return false; let best = -1, bd = 16; pts.forEach((p, i) => { const d = Math.hypot(v2.X(p[0]) - x, v2.Y(p[1]) - y); if (d < bd) { bd = d; best = i; } }); if (best < 0) return false; drag2 = best; return true; },
    move: ([x, y]) => { pts[drag2][0] = M.clamp(v2.ix(x), -2.2, 2.2); pts[drag2][1] = M.clamp(v2.iy(y), -2.2, 2.2); fitK(); },
    up: () => { drag2 = -1; },
  });
  // 三维视图：坐标 (X, Y, Z) = (x1², x2², √2 x1 x2)
  let v3 = null;
  const k3 = LAB.canvas('#k-3d', (ctx, w, h) => {
    const P = pts.map((p) => { const f = phi(p); return [f[0], f[2], f[1]]; });
    const R = Math.max(1.2, ...P.map((p) => Math.max(p[0], p[1]))), Z = Math.max(1.2, ...P.map((p) => Math.abs(p[2]))) * 1.1;
    const s = Math.min(w, h) / (Math.max(R * 1.9, Z * 1.6) * 1.35), ctr = [R / 2, R / 2, 0];
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const proj = (q) => { const X = q[0] - ctr[0], Y = q[1] - ctr[1], Z = q[2] - ctr[2]; const x1 = X * cy - Y * sy, y1 = X * sy + Y * cy; return [w / 2 + s * x1, h / 2 - s * (Z * cp + y1 * sp), -Z * sp + y1 * cp]; };
    v3 = proj;
    const line = (a, b, col, wd, dash) => { const A = proj(a), B = proj(b); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = wd || 1; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.restore(); };
    // 盒子与坐标轴
    [[0, 0], [R, 0], [R, R], [0, R]].forEach(([x, y], i, arr) => { const [x2, y2] = arr[(i + 1) % 4]; line([x, y, -Z], [x2, y2, -Z], C.line); line([x, y, Z], [x2, y2, Z], C.line); line([x, y, -Z], [x, y, Z], C.line); });
    line([0, 0, 0], [R * 1.12, 0, 0], C.slate, 1.4); line([0, 0, 0], [0, R * 1.12, 0], C.slate, 1.4); line([0, 0, -Z], [0, 0, Z * 1.08], C.slate, 1.4);
    const lab = (q, t) => { const A = proj(q); ctx.save(); ctx.fillStyle = C.slate; ctx.font = '12px ' + NUMF; ctx.textAlign = 'center'; ctx.fillText(t, A[0], A[1]); ctx.restore(); };
    lab([R * 1.25, 0, 0], 'x₁²'); lab([0, R * 1.25, 0], 'x₂²'); lab([0, 0, Z * 1.2], '√2·x₁x₂');
    // 分割平面 wᵀφ + b = 0：在 (X, Y, Z) 中系数为 (w0, w2, w1)
    let quad = null;
    if (model) {
      const [a0, a1, a2, a3] = model.w, cX = a0, cY = a2, cZ = a1, ab = [Math.abs(cX), Math.abs(cY), Math.abs(cZ) * 1.0];
      const big = ab.indexOf(Math.max(...ab));
      const g = (u, v) => (big === 2 ? [u, v, -(cX * u + cY * v + a3) / cZ] : big === 0 ? [-(cY * u + cZ * v + a3) / cX, u, v] : [u, -(cX * u + cZ * v + a3) / cY, v]);
      const ur = big === 2 ? [0, R] : [0, R], vr = big === 2 ? [0, R] : [-Z, Z];
      quad = { g, ur, vr };
    }
    const depth0 = proj([R / 2, R / 2, 0])[2];
    const order = P.map((p, i) => ({ p, i, d: proj(p)[2] })).sort((a, b) => b.d - a.d);
    const drawPt = (o) => { const A = proj(o.p); ctx.save(); ctx.fillStyle = pts[o.i][2] > 0 ? C.c4 : C.c1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(A[0], A[1], o.i < 4 ? 7 : 4.5, 0, 7); ctx.fill(); ctx.stroke(); if (o.i < 4) { ctx.fillStyle = '#fff'; ctx.font = '600 9.5px ' + NUMF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.i + 1, A[0], A[1] + 0.5); } ctx.restore(); };
    order.filter((o) => o.d > depth0).forEach(drawPt);
    if (quad) {
      const { g, ur, vr } = quad, n = 6;
      const c4 = [g(ur[0], vr[0]), g(ur[1], vr[0]), g(ur[1], vr[1]), g(ur[0], vr[1])].map(proj);
      ctx.save(); ctx.fillStyle = 'rgba(107,76,154,.16)'; ctx.strokeStyle = 'rgba(107,76,154,.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); c4.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      for (let i = 1; i < n; i++) { const u = ur[0] + (ur[1] - ur[0]) * i / n, v = vr[0] + (vr[1] - vr[0]) * i / n; line(g(u, vr[0]), g(u, vr[1]), 'rgba(107,76,154,.25)'); line(g(ur[0], v), g(ur[1], v), 'rgba(107,76,154,.25)'); }
    }
    order.filter((o) => o.d <= depth0).forEach(drawPt);
  });
  pointer(k3.canvas, {
    down: ([x, y]) => { drag3 = { x, y, yaw, pitch }; return true; },
    move: ([x, y]) => { yaw = drag3.yaw - (x - drag3.x) * 0.01; pitch = M.clamp(drag3.pitch + (y - drag3.y) * 0.01, -1.4, 1.4); k3.redraw(); },
    up: () => { drag3 = null; },
  });
  k3.canvas.style.touchAction = 'pan-y'; // 手机上竖向滑动仍可滚动页面，横向拖动旋转
  function spinLoop() {
    if (!spinOn || !isActive(sec1)) { spinning = false; return; }
    if (!drag3) { yaw += 0.005; k3.redraw(); }
    requestAnimationFrame(spinLoop);
  }
  function ensureSpin() { if (spinOn && !spinning && isActive(sec1)) { spinning = true; requestAnimationFrame(spinLoop); } }
  window.addEventListener('resize', ensureSpin);
  document.addEventListener('visibilitychange', ensureSpin);
  build(); ensureSpin();

  /* ================= 实验 2：核回归与随机傅里叶特征 ================= */
  const XR = [-3, 3], YR = [-2.3, 2.3], DLIST = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096], DMAX = 4096;
  let data = [], rffSeed = 1, showRff = true, Om = null, Bp = null, dragF = -1, errCurve = [];
  const sSig = LAB.slider('#f-sigma', { label: '带宽 $\\sigma$', min: 0.1, max: 3, step: 0.05, value: 0.7, fmt: (v) => v.toFixed(2), onInput: () => { upd(); runErr(); } });
  const sLam = LAB.slider('#f-lambda', { label: '正则 $\\lambda$', min: -4, max: 1, step: 0.1, value: -2, fmt: (v) => LAB.tex(`10^{${v.toFixed(1)}}`), onInput: () => upd() });
  const sD = LAB.slider('#f-D', { label: '随机特征数 $D$', min: 0, max: DLIST.length - 1, step: 1, value: 6, fmt: (i) => DLIST[i], onInput: () => upd() });
  LAB.checkbox('#f-showrff', '显示随机特征回归曲线', true, (v) => { showRff = v; reg.redraw(); });
  document.querySelector('#f-redraw').onclick = () => { rffSeed++; drawRff(); upd(); };
  document.querySelector('#f-data').onclick = () => { randomData(Math.floor(Math.random() * 1e6)); upd(); };
  function drawRff() { const R = LAB.rng(rffSeed * 7 + 1); Om = Float64Array.from({ length: DMAX }, () => R.normal()); Bp = Float64Array.from({ length: DMAX }, () => R() * 2 * Math.PI); }
  function randomData(seed) {
    const R = LAB.rng(seed), n = 9;
    data = M.range(n).map((i) => { const x = -2.7 + 5.4 * (i + 0.5 * R()) / n; return [x, Math.sin(1.3 * x) + 0.4 * Math.cos(2.7 * x) + 0.15 * R.normal()]; });
  }
  drawRff(); randomData(4);
  const kf = (a, b, s) => Math.exp(-(a - b) * (a - b) / (2 * s * s));
  function zfeat(x, D, s) { const z = new Float64Array(D), c = Math.sqrt(2 / D); for (let j = 0; j < D; j++) z[j] = c * Math.cos(Om[j] / s * x + Bp[j]); return z; }
  let fitE = null, fitR = null;
  const GX = M.linspace(XR[0], XR[1], 241);
  const sf = [LAB.stat('#f-stats', '数据点 $N$'), LAB.stat('#f-stats', '有效自由度 $\\operatorname{tr}\\,\\mathbf K(\\mathbf K+\\lambda\\mathbf I)^{-1}$', 'teal'), LAB.stat('#f-stats', '训练均方根误差', 'coral'), LAB.stat('#f-stats', '两条曲线最大差', 'amber')];
  function upd() {
    const s = sSig.get(), lam = Math.pow(10, sLam.get()), D = DLIST[sD.get()], N = data.length;
    const K = data.map((p) => data.map((q) => kf(p[0], q[0], s)));
    const A = K.map((r, i) => r.map((v, j) => v + (i === j ? lam : 0)));
    const alpha = solve(A, data.map((p) => p[1]));
    const f = GX.map((x) => data.reduce((acc, p, i) => acc + alpha[i] * kf(x, p[0], s), 0));
    let dof = 0; for (let j = 0; j < N; j++) { const e = M.range(N).map((i) => (i === j ? 1 : 0)); const col = solve(A, e); dof += 1 - lam * col[j]; }
    const fitted = data.map((p) => data.reduce((acc, q, i) => acc + alpha[i] * kf(p[0], q[0], s), 0));
    const rmse = Math.sqrt(M.mean(fitted.map((v, i) => (v - data[i][1]) ** 2)));
    // 随机特征：K̂ = Z Zᵀ；预测 f̂(x) = z(x)ᵀ Zᵀ (K̂+λI)⁻¹ y
    const Z = data.map((p) => zfeat(p[0], D, s));
    const Kh = Z.map((a) => Z.map((b) => M.dot(a, b)));
    const ah = solve(Kh.map((r, i) => r.map((v, j) => v + (i === j ? lam : 0))), data.map((p) => p[1]));
    const wv = new Float64Array(D); Z.forEach((z, i) => { for (let j = 0; j < D; j++) wv[j] += z[j] * ah[i]; });
    const fh = GX.map((x) => M.dot(zfeat(x, D, s), wv));
    fitE = { f, alpha, s }; fitR = { f: fh };
    sf[0].set(N); sf[1].set(dof.toFixed(2)); sf[2].set(rmse.toFixed(3));
    sf[3].set(M.fmt(Math.max(...f.map((v, i) => Math.abs(v - fh[i]))), 3) + `<small>D = ${D}</small>`);
    reg.redraw(); heat.redraw(); errc.redraw();
  }
  let PR = null;
  const reg = LAB.canvas('#f-reg', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: XR[0], xmax: XR[1], ymin: YR[0], ymax: YR[1], xlabel: 'x', ylabel: 'y', pad: { l: 40, r: 12, t: 10, b: 36 } }).axes();
    PR = P; if (!fitE) return;
    P.clip();
    data.forEach((p, i) => P.fn((x) => fitE.alpha[i] * kf(x, p[0], fitE.s), '#C9D1DA', 1.1, null, 200));
    if (showRff) P.line(GX, fitR.f, C.c2, 2.2, [7, 4]);
    P.line(GX, fitE.f, C.c1, 2.6);
    P.unclip();
    data.forEach((p, i) => P.points([p[0]], [p[1]], i === dragF ? C.c4 : C.navy, i === dragF ? 7 : 5.5, '#fff'));
  });
  pointer(reg.canvas, {
    down: ([x, y]) => {
      if (!PR) return false;
      let best = -1, bd = 16; data.forEach((p, i) => { const d = Math.hypot(PR.tx(p[0]) - x, PR.ty(p[1]) - y); if (d < bd) { bd = d; best = i; } });
      if (best < 0) { if (x < PR.x0 || x > PR.x1 || y < PR.y1 || y > PR.y0) return false; data.push([PR.ix(x), PR.iy(y)]); best = data.length - 1; }
      dragF = best; upd(); return true;
    },
    move: ([x, y]) => { data[dragF] = [PR.ix(x), PR.iy(y)]; if (data[dragF][0] >= XR[0] && data[dragF][0] <= XR[1] && data[dragF][1] >= YR[0] && data[dragF][1] <= YR[1]) upd(); else reg.redraw(); },
    up: () => {
      const p = data[dragF];
      if ((p[0] < XR[0] || p[0] > XR[1] || p[1] < YR[0] || p[1] > YR[1]) && data.length > 1) data.splice(dragF, 1);
      else { p[0] = M.clamp(p[0], XR[0], XR[1]); p[1] = M.clamp(p[1], YR[0], YR[1]); }
      dragF = -1; upd();
    },
  });
  const HG = M.linspace(-3, 3, 24);
  function gramRff(D, s, om, bp) {
    const Z = HG.map((x) => { const z = new Float64Array(D), c = Math.sqrt(2 / D); for (let j = 0; j < D; j++) z[j] = c * Math.cos(om[j] / s * x + bp[j]); return z; });
    return Z.map((a) => Z.map((b) => M.dot(a, b)));
  }
  const heat = LAB.canvas('#f-heat', (ctx, w, h) => {
    const s = sSig.get(), D = DLIST[sD.get()];
    const Ke = HG.map((a) => HG.map((b) => kf(a, b, s))), Kr = gramRff(D, s, Om, Bp);
    const gap = 18, size = Math.min((w - gap) / 2, h - 30), cs = size / 24, x0 = (w - 2 * size - gap) / 2;
    [[Ke, '精确 K'], [Kr, `随机特征 D = ${D}`]].forEach(([K, t], k) => {
      const ox = x0 + k * (size + gap);
      for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) { ctx.fillStyle = LAB.diverge(K[i][j]); ctx.fillRect(ox + j * cs, 4 + i * cs, cs + 0.5, cs + 0.5); }
      ctx.strokeStyle = C.line; ctx.strokeRect(ox, 4, size, size);
      ctx.fillStyle = C.ink; ctx.font = '12px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(t, ox + size / 2, 4 + size + 15);
    });
  });
  const runErr = schedule(() => {
    const s = sSig.get(), Ke = HG.map((a) => HG.map((b) => kf(a, b, s))), nK = Math.sqrt(Ke.flat().reduce((a, v) => a + v * v, 0));
    errCurve = DLIST.map((D) => {
      let e = 0;
      for (let r = 0; r < 6; r++) { const R = LAB.rng(1000 + r * 31 + D), om = Float64Array.from({ length: D }, () => R.normal()), bp = Float64Array.from({ length: D }, () => R() * 2 * Math.PI); const Kr = gramRff(D, s, om, bp); let d = 0; for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) d += (Kr[i][j] - Ke[i][j]) ** 2; e += Math.sqrt(d) / nK; }
      return e / 6;
    });
    errc.redraw();
  });
  const errc = LAB.canvas('#f-err', (ctx, w, h) => {
    if (!errCurve.length) return;
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: 4096, logx: true, logy: true, ymin: 0.005, ymax: 3, xtickValues: [1, 8, 64, 512, 4096], xfmt: (v) => v, ytickValues: [0.01, 0.1, 1], xlabel: '特征数 D', ylabel: '相对误差', pad: { l: 48, r: 12, t: 10, b: 38 } }).axes();
    P.clip();
    P.fn((D) => errCurve[0] / Math.sqrt(D), C.slate, 1.4, [6, 4]);
    P.line(DLIST, errCurve, C.c2, 2.2); P.points(DLIST, errCurve, C.c2, 3);
    P.unclip();
    const s = sSig.get(), D = DLIST[sD.get()], Ke = HG.map((a) => HG.map((b) => kf(a, b, s))), Kr = gramRff(D, s, Om, Bp);
    let d = 0, n = 0; for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) { d += (Kr[i][j] - Ke[i][j]) ** 2; n += Ke[i][j] ** 2; }
    P.points([D], [Math.max(Math.sqrt(d / n), 0.006)], C.c4, 6, '#fff');
  });
  upd(); runErr();

  /* ================= 实验 3：NTK 与频谱偏置 ================= */
  const sec3 = document.querySelector('#ntk');
  const NT = 40, TMAX = 5000, XT = M.linspace(-1, 1, NT), GXN = M.linspace(-1, 1, 161);
  const MLIST = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096], ALIST = [0.1, 1];
  let net = null, running = false, runs = [], ampIdx = 0;
  const sM = LAB.slider('#n-M', { label: '隐藏层宽度 $M$', min: 0, max: MLIST.length - 1, step: 1, value: 6, fmt: (i) => MLIST[i], onInput: () => resetNet() });
  const sK = LAB.slider('#n-k', { label: '高频成分 $\\sin k\\pi x$ 的 $k$', min: 2, max: 6, step: 1, value: 4, onInput: () => resetNet() });
  LAB.segmented('#n-A', ['$A=0.1$（惰性区）', '$A=1$（特征学习区）'], 0, (i) => { ampIdx = i; resetNet(); });
  const runBtn = document.querySelector('#n-run');
  runBtn.onclick = () => { if (running) { running = false; runBtn.textContent = '▶ 继续训练'; return; } if (net.step >= TMAX) resetNet(); running = true; runBtn.textContent = '⏸ 暂停'; requestAnimationFrame(trainLoop); };
  document.querySelector('#n-reset').onclick = () => resetNet();
  function ntkMatrix(n, xsA, xsB) { // Θ(x,x') = (1/M) Σ [σσ' + a² 1[·>0]1[·>0] (xx'+1)]
    const { a, w, b, M: Mw } = n, T = new Float64Array(xsA.length * xsB.length);
    for (let m = 0; m < Mw; m++) {
      const am2 = a[m] * a[m], wm = w[m], bm = b[m];
      for (let i = 0; i < xsA.length; i++) { const p = wm * xsA[i] + bm; if (p <= 0) continue; for (let j = 0; j < xsB.length; j++) { const q = wm * xsB[j] + bm; if (q > 0) T[i * xsB.length + j] += p * q + am2 * (xsA[i] * xsB[j] + 1); } }
    }
    for (let i = 0; i < T.length; i++) T[i] /= Mw;
    return T;
  }
  function resetNet() {
    running = false; runBtn.textContent = '▶ 开始训练';
    const Mw = MLIST[sM.get()], k = sK.get(), R = LAB.rng(20 + Mw);
    const a = new Float64Array(Mw), w = new Float64Array(Mw), b = new Float64Array(Mw);
    for (let m = 0; m < Mw / 2; m++) { a[m] = R.normal(); w[m] = R.normal(); b[m] = R.normal(); a[m + Mw / 2] = -a[m]; w[m + Mw / 2] = w[m]; b[m + Mw / 2] = b[m]; }
    const A = ALIST[ampIdx], y = XT.map((x) => A * (Math.sin(Math.PI * x) + Math.sin(k * Math.PI * x)));
    const n = { M: Mw, k, A, a, w, b, y, step: 0, f: new Float64Array(NT), pre: new Float64Array(Mw * NT) };
    n.T0 = ntkMatrix(n, XT, XT);
    n.E = eigSym(n.T0, NT);
    n.eta = 0.9 / n.E.vals[0];
    n.Tg = ntkMatrix(n, GXN, XT);
    const lo = XT.map((x) => Math.sin(Math.PI * x)), hi = XT.map((x) => Math.sin(k * Math.PI * x));
    n.ulo = lo.map((v) => v / M.norm(lo)); n.uhi = hi.map((v) => v / M.norm(hi));
    n.r0lo = -M.dot(y, n.ulo); n.r0hi = -M.dot(y, n.uhi);
    n.proj = n.E.vecs.map((v) => ({ vy: M.dot(v, y), vlo: M.dot(v, n.ulo), vhi: M.dot(v, n.uhi) }));
    n.hist = [{ t: 0, lo: 1, hi: 1 }]; n.nextLog = 1;
    n.drift = [{ t: 0, d: 0 }]; n.nextDrift = 1; n.nT0 = Math.sqrt(n.T0.reduce((s, v) => s + v * v, 0));
    net = n;
    // 理论曲线：残差 r(t) = −Σ_k (1−ηλ_k)^t ⟨v_k,y⟩ v_k
    n.theory = []; for (let i = 0; i <= 160; i++) { const t = Math.pow(TMAX, i / 160); n.theory.push({ t, ...theoryRes(t) }); }
    n.t10 = { lo: firstBelow('lo'), hi: firstBelow('hi') };
    document.querySelector('#n-eta').innerHTML = `学习率 $\\eta=0.9/\\lambda_{\\max}=${n.eta.toFixed(4)}$，最多训练 ${TMAX.toLocaleString()} 步。`;
    LAB.renderMath(document.querySelector('#n-eta'));
    updN(); fit.redraw(); spec.redraw(); vecs.redraw(); res.redraw(); drift.redraw();
  }
  function decay(lam, t) { const q = 1 - net.eta * lam; return q <= 0 ? 0 : Math.exp(t * Math.log(q)); }
  function theoryRes(t) {
    let lo = 0, hi = 0;
    net.E.vals.forEach((lam, k) => { const d = decay(Math.max(lam, 0), t), p = net.proj[k]; lo -= d * p.vy * p.vlo; hi -= d * p.vy * p.vhi; });
    return { lo: Math.abs(lo / net.r0lo), hi: Math.abs(hi / net.r0hi) };
  }
  function firstBelow(key) { let lo = 0, hi = 1e7; if (theoryRes(hi)[key] > 0.1) return Infinity; for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (theoryRes(mid)[key] > 0.1) lo = mid; else hi = mid; } return hi; }
  function linPred(t) { // NTK 线性化模型在网格上的预测
    const coef = new Float64Array(NT);
    net.E.vals.forEach((lam, k) => { const l = Math.max(lam, 1e-12), g = net.eta * l < 1e-9 ? net.eta * t : -Math.expm1(t * Math.log1p(-Math.min(net.eta * l, 0.999999))) / l; const c = g * net.proj[k].vy; net.E.vecs[k].forEach((v, i) => { coef[i] += c * v; }); });
    return GXN.map((_, g) => { let s = 0; for (let i = 0; i < NT; i++) s += net.Tg[g * NT + i] * coef[i]; return s; });
  }
  function trainSteps(K) {
    const n = net, { a, w, b, f, pre } = n, Mw = n.M, isq = 1 / Math.sqrt(Mw), r = new Float64Array(NT);
    for (let it = 0; it < K && n.step < TMAX; it++) {
      f.fill(0);
      for (let m = 0; m < Mw; m++) { const am = a[m], wm = w[m], bm = b[m], o = m * NT; for (let i = 0; i < NT; i++) { const p = wm * XT[i] + bm; pre[o + i] = p; if (p > 0) f[i] += am * p; } }
      for (let i = 0; i < NT; i++) { f[i] *= isq; r[i] = f[i] - n.y[i]; }
      if (n.step >= n.nextLog || n.step === 0) { n.hist.push({ t: Math.max(n.step, 0.5), lo: Math.abs(M.dot(r, n.ulo) / n.r0lo), hi: Math.abs(M.dot(r, n.uhi) / n.r0hi) }); n.nextLog = Math.max(n.step + 1, Math.floor(n.step * 1.04)); }
      const e = n.eta * isq;
      for (let m = 0; m < Mw; m++) {
        let ga = 0, gw = 0, gb = 0; const o = m * NT;
        for (let i = 0; i < NT; i++) { const p = pre[o + i]; if (p > 0) { ga += r[i] * p; gw += r[i] * XT[i]; gb += r[i]; } }
        const am = a[m]; a[m] -= e * ga; w[m] -= e * am * gw; b[m] -= e * am * gb;
      }
      n.step++;
      if (n.step >= n.nextDrift) { const T = ntkMatrix(n, XT, XT); let d = 0; for (let i = 0; i < T.length; i++) d += (T[i] - n.T0[i]) ** 2; n.drift.push({ t: n.step, d: Math.sqrt(d) / n.nT0 }); n.nextDrift = Math.ceil(n.step * 1.5); }
    }
  }
  function netOut(xs) { const { a, w, b } = net, isq = 1 / Math.sqrt(net.M); return xs.map((x) => { let s = 0; for (let m = 0; m < net.M; m++) { const p = w[m] * x + b[m]; if (p > 0) s += a[m] * p; } return s * isq; }); }
  function trainLoop() {
    if (!running) return;
    if (!isActive(sec3)) { running = false; runBtn.textContent = '▶ 继续训练'; return; }
    const K = Math.max(1, Math.min(400, Math.floor(2.5e6 / (NT * net.M))));
    trainSteps(K);
    updN(); fit.redraw(); res.redraw(); drift.redraw();
    if (net.step >= TMAX) {
      running = false; runBtn.textContent = '▶ 重新训练';
      const last = net.drift[net.drift.length - 1];
      runs = runs.filter((r) => r.M !== net.M || r.A !== net.A); runs.push({ M: net.M, A: net.A, pts: net.drift.slice() }); if (runs.length > 6) runs.shift(); net.saved = true;
      drift.redraw(); updN(last);
      return;
    }
    requestAnimationFrame(trainLoop);
  }
  const sn = [LAB.stat('#n-stats', '训练步数 $t$'), LAB.stat('#n-stats', '低频残差（相对）', 'leaf'), LAB.stat('#n-stats', '高频残差（相对）', 'coral'), LAB.stat('#n-stats', '低频比高频快', 'plum')];
  function updN() {
    const n = net, h = n.hist[n.hist.length - 1];
    sn[0].set(`${n.step.toLocaleString()}<small>/ ${TMAX.toLocaleString()}</small>`);
    sn[1].set(n.step ? h.lo.toFixed(3) : '1.000'); sn[2].set(n.step ? h.hi.toFixed(3) : '1.000');
    sn[3].set(isFinite(n.t10.hi) ? `${(n.t10.hi / n.t10.lo).toFixed(0)}<small>倍（理论，降到 10% 所需步数之比）</small>` : '–');
    const d = n.drift[n.drift.length - 1];
    document.querySelector('#n-step').textContent = `第 ${n.step.toLocaleString()} 步 · M = ${n.M} · 核漂移 ${(d.d * 100).toFixed(1)}%`;
  }
  const fit = LAB.canvas('#n-fit', (ctx, w, h) => {
    if (!net) return;
    const P = new LAB.Plot(ctx, w, h, { xmin: -1, xmax: 1, ymin: -2.3, ymax: 2.3, xlabel: 'x', ylabel: 'f / A', pad: { l: 44, r: 12, t: 10, b: 36 } }).axes();
    const k = net.k, A = net.A;
    P.fn((x) => Math.sin(Math.PI * x) + Math.sin(k * Math.PI * x), '#C9D1DA', 4, null, 400);
    P.points(XT, net.y.map((v) => v / A), '#9aa5b1', 2.6);
    P.clip();
    P.line(GXN, linPred(net.step).map((v) => v / A), C.c2, 2, [7, 4]);
    P.line(GXN, netOut(GXN).map((v) => v / A), C.c1, 2.4);
    P.unclip();
  });
  const res = LAB.canvas('#n-res', (ctx, w, h) => {
    if (!net) return;
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: TMAX, logx: true, logy: true, ymin: 1e-3, ymax: 1.5, xtickValues: [1, 10, 100, 1000, 10000], xfmt: (v) => (v >= 1000 ? v / 1000 + 'k' : v), ytickValues: [0.001, 0.01, 0.1, 1], xlabel: '训练步数 t', ylabel: '相对残差', pad: { l: 48, r: 12, t: 10, b: 38 } }).axes();
    const th = net.theory.filter((p) => p.t >= 1), cl = (v) => Math.max(v, 1.05e-3);
    P.clip();
    P.line(th.map((p) => p.t), th.map((p) => cl(p.lo)), C.c3, 1.6, [6, 4]);
    P.line(th.map((p) => p.t), th.map((p) => cl(p.hi)), C.c4, 1.6, [6, 4]);
    const hs = net.hist.filter((p) => p.t >= 1);
    if (hs.length > 1) { P.line(hs.map((p) => p.t), hs.map((p) => cl(p.lo)), C.c3, 2.4); P.line(hs.map((p) => p.t), hs.map((p) => cl(p.hi)), C.c4, 2.4); }
    P.unclip();
    P.hline(0.1, C.slate, [2, 3], 1);
    if (net.step > 0) P.vline(Math.max(1, net.step), C.slate, [3, 3]);
  });
  const drift = LAB.canvas('#n-drift', (ctx, w, h) => {
    if (!net) return;
    const all = runs.concat(net.step > 0 && !net.saved ? [{ M: net.M, pts: net.drift, cur: true }] : []);
    const mx = Math.max(0.05, ...all.flatMap((r) => r.pts.map((p) => p.d)));
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: TMAX, logx: true, ymin: 0, ymax: Math.min(3, mx * 1.15), xtickValues: [1, 10, 100, 1000, 10000], xfmt: (v) => (v >= 1000 ? v / 1000 + 'k' : v), xlabel: '训练步数 t', ylabel: '相对漂移', yfmt: (v) => Math.round(v * 100) + '%', pad: { l: 48, r: 12, t: 10, b: 38 } }).axes();
    all.forEach((r) => {
      const col = LAB.mix(C.c5, C.c6, Math.log2(r.M / 16) / 7), p = r.pts.filter((q) => q.t >= 1);
      if (p.length < 1) return;
      P.line(p.map((q) => q.t), p.map((q) => q.d), col, r.cur ? 2.6 : 1.8, r.A > 0.5 ? [6, 3] : null);
      const e = p[p.length - 1]; P.text(e.t, e.d, `M=${r.M}${r.A > 0.5 ? ', A=1' : ''} `, col, 'right', 'bottom', '600 11px ' + NUMF);
    });
    if (!all.length) P.text(3, mx * 0.5, '训练开始后显示', C.slate);
  });
  const spec = LAB.canvas('#n-spec', (ctx, w, h) => {
    if (!net) return;
    const v = net.E.vals.map((x) => Math.max(x, 1e-6)), top = Math.pow(10, Math.ceil(Math.log10(v[0])));
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.3, xmax: NT + 0.7, ymin: 1e-5, ymax: top, logy: true, xtickValues: [1, 10, 20, 30, 40], xfmt: (x) => x, xlabel: '特征值序号 k', ylabel: 'λ_k', pad: { l: 50, r: 10, t: 10, b: 38 } }).axes();
    P.bars(M.range(NT).map((i) => i + 1), v, M.range(NT).map((i) => (i < 4 ? LAB.SERIES[i] : LAB.mix(C.c6, '#ffffff', 0.35))), (P.tx(2) - P.tx(1)) * 0.7, 1e-5);
  });
  const vecs = LAB.canvas('#n-vec', (ctx, w, h) => {
    if (!net) return;
    const P = new LAB.Plot(ctx, w, h, { xmin: -1, xmax: 1, ymin: -0.45, ymax: 0.45, xlabel: 'x', pad: { l: 44, r: 10, t: 10, b: 36 } }).axes();
    for (let k = 0; k < 4; k++) { let v = net.E.vecs[k]; if (v[NT - 1] < 0) v = v.map((x) => -x); P.line(XT, v, LAB.SERIES[k], 2.2); P.text(-0.98, 0.4 - k * 0.075, `u${'₁₂₃₄'[k]}  λ=${net.E.vals[k].toPrecision(3)}`, LAB.SERIES[k], 'left', 'middle', '600 11px ' + NUMF); }
  });
  resetNet();
})();
