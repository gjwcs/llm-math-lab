/* 第 4 章：核方法与 NTK · 交互实验（与第二版正文 §4.1–4.4、练习 4.1/4.3/4.4 的数字一致） */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §4.1 提床单切异或 · §4.2 核技巧与注意力指数核 · §4.3 神经正切核 · §4.4 手算算例 · 练习 4.1、4.3、4.4' });
  // 窄屏下长公式与宽表格改为横向滚动，不撑破版面
  document.querySelectorAll('.formula, [style*="overflow-x"]').forEach((f) => { f.style.width = '0'; f.style.minWidth = '100%'; });
  const FONT = getComputedStyle(document.body).getPropertyValue('--font');
  const NUMF = getComputedStyle(document.body).getPropertyValue('--font-num');
  const r4 = (v) => (Math.abs(v) < 5e-10 ? '0' : String(+v.toFixed(4))).replace('-', '−');
  const r2 = (v) => (Math.abs(v) < 5e-10 ? '0.00' : v.toFixed(2)).replace('-', '−');
  const tm = (v) => (Math.abs(v) < 5e-10 ? '0' : String(+v.toFixed(2))); // 公式里用 ASCII 减号
  function pointer(cv, h) {
    cv.style.touchAction = 'none';
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let active = false;
    cv.addEventListener('pointerdown', (e) => { if (h.down && h.down(pos(e)) !== false) { active = true; cv.setPointerCapture(e.pointerId); e.preventDefault(); } });
    cv.addEventListener('pointermove', (e) => { if (active) h.move && h.move(pos(e)); });
    const end = () => { if (active) { active = false; h.up && h.up(); } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }

  /* ================= 实验 1：提起床单切异或 ================= */
  const sec1 = document.querySelector('#lift');
  const XOR = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]];
  const RING = [[1, 0, 1], [0, 1, 1], [-1, 0, 1], [0, -1, 1], [2, 0, -1], [0, 2, -1], [-2, 0, -1], [0, -2, -1]];
  const NAMES = { xor: ['红豆 1', '红豆 2', '蓝豆 3', '蓝豆 4'], ring: ['内圈 1', '内圈 2', '内圈 3', '内圈 4', '外圈 1', '外圈 2', '外圈 3', '外圈 4'] };
  let ds = 0, mode = 0, yaw = 0.75, pitch = 0.42, spin = true, dragging = null;
  const pts = () => (ds === 0 ? XOR : RING);
  const lift = (p) => (ds === 0 ? p[0] * p[1] : p[0] * p[0] + p[1] * p[1]);
  LAB.segmented('#l-data', ['异或四颗豆', '圆环八颗豆（练习 4.1）'], 0, (i) => { ds = i; sC.setRange(ds === 0 ? -1.5 : 0, ds === 0 ? 1.5 : 5, 0.05); sC.set(ds === 0 ? 0 : 2.5); descLift(); upd(); });
  LAB.segmented('#l-mode', ['桌面上切一刀', '提起床单再切'], 0, (i) => { mode = i; document.querySelector('#l-flat').style.display = i === 0 ? '' : 'none'; document.querySelector('#l-lift').style.display = i === 1 ? '' : 'none'; upd(); ensureSpin(); });
  const sW1 = LAB.slider('#l-w1', { label: '$w_1$', min: -3, max: 3, step: 0.1, value: 1, fmt: (v) => v.toFixed(1), onInput: () => upd() });
  const sW2 = LAB.slider('#l-w2', { label: '$w_2$', min: -3, max: 3, step: 0.1, value: 0.5, fmt: (v) => v.toFixed(1), onInput: () => upd() });
  const sB = LAB.slider('#l-b', { label: '$b$', min: -3, max: 3, step: 0.1, value: 0.3, fmt: (v) => v.toFixed(1), onInput: () => upd() });
  const sC = LAB.slider('#l-c', { label: '水平刀面的高度 $c$', min: -1.5, max: 1.5, step: 0.05, value: 0, fmt: (v) => v.toFixed(2), onInput: () => upd() });
  LAB.checkbox('#l-spin', '三维视图自动旋转', true, (v) => { spin = v; ensureSpin(); });
  function descLift() {
    const d = document.querySelector('#l-liftdesc');
    d.innerHTML = ds === 0 ? '多算一列 $x_3=x_1x_2$，在高度 $x_3=c$ 处横切：$x_3&gt;c$ 判为红豆。书中取 $c=0$，即 $F=x_3$。' : '多算一列 $x_3=x_1^2+x_2^2$（碗），在高度 $x_3=c$ 处横切：$x_3&lt;c$ 判为红豆。练习 4.1 取 $c=2.5$，即 $F=-x_3+2.5$。';
    LAB.renderMath(d);
  }
  descLift();
  const score = (p) => { // >0 判红
    if (mode === 0) return sW1.get() * p[0] + sW2.get() * p[1] + sB.get();
    const c = sC.get(), z = lift(p); return ds === 0 ? z - c : c - z;
  };
  const wrong = () => pts().filter((p) => (score(p) > 0 ? 1 : -1) !== p[2]).length;
  document.querySelector('#l-search').onclick = () => {
    let best = null;
    for (let a = -30; a <= 30; a += 1) for (let b2 = -30; b2 <= 30; b2 += 1) for (let c0 = -30; c0 <= 30; c0 += 1) {
      const w1 = a / 10, w2 = b2 / 10, bb = c0 / 10;
      const e = pts().filter((p) => ((w1 * p[0] + w2 * p[1] + bb) > 0 ? 1 : -1) !== p[2]).length;
      if (!best || e < best.e) best = { e, w1, w2, bb };
    }
    sW1.set(best.w1); sW2.set(best.w2); sB.set(best.bb); upd();
    const cap = document.querySelector('#l-tcap');
    cap.innerHTML = `电脑试遍了 $w_1,w_2,b\\in[-3,3]$ 上的 ${(61 ** 3).toLocaleString()} 条直线，最好的也要分错 <b>${best.e}</b> 颗。`;
    LAB.renderMath(cap);
  };
  // ---- 二维桌面
  const v2 = LAB.canvas('#l-2d', (ctx, w, h) => {
    const R = ds === 0 ? 1.8 : 2.8, s = Math.min(w, h) / (2 * R), cx = w / 2, cy = h / 2;
    const X = (x) => cx + x * s, Y = (y) => cy - y * s;
    const cell = 5;
    for (let px = 0; px < w; px += cell) for (let py = 0; py < h; py += cell) {
      const v = score([(px + cell / 2 - cx) / s, (cy - py - cell / 2) / s]);
      ctx.fillStyle = v > 0 ? '#FBEEF0' : '#EAF1FA'; ctx.fillRect(px, py, cell, cell);
    }
    ctx.save(); ctx.strokeStyle = 'rgba(92,103,115,.22)'; ctx.lineWidth = 1;
    for (let i = -Math.floor(R); i <= Math.floor(R); i++) { ctx.beginPath(); ctx.moveTo(X(i), 0); ctx.lineTo(X(i), h); ctx.moveTo(0, Y(i)); ctx.lineTo(w, Y(i)); ctx.stroke(); }
    ctx.strokeStyle = '#9aa5b1'; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    ctx.fillStyle = C.slate; ctx.font = '12px ' + NUMF; ctx.fillText('x₁', w - 18, cy - 6); ctx.fillText('x₂', cx + 6, 14);
    // 分界线
    ctx.strokeStyle = C.navy; ctx.lineWidth = 2.2;
    if (mode === 0) {
      const a = sW1.get(), b = sW2.get(), c = sB.get();
      ctx.beginPath();
      if (Math.abs(b) > 1e-9) { ctx.moveTo(X(-R * 1.5), Y((-c - a * -R * 1.5) / b)); ctx.lineTo(X(R * 1.5), Y((-c - a * R * 1.5) / b)); }
      else if (Math.abs(a) > 1e-9) { ctx.moveTo(X(-c / a), Y(-R * 1.5)); ctx.lineTo(X(-c / a), Y(R * 1.5)); }
      ctx.stroke();
    } else if (ds === 0) {
      const c = sC.get();
      if (Math.abs(c) < 1e-9) { ctx.beginPath(); ctx.moveTo(X(-R * 1.5), cy); ctx.lineTo(X(R * 1.5), cy); ctx.moveTo(cx, Y(-R * 1.5)); ctx.lineTo(cx, Y(R * 1.5)); ctx.stroke(); }
      else [1, -1].forEach((sg) => { ctx.beginPath(); let st = false; for (let i = 1; i <= 400; i++) { const x = sg * (0.01 + R * 1.2 * i / 400), y = c / x; if (Math.abs(y) > R * 1.4) { st = false; continue; } if (!st) { ctx.moveTo(X(x), Y(y)); st = true; } else ctx.lineTo(X(x), Y(y)); } ctx.stroke(); });
    } else {
      const c = sC.get(); if (c > 0) { ctx.beginPath(); ctx.arc(cx, cy, Math.sqrt(c) * s, 0, 2 * Math.PI); ctx.stroke(); }
    }
    ctx.restore();
    pts().forEach((p, i) => {
      const ok = (score(p) > 0 ? 1 : -1) === p[2];
      ctx.save(); ctx.fillStyle = p[2] > 0 ? C.c4 : C.c1; ctx.strokeStyle = ok ? '#fff' : C.ink; ctx.lineWidth = ok ? 1.8 : 2.6;
      ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 9, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '600 10px ' + NUMF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i + 1, X(p[0]), Y(p[1]) + 0.5);
      if (!ok) { ctx.fillStyle = C.ink; ctx.font = '600 13px ' + FONT; ctx.fillText('✗', X(p[0]) + 14, Y(p[1]) - 12); }
      ctx.restore();
    });
  });
  // ---- 三维视图
  function proj(w, h) {
    const R = ds === 0 ? 1.5 : 2.4, zs = ds === 0 ? 0.9 : 0.38, s = Math.min(w, h) / (2.6 * R);
    const ca = Math.cos(yaw), sa = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return (x, y, z) => { const xr = x * ca - y * sa, yr = x * sa + y * ca; return [w / 2 + xr * s, h * 0.55 - (z * zs * cp - yr * sp) * s * 0.95 - 0 , yr * cp + z * sp]; };
  }
  const v3 = LAB.canvas('#l-3d', (ctx, w, h) => {
    const P = proj(w, h), R = ds === 0 ? 1.5 : 2.4;
    const seg = (a, b, col, lw, dash) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw || 1; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore(); };
    const poly = (ps, fill, stroke) => { ctx.save(); ctx.beginPath(); ps.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } ctx.restore(); };
    // 桌面（高度 0）
    const base = ds === 0 ? 0 : 0;
    poly([P(-R, -R, base), P(R, -R, base), P(R, R, base), P(-R, R, base)], 'rgba(176,122,78,.10)', 'rgba(138,90,54,.35)');
    // 坐标轴
    seg(P(-R, 0, base), P(R, 0, base), '#9aa5b1', 1); seg(P(0, -R, base), P(0, R, base), '#9aa5b1', 1);
    ctx.save(); ctx.fillStyle = C.slate; ctx.font = '12px ' + NUMF; const ax = P(R * 1.08, 0, base), ay = P(0, R * 1.08, base); ctx.fillText('x₁', ax[0], ax[1]); ctx.fillText('x₂', ay[0], ay[1]); ctx.restore();
    if (mode === 1) {
      // 床单曲面网格
      const N = 12;
      for (let i = 0; i <= N; i++) {
        const a = [], b = [];
        for (let j = 0; j <= 40; j++) {
          if (ds === 0) { const u = -R + 2 * R * i / N, v = -R + 2 * R * j / 40; a.push(P(u, v, u * v)); b.push(P(v, u, u * v)); }
          else { const r = 2.3 * i / N, t = 2 * Math.PI * j / 40; a.push(P(r * Math.cos(t), r * Math.sin(t), r * r)); const rr = 2.3 * j / 40, tt = 2 * Math.PI * i / N; b.push(P(rr * Math.cos(tt), rr * Math.sin(tt), rr * rr)); }
        }
        [a, b].forEach((L) => { ctx.save(); ctx.strokeStyle = 'rgba(107,76,154,.28)'; ctx.lineWidth = 1; ctx.beginPath(); L.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.restore(); });
      }
      // 水平刀面
      const c = sC.get(), Q = R * 1.05;
      poly([P(-Q, -Q, c), P(Q, -Q, c), P(Q, Q, c), P(-Q, Q, c)], 'rgba(224,154,45,.22)', 'rgba(224,154,45,.8)');
      const lab = P(Q, -Q, c); ctx.save(); ctx.fillStyle = C.amber; ctx.font = '600 12px ' + FONT; ctx.fillText(`刀面 x₃ = ${c.toFixed(2)}`, lab[0] + 4, lab[1]); ctx.restore();
    } else {
      // 竖直刀面 w1x1+w2x2+b=0
      const a = sW1.get(), b = sW2.get(), cc = sB.get(), H = 1.2;
      // 直线 a x + b y + cc = 0 与正方形 [-R,R]^2 的交点
      const hits = [];
      if (Math.abs(b) > 1e-9) [-R, R].forEach((x) => { const y = (-cc - a * x) / b; if (Math.abs(y) <= R + 1e-9) hits.push([x, y]); });
      if (Math.abs(a) > 1e-9) [-R, R].forEach((y) => { const x = (-cc - b * y) / a; if (Math.abs(x) <= R + 1e-9) hits.push([x, y]); });
      const p1 = hits[0], p2 = hits.find((q) => Math.hypot(q[0] - hits[0][0], q[1] - hits[0][1]) > 1e-6);
      if (p1 && p2) poly([P(p1[0], p1[1], -H), P(p2[0], p2[1], -H), P(p2[0], p2[1], H), P(p1[0], p1[1], H)], 'rgba(29,53,87,.12)', 'rgba(29,53,87,.55)');
    }
    // 豆子（按深度排序）
    const items = pts().map((p, i) => { const z = mode === 1 ? lift(p) : 0; return { p, i, z, q: P(p[0], p[1], z), q0: P(p[0], p[1], base) }; }).sort((u, v) => v.q[2] - u.q[2]);
    items.forEach(({ p, i, z, q, q0 }) => {
      if (mode === 1) seg(q0, q, 'rgba(92,103,115,.6)', 1, [3, 3]);
      const ok = (score(p) > 0 ? 1 : -1) === p[2];
      ctx.save(); ctx.fillStyle = p[2] > 0 ? C.c4 : C.c1; ctx.strokeStyle = ok ? '#fff' : C.ink; ctx.lineWidth = ok ? 1.6 : 2.4;
      ctx.beginPath(); ctx.arc(q[0], q[1], 8, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '600 10px ' + NUMF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i + 1, q[0], q[1] + 0.5);
      if (mode === 1) { ctx.fillStyle = C.ink; ctx.font = '11px ' + NUMF; ctx.textAlign = 'left'; ctx.fillText(`x₃=${r4(z)}`, q[0] + 11, q[1] - 8); }
      ctx.restore();
    });
  });
  pointer(v3.canvas, {
    down: (p) => { dragging = { p, yaw, pitch }; return true; },
    move: (p) => { yaw = dragging.yaw + (p[0] - dragging.p[0]) * 0.01; pitch = M.clamp(dragging.pitch + (p[1] - dragging.p[1]) * 0.01, -0.2, 1.35); v3.redraw(); },
    up: () => { dragging = null; },
  });
  let spinning = false;
  function ensureSpin() {
    if (spinning || !spin) return; spinning = true;
    let last = performance.now();
    const loop = (t) => {
      if (!spin) { spinning = false; return; }
      if (sec1.classList.contains('active') && !dragging) { yaw += (t - last) * 0.00025; v3.redraw(); }
      last = t; requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  const stL = [LAB.stat('#l-stats', '分错的豆子', 'coral'), LAB.stat('#l-stats', '红豆的得分之和', ''), LAB.stat('#l-stats', '蓝豆的得分之和', 'plum')];
  function upd() {
    const P = pts(), names = ds === 0 ? NAMES.xor : NAMES.ring;
    const e = wrong();
    stL[0].set(`${e}<small>/ ${P.length} 颗</small>`);
    const red = P.filter((p) => p[2] > 0).reduce((s, p) => s + score(p), 0), blue = P.filter((p) => p[2] < 0).reduce((s, p) => s + score(p), 0);
    stL[1].set(`${r2(red)}<small>要求 &gt; 0</small>`);
    stL[2].set(`${r2(blue)}<small>要求 &lt; 0</small>`);
    const cap2 = document.querySelector('#l-cap2'), cap3 = document.querySelector('#l-cap3');
    if (mode === 0) {
      cap2.innerHTML = ds === 0 ? `直线 $${tm(sW1.get())}x_1${sW2.get() >= 0 ? '+' : ''}${tm(sW2.get())}x_2${sB.get() >= 0 ? '+' : ''}${tm(sB.get())}=0$。两颗红豆的得分相加等于 $2b$，两颗蓝豆相加也等于 $2b$，不可能一正一负。` : `圆环上同样有：内圈 4 颗的得分之和是 $4b$，外圈 4 颗也是 $4b$。`;
      cap3.innerHTML = '豆子都躺在桌面上（高度 0），竖直的刀面就是左图那条直线。';
    } else {
      cap2.innerHTML = ds === 0 ? `把三维里的水平一刀投影回桌面：$x_1x_2=${tm(sC.get())}$，是一条会拐弯的曲线（$c=0$ 时就是两条坐标轴）。` : `投影回桌面：圆 $x_1^2+x_2^2=${tm(sC.get())}$，半径 $\\sqrt{${tm(sC.get())}}\\approx${tm(Math.sqrt(Math.max(sC.get(), 0)))}$。`;
      cap3.innerHTML = ds === 0 ? '红豆升到 $x_3=+1$，蓝豆沉到 $x_3=-1$。' : '内圈升到 $x_3=1$，外圈升到 $x_3=4$。';
    }
    LAB.renderMath(cap2); LAB.renderMath(cap3);
    let hh = `<thead><tr><th>豆子</th><th>$(x_1,x_2)$</th><th>标签</th>${mode === 1 ? `<th>高度 $x_3=${ds === 0 ? 'x_1x_2' : 'x_1^2+x_2^2'}$</th>` : ''}<th>得分 ${mode === 0 ? '$w_1x_1+w_2x_2+b$' : (ds === 0 ? '$x_3-c$' : '$c-x_3$')}</th><th>判对了吗</th></tr></thead><tbody>`;
    P.forEach((p, i) => {
      const sc = score(p), ok = (sc > 0 ? 1 : -1) === p[2];
      hh += `<tr><td><b style="color:${p[2] > 0 ? C.c4 : C.c1}">${i + 1}. ${names[i]}</b></td><td class="num">(${r4(p[0])}, ${r4(p[1])})</td><td><span class="tag ${p[2] > 0 ? 'coral' : ''}">${p[2] > 0 ? '+1 红' : '−1 蓝'}</span></td>${mode === 1 ? `<td class="num">${r4(lift(p))}</td>` : ''}<td class="num">${r2(sc)}</td><td>${ok ? '✓' : '<b style="color:var(--coral)">✗</b>'}</td></tr>`;
    });
    const tb = document.querySelector('#l-table'); tb.innerHTML = hh + '</tbody>'; LAB.renderMath(tb);
    const cap = document.querySelector('#l-tcap');
    cap.innerHTML = mode === 0 ? '红豆要求得分 $&gt;0$，蓝豆要求 $&lt;0$。在桌面上，这两个要求永远不能同时满足。' : (ds === 0 ? '书中取 $c=0$：$F=x_3$，红豆 $+1&gt;0$，蓝豆 $-1&lt;0$，一刀切开。' : '练习 4.1 取 $c=2.5$：内圈 $F=-1+2.5=+1.5&gt;0$，外圈 $F=-4+2.5=-1.5&lt;0$。');
    LAB.renderMath(cap);
    v2.redraw(); v3.redraw();
  }
  upd(); ensureSpin();

  /* ================= 实验 2：先点积再平方 ================= */
  const BOOKX = [2, 3], BOOKZ = [4, 1];
  const kx = ['x_1', 'x_2', 'z_1', 'z_2'].map((nm, i) => LAB.slider('#k-' + nm.replace('_', ''), { label: `$${nm}$`, min: -5, max: 5, step: 0.5, value: [2, 3, 4, 1][i], fmt: (v) => v.toFixed(1), onInput: () => updK() }));
  const DS = [2, 10, 100, 1000, 10000];
  const sD = LAB.slider('#k-d', { label: '原始维度 $d$（算力对比用）', min: 0, max: DS.length - 1, step: 1, value: 3, fmt: (i) => DS[i].toLocaleString(), onInput: () => updK() });
  document.querySelector('#k-reset').onclick = () => { [2, 3, 4, 1].forEach((v, i) => kx[i].set(v)); updK(); };
  const rt2 = (v) => { // 把 a·√2 写成好看的形式
    if (Math.abs(v) < 1e-12) return '0';
    const s = Math.abs(v) === 1 ? '' : String(+Math.abs(v).toFixed(4));
    return (v < 0 ? '-' : '') + s + '\\sqrt{2}';
  };
  const stK = [LAB.stat('#k-stats', '笨办法：三维内积', 'amber'), LAB.stat('#k-stats', '聪明办法：$(\\mathbf x^\\top\\mathbf z)^2$', 'teal'), LAB.stat('#k-stats', '两者之差', 'leaf')];
  function updK() {
    const [x1, x2, z1, z2] = kx.map((s) => s.get());
    const fx = [x1 * x1, x1 * x2, x2 * x2], fz = [z1 * z1, z1 * z2, z2 * z2]; // 第 2 个分量还要乘 √2
    const prod = [fx[0] * fz[0], 2 * fx[1] * fz[1], fx[2] * fz[2]];
    const total = prod[0] + prod[1] + prod[2], dot = x1 * z1 + x2 * z2, smart = dot * dot;
    const n = (v) => String(+v.toFixed(4));
    let hh = '<thead><tr><th>分量</th><th>$\\phi(\\mathbf x)$</th><th>$\\phi(\\mathbf z)$</th><th>相乘</th></tr></thead><tbody>';
    hh += `<tr><td>$x_1^2\\cdot z_1^2$</td><td class="num">$${n(fx[0])}$</td><td class="num">$${n(fz[0])}$</td><td class="num"><b>${n(prod[0])}</b></td></tr>`;
    hh += `<tr><td>$\\sqrt2x_1x_2\\cdot\\sqrt2z_1z_2$</td><td class="num">$${rt2(fx[1])}$</td><td class="num">$${rt2(fz[1])}$</td><td class="num"><b>${n(prod[1])}</b></td></tr>`;
    hh += `<tr><td>$x_2^2\\cdot z_2^2$</td><td class="num">$${n(fx[2])}$</td><td class="num">$${n(fz[2])}$</td><td class="num"><b>${n(prod[2])}</b></td></tr>`;
    hh += `<tr><td colspan="3"><b>三项相加</b></td><td class="num"><b style="color:var(--amber)">${n(total)}</b></td></tr></tbody>`;
    const tb = document.querySelector('#k-table'); tb.innerHTML = hh; LAB.renderMath(tb);
    const sm = document.querySelector('#k-smart');
    sm.innerHTML = `$$\\mathbf x^\\top\\mathbf z=${n(x1)}\\times${n(z1)}+${n(x2)}\\times${n(z2)}=${n(dot)},\\qquad (\\mathbf x^\\top\\mathbf z)^2=${n(dot)}^2=${n(smart)}$$`.replace(/\+-/g, '-').replace(/\\times-([\d.]+)/g, '\\times(-$1)');
    LAB.renderMath(sm);
    const d = DS[sD.get()];
    const cost = document.querySelector('#k-cost');
    cost.innerHTML = `$d=${d.toLocaleString().replace(/,/g, '{,}')}$ 时：笨办法要先算 $d^2=${(d * d).toLocaleString().replace(/,/g, '{,}')}$ 个二次乘积（去掉重复也有 $\\tfrac{d(d+1)}{2}=${(d * (d + 1) / 2).toLocaleString().replace(/,/g, '{,}')}$ 个）；聪明办法只做 $${d.toLocaleString().replace(/,/g, '{,}')}$ 次乘法，再平方一次。`;
    LAB.renderMath(cost);
    stK[0].set(n(total)); stK[1].set(n(smart)); stK[2].set(Math.abs(total - smart) < 1e-9 ? '0<small>分毫不差</small>' : M.fmt(total - smart, 3));
  }
  updK();
  // ---- 第二部分：指数核的泰勒展开
  const fact = (k) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return f; };
  const sU = LAB.slider('#e-u', { label: '内积 $u=\\mathbf q^\\top\\mathbf k$', min: -3, max: 3, step: 0.1, value: 1, fmt: (v) => v.toFixed(1), onInput: () => updE() });
  const sN = LAB.slider('#e-n', { label: '保留到第 $n$ 阶', min: 0, max: 10, step: 1, value: 2, onInput: () => updE() });
  const partial = (u, n) => { let s = 0; for (let k = 0; k <= n; k++) s += Math.pow(u, k) / fact(k); return s; };
  const eb = LAB.canvas('#e-bars', (ctx, w, h) => {
    const u = sU.get(), n = sN.get(), terms = M.range(11).map((k) => Math.pow(u, k) / fact(k));
    const lo = Math.min(-0.2, ...terms) * 1.15, hi = Math.max(1.1, ...terms) * 1.15;
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.6, xmax: 10.6, ymin: lo, ymax: hi, xtickValues: M.range(11), xfmt: (v) => v, xlabel: '阶数 n', ylabel: 'uⁿ / n!', pad: { l: 46, r: 10, t: 10, b: 38 } }).axes();
    P.hline(0, '#9aa5b1');
    const bw = (P.tx(1) - P.tx(0)) * 0.6;
    P.bars(M.range(11), terms, M.range(11).map((k) => (k <= n ? C.c1 : LAB.mix(C.c1, '#ffffff', 0.7))), bw, 0);
  });
  const ec = LAB.canvas('#e-curve', (ctx, w, h) => {
    const u = sU.get(), n = sN.get();
    const P = new LAB.Plot(ctx, w, h, { xmin: -3, xmax: 3, ymin: -3, ymax: 21, xlabel: 'u', pad: { l: 40, r: 10, t: 10, b: 36 } }).axes();
    P.clip(); P.fn(Math.exp, '#B8C1CC', 5); P.fn((v) => partial(v, n), C.c4, 2.2); P.unclip();
    P.vline(u, C.slate, [4, 3]);
    P.points([u], [Math.exp(u)], C.slate, 4.5, '#fff'); P.points([u], [partial(u, n)], C.c4, 4.5, '#fff');
  });
  const stE = [LAB.stat('#e-stats', '真实值 $e^{u}$'), LAB.stat('#e-stats', '前 $n$ 阶之和', 'coral'), LAB.stat('#e-stats', '相对误差', 'amber')];
  function updE() {
    const u = sU.get(), n = sN.get(), e = Math.exp(u), s = partial(u, n);
    stE[0].set(r4(e)); stE[1].set(`${r4(s)}<small>${n + 1} 项</small>`); stE[2].set(`${(Math.abs(s - e) / e * 100).toFixed(2)}%`);
    eb.redraw(); ec.redraw();
  }
  updE();

  /* ================= 实验 3：两道题的 NTK 赛跑 ================= */
  const PRE = [[4, 0, 1], [5, 4, 5], [4, 4, 8]];
  const E0 = [10, 10];
  const sK11 = LAB.slider('#n-k11', { label: '$K_{11}$', min: 0, max: 10, step: 0.5, value: 4, fmt: (v) => v.toFixed(1), onInput: () => updN() });
  const sK12 = LAB.slider('#n-k12', { label: '$K_{12}=K_{21}$', min: -5, max: 5, step: 0.5, value: 0, fmt: (v) => v.toFixed(1), onInput: () => updN() });
  const sK22 = LAB.slider('#n-k22', { label: '$K_{22}$', min: 0, max: 10, step: 0.5, value: 1, fmt: (v) => v.toFixed(1), onInput: () => updN() });
  LAB.segmented('#n-preset', ['$\\operatorname{diag}(4,1)$（§4.3）', '$\\begin{bmatrix}5&4\\\\4&5\\end{bmatrix}$（练习 4.3/4.4）', '$\\begin{bmatrix}4&4\\\\4&8\\end{bmatrix}$（§4.4）'], 0, (i) => { sK11.set(PRE[i][0]); sK12.set(PRE[i][1]); sK22.set(PRE[i][2]); updN(); });
  const sEta = LAB.slider('#n-eta', { label: '学习率 $\\eta$', min: 0.01, max: 0.5, step: 0.01, value: 0.1, fmt: (v) => v.toFixed(2), onInput: () => updN() });
  const sT = LAB.slider('#n-T', { label: '走多少步 $t$', min: 3, max: 60, step: 1, value: 20, onInput: () => updN() });
  function eig2(a, b, c) { // [[a,b],[b,c]]
    const tr = a + c, det = a * c - b * b, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
    let u1;
    if (Math.abs(b) > 1e-12) u1 = [l1 - c, b]; else u1 = a >= c ? [1, 0] : [0, 1];
    const nn = Math.hypot(u1[0], u1[1]); u1 = [u1[0] / nn, u1[1] / nn];
    return { l1, l2, u1, u2: [-u1[1], u1[0]] };
  }
  const K = () => [sK11.get(), sK12.get(), sK22.get()];
  function traj(T) {
    const [a, b, c] = K(), eta = sEta.get(); let e = E0.slice(); const out = [e.slice()];
    for (let t = 0; t < T; t++) { e = [e[0] - eta * (a * e[0] + b * e[1]), e[1] - eta * (b * e[0] + c * e[1])]; out.push(e.slice()); }
    return out;
  }
  function cont(tau) {
    const [a, b, c] = K(), E = eig2(a, b, c);
    const p1 = M.dot(E.u1, E0) * Math.exp(-E.l1 * tau), p2 = M.dot(E.u2, E0) * Math.exp(-E.l2 * tau);
    return [p1 * E.u1[0] + p2 * E.u2[0], p1 * E.u1[1] + p2 * E.u2[1]];
  }
  const nm = LAB.canvas('#n-main', (ctx, w, h) => {
    const T = sT.get(), eta = sEta.get(), tr = traj(T);
    const vals = tr.flat(), lo = Math.max(-60, Math.min(-1, ...vals)), hi = Math.min(60, Math.max(11, ...vals));
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: eta * T, ymin: lo, ymax: hi, xlabel: '连续时间 τ = η·t', ylabel: '误差 e', pad: { l: 46, r: 14, t: 12, b: 38 } }).axes();
    P.hline(0, '#9aa5b1');
    P.clip();
    const taus = M.linspace(0, eta * T, 300), cs = taus.map(cont);
    P.line(taus, cs.map((v) => v[0]), C.c1, 1.4, [5, 4]); P.line(taus, cs.map((v) => v[1]), C.c2, 1.4, [5, 4]);
    const ts = tr.map((_, t) => eta * t);
    P.line(ts, tr.map((v) => v[0]), LAB.mix(C.c1, '#ffffff', 0.5), 1.2); P.line(ts, tr.map((v) => v[1]), LAB.mix(C.c2, '#ffffff', 0.5), 1.2);
    P.points(ts, tr.map((v) => v[0]), C.c1, 3.4); P.points(ts, tr.map((v) => v[1]), C.c2, 3.4);
    P.unclip();
  });
  const stN = [LAB.stat('#n-stats', '特征值 $\\lambda_1,\\lambda_2$', 'plum'), LAB.stat('#n-stats', '每步公比 $1-\\eta\\lambda_i$', 'amber'), LAB.stat('#n-stats', '稳定上限 $2/\\lambda_{\\max}$', 'coral'), LAB.stat('#n-stats', '$t$ 步后的误差', 'teal')];
  function updN() {
    const [a, b, c] = K(), eta = sEta.get(), T = sT.get(), E = eig2(a, b, c), tr = traj(T);
    const psd = E.l2 >= -1e-9;
    stN[0].set(`${r4(E.l1)}, ${r4(E.l2)}${psd ? '' : '<small style="color:var(--coral)">不是半正定</small>'}`);
    stN[1].set(`${r4(1 - eta * E.l1)}, ${r4(1 - eta * E.l2)}`);
    const lim = E.l1 > 0 ? 2 / E.l1 : Infinity, stable = eta < lim - 1e-12;
    stN[2].set(`${E.l1 > 0 ? r4(lim) : '∞'}<small style="color:${stable ? 'var(--leaf)' : 'var(--coral)'}">${stable ? 'η 在安全区' : 'η 越线，会发散'}</small>`);
    const eT = tr[T];
    stN[3].set(`(${M.fmt(eT[0], 3)}, ${M.fmt(eT[1], 3)})`);
    document.querySelector('#n-sub').textContent = `K = [[${a}, ${b}], [${b}, ${c}]] · η = ${eta.toFixed(2)}`;
    let hh = '<thead><tr><th>步数 $t$</th>' + M.range(5).map((t) => `<th class="num">${t}</th>`).join('') + '</tr></thead><tbody>';
    hh += '<tr><td>第 1 题 $e_1$</td>' + M.range(5).map((t) => `<td class="num">${r4(tr[Math.min(t, T)][0])}</td>`).join('') + '</tr>';
    hh += '<tr><td>第 2 题 $e_2$</td>' + M.range(5).map((t) => `<td class="num">${r4(tr[Math.min(t, T)][1])}</td>`).join('') + '</tr></tbody>';
    const tb = document.querySelector('#n-table'); tb.innerHTML = hh; LAB.renderMath(tb);
    nm.redraw();
  }
  updN();
  // ---- 第二部分：4.4 节算例
  const WETA = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2];
  const sWE = LAB.slider('#w-eta', { label: '学习率 $\\eta$', min: 0, max: WETA.length - 1, step: 1, value: 5, fmt: (i) => WETA[i], onInput: () => updW() });
  const X1 = [1, 0], Y1 = 3, X2 = [1, 1], Y2 = 6;
  const f = (x, th) => th[0] * th[0] * x[0] + th[1] * th[1] * x[1];
  const grad = (x, th) => [2 * th[0] * x[0], 2 * th[1] * x[1]];
  function step(eta) {
    const th = [1, 1], e0 = [f(X1, th) - Y1, f(X2, th) - Y2], g1 = grad(X1, th), g2 = grad(X2, th);
    const K0 = [[M.dot(g1, g1), M.dot(g1, g2)], [M.dot(g2, g1), M.dot(g2, g2)]];
    const ntk = [e0[0] - eta * (K0[0][0] * e0[0] + K0[0][1] * e0[1]), e0[1] - eta * (K0[1][0] * e0[0] + K0[1][1] * e0[1])];
    const dth = [-eta * (e0[0] * g1[0] + e0[1] * g2[0]), -eta * (e0[0] * g1[1] + e0[1] * g2[1])];
    const th1 = [th[0] + dth[0], th[1] + dth[1]];
    const real = [f(X1, th1) - Y1, f(X2, th1) - Y2];
    return { e0, K0, ntk, dth, th1, real, gap: [real[0] - ntk[0], real[1] - ntk[1]] };
  }
  const wg = LAB.canvas('#w-gap', (ctx, w, h) => {
    const eta = WETA[sWE.get()];
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.001, xmax: 0.2, ymin: 1e-5, ymax: 3, logx: true, logy: true, xtickValues: [0.001, 0.01, 0.1], xfmt: (v) => v, ytickValues: [1e-5, 1e-4, 1e-3, 1e-2, 0.1, 1], xlabel: '学习率 η', ylabel: '真实 − NTK', pad: { l: 50, r: 10, t: 10, b: 38 } }).axes();
    P.fn((v) => step(v).gap[0], C.c1, 2.2); P.fn((v) => step(v).gap[1], C.c2, 2.2);
    const s = step(eta); P.points([eta], [s.gap[0]], C.c1, 5, '#fff'); P.points([eta], [s.gap[1]], C.c2, 5, '#fff');
    P.text(0.0012, 1.5, '第 1 题（蓝）· 第 2 题（橙）：斜率 2，即 ∝ η²', C.slate, 'left', 'middle', '11.5px ' + FONT);
  });
  function updW() {
    const eta = WETA[sWE.get()], s = step(eta);
    const v = (a) => `(${r4(a[0])}, ${r4(a[1])})`;
    let hh = '<thead><tr><th>项目</th><th>数值</th></tr></thead><tbody>';
    hh += `<tr><td>切线向量 $\\mathbf g_1,\\mathbf g_2$</td><td class="num">(2, 0), (2, 2)</td></tr>`;
    hh += `<tr><td>NTK 矩阵 $\\mathbf K_0$</td><td class="num">[[${s.K0[0][0]}, ${s.K0[0][1]}], [${s.K0[1][0]}, ${s.K0[1][1]}]]</td></tr>`;
    hh += `<tr><td>初始误差 $\\mathbf e(0)$</td><td class="num">${v(s.e0)}</td></tr>`;
    hh += `<tr><td>NTK 预测 $\\mathbf e(0)-\\eta\\mathbf K_0\\mathbf e(0)$</td><td class="num"><b style="color:var(--c1)">${v(s.ntk)}</b></td></tr>`;
    hh += `<tr><td>参数改动 $\\Delta\\boldsymbol\\theta$，新参数 $\\boldsymbol\\theta_1$</td><td class="num">${v(s.dth)}，${v(s.th1)}</td></tr>`;
    hh += `<tr><td>真实新误差</td><td class="num"><b style="color:var(--coral)">${v(s.real)}</b></td></tr>`;
    hh += `<tr><td>两者之差 $(\\Delta\\theta_1^2,\\ \\Delta\\theta_1^2+\\Delta\\theta_2^2)$</td><td class="num">${v(s.gap)}</td></tr></tbody>`;
    const tb = document.querySelector('#w-table'); tb.innerHTML = hh; LAB.renderMath(tb);
    document.querySelector('#w-sub').textContent = `η = ${eta}`;
    wg.redraw();
  }
  updW();
})();
