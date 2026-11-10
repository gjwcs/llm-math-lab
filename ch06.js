/* 第 6 章：位置编码：让模型分清词的先后 · 交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §6.1 狗咬人与人咬狗 · §6.3 RoPE 钟表指针 · §6.4 秒针、分针、时针与长文外推 · §6.5 4 维完整算例' });
  // 窄屏下长公式与宽表格改为横向滚动，不撑破版面
  document.querySelectorAll('.formula, [style*="overflow-x"]').forEach((f) => { f.style.width = '0'; f.style.minWidth = '100%'; });
  const FONT = getComputedStyle(document.body).getPropertyValue('--font');
  const NUMF = getComputedStyle(document.body).getPropertyValue('--font-num');
  const DEG = Math.PI / 180, TAU = 2 * Math.PI;
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  function pointer(cv, h) {
    cv.style.touchAction = 'none';
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let active = false;
    cv.addEventListener('pointerdown', (e) => { if (h.down && h.down(pos(e)) !== false) { active = true; cv.setPointerCapture(e.pointerId); e.preventDefault(); } });
    cv.addEventListener('pointermove', (e) => { if (active) h.move && h.move(pos(e)); else h.hover && h.hover(pos(e)); });
    const end = () => { if (active) { active = false; h.up && h.up(); } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }
  const fmtBase = (lg) => { const v = Math.pow(10, lg); if (Math.abs(lg - Math.round(lg)) < 1e-9) return '10' + '⁰¹²³⁴⁵⁶⁷⁸⁹'[Math.round(lg)]; const e = Math.floor(lg); return (v / Math.pow(10, e)).toFixed(1) + '×10' + '⁰¹²³⁴⁵⁶⁷⁸⁹'[e]; };

  /* ================= 实验 1：钟表指针转出相对距离 ================= */
  const sec1 = document.querySelector('#rotation');
  let q = [1, 0], k = [1, 0], m = 1, n = 4, lock = false, playing = false, dragV = null, view = null;
  const MMAX = 60;
  const sm = LAB.slider('#r-m', { label: '查询的位置 $m$', min: 0, max: MMAX, step: 1, value: 1, onInput: (v) => { const d = n - m; m = v; if (lock) { n = M.clamp(m + d, 0, MMAX); m = n - d; sn.set(Math.round(n)); sm.set(Math.round(m)); } upd1(); } });
  const sn = LAB.slider('#r-n', { label: '键的位置 $n$', min: 0, max: MMAX, step: 1, value: 4, onInput: (v) => { const d = n - m; n = v; if (lock) { m = M.clamp(n - d, 0, MMAX); n = m + d; sm.set(Math.round(m)); sn.set(Math.round(n)); } upd1(); } });
  const sth = LAB.slider('#r-theta', { label: '基础角频率 $\\theta$', min: 1, max: 90, step: 1, value: 30, fmt: (v) => v + '°', onInput: () => upd1() });
  LAB.checkbox('#r-lock', '锁定相对距离 $n-m$', false, (v) => { lock = v; });
  const playBtn = document.querySelector('#r-play');
  playBtn.onclick = () => {
    if (playing) { playing = false; playBtn.textContent = '▶ 整句一起后移'; return; }
    if (n >= MMAX - 1 || m >= MMAX - 1) { const d = n - m; m = Math.max(0, -Math.min(0, d)); n = m + d; }
    playing = true; playBtn.textContent = '⏸ 暂停'; let last = performance.now();
    const step = (t) => {
      if (!playing) return;
      if (!sec1.classList.contains('active')) { playing = false; playBtn.textContent = '▶ 整句一起后移'; return; }
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      m += 1.6 * dt; n += 1.6 * dt;
      if (Math.max(m, n) >= MMAX) { const over = Math.max(m, n) - MMAX; m -= over; n -= over; playing = false; playBtn.textContent = '▶ 整句一起后移'; }
      sm.set(Math.round(m)); sn.set(Math.round(n)); upd1();
      if (playing) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const preset1 = (qq, kk, th, mm, nn) => { playing = false; q = qq; k = kk; m = mm; n = nn; sth.set(th); sm.set(mm); sn.set(nn); upd1(); };
  document.querySelector('#r-bookA').onclick = () => preset1([1, 0], [1, 0], 30, 1, 4);
  document.querySelector('#r-bookB').onclick = () => preset1([1, 0], [1, 0], 30, 2, 5);
  document.querySelector('#r-ex1').onclick = () => preset1([1, 0], [0, 1], 90, 2, 1);
  document.querySelector('#r-ex3').onclick = () => preset1([1, 0], [0, 1], 90, 2, 3);
  const sr = [LAB.stat('#r-stats', '$\\langle\\tilde{\\mathbf q}_m,\\tilde{\\mathbf k}_n\\rangle$', 'coral'), LAB.stat('#r-stats', '相对距离 $n-m$'), LAB.stat('#r-stats', '旋转前 $\\mathbf q^\\top\\mathbf k$', 'teal'), LAB.stat('#r-stats', '$\\|\\tilde{\\mathbf q}_m\\|=\\|\\mathbf q\\|$', 'amber')];
  function upd1() {
    const th = sth.get() * DEG, qt = rot(q, m * th), kt = rot(k, n * th);
    const dot = M.dot(qt, kt);
    sr[0].set((Math.abs(dot) < 5e-4 ? 0 : dot).toFixed(3)); sr[1].set((n - m).toFixed(Math.abs(n - m - Math.round(n - m)) < 1e-6 ? 0 : 2));
    sr[2].set(M.dot(q, k).toFixed(3)); sr[3].set(`${M.norm(qt).toFixed(3)}<small>= ${M.norm(q).toFixed(3)}</small>`);
    plane.redraw(); curve.redraw();
  }
  const plane = LAB.canvas('#r-plane', (ctx, w, h) => {
    const th = sth.get() * DEG, R = Math.max(1.2, M.norm(q), M.norm(k)) * 1.2, s = Math.min(w, h) / 2 / R, cx = w / 2, cy = h / 2;
    view = { s, cx, cy, X: (v) => cx + v[0] * s, Y: (v) => cy - v[1] * s, inv: (x, y) => [(x - cx) / s, (cy - y) / s] };
    ctx.save(); ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    ctx.setLineDash([3, 4]); ctx.strokeStyle = '#cfd6de';
    [M.norm(q), M.norm(k)].forEach((r) => { ctx.beginPath(); ctx.arc(cx, cy, r * s, 0, TAU); ctx.stroke(); });
    ctx.setLineDash([]); ctx.fillStyle = C.slate; ctx.font = '12px ' + NUMF; ctx.fillText('Re', w - 22, cy - 6); ctx.fillText('Im', cx + 6, 14);
    ctx.restore();
    const qt = rot(q, m * th), kt = rot(k, n * th);
    const arc = (v, ang, rr, col) => { const a0 = Math.atan2(v[1], v[0]); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.6; ctx.beginPath(); const steps = 120; for (let i = 0; i <= steps; i++) { const a = a0 + ang * i / steps, r = rr * (1 + 0.06 * ang * i / steps / TAU); const X = cx + r * Math.cos(a), Y = cy - r * Math.sin(a); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.stroke(); ctx.restore(); };
    arc(q, m * th, s * M.norm(q) * 0.42, C.c1); arc(k, n * th, s * M.norm(k) * 0.58, C.c2);
    // 旋转后两向量的夹角
    let d = Math.atan2(kt[1], kt[0]) - Math.atan2(qt[1], qt[0]); while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    const a0 = Math.atan2(qt[1], qt[0]), rr = s * Math.min(M.norm(q), M.norm(k)) * 0.8;
    ctx.save(); ctx.fillStyle = 'rgba(107,76,154,.12)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, rr, -a0, -a0 - d, d > 0); ctx.closePath(); ctx.fill(); ctx.restore();
    const am = a0 + d / 2; ctx.save(); ctx.fillStyle = C.plum; ctx.font = '600 12.5px ' + NUMF; ctx.textAlign = 'center'; ctx.fillText(`${Math.abs(d / DEG).toFixed(0)}°`, cx + rr * 0.62 * Math.cos(am), cy - rr * 0.62 * Math.sin(am) + 4); ctx.restore();
    const ghost = (v, col) => { ctx.save(); ctx.setLineDash([5, 4]); ctx.globalAlpha = 0.55; LAB.arrow(ctx, cx, cy, view.X(v), view.Y(v), col, 1.6, 8); ctx.restore(); };
    ghost(q, C.c1); ghost(k, C.c2);
    LAB.arrow(ctx, cx, cy, view.X(qt), view.Y(qt), C.c1, 3, 12); LAB.arrow(ctx, cx, cy, view.X(kt), view.Y(kt), C.c2, 3, 12);
    const label = (v, t, col, bold) => { const a = Math.atan2(v[1], v[0]); ctx.save(); ctx.fillStyle = col; ctx.font = (bold ? '600 ' : '') + '13px ' + NUMF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, view.X(v) + 18 * Math.cos(a), view.Y(v) - 16 * Math.sin(a)); ctx.restore(); };
    label(q, 'q', C.c1); label(k, 'k', C.c2);
    label(qt, `q̃ (m=${+m.toFixed(1)})`, C.c1, true); label(kt, `k̃ (n=${+n.toFixed(1)})`, C.c2, true);
    [[q, C.c1, 4], [k, C.c2, 4], [qt, C.c1, 5.5], [kt, C.c2, 5.5]].forEach(([v, col, r]) => { ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(view.X(v), view.Y(v), r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); });
  });
  pointer(plane.canvas, {
    down: ([x, y]) => {
      if (!view) return false;
      const th = sth.get() * DEG, cands = [['q', q], ['k', k], ['qt', rot(q, m * th)], ['kt', rot(k, n * th)]];
      let best = null, bd = 22; cands.forEach(([id, v]) => { const dd = Math.hypot(view.X(v) - x, view.Y(v) - y); if (dd < bd) { bd = dd; best = id; } });
      if (!best) return false; dragV = best; return true;
    },
    move: ([x, y]) => {
      const th = sth.get() * DEG; let p = view.inv(x, y);
      const lim = Math.min(plane.w, plane.h) / 2 / view.s * 0.95, r = Math.hypot(p[0], p[1]);
      if (r > lim) p = [p[0] * lim / r, p[1] * lim / r]; if (r < 0.08) return;
      if (dragV === 'q') q = p; else if (dragV === 'k') k = p; else if (dragV === 'qt') q = rot(p, -m * th); else k = rot(p, -n * th);
      upd1();
    },
    up: () => { dragV = null; },
    hover: ([x, y]) => { if (!view) return; const th = sth.get() * DEG; const near = [q, k, rot(q, m * th), rot(k, n * th)].some((v) => Math.hypot(view.X(v) - x, view.Y(v) - y) < 22); plane.canvas.style.cursor = near ? 'grab' : 'default'; },
  });
  const curve = LAB.canvas('#r-curve', (ctx, w, h) => {
    const th = sth.get() * DEG, A = M.norm(q) * M.norm(k), ph = Math.atan2(k[1], k[0]) - Math.atan2(q[1], q[0]);
    const f = (D) => A * Math.cos(ph + D * th), D0 = n - m, span = 24;
    const xmin = Math.round(D0) - span, xmax = Math.round(D0) + span;
    const P = new LAB.Plot(ctx, w, h, { xmin, xmax, ymin: -A * 1.2, ymax: A * 1.2, xlabel: '相对距离 n − m', ylabel: '内积', pad: { l: 46, r: 12, t: 10, b: 38 } }).axes();
    P.hline(0, '#9aa5b1');
    P.fn(f, C.c5, 2, null, 600);
    const xs = M.range(xmax - xmin + 1).map((i) => xmin + i);
    P.points(xs, xs.map(f), LAB.mix(C.c5, '#ffffff', 0.35), 2.6);
    P.vline(D0, C.c4, [3, 3]);
    P.points([D0], [f(D0)], C.c4, 6.5, '#fff');
  });
  upd1();

  /* ================= 实验 2：秒针时针一起转（多频叠加与远程衰减） ================= */
  const sd = LAB.slider('#d-d', { label: '维度 $d$（共 $d/2$ 根指针）', min: 8, max: 256, step: 8, value: 128, onInput: () => upd2() });
  const sb = LAB.slider('#d-base', { label: '底数 base', min: 2, max: 7, step: 0.05, value: 4, fmt: fmtBase, onInput: () => upd2() });
  const DeltaOf = (v) => (v === 0 ? 0 : Math.round(Math.pow(10, v / 20)));
  const sD = LAB.slider('#d-delta', { label: '相对距离 $\\Delta=|m-n|$', min: 0, max: 100, step: 1, value: 30, fmt: (v) => DeltaOf(v).toLocaleString(), hint: '对数刻度：0, 1, … 10⁵', onInput: () => upd2() });
  document.querySelector('#d-b1').onclick = () => sb.set(4, true);
  document.querySelector('#d-b2').onclick = () => sb.set(Math.log10(5e5), true);
  document.querySelector('#d-b3').onclick = () => sb.set(6, true);
  const thetas = () => { const d = sd.get(), base = Math.pow(10, sb.get()); return M.range(d / 2).map((j) => Math.pow(base, -2 * j / d)); };
  function partial(th, D) { let x = 0, y = 0; const pts = [[0, 0]]; th.forEach((t) => { x += Math.cos(D * t); y += Math.sin(D * t); pts.push([x, y]); }); return pts; }
  function measures(th, D) { const P = partial(th, D), J = th.length; let B = 0; for (let j = 1; j <= J; j++) B += Math.hypot(P[j][0], P[j][1]); B /= J; const last = P[J]; return { B: B / ((J + 1) / 2), S: Math.hypot(last[0], last[1]) / J, cos: last[0] / J }; }
  const sdst = [LAB.stat('#d-stats', 'Abel 上界 $B(\\Delta)/B(0)$', 'coral'), LAB.stat('#d-stats', '$|S_{d/2}|/(d/2)$'), LAB.stat('#d-stats', '平均 $\\cos(\\Delta\\theta_j)$', 'leaf'), LAB.stat('#d-stats', '最慢维的波长', 'amber')];
  function upd2() {
    const th = thetas(), D = DeltaOf(sD.get()), r = measures(th, D);
    sdst[0].set(r.B.toFixed(3)); sdst[1].set(r.S.toFixed(3)); sdst[2].set(r.cos.toFixed(3));
    const lam = TAU / th[th.length - 1]; sdst[3].set(`${lam >= 1e5 ? M.fmt(lam, 1) : Math.round(lam).toLocaleString()}<small>词</small>`);
    spiral.redraw(); spec.redraw(); dcurve.redraw();
  }
  const spiral = LAB.canvas('#d-spiral', (ctx, w, h) => {
    const th = thetas(), D = DeltaOf(sD.get()), P = partial(th, D), J = th.length;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; P.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    const span = Math.max(x1 - x0, y1 - y0, 2), s = (Math.min(w, h) - 30) / span, cx = w / 2 - (x0 + x1) / 2 * s, cy = h / 2 + (y0 + y1) / 2 * s;
    ctx.save(); ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let j = 1; j <= J; j++) { ctx.strokeStyle = LAB.mix(C.c1, C.c2, (j - 1) / Math.max(1, J - 1)); ctx.beginPath(); ctx.moveTo(cx + P[j - 1][0] * s, cy - P[j - 1][1] * s); ctx.lineTo(cx + P[j][0] * s, cy - P[j][1] * s); ctx.stroke(); }
    ctx.restore();
    const L = P[J]; if (Math.hypot(L[0], L[1]) * s > 6) LAB.arrow(ctx, cx, cy, cx + L[0] * s, cy - L[1] * s, C.c4, 1.6, 8);
    ctx.save(); ctx.fillStyle = C.navy; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, TAU); ctx.fill();
    ctx.font = '600 12px ' + FONT; ctx.fillStyle = C.ink; ctx.fillText(`Δ = ${D.toLocaleString()}，|S| = ${Math.hypot(L[0], L[1]).toFixed(1)} / ${J}`, 8, 16);
    ctx.font = '11px ' + FONT; ctx.fillStyle = C.c1; ctx.fillText('蓝 = 快指针', 8, h - 22); ctx.fillStyle = C.c2; ctx.fillText('橙 = 慢指针', 8, h - 8);
    ctx.restore();
  });
  const spec = LAB.canvas('#d-spec', (ctx, w, h) => {
    const th = thetas(), J = th.length, js = M.range(J).map((j) => j + 1);
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: J, logy: true, ymin: 1e-7, ymax: 1e8, ytickValues: [1e-6, 1e-3, 1, 1e3, 1e6], xlabel: '维度组 j', pad: { l: 50, r: 10, t: 10, b: 38 } }).axes();
    P.hline(4096, C.slate, [4, 4], 1); P.text(J, 4096, '4096 ', C.slate, 'right', 'bottom', '11px ' + NUMF);
    P.line(js, th, C.c6, 2.4); P.line(js, th.map((t) => TAU / t), C.c2, 2.4);
    const D = DeltaOf(sD.get()); if (D > 0) { P.hline(TAU / D, C.c4, [2, 3], 1); P.text(1.5, TAU / D, ` 波长 = 2π/Δ`, C.c4, 'left', 'top', '11px ' + FONT); }
  });
  const dcurve = LAB.canvas('#d-curve', (ctx, w, h) => {
    const th = thetas(), Dmax = 1e5;
    const xs = [], B = [], S = [], Cc = [];
    for (let i = 0; i <= 420; i++) { const D = Math.pow(Dmax, i / 420); const r = measures(th, D); xs.push(D); B.push(r.B); S.push(r.S); Cc.push(r.cos); }
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: Dmax, logx: true, ymin: -0.4, ymax: 1.05, xtickValues: [1, 10, 100, 1000, 1e4, 1e5], xfmt: (v) => (v >= 1e4 ? M.fmt(v, 0).replace('1×', '') : v), xlabel: '相对距离 Δ（对数刻度）', ylabel: '归一化幅度', pad: { l: 46, r: 12, t: 10, b: 38 } }).axes();
    P.hline(0, '#9aa5b1');
    P.line(xs, Cc, C.c3, 1.4); P.line(xs, S, C.c1, 1.8); P.line(xs, B, C.c4, 2.8);
    const D = DeltaOf(sD.get()); if (D >= 1) { const r = measures(th, D); P.vline(D, C.slate, [3, 3]); P.points([D], [r.B], C.c4, 6, '#fff'); }
  });
  upd2();
  // 书中 4 维算例：快针 90°、慢针 15°
  const t4 = LAB.slider('#t4-D', { label: '相对距离 $\\Delta=n-m$', min: 0, max: 24, step: 1, value: 4, onInput: () => updT4() });
  const st4 = [LAB.stat('#t4-stats', '快针得分 $\\cos(90^\\circ\\Delta)$', 'teal'), LAB.stat('#t4-stats', '慢针得分 $\\cos(15^\\circ\\Delta)$', 'plum'), LAB.stat('#t4-stats', '总分', 'coral')];
  const fast = (D) => Math.cos(90 * D * DEG), slow = (D) => Math.cos(15 * D * DEG);
  const r3 = (x) => (Math.abs(x) < 5e-10 ? 0 : x).toFixed(3);
  function updT4() { const D = t4.get(); st4[0].set(r3(fast(D))); st4[1].set(r3(slow(D))); st4[2].set(r3(fast(D) + slow(D))); t4c.redraw(); }
  const t4c = LAB.canvas('#t4-plot', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.5, xmax: 24.5, ymin: -2.2, ymax: 2.3, xtickValues: [0, 4, 8, 12, 16, 20, 24], xlabel: '相对距离 Δ（个词）', ylabel: '内积', pad: { l: 44, r: 12, t: 10, b: 38 } }).axes();
    const xs = M.range(25);
    P.hline(0, '#9aa5b1');
    P.fn(slow, C.c5, 1.6, [6, 4]);
    P.points(xs, xs.map(fast), LAB.mix(C.c6, '#ffffff', 0.3), 3);
    P.line(xs, xs.map((D) => fast(D) + slow(D)), C.c4, 2.2); P.points(xs, xs.map((D) => fast(D) + slow(D)), C.c4, 3.2);
    const D = t4.get(); P.vline(D, C.slate, [3, 3]); P.points([D], [fast(D) + slow(D)], C.amber, 6.5, '#fff');
    P.text(24.3, 2.15, '红 = 总分　紫虚线 = 慢针　青点 = 快针', C.slate, 'right', 'top', '11px ' + FONT);
  });
  updT4();

  /* ================= 实验 3：调慢表针读长文（PI 与 NTK） ================= */
  const LTR = [2048, 4096, 8192, 16384];
  let lIdx = 1;
  LAB.segmented('#e-L', ['2K', '4K', '8K', '16K'], 1, (i) => { lIdx = i; upd3(); });
  const es = LAB.slider('#e-s', { label: '扩展倍数 $s=L_{\\text{test}}/L_{\\text{train}}$', min: 1, max: 32, step: 1, value: 8, onInput: () => upd3() });
  const ed = LAB.slider('#e-d', { label: '头维度 $d_k$', min: 16, max: 256, step: 16, value: 128, onInput: () => upd3() });
  const eb = LAB.slider('#e-base', { label: '底数 base', min: 2, max: 7, step: 0.05, value: 4, fmt: fmtBase, onInput: () => upd3() });
  const ei = LAB.slider('#e-i', { label: '观察第 $i$ 组维度', min: 0, max: 1, step: 0.005, value: 1, fmt: (v) => `${idxOf(v)} / ${ed.get() / 2}`, hint: '1 = 最快的秒针，最右 = 最慢的时针', onInput: () => upd3() });
  const eH = LAB.slider('#e-H', { label: 'ALiBi 头数 $H$', min: 1, max: 32, step: 1, value: 8, onInput: () => upd3() });
  function idxOf(v) { const J = ed ? ed.get() / 2 : 64; return 1 + Math.round(v * (J - 1)); }
  const METHODS = [{ n: '原始 RoPE', col: C.c1 }, { n: '位置插值 PI', col: C.c2 }, { n: 'NTK-aware', col: C.c3 }];
  // NTK-aware：新底数 base·s^{d/(d-2)}，等价于 θ_i · s^{-2(i-1)/(d-2)}（最慢的时针恰好放慢 s 倍）
  function thetaM(mi, i, d, base, s) { const t = Math.pow(base, -2 * (i - 1) / d); return mi === 0 ? t : mi === 1 ? t / s : t * Math.pow(s, -2 * (i - 1) / (d - 2)); }
  function unseen(mi, i, d, base, s, Ltr) { const At = Ltr * Math.pow(base, -2 * (i - 1) / d), Ae = s * Ltr * thetaM(mi, i, d, base, s); return At >= TAU ? 0 : Math.max(0, Math.min(Ae, TAU) - At); }
  const est = [LAB.stat('#e-stats', '测试长度 $L_{\\text{test}}$'), LAB.stat('#e-stats', '原始 RoPE 越界的维度组', 'coral'), LAB.stat('#e-stats', 'PI 的相邻词角差', 'amber'), LAB.stat('#e-stats', 'NTK-aware 最大未见角度', 'leaf')];
  function upd3() {
    const d = ed.get(), J = d / 2, base = Math.pow(10, eb.get()), s = es.get(), Ltr = LTR[lIdx], Lte = s * Ltr;
    ei.el.querySelector('.val').textContent = `${idxOf(ei.get())} / ${J}`;
    const res = METHODS.map((_, mi) => { let cnt = 0, mx = 0; for (let i = 1; i <= J; i++) { const u = unseen(mi, i, d, base, s, Ltr); if (u > DEG) cnt++; mx = Math.max(mx, u); } return { cnt, mx }; });
    est[0].set(Lte >= 1024 ? `${Lte / 1024}K` : Lte); est[1].set(`${res[0].cnt}<small>/ ${J} 组</small>`);
    est[2].set(`${(thetaM(1, 1, d, base, s) / DEG).toFixed(2)}°<small>原来 ${(1 / DEG).toFixed(1)}°</small>`);
    est[3].set(`${(res[2].mx / DEG).toFixed(0)}°<small>${res[2].cnt} 组越界</small>`);
    const H = eH.get(), slopes = M.range(H).map((h) => Math.pow(2, -8 * (h + 1) / H)), lmin = slopes[H - 1];
    const rows = [
      [METHODS[0], 'θ_i', res[0], 1, '长文时慢维转进从未见过的角度'],
      [METHODS[1], 'θ_i / s', res[1], 1 / s, '近处相邻词分辨率降为 1/s'],
      [METHODS[2], 'θ_i · s^{-2(i-1)/(d_k-2)}', res[2], 1, '中间频段仍有部分越界'],
    ].map(([mm, f, r, res1, cost]) => `<tr><td><b style="color:${mm.col}">${mm.n}</b></td><td>${LAB.tex(f)}</td><td class="num">${r.cnt} / ${J}</td><td class="num">${(r.mx / DEG).toFixed(0)}°</td><td class="num">${(res1 / DEG).toFixed(2)}°</td><td>${cost}</td></tr>`);
    rows.push(`<tr><td><b style="color:${C.c5}">ALiBi</b></td><td>${LAB.tex('-\\lambda_h|m-n|')}</td><td class="num">0</td><td class="num">–</td><td class="num">–</td><td>最平缓的头在 ${Lte >= 1024 ? Lte / 1024 + 'K' : Lte} 处仍被乘上 ${M.fmt(Math.exp(-lmin * Lte), 1)}</td></tr>`);
    document.querySelector('#e-table').innerHTML = `<thead><tr><th>方案</th><th>第 $i$ 组角速度</th><th>越界的维度组</th><th>最大未见角度</th><th>相邻词角差（第 1 组）</th><th>代价</th></tr></thead><tbody>${rows.join('')}</tbody>`;
    LAB.renderMath(document.querySelector('#e-table thead'));
    const i = idxOf(ei.get());
    document.querySelector('#e-sub').textContent = `i = ${i}，原始波长 ${Math.round(TAU / thetaM(0, i, d, base, s)).toLocaleString()} 词`;
    dials.redraw(); wave.redraw(); alibi.redraw();
  }
  // 窄屏时按宽度收缩表盘画布的高度
  const dialHost = document.querySelector('#e-dials');
  const fitDials = () => { const w = dialHost.clientWidth; if (w > 0) dialHost.style.height = Math.round(Math.min(260, w / 3 + 78)) + 'px'; };
  window.addEventListener('resize', fitDials); fitDials();
  const dials = LAB.canvas('#e-dials', (ctx, w, h) => {
    const d = ed.get(), base = Math.pow(10, eb.get()), s = es.get(), Ltr = LTR[lIdx], i = idxOf(ei.get());
    const cw = w / 3, R = Math.min(cw / 2 - 12, (h - 76) / 2), cyy = 10 + R + 6;
    const At = Ltr * thetaM(0, i, d, base, s);
    METHODS.forEach((mm, mi) => {
      const cx = cw * mi + cw / 2, Ae = s * Ltr * thetaM(mi, i, d, base, s);
      const ang = (a) => -Math.PI / 2 + a; // 从 12 点钟方向顺时针
      ctx.save();
      ctx.lineWidth = Math.max(8, R * 0.2); ctx.lineCap = 'butt';
      ctx.strokeStyle = '#EEF1F5'; ctx.beginPath(); ctx.arc(cx, cyy, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#C9D1DA'; ctx.beginPath(); ctx.arc(cx, cyy, R, ang(0), ang(Math.min(At, TAU) - 1e-6)); ctx.stroke();
      ctx.lineWidth = Math.max(4, R * 0.09);
      const seenUsed = Math.min(Ae, At, TAU), unseenEnd = Math.min(Ae, TAU);
      ctx.strokeStyle = C.c3; ctx.beginPath(); ctx.arc(cx, cyy, R, ang(0), ang(seenUsed - 1e-6)); ctx.stroke();
      if (At < TAU && unseenEnd > At) { ctx.strokeStyle = C.c4; ctx.beginPath(); ctx.arc(cx, cyy, R, ang(At), ang(unseenEnd)); ctx.stroke(); }
      // 指针：测试最远位置的角度
      const fa = ang(Ae % TAU);
      ctx.strokeStyle = C.navy; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cyy); ctx.lineTo(cx + R * 0.78 * Math.cos(fa), cyy + R * 0.78 * Math.sin(fa)); ctx.stroke();
      ctx.fillStyle = C.navy; ctx.beginPath(); ctx.arc(cx, cyy, 3.5, 0, TAU); ctx.fill();
      ctx.fillStyle = C.ink; ctx.font = '600 13px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(mm.n, cx, cyy + R + 24);
      ctx.font = '11.5px ' + FONT; ctx.fillStyle = C.slate;
      const deg = (a) => (a / DEG >= 3600 ? (a / TAU).toFixed(0) + ' 圈' : (a / DEG).toFixed(0) + '°');
      if (cw >= 200) ctx.fillText(`测试转到 ${deg(Ae)}（训练见过 ${deg(At)}）`, cx, cyy + R + 41);
      else { ctx.fillText(`测试转到 ${deg(Ae)}`, cx, cyy + R + 40); ctx.fillText(`训练见过 ${deg(At)}`, cx, cyy + R + 55); }
      ctx.restore();
    });
  });
  const wave = LAB.canvas('#e-wave', (ctx, w, h) => {
    const d = ed.get(), J = d / 2, base = Math.pow(10, eb.get()), s = es.get(), Ltr = LTR[lIdx], js = M.range(J).map((j) => j + 1);
    const top = Math.pow(10, Math.ceil(Math.log10(TAU * s * Math.pow(base, (d - 2) / d) * 1.5)));
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: J, logy: true, ymin: 1, ymax: Math.max(top, 1e5), xlabel: '维度组 i', ylabel: '波长（词）', pad: { l: 50, r: 10, t: 10, b: 38 } }).axes();
    P.hline(Ltr, C.slate, [5, 4], 1.2); P.text(1.5, Ltr, ` L_train`, C.slate, 'left', 'bottom', '11px ' + NUMF);
    if (s > 1) { P.hline(s * Ltr, C.c4, [5, 4], 1.2); P.text(1.5, s * Ltr, ` L_test`, C.c4, 'left', 'bottom', '11px ' + NUMF); }
    [2, 1, 0].forEach((mi) => P.line(js, js.map((i) => TAU / thetaM(mi, i, d, base, s)), METHODS[mi].col, mi === 0 ? 2.6 : 2, mi === 1 ? [6, 3] : null));
    P.vline(idxOf(ei.get()), C.slate, [2, 3], 1);
  });
  const alibi = LAB.canvas('#e-alibi', (ctx, w, h) => {
    const s = es.get(), Ltr = LTR[lIdx], Lte = s * Ltr, H = eH.get();
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: Math.max(Lte, 2 * Ltr), logx: true, ymin: 0, ymax: 1.02, xtickValues: [1, 10, 100, 1000, 10000, 100000].filter((v) => v <= Math.max(Lte, 2 * Ltr)), xfmt: (v) => (v >= 1000 ? v / 1000 + 'K' : v), xlabel: '距离 Δ', ylabel: '权重因子', pad: { l: 44, r: 10, t: 10, b: 38 } }).axes();
    for (let hh = 1; hh <= H; hh++) { const lam = Math.pow(2, -8 * hh / H); P.fn((x) => Math.exp(-lam * x), LAB.mix(C.c5, C.c6, (hh - 1) / Math.max(1, H - 1)), 1.8); }
    P.vline(Ltr, C.slate, [5, 4]); P.text(Ltr, 0.95, ' L_train', C.slate, 'left', 'middle', '11px ' + NUMF);
  });
  upd3();
})();
