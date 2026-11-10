/* 第 2 章：几何：把词变成高维空间里的向量 · 交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §2.1 词向量与余弦 · §2.2 高维近似正交 · §2.3 高维球壳与除以 √d · §2.4 手算算例' });
  // 窄屏下长公式与宽表格改为横向滚动，不撑破版面（position: relative 让 KaTeX 隐藏的 MathML 也被裁在框内）
  document.querySelectorAll('.formula, [style*="overflow-x"]').forEach((f) => { f.style.width = '0'; f.style.minWidth = '100%'; f.style.position = 'relative'; });
  const $ = (s) => document.querySelector(s);
  const FONT = getComputedStyle(document.body).getPropertyValue('--font');
  const NUMF = getComputedStyle(document.body).getPropertyValue('--font-num');
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (e) => String(e).split('').map((ch) => SUP[ch] || ch).join('');
  const neg = (s) => String(s).replace(/^-/, '−');
  const fx = (x, d) => neg((Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x).toFixed(d));
  const tr = (x, d) => neg(String(+x.toFixed(d)));
  const sci = (x, d) => neg(M.fmt(x, d));
  const f24 = (x) => (Math.abs(x * 100 - Math.round(x * 100)) < 1e-9 ? x.toFixed(2) : x.toFixed(4)); // 整百分位给 2 位，否则 4 位
  const syncSeg = (seg, vals, v) => seg.el.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', vals[i] === v));

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
  // 扔硬币：d 个坐标里恰有 j 个“同号”的概率 C(d, j) / 2^d
  const binom = (d, j) => Math.exp(lgamma(d + 1) - lgamma(j + 1) - lgamma(d - j + 1) - d * Math.LN2);
  const gauss = (x, s, m) => { const z = (x - (m || 0)) / s; return Math.exp(-z * z / 2) / (s * Math.sqrt(2 * Math.PI)); };
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
  // 等比例坐标系：在 w×h 画布里放下 [x0,x1]×[y0,y1]，横纵每单位像素数相同
  function squarePlot(ctx, w, h, X0, X1, Y0, Y1, o) {
    const L = 50, R = 14, T = 12, B = 38;
    const s = Math.min((w - L - R) / (X1 - X0), (h - T - B) / (Y1 - Y0));
    const pw = s * (X1 - X0), ph = s * (Y1 - Y0), pl = L + (w - L - R - pw) / 2, pt = T + (h - T - B - ph) / 2;
    return new LAB.Plot(ctx, w, h, Object.assign({ xmin: X0, xmax: X1, ymin: Y0, ymax: Y1, pad: { l: pl, r: w - pl - pw, t: pt, b: h - pt - ph } }, o));
  }
  const ang = (c) => Math.acos(M.clamp(c, -1, 1)) * 180 / Math.PI;

  /* ================= 实验 1：词向量与余弦相似度 ================= */
  const BOOKW = { 猫: [0.9, 0.1], 狗: [0.8, 0.2], 国王: [0.1, 0.9] };
  let W = {}, selA = '猫', selB = '狗', dragW = null, planeP = null;
  const loadW = () => { W = {}; Object.keys(BOOKW).forEach((k) => (W[k] = BOOKW[k].slice())); };
  loadW();
  function pills(host, get, set) {
    const el = $(host); el.innerHTML = '';
    Object.keys(W).forEach((n) => {
      const b = document.createElement('button'); b.className = 'pill' + (n === get() ? ' on' : ''); b.textContent = n;
      b.onclick = () => { set(n); el.querySelectorAll('.pill').forEach((p) => p.classList.toggle('on', p.textContent === n)); upd1(); };
      el.appendChild(b);
    });
  }
  pills('#w-a', () => selA, (n) => (selA = n));
  pills('#w-b', () => selB, (n) => (selB = n));
  $('#w-reset').onclick = () => { loadW(); upd1(); };
  const ws = [LAB.stat('#w-stats', '内积 $\\mathbf a\\cdot\\mathbf b$'), LAB.stat('#w-stats', '模长 $\\|\\mathbf a\\|$', 'teal'), LAB.stat('#w-stats', '模长 $\\|\\mathbf b\\|$', 'teal'),
    LAB.stat('#w-stats', '余弦 $\\cos\\theta$', 'coral'), LAB.stat('#w-stats', '夹角 $\\theta$', 'amber')];
  const tn = (x) => (x < 0 ? `(${tr(x, 2).replace('−', '-')})` : tr(x, 2)); // 公式里的坐标，负数加括号
  function upd1() {
    const a = W[selA], b = W[selB];
    const dot = a[0] * b[0] + a[1] * b[1], na2 = a[0] * a[0] + a[1] * a[1], nb2 = b[0] * b[0] + b[1] * b[1];
    const na = Math.sqrt(na2), nb = Math.sqrt(nb2), cs = dot / (na * nb);
    ws[0].set(tr(dot, 4)); ws[1].set(na.toFixed(4)); ws[2].set(nb.toFixed(4));
    ws[3].set(cs.toFixed(4)); ws[4].set(`${ang(cs).toFixed(1)}°`);
    const tdot = tr(dot, 4).replace('−', '-');
    $('#w-calc').innerHTML = LAB.tex(`\\mathbf a\\cdot\\mathbf b=${tn(a[0])}\\times${tn(b[0])}+${tn(a[1])}\\times${tn(b[1])}=${tdot},\\qquad \\cos\\theta=\\frac{${tdot}}{\\sqrt{${tr(na2, 4)}}\\times\\sqrt{${tr(nb2, 4)}}}\\approx ${cs.toFixed(4)}`, true);
    plane.redraw();
  }
  const plane = LAB.canvas('#w-plane', (ctx, w, h) => {
    const P = squarePlot(ctx, w, h, -0.2, 1.4, -0.2, 1.2, { xticks: 8, yticks: 7, xlabel: '有多像宠物 x₁' }).axes();
    planeP = P;
    ctx.save(); ctx.fillStyle = C.ink; ctx.font = '12px ' + FONT; ctx.translate(P.x0 - 40, (P.y0 + P.y1) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('有多像权力 x₂', 0, 0); ctx.restore();
    P.hline(0, '#9aa5b1', null, 1.2); P.vline(0, '#9aa5b1', null, 1.2);
    const s = P.tx(1) - P.tx(0), ox = P.tx(0), oy = P.ty(0);
    const a = W[selA], b = W[selB];
    // 夹角弧
    const ta = Math.atan2(a[1], a[0]), tb = Math.atan2(b[1], b[0]);
    let dd = tb - ta; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI;
    ctx.save(); ctx.fillStyle = 'rgba(224,154,45,.16)'; ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.arc(ox, oy, s * 0.24, -ta, -ta - dd, dd > 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(ox, oy, s * 0.24, -ta, -ta - dd, dd > 0); ctx.stroke(); ctx.restore();
    // b 在 a 上的投影
    const na2 = a[0] * a[0] + a[1] * a[1], pr = (a[0] * b[0] + a[1] * b[1]) / na2, foot = [a[0] * pr, a[1] * pr];
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = C.slate; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(P.tx(b[0]), P.ty(b[1])); ctx.lineTo(P.tx(foot[0]), P.ty(foot[1])); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.strokeStyle = pr >= 0 ? C.c3 : C.c4; ctx.lineWidth = 6; ctx.globalAlpha = 0.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(P.tx(foot[0]), P.ty(foot[1])); ctx.stroke(); ctx.restore();
    // 箭头与标签
    Object.keys(W).forEach((n) => {
      const v = W[n], isA = n === selA, isB = n === selB, col = isA ? C.c1 : isB ? C.c2 : '#9aa5b1';
      const X = P.tx(v[0]), Y = P.ty(v[1]);
      LAB.arrow(ctx, ox, oy, X, Y, col, isA || isB ? 3 : 2, isA || isB ? 12 : 9);
      ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, dragW === n ? 7 : 5, 0, 7); ctx.fill(); ctx.stroke();
      const th = Math.atan2(v[1], v[0]), cx = Math.cos(th), cy = Math.sin(th);
      const short = `${n}${isA && isB ? '  a = b' : isA ? '  a' : isB ? '  b' : ''}`, full = `${short}  (${tr(v[0], 2)}, ${tr(v[1], 2)})`;
      ctx.fillStyle = isA || isB ? col : C.ink; ctx.font = (isA || isB ? '600 ' : '') + '13.5px ' + FONT; ctx.textBaseline = 'middle';
      const W_ = (t) => ctx.measureText(t).width;
      if (cx > 0.45) {
        const tag = X + 12 + W_(full) <= w - 4 ? full : short;
        if (X + 12 + W_(tag) <= w - 4) { ctx.textAlign = 'left'; ctx.fillText(tag, X + 12, Y - cy * 10); }
        else { ctx.textAlign = 'right'; ctx.fillText(tag, Math.min(X + 6, w - 4), Y - 17); }
      } else if (cx < -0.45) {
        const tag = X - 12 - W_(full) >= 4 ? full : short;
        ctx.textAlign = 'right'; ctx.fillText(tag, X - 12, Y + cy * 10);
      } else {
        const tag = X - W_(full) / 2 >= 4 && X + W_(full) / 2 <= w - 4 ? full : short;
        ctx.textAlign = 'center'; ctx.fillText(tag, X, Y + (cy >= 0 ? -16 : 16));
      }
      ctx.restore();
    });
  });
  pointer(plane.canvas, {
    down: ([x, y]) => {
      if (!planeP) return false;
      let best = null, bd = 22;
      Object.keys(W).forEach((n) => { const d = Math.hypot(planeP.tx(W[n][0]) - x, planeP.ty(W[n][1]) - y); if (d < bd) { bd = d; best = n; } });
      if (!best) return false; dragW = best; plane.redraw(); return true;
    },
    move: ([x, y]) => {
      const vx = Math.round(M.clamp(planeP.ix(x), -0.18, 1.38) * 100) / 100, vy = Math.round(M.clamp(planeP.iy(y), -0.18, 1.18) * 100) / 100;
      if (Math.hypot(vx, vy) < 0.05) return;
      W[dragW] = [vx, vy]; upd1();
    },
    up: () => { dragW = null; plane.redraw(); },
    hover: ([x, y]) => { if (!planeP) return; const near = Object.keys(W).some((n) => Math.hypot(planeP.tx(W[n][0]) - x, planeP.ty(W[n][1]) - y) < 22); plane.canvas.style.cursor = near ? 'grab' : 'default'; },
  });
  upd1();

  // ---------- 三维类比表
  const FEAT3 = ['皇室权力度', '男性特征度', '女性特征度'];
  const BOOK3 = [['国王', [0.95, 0.90, 0.05]], ['男人', [0.05, 0.92, 0.03]], ['女人', [0.04, 0.04, 0.91]], ['王后', [0.92, 0.05, 0.92]]];
  let rows3 = [];
  const tbl3 = $('#w-table');
  function render3() {
    rows3 = BOOK3.map(([n, v]) => [n, v.slice()]);
    tbl3.innerHTML = `<thead><tr><th>词</th>${FEAT3.map((f) => `<th>${f}</th>`).join('')}<th>模长</th><th>与 ${LAB.tex('\\mathbf r')} 的余弦</th></tr></thead><tbody>` +
      rows3.map(([n, v], i) => `<tr><td><b>${n}</b></td>${v.map((x, k) => `<td><input type="number" step="0.01" value="${x.toFixed(2)}" data-i="${i}" data-k="${k}" style="width:76px;padding:4px 6px"></td>`).join('')}<td class="num" id="w3-n${i}"></td><td class="num" id="w3-c${i}" style="border-radius:6px"></td></tr>`).join('') +
      `<tr style="background:#F7F4FB"><td><b style="color:var(--plum)">${LAB.tex('\\mathbf r')} = 国王 − 男人 + 女人</b></td>${FEAT3.map((_, k) => `<td class="num" id="w3-r${k}" style="color:var(--plum);font-weight:650"></td>`).join('')}<td class="num" id="w3-rn"></td><td></td></tr></tbody>`;
    tbl3.querySelectorAll('input').forEach((inp) => (inp.oninput = () => { const v = parseFloat(inp.value); if (isFinite(v)) { rows3[+inp.dataset.i][1][+inp.dataset.k] = v; upd3(); } }));
    upd3();
  }
  function upd3() {
    const V = {}; rows3.forEach(([n, v]) => (V[n] = v));
    const r = [0, 1, 2].map((k) => V['国王'][k] - V['男人'][k] + V['女人'][k]), nr = M.norm(r) || 1e-12;
    r.forEach((x, k) => ($(`#w3-r${k}`).textContent = fx(x, 2)));
    $('#w3-rn').textContent = M.norm(r).toFixed(4);
    rows3.forEach(([n, v], i) => {
      const c = M.dot(v, r) / ((M.norm(v) || 1e-12) * nr), el = $(`#w3-c${i}`);
      $(`#w3-n${i}`).textContent = M.norm(v).toFixed(4);
      el.innerHTML = `<b>${c.toFixed(4)}</b><span class="small muted">　${ang(c).toFixed(1)}°</span>`;
      el.style.background = n === '王后' ? C.c3l : '';
    });
    const cq = M.dot(V['王后'], r) / ((M.norm(V['王后']) || 1e-12) * nr);
    $('#w-an-out').innerHTML = `${LAB.tex(`\\mathbf r=(${r.map((x) => fx(x, 2).replace('−', '-')).join(',\\ ')})`)}，与王后的余弦是 <b>${cq.toFixed(4)}</b>（夹角 ${ang(cq).toFixed(1)}°）。“国王 − 男人”把男性特征度 ${V['国王'][1].toFixed(2)} − ${V['男人'][1].toFixed(2)} 抵消成 ${fx(V['国王'][1] - V['男人'][1], 2)}，只剩皇室权力；再加上“女人”的女性特征，平行四边形的第四个顶点就落在王后旁边。表中数字可以直接改。`;
  }
  $('#w-book3').onclick = render3;
  render3();

  // ---------- 单位向量：‖u − v‖² = 2(1 − cosθ)（习题 2.1）
  const UPRE = [[0.8, 0.6, 0], [0, 0.6, 0.8]];
  let uv = UPRE[0].slice();
  const segU = LAB.segmented('#u-preset', ['$\\mathbf v_1=(0.8,0.6,0)$', '$\\mathbf v_2=(0,0.6,0.8)$'], 0, (i) => { uv = UPRE[i].slice(); sU.set(ang(uv[0])); updU(); });
  const sU = LAB.slider('#u-theta', { label: '或者拖动夹角 $\\theta$，令 $\\mathbf v=(\\cos\\theta,\\sin\\theta,0)$', min: 0, max: 180, step: 0.1, value: ang(0.8), fmt: (v) => v.toFixed(1) + '°',
    onInput: (t) => { const r = t * Math.PI / 180; uv = [Math.cos(r), Math.sin(r), 0]; segU.el.querySelectorAll('button').forEach((b) => b.classList.remove('active')); updU(); } });
  const us = [LAB.stat('#u-stats', '$\\mathbf u\\cdot\\mathbf v=\\cos\\theta$', ''), LAB.stat('#u-stats', '$\\|\\mathbf u-\\mathbf v\\|^2$', 'coral'), LAB.stat('#u-stats', '$2(1-\\mathbf u\\cdot\\mathbf v)$', 'leaf')];
  const tc = (x) => { const s = tr(x, 4).replace('−', '-'); return x < 0 ? `(${s})` : s; };
  function updU() {
    const u = [1, 0, 0], dot = M.dot(u, uv), d2 = uv.reduce((a, v, k) => a + (u[k] - v) * (u[k] - v), 0);
    us[0].set(f24(dot)); us[1].set(f24(d2)); us[2].set(f24(2 * (1 - dot)));
    $('#u-calc').innerHTML = LAB.tex(`\\mathbf v=(${uv.map((x) => tr(x, 4).replace('−', '-')).join(',\\,')}),\\quad \\|\\mathbf u-\\mathbf v\\|^2=${[0, 1, 2].map((k) => `(${k ? 0 : 1}-${tc(uv[k])})^2`).join('+')}=${f24(d2)}`, true);
    uPlot.redraw();
  }
  const uPlot = LAB.canvas('#u-plot', (ctx, w, h) => {
    const P = squarePlot(ctx, w, h, -1.3, 1.3, -0.25, 1.3, { xtickValues: [-1, -0.5, 0, 0.5, 1], ytickValues: [0, 0.5, 1], grid: false }).axes();
    const ox = P.tx(0), oy = P.ty(0), s = P.tx(1) - ox;
    const c = uv[0], sn = Math.sqrt(Math.max(0, 1 - c * c)), vx = c, vy = sn; // 在 u、v 张成的平面里，v 与 u 的夹角为 θ
    P.clip();
    ctx.save(); ctx.strokeStyle = '#c3ccd6'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(ox, oy, s, 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
    P.unclip();
    P.hline(0, '#d5dbe3', null, 1);
    // 夹角弧
    ctx.save(); ctx.fillStyle = 'rgba(224,154,45,.16)'; ctx.strokeStyle = C.amber; ctx.lineWidth = 1.4;
    const th = Math.atan2(vy, vx);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.arc(ox, oy, s * 0.22, 0, -th, true); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    // 投影 cosθ
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = C.slate; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(P.tx(vx), P.ty(vy)); ctx.lineTo(P.tx(vx), oy); ctx.stroke(); ctx.restore();
    // 弦 u − v
    ctx.save(); ctx.strokeStyle = C.c4; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(P.tx(1), P.ty(0)); ctx.lineTo(P.tx(vx), P.ty(vy)); ctx.stroke(); ctx.restore();
    LAB.arrow(ctx, ox, oy, P.tx(1), P.ty(0), C.c1, 3, 11);
    LAB.arrow(ctx, ox, oy, P.tx(vx), P.ty(vy), C.c2, 3, 11);
    const f = '600 12.5px ' + NUMF, d = Math.sqrt(2 * (1 - c));
    P.text(1.04, -0.12, 'u', C.c1, 'left', 'middle', '600 14px ' + FONT);
    P.text(vx * 1.12, vy * 1.12 + 0.02, 'v', C.c2, 'center', 'middle', '600 14px ' + FONT);
    P.text(-1.25, 1.23, `弦长 ‖u − v‖ = ${d.toFixed(3)}`, C.c4, 'left', 'middle', f);
    P.text(-1.25, 1.08, `‖u − v‖² = ${f24(d * d)}`, C.c4, 'left', 'middle', f);
    P.text(0.25 * Math.cos(th / 2) + 0.04, 0.25 * Math.sin(th / 2) + 0.06, `θ = ${ang(c).toFixed(1)}°`, C.amber, 'left', 'bottom', f);
  });
  updU();

  /* ================= 实验 2：扔硬币造随机箭头 ================= */
  const DLIST = [2, 3, 4, 6, 8, 10, 16, 24, 32, 50, 64, 100, 128, 200, 256, 400, 512, 768, 1000, 1024, 1536, 2048, 3072, 4096];
  const PRE_D = [4, 100, 1000, 4096];
  let seed2 = 11, mode = 0, zoom = false, curD = 100;
  const segD = LAB.segmented('#o-preset', PRE_D.map((d) => `$d=${d}$`), 1, (i) => { sD.set(DLIST.indexOf(PRE_D[i])); run2(); });
  const sD = LAB.slider('#o-d', { label: '维度 $d$', min: 0, max: DLIST.length - 1, step: 1, value: DLIST.indexOf(100), fmt: (i) => DLIST[i], hint: '对数刻度：2, 3, 4, …, 4096', onInput: (i) => { syncSeg(segD, PRE_D, DLIST[i]); run2(); } });
  const sN = LAB.slider('#o-n', { label: '箭头根数 $N$', min: 20, max: 200, step: 10, value: 100, fmt: (v) => `${v}（${(v * (v - 1) / 2).toLocaleString()} 对）`, onInput: () => run2() });
  LAB.segmented('#o-mode', ['扔硬币 $\\pm\\frac{1}{\\sqrt d}$', '高斯（归一化）', '未归一化 $\\pm1$'], 0, (i) => { mode = i; setLabels(); run2(); });
  LAB.checkbox('#o-zoom', '放大横轴（$\\pm4.5$ 个理论标准差）', false, (v) => { zoom = v; hist.redraw(); });
  $('#o-resample').onclick = () => { seed2++; run2(); };
  const st2 = [LAB.stat('#o-stats', '', ''), LAB.stat('#o-stats', '', 'teal'), LAB.stat('#o-stats', '', 'amber'), LAB.stat('#o-stats', '', 'plum')];
  function setLabels() {
    const L = mode < 2
      ? ['实测平均余弦', '实测标准差', '$\\pm1\\sigma$ 夹角带', '$\\pm3\\sigma$ 夹角带']
      : ['实测平均内积', '实测标准差', '平均模长 $\\|\\mathbf x\\|$', '最大 $|\\mathbf x\\cdot\\mathbf y|$'];
    st2.forEach((s, i) => { const l = s.el.querySelector('.label'); l.innerHTML = L[i]; LAB.renderMath(l); });
    const t = $('#o-title');
    t.innerHTML = mode < 2 ? '两两夹角余弦 $\\cos\\theta$ 的分布' : '未归一化内积 $\\mathbf x\\cdot\\mathbf y$ 的分布（$x_i,y_i=\\pm1$）';
    LAB.renderMath(t);
    const lg = $('#o-lg1t'); lg.innerHTML = mode === 1 ? '精确密度 $\\propto(1-t^2)^{(d-3)/2}$' : '精确概率（二项分布）'; LAB.renderMath(lg);
  }
  setLabels();

  // 生成 N 根 d 维箭头，返回所有点对的余弦（m=0 扔硬币、m=1 高斯并归一化）或内积（m=2 未归一化 ±1）
  function sample(d, N, seed, m) {
    const R = LAB.rng(seed * 7919 + d * 31 + (m === 1 ? 1 : 0)), X = new Float64Array(N * d), nr = new Float64Array(N);
    for (let i = 0; i < N; i++) { let s = 0; for (let k = 0; k < d; k++) { const z = m === 1 ? R.normal() : (R() < 0.5 ? -1 : 1); X[i * d + k] = z; s += z * z; } nr[i] = Math.sqrt(s); }
    const out = new Float64Array(N * (N - 1) / 2); let p = 0;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      let s = 0; const a = i * d, b = j * d; for (let k = 0; k < d; k++) s += X[a + k] * X[b + k];
      out[p++] = m === 2 ? s : m === 0 ? s / d : s / (nr[i] * nr[j]);
    }
    return { vals: out, meanNorm: M.mean(Array.from(nr)) };
  }
  let vals = new Float64Array(0), meanNorm = 0;
  const run2 = schedule(() => {
    curD = DLIST[sD.get()];
    const r = sample(curD, sN.get(), seed2, mode);
    vals = r.vals; meanNorm = r.meanNorm;
    $('#o-pairs').textContent = `${vals.length.toLocaleString()} 对 · d = ${curD}`;
    stats2(); hist.redraw(); stdc.redraw();
  });
  const sigStr = (x) => (Math.abs(x * 100 - Math.round(x * 100)) < 1e-9 ? x.toFixed(2) : x.toFixed(4));
  function band(c) {
    if (c >= 1) return '0°–180°';
    const lo = ang(c), hi = 180 - lo, dec = 90 - lo >= 3 ? 0 : 1;
    return `${lo.toFixed(dec)}°–${hi.toFixed(dec)}°`;
  }
  let cover1 = 0, cover3 = 0;
  function stats2() {
    const d = curD, n = vals.length; if (!n) return;
    let s1 = 0, s2 = 0, mx = 0;
    for (let i = 0; i < n; i++) { const v = vals[i]; s1 += v; s2 += v * v; if (Math.abs(v) > mx) mx = Math.abs(v); }
    const mean = s1 / n, sd = Math.sqrt(Math.max(0, s2 / n - mean * mean));
    const sig = mode < 2 ? 1 / Math.sqrt(d) : Math.sqrt(d);
    let c1 = 0, c3 = 0; const e1 = sig * (1 + 1e-9), e3 = 3 * sig * (1 + 1e-9);
    for (let i = 0; i < n; i++) { const a = Math.abs(vals[i]); if (a <= e1) c1++; if (a <= e3) c3++; }
    cover1 = c1 / n; cover3 = c3 / n;
    const pc = (x) => `${(x * 100).toFixed(x > 0.9995 ? 0 : 1)}%`;
    if (mode < 2) {
      st2[0].set(`${fx(mean, 4)}<small>理论 0</small>`);
      st2[1].set(`${sd.toFixed(4)}<small>理论 1/√d = ${sigStr(1 / Math.sqrt(d))}</small>`);
      st2[2].set(`${band(sig)}<small>实测 ${pc(cover1)}</small>`);
      st2[3].set(`${band(3 * sig)}<small>${3 * sig >= 1 ? '3σ 已超过 1，整条轴' : `|cos θ| ≤ ${(3 * sig).toFixed(3)}，实测 ${pc(cover3)}`}</small>`);
    } else {
      st2[0].set(`${fx(mean, 2)}<small>理论 0</small>`);
      st2[1].set(`${sd.toFixed(2)}<small>理论 √d = ${tr(Math.sqrt(d), 2)}</small>`);
      st2[2].set(`${meanNorm.toFixed(2)}<small>恰好是 √d</small>`);
      st2[3].set(`${tr(mx, 0)}<small>满分是 ${d}</small>`);
    }
    const disc = mode !== 1 && d <= 8 ? `d = ${d} 时扔硬币箭头的${mode === 2 ? '内积' : '余弦'}只能取 ${d + 1} 个离散值：${M.range(d + 1).map((j) => tr((2 * j - d) / (mode === 2 ? 1 : d), 3)).join('、')}。` : '';
    $('#o-cap').innerHTML = `${disc}${n.toLocaleString()} 对箭头里，${pc(cover1)} 落在 ±1σ 带内，${pc(cover3)} 落在 ±3σ 带内（σ = ${mode < 2 ? '1/√d = ' + sigStr(sig) : '√d = ' + tr(sig, 2)}）。`;
  }
  const hist = LAB.canvas('#o-hist', (ctx, w, h) => {
    const d = curD, raw = mode === 2, sig = raw ? Math.sqrt(d) : 1 / Math.sqrt(d), n = vals.length;
    if (!n) return;
    let R = raw ? 4.5 * Math.sqrt(4096) : 1;
    if (zoom) R = Math.min(R, 4.5 * sig);
    const lattice = mode !== 1, sp = raw ? 2 : 2 / d, scale = raw ? 1 : 1 / d;
    const bwT = 2 * R / 90, k = lattice ? Math.max(1, 2 * Math.round((bwT / sp - 1) / 2) + 1) : 0, discrete = lattice && k === 1;
    if (discrete && !zoom) R += sp / 2;
    // 统计
    let bars = [], ymax = 0, curve = null, dots = null;
    if (lattice) {
      const cnt = new Float64Array(d + 1);
      for (let i = 0; i < n; i++) { const j = Math.round((vals[i] / scale + d) / 2); if (j >= 0 && j <= d) cnt[j]++; }
      const xj = (j) => (2 * j - d) * scale;
      if (discrete) {
        for (let j = 0; j <= d; j++) if (Math.abs(xj(j)) <= R) bars.push([xj(j), cnt[j] / n]);
        dots = []; for (let j = 0; j <= d; j++) if (Math.abs(xj(j)) <= R) dots.push([xj(j), binom(d, j)]);
        curve = (x) => gauss(x, sig) * sp;
        ymax = Math.max(...bars.map((b) => b[1]), ...dots.map((p) => p[1]), curve(0)) * 1.15;
      } else {
        const j0 = Math.floor(d / 2), bw = k * sp, agg = new Map();
        for (let j = 0; j <= d; j++) { if (!cnt[j]) continue; const m = Math.round((j - j0) / k); agg.set(m, (agg.get(m) || 0) + cnt[j]); }
        agg.forEach((c, m) => { const x = xj(j0 + m * k); if (Math.abs(x) <= R + bw) bars.push([x, c / (n * bw), bw]); });
        dots = []; for (let j = 0; j <= d; j++) { const x = xj(j); if (Math.abs(x) <= R) { const p = binom(d, j) / sp; if (p > 1e-6) dots.push([x, p]); } }
        curve = (x) => gauss(x, sig);
        ymax = Math.max(...bars.map((b) => b[1]), curve(0)) * 1.15;
      }
    } else {
      const H = histogram(vals, -R, R, 90);
      bars = H; curve = (x) => gauss(x, sig);
      ymax = Math.max(...H.h, curve(0)) * 1.15;
    }
    const P = new LAB.Plot(ctx, w, h, { xmin: -R, xmax: R, ymin: 0, ymax: ymax || 1, xlabel: raw ? 'x · y' : 'cos θ', ylabel: discrete ? '频率' : '概率密度', pad: { l: 52, r: 14, t: 12, b: 38 } });
    // ±3σ、±1σ 背景带
    ctx.save();
    const band3 = [Math.max(-R, -3 * sig), Math.min(R, 3 * sig)], band1 = [Math.max(-R, -sig), Math.min(R, sig)];
    ctx.fillStyle = '#EEF3FA'; ctx.fillRect(P.tx(band3[0]), P.y1, P.tx(band3[1]) - P.tx(band3[0]), P.y0 - P.y1);
    ctx.fillStyle = C.c1l; ctx.fillRect(P.tx(band1[0]), P.y1, P.tx(band1[1]) - P.tx(band1[0]), P.y0 - P.y1);
    ctx.restore();
    P.axes();
    P.clip();
    if (lattice && discrete) {
      const bwpx = Math.max(1.5, Math.min(26, (P.tx(sp) - P.tx(0)) * 0.6));
      P.bars(bars.map((b) => b[0]), bars.map((b) => b[1]), C.c1, bwpx);
    } else if (lattice) {
      ctx.save(); ctx.fillStyle = C.c1; ctx.globalAlpha = 0.55;
      bars.forEach(([x, y, bw]) => { const x0 = P.tx(x - bw / 2), x1 = P.tx(x + bw / 2), Y = P.ty(Math.min(y, ymax)); ctx.fillRect(x0 + 0.3, Y, Math.max(0.8, x1 - x0 - 0.6), P.y0 - Y); });
      ctx.restore();
    } else drawHist(P, bars, C.c1, 0.55);
    if (mode === 1) P.fn((t) => exactPdf(d, t), C.c4, 2.2, null, 600);
    else if (!discrete && dots.length > 1) P.line(dots.map((p) => p[0]), dots.map((p) => p[1]), C.c4, 2, null);
    P.fn(curve, C.c2, 1.8, [6, 4], 600);
    if (discrete) P.points(dots.map((p) => p[0]), dots.map((p) => p[1]), C.c4, 3.6, '#fff');
    P.unclip();
  });

  // 标准差 vs d：每种造法各用 60 根箭头的小样本扫一遍维度表（用到时才算）
  const small = {};
  function smallFor(m) {
    if (!small[m]) small[m] = DLIST.map((d) => { const v = sample(d, 60, 999, m).vals; let s = 0; for (const x of v) s += x * x; return { d, sd: Math.sqrt(s / v.length) }; });
    return small[m];
  }
  const stdc = LAB.canvas('#o-std', (ctx, w, h) => {
    const un = mode === 2, pts = smallFor(mode);
    const P = new LAB.Plot(ctx, w, h, { xmin: 2, xmax: 4096, logx: true, logy: true, ymin: un ? 1 : 0.01, ymax: un ? 100 : 1, xtickValues: [2, 16, 128, 1024, 4096], xfmt: (v) => v, xlabel: '维度 d', ylabel: '标准差', pad: { l: 48, r: 12, t: 10, b: 38 } }).axes();
    P.fn((d) => (un ? Math.sqrt(d) : 1 / Math.sqrt(d)), C.c2, 1.8, [6, 4]);
    P.points(pts.map((s) => s.d), pts.map((s) => s.sd), C.c1, 3.2);
    const cur = pts.find((s) => s.d === curD);
    if (cur) P.points([curD], [cur.sd], C.c4, 6, '#fff');
    P.text(un ? 2.5 : 4000, un ? 60 : 0.6, un ? '理论 √d（斜率 +1/2）' : '理论 1/√d（斜率 −1/2）', C.amber, un ? 'left' : 'right', 'middle', '600 12px ' + FONT);
  });
  run2();

  // ---------- 叠加读数（习题 2.4）
  const sEps = LAB.slider('#s-eps', { label: '两个特征的内积 $\\varepsilon=\\mathbf e_1\\cdot\\mathbf e_2$', min: -0.3, max: 0.3, step: 0.005, value: 0.02, fmt: (v) => fx(v, 3), hint: '$\\mathbf h=3\\mathbf e_1+5\\mathbf e_2$：把两个特征叠在同一根向量里', onInput: () => updS() });
  const ss = [LAB.stat('#s-stats', '$\\mathbf e_1\\cdot\\mathbf h$', 'teal'), LAB.stat('#s-stats', '$\\mathbf e_2\\cdot\\mathbf h$', 'amber')];
  function updS() {
    const e = sEps.get();
    ss[0].set(`${fx(3 + 5 * e, 2)}<small>真值 3，串味 ${fx(5 * e, 2)}</small>`);
    ss[1].set(`${fx(3 * e + 5, 2)}<small>真值 5，串味 ${fx(3 * e, 2)}</small>`);
    sPlot.redraw();
  }
  const sPlot = LAB.canvas('#s-plot', (ctx, w, h) => {
    const e = sEps.get(), c = Math.sqrt(1 - e * e), e2 = [e, c], H = [3 + 5 * e, 5 * c];
    const P = squarePlot(ctx, w, h, -3.2, 5.4, -0.9, 6.1, { xticks: 8, yticks: 6, grid: false }).axes();
    const T = (v) => [P.tx(v[0]), P.ty(v[1])];
    // 两把读数尺：e1、e2 方向的长直线
    ctx.save(); ctx.strokeStyle = '#d5dbe3'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(...T([-3.2, 0])); ctx.lineTo(...T([5.4, 0])); ctx.moveTo(...T([-0.9 * e / c, -0.9])); ctx.lineTo(...T([6.1 * e / c, 6.1])); ctx.stroke(); ctx.restore();
    // 平行四边形
    ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = '#b8c2cd'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(...T([3, 0])); ctx.lineTo(...T(H)); ctx.lineTo(...T([5 * e, 5 * c])); ctx.stroke(); ctx.restore();
    // 投影：h 在 e1、e2 上的读数
    const r1 = 3 + 5 * e, r2 = 3 * e + 5, f1 = [r1, 0], f2 = [r2 * e, r2 * c];
    ctx.save(); ctx.setLineDash([4, 4]); ctx.lineWidth = 1.3;
    ctx.strokeStyle = C.teal; ctx.beginPath(); ctx.moveTo(...T(H)); ctx.lineTo(...T(f1)); ctx.stroke();
    ctx.strokeStyle = C.amber; ctx.beginPath(); ctx.moveTo(...T(H)); ctx.lineTo(...T(f2)); ctx.stroke(); ctx.restore();
    const O = T([0, 0]);
    LAB.arrow(ctx, O[0], O[1], ...T(H), C.plum, 2.6, 11);
    LAB.arrow(ctx, O[0], O[1], ...T([1, 0]), C.c1, 3.2, 10);
    LAB.arrow(ctx, O[0], O[1], ...T(e2), C.c2, 3.2, 10);
    P.points([f1[0], f2[0]], [f1[1], f2[1]], '#fff', 4.5); P.points([f1[0]], [f1[1]], C.teal, 3.2); P.points([f2[0]], [f2[1]], C.amber, 3.2);
    const fb = '600 12.5px ' + NUMF;
    P.text(1.05, 0.28, 'e₁', C.c1, 'left', 'middle', '600 13px ' + FONT);
    P.text(e2[0] - 0.12, e2[1], 'e₂', C.c2, 'right', 'middle', '600 13px ' + FONT);
    P.text(H[0] + 0.15, H[1] + 0.22, 'h = 3e₁ + 5e₂', C.plum, 'right', 'bottom', '600 12.5px ' + FONT);
    P.text(f1[0], -0.3, `e₁·h = ${fx(r1, 2)}`, C.teal, 'center', 'top', fb);
    P.text(f2[0] - 0.25, f2[1], `e₂·h = ${fx(r2, 2)}`, C.amber, 'right', 'middle', fb);
    P.text(-3.0, -0.6, `夹角 ${ang(e).toFixed(1)}°`, C.slate, 'left', 'middle', '12px ' + FONT);
  });
  updS();

  /* ================= 实验 3：西瓜皮与除以 √d ================= */
  const DM = [1, 2, 3, 4, 5, 6, 8, 10, 16, 20, 32, 50, 64, 100, 128, 200, 256, 512, 1000, 1024, 2048, 4096];
  const PRE_M = [1, 2, 3, 100, 4096];
  let seedM = 5;
  const segM = LAB.segmented('#m-preset', PRE_M.map(String), 2, (i) => { sMd.set(DM.indexOf(PRE_M[i])); updM(); runN(); });
  const sMd = LAB.slider('#m-d', { label: '维度 $d$', min: 0, max: DM.length - 1, step: 1, value: DM.indexOf(3), fmt: (i) => DM[i], hint: '对数刻度：1, 2, 3, …, 4096', onInput: (i) => { syncSeg(segM, PRE_M, DM[i]); updM(); runN(); } });
  const sMe = LAB.slider('#m-eps', { label: '瓜皮厚度 $\\varepsilon$（占半径的比例）', min: 0.01, max: 0.5, step: 0.01, value: 0.1, fmt: (v) => v.toFixed(2), onInput: () => updM() });
  $('#m-resample').onclick = () => { seedM++; runN(); };
  const ms = [LAB.stat('#m-stats', '瓜瓤占比 $(1-\\varepsilon)^d$', 'coral'), LAB.stat('#m-stats', '瓜皮占比 $1-(1-\\varepsilon)^d$', 'leaf'),
    LAB.stat('#m-stats', '$\\|\\mathbf x\\|/\\sqrt d$ 的平均值', ''), LAB.stat('#m-stats', '$\\|\\mathbf x\\|/\\sqrt d$ 的标准差', 'teal')];
  // 瓜瓤占比的显示：≥1% 给百分数；再小给百分数 + 科学计数；小到 10⁻⁸ 以下只给 10 的几次方
  function flesh(d, eps) {
    const L = d * Math.log10(1 - eps), f = Math.pow(10, L);
    if (L >= -2) return { L, f, html: `${+(f * 100).toPrecision(4)}%`, short: `${+(f * 100).toPrecision(4)}%` };
    if (L >= -8) return { L, f, html: `${+(f * 100).toPrecision(4)}%<small>= ${sci(f, 3)}</small>`, short: `${+(f * 100).toPrecision(4)}%` };
    return { L, f, html: `≈ 10<sup>${neg(L.toFixed(1))}</sup>`, short: `≈ 10^${neg(L.toFixed(1))}` };
  }
  function updM() {
    const d = DM[sMd.get()], eps = sMe.get(), F = flesh(d, eps);
    ms[0].set(F.html);
    ms[1].set(F.f >= 0.01 ? `${+((1 - F.f) * 100).toPrecision(4)}%` : '≈ 100%');
    $('#m-sub').textContent = `d = ${d}，瓜皮厚 ${Math.round(eps * 100)}% 半径`;
    mPic.redraw(); mCurve.redraw();
  }
  const mPic = LAB.canvas('#m-pic', (ctx, w, h) => {
    const d = DM[sMd.get()], eps = sMe.get(), F = flesh(d, eps);
    const barW = 30, gap = 18, labW = 118, r = Math.max(30, Math.min(h / 2 - 14, (w - barW - gap - labW - 20) / 2));
    const cx = 10 + r, cy = h / 2;
    ctx.save();
    ctx.fillStyle = '#2F8F5B'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#E8F3D9'; ctx.beginPath(); ctx.arc(cx, cy, r * (1 - eps) + Math.min(3, r * eps * 0.3), 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#E4505F'; ctx.beginPath(); ctx.arc(cx, cy, r * (1 - eps), 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = r * (1 - eps) * (0.3 + 0.45 * ((i * 37) % 10) / 10); ctx.beginPath(); ctx.ellipse(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 2.2, 3.6, a, 0, 2 * Math.PI); ctx.fill(); }
    ctx.restore();
    // 体积色条
    const bx = cx + r + gap, top = 16, H = h - 40, fh = H * F.f;
    ctx.save();
    ctx.fillStyle = '#2F8F5B'; ctx.fillRect(bx, top, barW, H - fh);
    ctx.fillStyle = '#E4505F'; ctx.fillRect(bx, top + H - fh, barW, fh);
    ctx.strokeStyle = '#9aa5b1'; ctx.lineWidth = 1; ctx.strokeRect(bx, top, barW, H);
    ctx.fillStyle = C.slate; ctx.font = '12px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${d} 维体积`, bx + barW / 2, top + H + 6);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '600 12.5px ' + NUMF;
    const yRind = top + Math.max(10, Math.min(H - 26, (H - fh) / 2)), yFlesh = Math.max(yRind + 18, Math.min(top + H - 8, top + H - fh / 2));
    ctx.fillStyle = '#2F8F5B'; ctx.fillText(`瓜皮 ${F.f >= 0.01 ? +((1 - F.f) * 100).toPrecision(4) + '%' : '≈ 100%'}`, bx + barW + 8, yRind);
    ctx.fillStyle = '#C73A4A'; ctx.fillText(`瓜瓤 ${F.short}`, bx + barW + 8, yFlesh);
    ctx.restore();
  });
  const mCurve = LAB.canvas('#m-curve', (ctx, w, h) => {
    const d = DM[sMd.get()], eps = sMe.get(), F = flesh(d, eps), lg = Math.log10(1 - eps);
    const ymin = Math.min(-10, 4096 * lg) * 1.06;
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: 4096, logx: true, ymin, ymax: 0, xtickValues: [1, 4, 16, 64, 256, 1024, 4096], xfmt: (v) => v, yfmt: (v) => (v === 0 ? '1' : '10' + sup(v)), xlabel: '维度 d', ylabel: '瓜瓤占比', pad: { l: 64, r: 12, t: 12, b: 38 } }).axes();
    P.fn((x) => x * lg, C.c4, 2.6);
    PRE_M.forEach((k) => P.points([k], [k * lg], '#fff', 4, C.c4));
    P.points([d], [d * lg], C.c4, 6, '#fff');
    P.text(1.25, ymin * 0.82, `d = ${d}：瓜瓤 ${F.short}`, C.c4, 'left', 'middle', '600 12.5px ' + FONT);
  });
  updM();

  // ---------- 向量长度集中在 √d
  let normR = [];
  const runN = schedule(() => {
    const d = DM[sMd.get()], N = 1500, R = LAB.rng(seedM * 104729 + d);
    normR = new Float64Array(N);
    for (let i = 0; i < N; i++) { let s = 0; for (let k = 0; k < d; k++) { const z = R.normal(); s += z * z; } normR[i] = Math.sqrt(s / d); }
    const m = M.mean(Array.from(normR)), sd = M.std(Array.from(normR));
    ms[2].set(`${m.toFixed(4)}<small>理论 ≈ 1</small>`);
    ms[3].set(`${sd.toFixed(4)}<small>理论 ≈ 1/√(2d) = ${(1 / Math.sqrt(2 * d)).toFixed(4)}</small>`);
    $('#n-sub').textContent = `d = ${d} · 1500 根向量`;
    nHist.redraw();
  });
  const nHist = LAB.canvas('#n-hist', (ctx, w, h) => {
    if (!normR.length) return;
    const d = DM[sMd.get()], H = histogram(normR, 0, 3, 150);
    // ‖x‖/√d 的精确密度（卡方分布开根号后再缩放）
    const pdf = (r) => (r <= 0 ? 0 : Math.exp(Math.LN2 + (d / 2) * Math.log(d / 2) + (d - 1) * Math.log(r) - d * r * r / 2 - lgamma(d / 2)));
    const ymax = Math.max(...H.h, pdf(Math.sqrt((d - 1) / d) || 0.01)) * 1.12;
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 3, ymin: 0, ymax, xlabel: '‖x‖ / √d', ylabel: '概率密度', pad: { l: 50, r: 12, t: 12, b: 38 } }).axes();
    drawHist(P, H, C.c1, 0.6);
    P.clip(); P.fn(pdf, C.c2, 1.8, [6, 4], 600); P.unclip();
    P.vline(1, C.leaf, [4, 3], 1.6);
    P.text(1.04, ymax * 0.92, '‖x‖ = √d', C.leaf, 'left', 'middle', '600 12px ' + FONT);
  });
  runN();

  // ---------- Softmax 饱和：S₁ = √d，S₂ = 0
  const DS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  const PRE_S = [4, 64, 4096];
  const segS = LAB.segmented('#s-preset', PRE_S.map((d) => `$d=${d}$`), 2, (i) => { sSd.set(DS.indexOf(PRE_S[i])); updSm(); });
  const sSd = LAB.slider('#s-d', { label: '注意力维度 $d$', min: 0, max: DS.length - 1, step: 1, value: DS.indexOf(4096), fmt: (i) => DS[i], onInput: (i) => { syncSeg(segS, PRE_S, DS[i]); updSm(); } });
  const sigm = (s) => ({ q1: 1 / (1 + Math.exp(-s)), q2: 1 / (1 + Math.exp(s)) });
  const fQ1 = (q) => (q.q2 < 1e-3 ? `1 − ${sci(q.q2, 1)}` : q.q1.toFixed(3));
  const fQ2 = (q) => (q.q2 < 1e-3 ? sci(q.q2, 1) : q.q2.toFixed(3));
  const fSl = (v) => (v < 1e-3 ? `${sci(v, 1)} ≈ 0` : v.toFixed(3));
  let SM = null;
  function updSm() {
    const d = DS[sSd.get()], rd = Math.sqrt(d);
    SM = { d, rows: [
      { name: '不缩放', short: '不缩放', s: rd, sTxt: `√${d} = ${tr(rd, 4)}` },
      { name: '除以 √d', short: '÷√d', s: 1, sTxt: `${tr(rd, 4)} / √${d} = 1` },
      { name: '除以 d（缩过头）', short: '÷d', s: 1 / rd, sTxt: `${tr(rd, 4)} / ${d} = ${tr(1 / rd, 4)}` },
    ] };
    SM.rows.forEach((r) => { r.q = sigm(r.s); r.slope = r.q.q1 * r.q.q2; });
    $('#s-sub').textContent = `d = ${d}`;
    $('#s-table').innerHTML = `<thead><tr><th>方案</th><th>打分 ${LAB.tex('S_1')}（${LAB.tex('S_2=0')}）</th><th>${LAB.tex('Q_1')}</th><th>${LAB.tex('Q_2')}</th><th>斜率 ${LAB.tex('Q_1(1-Q_1)')}</th></tr></thead><tbody>` +
      SM.rows.map((r, i) => `<tr><td><b>${r.name}</b></td><td class="num">${r.sTxt}</td><td class="num">${fQ1(r.q)}</td><td class="num">${fQ2(r.q)}</td><td class="num" style="color:${r.slope < 1e-3 ? 'var(--coral)' : i === 1 ? 'var(--leaf)' : 'inherit'};font-weight:650">${fSl(r.slope)}</td></tr>`).join('') + '</tbody>';
    sBars.redraw();
  }
  const sBars = LAB.canvas('#s-bars', (ctx, w, h) => {
    if (!SM) return;
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.5, xmax: 2.5, ymin: 0, ymax: 1.35, xtickValues: [], ytickValues: [0, 0.25, 0.5, 0.75, 1], ylabel: '注意力权重', pad: { l: 50, r: 12, t: 10, b: 44 } }).axes();
    const gw = P.tx(1) - P.tx(0), bw = Math.min(46, gw * 0.3), off = 0.19, f = (gw < 150 ? '600 10.5px ' : '600 12px ') + NUMF;
    SM.rows.forEach((r, i) => {
      P.bars([i - off], [r.q.q1], C.c1, bw); P.bars([i + off], [r.q.q2], C.c2, bw);
      P.text(i - off, r.q.q1 + 0.02, r.q.q2 < 1e-3 ? '≈ 1' : r.q.q1.toFixed(3), C.c1, 'center', 'bottom', f);
      P.text(i + off, r.q.q2 + 0.02, r.q.q2 < 1e-3 ? '≈ 0' : r.q.q2.toFixed(3), C.c2, 'center', 'bottom', f);
      P.text(i, 1.26, `斜率 ${r.slope < 1e-3 ? '≈ 0' : r.slope.toFixed(3)}`, r.slope < 1e-3 ? C.coral : i === 1 ? C.leaf : C.slate, 'center', 'middle', '600 12.5px ' + FONT);
      ctx.save(); ctx.fillStyle = C.ink; ctx.font = '600 12.5px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(r.short, P.tx(i), P.y0 + 6); ctx.font = '12px ' + NUMF; ctx.fillStyle = C.slate; ctx.fillText(`S₁ = ${tr(r.s, 4)}`, P.tx(i), P.y0 + 23); ctx.restore();
    });
  });
  updSm();

  // ---------- 4 维手算：苹果、香蕉、汽车
  const F0 = [['苹果', [1, 1, 1, 1]], ['香蕉', [1, 1, 1, -1]], ['汽车', [1, -1, 1, -1]]];
  let F4 = [];
  const tblF = $('#f-table');
  function calcF() {
    const q = F4[0][1], s = F4.map(([, v]) => M.dot(q, v)), a = M.softmax(s), b = M.softmax(s.map((x) => x / 2));
    return { q, s, a, b, cos: F4.map(([, v]) => M.dot(q, v) / (M.norm(q) * M.norm(v))) };
  }
  function renderF() {
    const R = calcF();
    tblF.innerHTML = `<thead><tr><th>词</th>${[1, 2, 3, 4].map((k) => `<th>${LAB.tex('x_' + k)}</th>`).join('')}<th>${LAB.tex('\\mathbf q\\cdot\\mathbf k')}（${LAB.tex('\\mathbf q=')}苹果）</th><th>${LAB.tex('\\cos')}（与苹果）</th><th>夹角</th></tr></thead><tbody>` +
      F4.map(([n, v], i) => `<tr><td><b>${n}</b> ${LAB.tex('\\mathbf v_' + (i + 1))}</td>${v.map((x, k) => `<td><button type="button" class="pill ${x > 0 ? 'on' : ''}" data-i="${i}" data-k="${k}" style="min-width:46px;font-family:var(--font-num)">${x > 0 ? '+1' : '−1'}</button></td>`).join('')}<td class="num"><b>${tr(R.s[i], 2)}</b></td><td class="num">${R.cos[i].toFixed(2)}</td><td class="num">${ang(R.cos[i]).toFixed(0)}°</td></tr>`).join('') + '</tbody>';
    tblF.querySelectorAll('button').forEach((b) => (b.onclick = () => { const v = F4[+b.dataset.i][1], k = +b.dataset.k; v[k] = -v[k]; renderF(); }));
    const t3 = (arr) => arr.map((x) => x.toFixed(3)).join(',\\,'), ti = (arr) => arr.map((x) => tr(x, 2).replace('−', '-')).join(',\\,');
    $('#f-calc').innerHTML = LAB.tex(`\\mathbf q\\cdot\\mathbf k=(${ti(R.s)})\\ \\xrightarrow{\\operatorname{Softmax}}\\ (${t3(R.a)});\\qquad \\frac{\\mathbf q\\cdot\\mathbf k}{\\sqrt4}=(${ti(R.s.map((x) => x / 2))})\\ \\xrightarrow{\\operatorname{Softmax}}\\ (${t3(R.b)})`, true);
    fBars.redraw();
  }
  const fBars = LAB.canvas('#f-bars', (ctx, w, h) => {
    if (!F4.length) return;
    const R = calcF();
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.5, xmax: 2.5, ymin: 0, ymax: 1.1, xtickValues: [], ytickValues: [0, 0.25, 0.5, 0.75, 1], ylabel: '注意力权重', pad: { l: 50, r: 12, t: 10, b: 44 } }).axes();
    const gw = P.tx(1) - P.tx(0), bw = Math.min(46, gw * 0.3), off = 0.19, f = (gw < 150 ? '600 10.5px ' : '600 12px ') + NUMF;
    F4.forEach(([n], i) => {
      P.bars([i - off], [R.a[i]], C.c4, bw); P.bars([i + off], [R.b[i]], C.c3, bw);
      P.text(i - off, R.a[i] + 0.015, R.a[i].toFixed(3), C.c4, 'center', 'bottom', f);
      P.text(i + off, R.b[i] + 0.015, R.b[i].toFixed(3), C.c3, 'center', 'bottom', f);
      ctx.save(); ctx.fillStyle = C.ink; ctx.font = '600 13px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(n, P.tx(i), P.y0 + 6); ctx.font = '12px ' + FONT; ctx.fillStyle = C.slate; ctx.fillText(`打分 ${tr(R.s[i], 2)}`, P.tx(i), P.y0 + 23); ctx.restore();
    });
  });
  $('#f-book').onclick = () => { F4 = F0.map(([n, v]) => [n, v.slice()]); renderF(); };
  $('#f-book').onclick();
})();
