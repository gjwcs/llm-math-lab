/* 第 3 章：逼近论与表征学习 · 交互实验（与第二版正文 §3.2–3.4、FAQ、练习 3.4 的数字一致） */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §3.2 三个折页搭帐篷 · §3.3 对折与 2^L · §3.4 手算算例 · FAQ 问 1–3 · 练习 3.4' });
  // 窄屏下长公式与宽表格改为横向滚动，不撑破版面
  document.querySelectorAll('.formula, [style*="overflow-x"]').forEach((f) => { f.style.width = '0'; f.style.minWidth = '100%'; });
  const FONT = getComputedStyle(document.body).getPropertyValue('--font');
  const NUMF = getComputedStyle(document.body).getPropertyValue('--font-num');
  const relu = (z) => (z > 0 ? z : 0);
  const r4 = (v) => { const s = (Math.abs(v) < 5e-10 ? 0 : +v.toFixed(4)).toString(); return s.replace('-', '−'); };
  const sgn = (v) => (v >= 0 ? '+' : '−') + Math.abs(v);

  /* ================= 实验 1：三个折页搭帐篷 ================= */
  const BOOK = { c: [1, -2, 1], t: [0, 1, 2] };
  const XS_TABLE = [-0.5, 0, 0.5, 1, 1.5, 2, 2.5];
  const HUE = [C.c1, C.c4, C.c2];
  let showParts = true;
  const sc = [1, 2, 3].map((k, i) => LAB.slider('#t-c' + k, { label: `系数 $c_${k}$`, min: -3, max: 3, step: 0.5, value: BOOK.c[i], fmt: (v) => sgn(v), onInput: upd1 }));
  const stt = [1, 2, 3].map((k, i) => LAB.slider('#t-t' + k, { label: `拐点 $t_${k}$`, min: -1, max: 3, step: 0.25, value: BOOK.t[i], fmt: (v) => v.toFixed(2), onInput: upd1 }));
  LAB.checkbox('#t-show', '显示三个分量 $c_k\\,\\mathrm{ReLU}(x-t_k)$', true, (v) => { showParts = v; main1.redraw(); });
  document.querySelector('#t-reset').onclick = () => { sc.forEach((s, i) => s.set(BOOK.c[i])); stt.forEach((s, i) => s.set(BOOK.t[i])); upd1(); };
  const cs = () => sc.map((s) => s.get()), ts = () => stt.map((s) => s.get());
  const part = (k, x) => cs()[k] * relu(x - ts()[k]);
  const T = (x) => part(0, x) + part(1, x) + part(2, x);
  const main1 = LAB.canvas('#t-main', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -1, xmax: 3.5, ymin: -2.2, ymax: 2.6, xlabel: 'x', ylabel: 'T(x)', pad: { l: 44, r: 14, t: 12, b: 38 } }).axes();
    P.hline(0, '#9aa5b1');
    P.clip();
    if (showParts) [0, 1, 2].forEach((k) => P.fn((x) => part(k, x), HUE[k], 1.4, [5, 4], 400));
    const xs = M.linspace(-1, 3.5, 901), ys = xs.map(T);
    P.area(xs, ys, C.c3, 0.13, 0);
    P.line(xs, ys, C.navy, 3);
    P.unclip();
    // 拐点三角标记
    ctx.save();
    ts().forEach((t, k) => { const X = P.tx(t); ctx.fillStyle = HUE[k]; ctx.beginPath(); ctx.moveTo(X, P.y0); ctx.lineTo(X - 5, P.y0 - 8); ctx.lineTo(X + 5, P.y0 - 8); ctx.closePath(); ctx.fill(); });
    ctx.restore();
    P.points(XS_TABLE, XS_TABLE.map(T), C.navy, 3.6, '#fff');
  });
  const st1 = [LAB.stat('#t-stats', '帐篷最高点 $\\max T(x)$', 'teal'), LAB.stat('#t-stats', '最右边的斜率 $c_1+c_2+c_3$', 'amber'), LAB.stat('#t-stats', '最右边的高度', 'coral'), LAB.stat('#t-stats', '右脚落地了吗？')];
  function upd1() {
    const c = cs(), t = ts();
    const xs = M.linspace(-1, 3.5, 1801), ys = xs.map(T);
    let mx = -Infinity, at = 0; ys.forEach((v, i) => { if (v > mx) { mx = v; at = xs[i]; } });
    const slope = c[0] + c[1] + c[2], farH = -(c[0] * t[0] + c[1] * t[1] + c[2] * t[2]);
    st1[0].set(`${r4(mx)}<small>在 x = ${r4(at)}</small>`);
    st1[1].set(r4(slope));
    st1[2].set(slope === 0 ? r4(farH) + '<small>保持水平</small>' : (slope > 0 ? '→ +∞' : '→ −∞'));
    st1[3].set(slope === 0 && Math.abs(farH) < 1e-9 ? '<span style="color:var(--leaf)">是</span>' : '<span style="color:var(--coral)">否</span>');
    // 手算账本
    let hh = '<thead><tr><th>$x$</th>' + XS_TABLE.map((x) => `<th class="num">${r4(x)}</th>`).join('') + '</tr></thead><tbody>';
    [0, 1, 2].forEach((k) => {
      hh += `<tr><td><span style="color:${HUE[k]};font-weight:650">${k + 1} 号</span> $${(c[k] >= 0 ? '+' : '-') + Math.abs(c[k])}\\,\\mathrm{ReLU}(x${t[k] === 0 ? '' : (t[k] > 0 ? '-' : '+') + Math.abs(t[k])})$</td>` + XS_TABLE.map((x) => `<td class="num">${r4(part(k, x))}</td>`).join('') + '</tr>';
    });
    hh += '<tr><td><b>合计 $T(x)$</b></td>' + XS_TABLE.map((x) => `<td class="num"><b>${r4(T(x))}</b></td>`).join('') + '</tr></tbody>';
    const tb = document.querySelector('#t-table'); tb.innerHTML = hh; LAB.renderMath(tb);
    main1.redraw();
  }
  upd1();

  // ---- 第二部分：帐篷拼抛物线
  const DX = [1, 0.5, 0.25, 0.125];
  let dxI = 0;
  LAB.segmented('#p-dx', DX.map((d) => `$\\Delta x=${d}$`), 0, (i) => { dxI = i; upd2p(); });
  const interp = (x, dx) => { const k = Math.min(Math.floor(x / dx + 1e-12), Math.round(2 / dx) - 1), a = k * dx, b = a + dx; return a * a + (b * b - a * a) * (x - a) / dx; };
  const mainP = LAB.canvas('#p-main', (ctx, w, h) => {
    const dx = DX[dxI];
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 2, ymin: -0.1, ymax: 4.3, xlabel: 'x', ylabel: 'y', pad: { l: 44, r: 14, t: 12, b: 38 } }).axes();
    const xs = M.linspace(0, 2, 801);
    P.clip();
    // 每顶帐篷 f(x_k) T_k(x)
    const N = Math.round(2 / dx);
    for (let k = 1; k <= N; k++) { const xk = k * dx, fk = xk * xk; P.line([xk - dx, xk, xk + dx], [0, fk, 0], LAB.mix(C.c6, '#ffffff', 0.45), 1); }
    P.line(xs, xs.map((x) => x * x), '#B8C1CC', 5);
    P.line(xs, xs.map((x) => interp(x, dx)), C.c1, 2.4);
    P.area(xs, xs.map((x) => 4 * (interp(x, dx) - x * x)), C.c4, 0.25, 0);
    P.line(xs, xs.map((x) => 4 * (interp(x, dx) - x * x)), C.c4, 1.4);
    P.unclip();
    const nodes = M.range(N + 1).map((k) => k * dx);
    P.points(nodes, nodes.map((x) => x * x), C.navy, 3.4, '#fff');
    if (dx >= 0.5) nodes.slice(0, -1).forEach((a) => { const m = a + dx / 2; P.text(m, 4 * (dx * dx / 4) + 0.12, `误差 ${r4(dx * dx / 4)}`, C.c4, 'center', 'bottom', '11px ' + FONT); });
  });
  const stP = [LAB.stat('#p-stats', '网格间距 $\\Delta x$'), LAB.stat('#p-stats', '需要的 ReLU 个数', 'teal'), LAB.stat('#p-stats', '实测最大误差', 'coral'), LAB.stat('#p-stats', '理论值 $\\Delta x^2/4$', 'amber')];
  function upd2p() {
    const dx = DX[dxI], N = Math.round(2 / dx);
    let mx = 0; for (let i = 0; i <= 8000; i++) { const x = 2 * i / 8000; mx = Math.max(mx, interp(x, dx) - x * x); }
    stP[0].set(String(dx)); stP[1].set(`${N}<small>个</small>`); stP[2].set(r4(mx)); stP[3].set(r4(dx * dx / 4));
    const sub = document.querySelector('#p-sub');
    sub.innerHTML = N === 2 ? '$\\hat f(x)=\\mathrm{ReLU}(x)+2\\,\\mathrm{ReLU}(x-1)$' : `$\\hat f(x)=${dx}\\,\\mathrm{ReLU}(x)+\\sum_{k=1}^{${N - 1}} ${2 * dx}\\,\\mathrm{ReLU}(x-${dx}k)$`;
    LAB.renderMath(sub);
    mainP.redraw();
  }
  upd2p();

  /* ================= 实验 2：对折十次数折线 ================= */
  const sec2 = document.querySelector('#fold');
  const g = (u) => relu(2 * u) - 2 * relu(2 * u - 1);
  let L = 3, playing = false, timer = null;
  const sL = LAB.slider('#f-L', { label: '层数 $L$', min: 1, max: 10, step: 1, value: 3, onInput: (v) => { L = v; upd3(); } });
  const PROBES = [null, 1 / 8, 3 / 8, 0.25, 0.5, 0.75];
  const PNAME = ['不跟踪', '$x=\\tfrac18$', '$x=\\tfrac38$', '$x=0.25$', '$x=0.5$', '$x=0.75$'];
  let probe = 1 / 8;
  const segP = LAB.segmented('#f-probe', PNAME, 1, (i) => { if (PROBES[i] != null) { probe = PROBES[i]; sX.set(probe); } else probe = null; upd3(); });
  const sX = LAB.slider('#f-x', { label: '或者拖动输入 $x$', min: 0, max: 1, step: 1 / 128, value: 1 / 8, fmt: (v) => v.toFixed(4), onInput: (v) => { probe = v; upd3(); } });
  const playBtn = document.querySelector('#f-play');
  function stop() { playing = false; clearTimeout(timer); playBtn.textContent = '▶ 从 1 层折到 10 层'; }
  playBtn.onclick = () => {
    if (playing) { stop(); return; }
    playing = true; playBtn.textContent = '⏸ 暂停'; L = 1; sL.set(1); upd3();
    const step = () => { if (!playing) return; if (!sec2.classList.contains('active') || L >= 10) { stop(); return; } L += 1; sL.set(L); upd3(); timer = setTimeout(step, 750); };
    timer = setTimeout(step, 750);
  };
  // g^{∘L} 在 k/2^L 处恰为 k mod 2，中间线性
  const polyline = (n) => { const N = 1 << n, xs = [], ys = []; for (let k = 0; k <= N; k++) { xs.push(k / N); ys.push(k % 2); } return { xs, ys }; };
  const mainF = LAB.canvas('#f-main', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: -0.06, ymax: 1.14, xlabel: 'x', ylabel: 'g∘L(x)', pad: { l: 46, r: 14, t: 12, b: 38 } }).axes();
    if (L > 1) { const p = polyline(L - 1); P.line(p.xs, p.ys, C.slate, 1.2, [4, 4]); }
    const p = polyline(L);
    for (let i = 0; i + 1 < p.xs.length; i++) P.line([p.xs[i], p.xs[i + 1]], [p.ys[i], p.ys[i + 1]], i % 2 ? C.c6 : C.c1, L >= 8 ? 1.3 : 2.4);
    if (L <= 5) P.points(p.xs, p.ys, C.navy, 2.6);
    if (probe != null) {
      let h1 = probe; for (let k = 0; k < L; k++) h1 = g(h1);
      P.vline(probe, C.coral, [3, 3]);
      P.points([probe], [h1], C.coral, 6, '#fff');
      P.text(Math.min(probe + 0.015, 0.8), Math.min(h1 + 0.07, 1.08), `h${L} = ${r4(h1)}`, C.coral, 'left', 'middle', '600 12px ' + NUMF);
    }
  });
  const bars = LAB.canvas('#f-bars', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.4, xmax: 10.6, ymin: 1, ymax: 2400, logy: true, xtickValues: M.range(10).map((i) => i + 1), xfmt: (v) => v, ytickValues: [1, 10, 100, 1000], xlabel: '层数 L（共 2L 个 ReLU）', ylabel: '线性段数', pad: { l: 46, r: 10, t: 10, b: 38 } }).axes();
    const bw = (P.tx(2) - P.tx(1)) * 0.36, xs = M.range(10).map((i) => i + 1);
    P.bars(xs.map((x) => x - 0.2), xs.map((x) => Math.pow(2, x)), xs.map((x) => (x === L ? C.c1 : LAB.mix(C.c1, '#ffffff', 0.55))), bw, 1);
    P.bars(xs.map((x) => x + 0.2), xs.map((x) => 2 * x + 1), xs.map((x) => (x === L ? C.c2 : LAB.mix(C.c2, '#ffffff', 0.55))), bw, 1);
    P.text(L - 0.2, Math.pow(2, L) * 1.3, String(Math.pow(2, L)), C.c1, 'center', 'bottom', '600 11.5px ' + NUMF);
    P.text(L + 0.25, (2 * L + 1) * 1.3, String(2 * L + 1), C.c2, 'center', 'bottom', '600 11.5px ' + NUMF);
  });
  const st2 = [LAB.stat('#f-stats', '用掉的 ReLU', ''), LAB.stat('#f-stats', '深网络段数 $2^L$', 'teal'), LAB.stat('#f-stats', '波峰个数 $2^{L-1}$', 'plum'), LAB.stat('#f-stats', '同预算浅网络至多', 'amber'), LAB.stat('#f-stats', '斜率绝对值 $2^L$', 'coral')];
  function upd3() {
    st2[0].set(`${2 * L}<small>${L} 层 × 2</small>`);
    st2[1].set(Math.pow(2, L).toLocaleString());
    st2[2].set(Math.pow(2, L - 1).toLocaleString());
    st2[3].set(`${2 * L + 1}<small>段</small>`);
    st2[4].set(Math.pow(2, L).toLocaleString() + '<small>拐点处除外</small>');
    document.querySelector('#f-sub').textContent = `${L} 层 · ${Math.pow(2, L)} 段 · ${Math.pow(2, L - 1)} 个波峰`;
    // 逐层手算
    const tb = document.querySelector('#f-table'), cap = document.querySelector('#f-cap');
    if (probe == null) { tb.innerHTML = ''; cap.textContent = '选一个输入 x，就能看到它一层一层被折到哪里。'; }
    else {
      let hh = '<thead><tr><th>层</th><th>输入 $h_{k-1}$</th><th>走哪段</th><th>输出 $h_k=g(h_{k-1})$</th></tr></thead><tbody>';
      let v = probe;
      for (let k = 1; k <= L; k++) {
        const nv = g(v), up = v < 0.5;
        hh += `<tr><td>第 ${k} 层</td><td class="num">${r4(v)}</td><td>${v === 0.5 ? '尖顶' : up ? '上坡 $2u$' : '下坡 $2-2u$'}</td><td class="num"><b>${r4(nv)}</b></td></tr>`;
        v = nv;
      }
      tb.innerHTML = hh + '</tbody>'; LAB.renderMath(tb);
      cap.innerHTML = `$x=${r4(probe)}$ 经过 ${L} 层后到达 $h_{${L}}=${r4(v)}$。只要不落在拐点上，每层斜率都是 $\\pm2$，链式法则乘起来就是 $\\pm2^{${L}}=\\pm${Math.pow(2, L)}$。`;
      LAB.renderMath(cap);
    }
    mainF.redraw(); bars.redraw();
  }
  upd3();

  /* ================= 实验 3：磨圆折角的激活函数 ================= */
  const sig = (z) => 1 / (1 + Math.exp(-z));
  const phi = (z) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI), Phi = M.normcdf;
  const ACT = [
    { name: 'ReLU', color: C.c2, f: relu, d: (z) => (z > 0 ? 1 : 0), on: true },
    { name: 'SiLU', color: C.c3, f: (z) => z * sig(z), d: (z) => sig(z) * (1 + z * (1 - sig(z))), on: true },
    { name: 'GELU', color: C.c1, f: (z) => z * Phi(z), d: (z) => Phi(z) + z * phi(z), on: true },
  ];
  ACT.forEach((a) => LAB.checkbox('#a-checks', `<span style="display:inline-block;width:14px;height:4px;border-radius:2px;background:${a.color};margin-right:2px;vertical-align:middle"></span>${a.name}`, true, (v) => { a.on = v; redrawA(); }));
  const sx = LAB.slider('#a-x', { label: '探针位置 $x$', min: -4, max: 4, step: 0.05, value: -1, fmt: (v) => v.toFixed(2), onInput: () => redrawA() });
  const legend = document.querySelector('#a-legend');
  legend.innerHTML = ACT.map((a) => `<span><i style="background:${a.color}"></i>${a.name}</span>`).join('') + '<span><i style="background:var(--slate)"></i>探针 $x$</span>';
  LAB.renderMath(legend);
  const fA = LAB.canvas('#a-f', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -4, xmax: 4, ymin: -0.8, ymax: 4.2, xlabel: 'x', pad: { l: 38, r: 10, t: 10, b: 36 } }).axes();
    const x0 = sx.get(); P.vline(x0, C.slate, [4, 3]); P.hline(0, '#9aa5b1');
    P.clip(); ACT.filter((a) => a.on).forEach((a) => P.fn(a.f, a.color, 2.3, null, 400)); P.unclip();
    ACT.filter((a) => a.on).forEach((a) => P.points([x0], [a.f(x0)], a.color, 4.5, '#fff'));
  });
  const dA = LAB.canvas('#a-df', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -4, xmax: 4, ymin: -0.25, ymax: 1.25, xlabel: 'x', pad: { l: 38, r: 10, t: 10, b: 36 } }).axes();
    const x0 = sx.get(); P.vline(x0, C.slate, [4, 3]); P.hline(0, '#9aa5b1');
    P.clip();
    ACT.filter((a) => a.on).forEach((a) => {
      if (a.name === 'ReLU') { P.line([-4, 0], [0, 0], a.color, 2.3); P.line([0, 4], [1, 1], a.color, 2.3); P.points([0], [0], a.color, 3.5); P.points([0], [1], '#fff', 3.5, a.color); }
      else P.fn(a.d, a.color, 2.3, null, 400);
    });
    P.unclip();
    ACT.filter((a) => a.on).forEach((a) => P.points([x0], [a.d(x0)], a.color, 4.5, '#fff'));
  });
  const stA = ACT.map((a, i) => LAB.stat('#a-stats', `${a.name}$(x)$ 与斜率`, ['amber', 'leaf', ''][i]));
  function redrawA() {
    const x0 = sx.get();
    ACT.forEach((a, i) => stA[i].set(`${r4(a.f(x0))}<small>斜率 ${r4(a.d(x0))}</small>`));
    fA.redraw(); dA.redraw();
  }
  redrawA();

  // ---- 第二部分：死亡 ReLU
  const R = LAB.rng(2026), XIN = M.range(24).map(() => -2.5 + 5 * R()).sort((a, b) => a - b);
  const sb = LAB.slider('#d-b', { label: '偏置 $b$', min: -100, max: 5, step: 0.5, value: 0, fmt: (v) => v.toFixed(1), onInput: () => updD() });
  const sw = LAB.slider('#d-w', { label: '权重 $w$', min: 0.2, max: 2, step: 0.1, value: 1, fmt: (v) => v.toFixed(1), onInput: () => updD() });
  const mainD = LAB.canvas('#d-main', (ctx, w, h) => {
    const b = sb.get(), ww = sw.get(), zs = XIN.map((x) => ww * x + b);
    const lo = Math.min(-6, Math.min(...zs) - 1), hi = Math.max(6, Math.max(...zs) + 1);
    const P = new LAB.Plot(ctx, w, h, { xmin: lo, xmax: hi, ymin: -0.15, ymax: 1.25, xlabel: 'z = w·x + b', ylabel: 'ReLU′(z)', pad: { l: 50, r: 12, t: 10, b: 38 } }).axes();
    ctx.save(); ctx.fillStyle = 'rgba(209,73,91,.07)'; ctx.fillRect(P.tx(lo), P.y1, P.tx(0) - P.tx(lo), P.y0 - P.y1); ctx.restore();
    P.vline(0, C.slate, [4, 3]);
    P.line([lo, 0], [0, 0], C.c2, 2); P.line([0, hi], [1, 1], C.c2, 2);
    zs.forEach((z) => P.points([z], [z > 0 ? 1 : 0], z > 0 ? C.leaf : C.coral, 4.5, '#fff'));
    P.text(lo + (0 - lo) * 0.5, 0.55, '负数区：导数 = 0', C.coral, 'center', 'middle', '600 12px ' + FONT);
  });
  const stD = [LAB.stat('#d-stats', '“活着”的题目（$z&gt;0$）', 'leaf'), LAB.stat('#d-stats', 'ReLU：$b$ 收到的梯度之和', 'coral'), LAB.stat('#d-stats', '换成 SiLU：梯度之和', 'plum')];
  function updD() {
    const b = sb.get(), ww = sw.get(), zs = XIN.map((x) => ww * x + b);
    const alive = zs.filter((z) => z > 0).length;
    const gR = zs.reduce((s, z) => s + (z > 0 ? 1 : 0), 0), gS = zs.reduce((s, z) => s + ACT[1].d(z), 0);
    stD[0].set(`${alive}<small>/ 24 道</small>`);
    stD[1].set(String(gR));
    stD[2].set(M.fmt(gS, 3));
    document.querySelector('#d-sub').textContent = alive === 0 ? '全部落在负数区：这个神经元“脑死亡”了' : `还有 ${alive} 道题能把梯度传回来`;
    mainD.redraw();
  }
  updD();
})();
