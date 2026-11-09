/* 第 11 章：低资源微调的线性代数奇迹：交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §11.1 显存账 · §11.2 一列乘一行与秩 · §11.3 LoRA 参数账、零延迟合并与非对称初始化 · §11.4 2×2 手算算例' });

  const $ = (s) => document.querySelector(s);
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (e) => String(e).split('').map((c) => SUP[c]).join('');
  const fe = (x) => { if (!isFinite(x)) return '–'; if (x === 0) return '0'; const a = Math.abs(x); if (a >= 1000 && a < 1e4) return String(Math.round(x)); if (a >= 0.01 && a < 1e4) return x.toPrecision(3); const e = Math.floor(Math.log10(a)); return (x / Math.pow(10, e)).toFixed(1) + '×10' + sup(e); };
  const big = (x) => { const u = [['B', 1e9], ['M', 1e6], ['K', 1e3]]; for (const [s, v] of u) if (x >= v) return (x / v).toPrecision(3) + s; return String(Math.round(x)); };
  const gb = (b) => (b / 1e9 >= 100 ? (b / 1e9).toFixed(0) : (b / 1e9).toPrecision(3)) + ' GB';
  const rgbOf = (hex) => { hex = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(hex.substr(i, 2), 16)); };
  const lerp3 = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));


  /* ================= 实验 1：一列乘一行拼积木 ================= */
  const V1 = { b1: [1, 2, 1, 2], a1: [1, 0, 2, 1], b2: [0, 1, 0, -1], a2: [0, 3, 1, 0], two: false };
  const inputs1 = {};
  function vecInputs(host, key, label, n) {
    const el = $(host);
    el.innerHTML = `<span class="lab">${label}</span>` + M.range(n).map((i) => `<input type="number" step="1" min="-9" max="9" data-i="${i}">`).join('');
    LAB.renderMath(el);
    const ins = Array.from(el.querySelectorAll('input'));
    ins.forEach((inp, i) => { inp.value = V1[key][i]; inp.addEventListener('input', () => { const v = Number(inp.value); V1[key][i] = isFinite(v) ? v : 0; upd1b(); }); });
    inputs1[key] = ins;
  }
  vecInputs('#v-b1', 'b1', '$\\mathbf b_1$', 4); vecInputs('#v-a1', 'a1', '$\\mathbf a_1^\\top$', 4);
  vecInputs('#v-b2', 'b2', '$\\mathbf b_2$', 4); vecInputs('#v-a2', 'a2', '$\\mathbf a_2^\\top$', 4);
  const chkTwo = LAB.checkbox('#chk-two', '再加第 2 块积木（$\\mathbf B$ 变成 $4\\times2$）', false, (v) => { V1.two = v; upd1b(); });
  const setVecs = (o) => { Object.assign(V1, JSON.parse(JSON.stringify(o))); ['b1', 'a1', 'b2', 'a2'].forEach((k) => inputs1[k].forEach((inp, i) => { inp.value = V1[k][i]; })); chkTwo.set(V1.two); upd1b(); };
  $('#btn-book1').onclick = () => setVecs({ b1: [1, 2, 1, 2], a1: [1, 0, 2, 1], b2: [0, 1, 0, -1], a2: [0, 3, 1, 0], two: false });
  $('#btn-book2').onclick = () => setVecs({ b1: [1, 2, 1, 2], a1: [1, 0, 2, 1], b2: [0, 1, 0, -1], a2: [0, 3, 1, 0], two: true });
  let randSeed = 3;
  $('#btn-rand').onclick = () => { const R = LAB.rng(randSeed++), f = () => R.int(7) - 3; setVecs({ b1: [f(), f(), f(), f()], a1: [f(), f(), f(), f()], b2: [f(), f(), f(), f()], a2: [f(), f(), f(), f()], two: V1.two }); };
  const outer = (b, a) => b.map((bi) => a.map((aj) => bi * aj));
  const addM = (X, Y) => X.map((r, i) => r.map((v, j) => v + Y[i][j]));
  function rankOf(Mx) {
    const A = Mx.map((r) => r.slice()), m = A.length, n = A[0].length; let rk = 0;
    for (let c = 0; c < n && rk < m; c++) {
      let p = rk; for (let i = rk + 1; i < m; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
      if (Math.abs(A[p][c]) < 1e-9) continue;
      [A[rk], A[p]] = [A[p], A[rk]];
      for (let i = 0; i < m; i++) if (i !== rk) { const f = A[i][c] / A[rk][c]; for (let j = c; j < n; j++) A[i][j] -= f * A[rk][j]; }
      rk++;
    }
    return rk;
  }
  // 第 i 行是否是第 1 个非零行的倍数
  function multipleOfFirst(Mx) {
    const base = Mx.find((r) => r.some((v) => v !== 0));
    return Mx.map((r) => { if (!base) return true; return rankOf([base, r]) <= 1; });
  }
  const blkCv = LAB.canvas('#blk-draw', (ctx, w, h) => {
    const P1 = outer(V1.b1, V1.a1), P2 = outer(V1.b2, V1.a2), S = V1.two ? addM(P1, P2) : P1;
    const mats = V1.two ? [['b₁a₁ᵀ', P1], ['b₂a₂ᵀ', P2], ['BA', S]] : [['b', V1.b1.map((v) => [v])], ['aᵀ', [V1.a1]], ['ΔW = baᵀ', S]];
    const mx = Math.max(1, ...[].concat(...mats.map((m) => m[1].flat().map(Math.abs))));
    const narrow = w < 520;
    const cell = Math.min(narrow ? 30 : 40, (h - 70) / 4, (w - 120) / (V1.two ? 12 : 9.5));
    const colr = (v) => (v === 0 ? '#ffffff' : v > 0 ? LAB.mix('#ffffff', C.c1, Math.min(1, 0.15 + 0.85 * v / mx)) : LAB.mix('#ffffff', C.c4, Math.min(1, 0.15 + 0.85 * -v / mx)));
    const drawM = (Mx, x0, y0, hl) => {
      Mx.forEach((r, i) => r.forEach((v, j) => {
        ctx.fillStyle = colr(v); ctx.fillRect(x0 + j * cell, y0 + i * cell, cell - 2, cell - 2);
        ctx.fillStyle = Math.abs(v) / mx > 0.55 ? '#fff' : C.ink; ctx.font = `600 ${Math.round(cell * 0.38)}px Avenir Next, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(+v.toFixed(2)), x0 + j * cell + cell / 2 - 1, y0 + i * cell + cell / 2 - 1);
      }));
      if (hl) hl.forEach((on, i) => { if (!on) { ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.strokeRect(x0 - 3, y0 + i * cell - 2, Mx[0].length * cell + 4, cell + 2); } });
    };
    const label = (t, x, y, col) => { ctx.fillStyle = col || C.navy; ctx.font = `600 13px PingFang SC, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(t, x, y); };
    const op = (t, x, y) => { ctx.fillStyle = C.ink; ctx.font = '600 22px Avenir Next, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); };
    const y0 = 34;
    if (!V1.two) {
      const wB = cell, wA = 4 * cell, wS = 4 * cell, gap = narrow ? 26 : 40, tot = wB + wA + wS + 2 * gap;
      let x = Math.max(8, (w - tot - 40) / 2);
      drawM(mats[0][1], x, y0); label('b（4×1）', x + wB / 2, y0 - 6, C.c1);
      x += wB + gap; op('×', x - gap / 2, y0 + 2 * cell);
      drawM(mats[1][1], x, y0 + 1.5 * cell); label('aᵀ（1×4）', x + wA / 2, y0 + 1.5 * cell - 6, C.c1);
      x += wA + gap; op('=', x - gap / 2, y0 + 2 * cell);
      const mul = multipleOfFirst(S); drawM(S, x, y0, mul); label('ΔW = baᵀ（4×4）', x + wS / 2, y0 - 6);
      // 行倍数
      const base = V1.a1; ctx.font = '600 12px Avenir Next, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.amber;
      if (base.some((v) => v !== 0)) V1.b1.forEach((bi, i) => ctx.fillText(`×${bi}`, x + wS + 4, y0 + i * cell + cell / 2));
    } else {
      const wS = 4 * cell, gap = narrow ? 22 : 34, tot = 3 * wS + 2 * gap;
      let x = Math.max(8, (w - tot - 70) / 2);
      drawM(P1, x, y0); label('b₁a₁ᵀ', x + wS / 2, y0 - 6, C.c1);
      x += wS + gap; op('+', x - gap / 2, y0 + 2 * cell);
      drawM(P2, x, y0); label('b₂a₂ᵀ', x + wS / 2, y0 - 6, C.c4);
      x += wS + gap; op('=', x - gap / 2, y0 + 2 * cell);
      const mul = multipleOfFirst(S); drawM(S, x, y0, mul); label('BA', x + wS / 2, y0 - 6);
      if (mul.some((v) => !v)) { ctx.fillStyle = C.amber; ctx.font = '12px PingFang SC, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('框出的行不是', x + wS + 12, y0 + cell); ctx.fillText('第 1 行的倍数', x + wS + 12, y0 + cell + 16); }
    }
  });
  const sb1 = LAB.stat('#blk-stats', '存了几个数'), sb2 = LAB.stat('#blk-stats', '变出几个格子', 'teal'), sb3 = LAB.stat('#blk-stats', '秩（独立方向个数）', 'amber');
  function upd1b() {
    $('#block2').style.display = V1.two ? '' : 'none';
    const S = V1.two ? addM(outer(V1.b1, V1.a1), outer(V1.b2, V1.a2)) : outer(V1.b1, V1.a1), rk = rankOf(S);
    sb1.set(V1.two ? '16' : '8'); sb2.set('16'); sb3.set(String(rk));
    const mul = multipleOfFirst(S);
    $('#blk-cap').innerHTML = V1.two
      ? `两块秩 1 积木相加就是 $4\\times2$ 的窄表乘 $2\\times4$ 的扁表。结果的秩为 <b>${rk}</b>；${mul.every((v) => v) ? '所有行仍是第 1 行的倍数（两块积木撞了方向）。' : '琥珀色框出的行已经不是第 1 行的倍数。'}`
      : `每一行都是 $\\mathbf a^\\top$ 的倍数（右侧标出了倍数 $b_i$），所以秩为 <b>${rk}</b>。`;
    LAB.renderMath($('#blk-cap'));
    blkCv.redraw();
  }
  // 大表
  const BIG = { d: 4096, k: 4096, r: 8 };
  const DIMS = [256, 512, 1000, 1024, 2048, 4096, 8192, 12288, 16384];
  const RS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
  const dS = LAB.slider('#big-d', { label: '行数 $d$', min: 0, max: DIMS.length - 1, step: 1, value: DIMS.indexOf(4096), fmt: (v) => String(DIMS[v]), onInput: (v) => { BIG.d = DIMS[v]; updBig(); } });
  const kS = LAB.slider('#big-k', { label: '列数 $k$', min: 0, max: DIMS.length - 1, step: 1, value: DIMS.indexOf(4096), fmt: (v) => String(DIMS[v]), onInput: (v) => { BIG.k = DIMS[v]; updBig(); } });
  const rS = LAB.slider('#big-r', { label: '秩 $r$', min: 0, max: RS.length - 1, step: 1, value: RS.indexOf(8), fmt: (v) => String(RS[v]), onInput: (v) => { BIG.r = RS[v]; updBig(); } });
  const setBig = (d, k, r) => { BIG.d = d; BIG.k = k; BIG.r = r; dS.set(DIMS.indexOf(d)); kS.set(DIMS.indexOf(k)); rS.set(RS.indexOf(r)); updBig(); };
  $('#btn-4096').onclick = () => setBig(4096, 4096, 8);
  $('#btn-1000').onclick = () => setBig(1000, 1000, 2);
  const bigCv = LAB.canvas('#big-draw', (ctx, w, h) => {
    const { d, k, r } = BIG, half = w / 2;
    const bars = [
      [[['存 ΔW：dk', d * k, C.c1], ['存 B、A：r(d+k)', r * (d + k), C.c3]], 0, '参数个数'],
      [[['(BA)x：drk+dk', d * r * k + d * k, C.c4], ['ΔW·x：dk', d * k, C.c1], ['B(Ax)：r(k+d)', r * (k + d), C.c3]], half, '乘法次数'],
    ];
    bars.forEach(([rows, x0, title]) => {
      const vmax = Math.max(...rows.map((r0) => r0[1])), lo = 1e2;
      const P = new LAB.Plot(ctx, half, h, { xmin: -0.6, xmax: rows.length - 0.4, ymin: lo, ymax: Math.pow(10, Math.ceil(Math.log10(vmax * 1.5))), logy: true, xtickValues: [], ylabel: title, pad: { l: 52, r: 10, t: 16, b: 46 } });
      ctx.save(); ctx.translate(x0, 0); P.axes();
      rows.forEach(([name, v, col], i) => {
        P.bars([i], [v], col, Math.min(64, half / (rows.length + 2)), lo);
        P.text(i, v, M.big(v), C.ink, 'center', 'bottom', '600 12px Avenir Next, sans-serif');
        ctx.fillStyle = C.ink; ctx.font = '12px PingFang SC, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; const [n1, n2] = name.split('：'); ctx.fillText(n1, P.tx(i), P.y0 + 6); ctx.fillStyle = C.slate; ctx.fillText(n2, P.tx(i), P.y0 + 22);
      });
      ctx.restore();
    });
  });
  const bs1 = LAB.stat('#big-stats', '参数压缩比 $r(d+k)/dk$', 'teal'), bs2 = LAB.stat('#big-stats', '省掉的参数', 'leaf'), bs3 = LAB.stat('#big-stats', '旁路比乘满秩 $\\Delta\\mathbf W$ 快', 'amber'), bs4 = LAB.stat('#big-stats', '$\\mathbf B(\\mathbf A\\mathbf x)$ 比 $(\\mathbf B\\mathbf A)\\mathbf x$ 快', 'coral');
  function updBig() {
    const { d, k, r } = BIG, ratio = r * (d + k) / (d * k);
    bs1.set(ratio >= 1 ? `${ratio.toFixed(2)}<small>（不省反亏）</small>` : (ratio * 100).toPrecision(3) + '<small>%</small>');
    bs2.set(ratio >= 1 ? '0<small>%</small>' : ((1 - ratio) * 100).toFixed(2) + '<small>%</small>');
    bs3.set((d * k / (r * (k + d))).toPrecision(3) + '<small>倍</small>');
    bs4.set(((d * r * k + d * k) / (r * (k + d))).toFixed(0) + '<small>倍</small>');
    bigCv.redraw();
  }
  upd1b(); updBig();

  /* ================= 实验 2：LoRA 显存账本 ================= */
  const MODELS = [
    { name: 'LLaMA-7B', d: 4096, ff: 11008, L: 32, kv: 4096, V: 32000 },
    { name: 'LLaMA-2-70B', d: 8192, ff: 28672, L: 80, kv: 1024, V: 32000 },
  ];
  const MODSETS = [['q', 'v'], ['q', 'k', 'v', 'o'], ['q', 'k', 'v', 'o', 'gate', 'up', 'down']];
  const P1 = { model: 0, r: 8, alpha: 16, mods: 0, which: 0 };
  const shape = (m, name) => ({ q: [m.d, m.d], k: [m.kv, m.d], v: [m.kv, m.d], o: [m.d, m.d], gate: [m.ff, m.d], up: [m.ff, m.d], down: [m.d, m.ff] }[name]); // [d_out, k_in]
  const totalParams = (m) => m.L * (2 * m.d * m.d + 2 * m.kv * m.d + 3 * m.d * m.ff + 2 * m.d) + 2 * m.V * m.d + m.d;
  const loraParams = () => { const m = MODELS[P1.model]; return m.L * M.sum(MODSETS[P1.mods].map((n) => { const [d, k] = shape(m, n); return P1.r * (d + k); })); };
  LAB.segmented('#p-model', MODELS.map((m) => m.name), 0, (i) => { P1.model = i; upd1(); });
  LAB.slider('#p-r', { label: '秩 $r$', min: 0, max: 8, step: 1, value: 3, fmt: (v) => String(Math.pow(2, v)), onInput: (v) => { P1.r = Math.pow(2, v); upd1(); } });
  LAB.slider('#p-alpha', { label: '缩放 $\\alpha$', min: 1, max: 64, step: 1, value: P1.alpha, onInput: (v) => { P1.alpha = v; upd1(); } });
  LAB.segmented('#p-mods', ['$\\mathbf W_q,\\mathbf W_v$', '注意力 4 个', '全部 7 个线性层'], 0, (i) => { P1.mods = i; upd1(); });
  LAB.segmented('#p-which', ['$\\mathbf W_q$', '$\\mathbf W_{\\text{down}}$'], 0, (i) => { P1.which = i; upd1(); });
  const drawCv = LAB.canvas('#p-draw', (ctx, w, h) => {
    const m = MODELS[P1.model], [d, k] = shape(m, P1.which ? 'down' : 'q'), r = P1.r, narrow = w < 520;
    const fs = narrow ? 11 : 12.5, gapOp = narrow ? 48 : 74;
    const u = Math.min((w - 28 - gapOp - 10) / (2 * k + r), (h - 92) / d);
    const W0w = k * u, W0h = d * u, rw = Math.max(3, r * u), y0 = 28;
    let x = 14;
    const label = (txt, cx, cy, col, font, align) => { ctx.fillStyle = col; ctx.font = font || `${fs}px PingFang SC, sans-serif`; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, cx, cy); };
    // W0
    ctx.fillStyle = '#e9edf2'; ctx.fillRect(x, y0, W0w, W0h); ctx.strokeStyle = '#9aa5b1'; ctx.lineWidth = 1; ctx.strokeRect(x, y0, W0w, W0h);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y0, W0w, W0h); ctx.clip(); ctx.strokeStyle = 'rgba(92,103,115,.18)';
    for (let t = -W0h; t < W0w; t += 9) { ctx.beginPath(); ctx.moveTo(x + t, y0 + W0h); ctx.lineTo(x + t + W0h, y0); ctx.stroke(); }
    ctx.restore();
    label('W₀ 冻结', x + W0w / 2, y0 + W0h / 2, C.slate, `600 ${fs + 0.5}px PingFang SC, sans-serif`);
    label(`${d.toLocaleString()}×${k.toLocaleString()}`, x, y0 + W0h + 16, C.slate, `${fs}px Avenir Next, sans-serif`, 'left');
    label(`${(d * k).toLocaleString()} 个参数`, x, y0 + W0h + 34, C.ink, `600 ${fs}px Avenir Next, sans-serif`, 'left');
    x += W0w + 6;
    label('+', x + gapOp * 0.22, y0 + W0h / 2, C.ink, '600 20px Avenir Next, sans-serif');
    label(`${P1.alpha}/${r}`, x + gapOp * 0.62, y0 + W0h / 2, C.c5, `600 ${fs}px Avenir Next, sans-serif`);
    x += gapOp;
    // B (d×r)
    ctx.fillStyle = C.c3; ctx.fillRect(x, y0, rw, W0h);
    label('B', x + rw / 2, y0 - 12, C.c3, '600 14px Avenir Next, sans-serif');
    const bx = x; x += rw + 6;
    // A (r×k)
    ctx.fillStyle = C.c6; ctx.fillRect(x, y0, W0w, rw);
    label('A', x + W0w / 2, y0 - 12, C.c6, '600 14px Avenir Next, sans-serif');
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(47,143,91,.55)'; ctx.strokeRect(x, y0, W0w, W0h); ctx.restore();
    if (W0w > 150) label('BA 与 W₀ 同形，但秩 ≤ r', x + W0w / 2, y0 + W0h / 2, C.c3);
    else { label('BA 同形', x + W0w / 2, y0 + W0h / 2 - 8, C.c3); label('秩 ≤ r', x + W0w / 2, y0 + W0h / 2 + 8, C.c3); }
    label(`${d.toLocaleString()}×${r} + ${r}×${k.toLocaleString()}`, bx, y0 + W0h + 16, C.slate, `${fs}px Avenir Next, sans-serif`, 'left');
    label(`${(r * (d + k)).toLocaleString()} 个参数`, bx, y0 + W0h + 34, C.c3, `600 ${fs}px Avenir Next, sans-serif`, 'left');
  });
  const memCv = LAB.canvas('#p-mem', (ctx, w, h) => {
    const m = MODELS[P1.model], P = totalParams(m), Pl = loraParams();
    const rows = [
      ['全量微调', [[2 * P, C.slate], [2 * P, C.c2], [8 * P, C.c4], [4 * P, C.c5]]],
      ['LoRA（BF16 底座）', [[2 * P + 2 * Pl, C.slate], [2 * Pl, C.c2], [8 * Pl, C.c4], [4 * Pl, C.c5]]],
      ['QLoRA（NF4 底座）', [[P * (4 + 8 / 64 + 32 / (64 * 256)) / 8 + 2 * Pl, C.slate], [2 * Pl, C.c2], [8 * Pl, C.c4], [4 * Pl, C.c5]]],
    ];
    const tot = rows.map((r) => M.sum(r[1].map((s) => s[0]))), maxT = tot[0];
    const narrow = w < 480, l = narrow ? 8 : 128, rpad = 70, bh = narrow ? 28 : Math.min(38, (h - 30) / 3 - 18);
    rows.forEach(([name, segs], q) => {
      const y = (narrow ? 26 : 12) + q * ((h - 20) / 3);
      ctx.fillStyle = C.ink; ctx.font = '12.5px PingFang SC, sans-serif'; ctx.textBaseline = 'middle';
      if (narrow) { ctx.textAlign = 'left'; ctx.fillText(name, l, y - 11); } else { ctx.textAlign = 'right'; ctx.fillText(name, l - 10, y + bh / 2); }
      let x = l;
      segs.forEach(([v, col]) => { const ww = (v / maxT) * (w - l - rpad); ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(ww, v > 0 ? 1 : 0), bh); x += ww; });
      ctx.fillStyle = C.navy; ctx.font = '600 13px Avenir Next, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(gb(tot[q]), x + 6, y + bh / 2);
    });
  });
  const p1 = LAB.stat('#p-stats', '单矩阵 $dk\\to r(d+k)$');
  const p2 = LAB.stat('#p-stats', '单矩阵压缩比', 'teal');
  const p3 = LAB.stat('#p-stats', '全模型可训练参数', 'leaf');
  const p4 = LAB.stat('#p-stats', '占全模型比例', 'amber');
  const p5 = LAB.stat('#p-stats', '缩放 $\\alpha/r$', 'plum');
  function upd1() {
    const m = MODELS[P1.model], [d, k] = shape(m, P1.which ? 'down' : 'q'), r = P1.r, Pl = loraParams(), P = totalParams(m);
    p1.set(`${big(d * k)}<small>→</small>${big(r * (d + k))}`);
    p2.set(((100 * r * (d + k)) / (d * k)).toPrecision(3) + '<small>%</small>');
    p3.set(big(Pl)); p4.set(((100 * Pl) / P).toPrecision(3) + '<small>%</small>'); p5.set((P1.alpha / r).toPrecision(3));
    drawCv.redraw(); memCv.redraw();
  }
  upd1();

  /* ================= 实验 3：一零一随机与无痕合并 ================= */
  const I3 = { scheme: 0, rand: [1, 2], g: [[-1, -2], [-2, -4]], eta: 0.2, x: [1, 1] };
  const W0 = [[10, 0], [0, 10]];
  const numRow = (host, label, vals, onset) => {
    const el = $(host);
    el.innerHTML = `<span class="lab">${label}</span>` + vals.map(() => '<input type="number" step="0.5">').join('');
    LAB.renderMath(el);
    const ins = Array.from(el.querySelectorAll('input'));
    ins.forEach((inp, i) => { inp.value = vals[i]; inp.addEventListener('input', () => { const v = Number(inp.value); onset(i, isFinite(v) ? v : 0); upd3(); }); });
    return ins;
  };
  const inRand = numRow('#i-rand', '随机', I3.rand, (i, v) => { I3.rand[i] = v; });
  const inG1 = numRow('#i-g1', '$\\mathbf G$ 行 1', I3.g[0], (i, v) => { I3.g[0][i] = v; });
  const inG2 = numRow('#i-g2', '$\\mathbf G$ 行 2', I3.g[1], (i, v) => { I3.g[1][i] = v; });
  const inX = numRow('#i-x', '$\\mathbf x$', I3.x, (i, v) => { I3.x[i] = v; });
  const etaS3 = LAB.slider('#i-eta', { label: '学习率 $\\eta$', min: 0.05, max: 1, step: 0.05, value: 0.2, fmt: (v) => v.toFixed(2), onInput: (v) => { I3.eta = v; upd3(); } });
  const schemeSeg = LAB.segmented('#i-scheme', ['LoRA：$\\mathbf B_0=\\mathbf 0$', '全零', '反过来：$\\mathbf A_0=\\mathbf 0$'], 0, (i) => { I3.scheme = i; upd3(); });
  $('#i-book').onclick = () => {
    I3.rand = [1, 2]; I3.g = [[-1, -2], [-2, -4]]; I3.x = [1, 1]; I3.eta = 0.2;
    inRand.forEach((inp, i) => { inp.value = I3.rand[i]; }); inG1.forEach((inp, i) => { inp.value = I3.g[0][i]; });
    inG2.forEach((inp, i) => { inp.value = I3.g[1][i]; }); inX.forEach((inp, i) => { inp.value = I3.x[i]; });
    etaS3.set(0.2); schemeSeg.set(0); upd3();
  };
  const fm = (v) => String(+(+v).toFixed(3));
  const colV = (b) => `\\begin{bmatrix}${b.map(fm).join('\\\\')}\\end{bmatrix}`;
  const rowV = (a) => `\\begin{bmatrix}${a.map(fm).join('&')}\\end{bmatrix}`;
  const mat2 = (Mx) => `\\begin{bmatrix}${Mx.map((r) => r.map(fm).join('&')).join('\\\\')}\\end{bmatrix}`;
  const isZero = (v) => v.every((x) => Math.abs(x) < 1e-12);
  const i1 = LAB.stat('#i-stats', '第 0 步 $\\Delta\\mathbf W_0$ 为零？'), i2 = LAB.stat('#i-stats', '第 1 步谁先动', 'teal'), i3 = LAB.stat('#i-stats', '两路输出相等？', 'leaf');
  function upd3() {
    const G = I3.g, eta = I3.eta;
    let B = I3.scheme === 2 ? I3.rand.slice() : [0, 0];
    let A = I3.scheme === 0 ? I3.rand.slice() : [0, 0];
    const rows = [];
    const dW = (b, a) => b.map((bi) => a.map((aj) => bi * aj));
    rows.push(['第 0 步', `\\mathbf B_0=${colV(B)},\\ \\mathbf A_0=${rowV(A)}`, `\\Delta\\mathbf W_0=${mat2(dW(B, A))}`]);
    const dW0zero = isZero(dW(B, A).flat());
    let firstMove = '';
    for (let t = 1; t <= 2; t++) {
      const gB = [G[0][0] * A[0] + G[0][1] * A[1], G[1][0] * A[0] + G[1][1] * A[1]];   // G A^T
      const gA = [B[0] * G[0][0] + B[1] * G[1][0], B[0] * G[0][1] + B[1] * G[1][1]];   // B^T G
      if (t === 1) firstMove = !isZero(gB) && !isZero(gA) ? 'A、B 同时' : !isZero(gB) ? '先动 B' : !isZero(gA) ? '先动 A' : '都不动';
      B = B.map((v, i) => v - eta * gB[i]); A = A.map((v, i) => v - eta * gA[i]);
      rows.push([`第 ${t} 步`, `\\mathbf G_{\\mathbf B}=${colV(gB)},\\ \\mathbf G_{\\mathbf A}=${rowV(gA)}`, `\\mathbf B_${t}=${colV(B)},\\ \\mathbf A_${t}=${rowV(A)}`]);
      if (t === 1) {
        const Wm = W0.map((r, i) => r.map((v, j) => v + B[i] * A[j]));
        const x = I3.x, one = Wm.map((r) => r[0] * x[0] + r[1] * x[1]);
        const ax = A[0] * x[0] + A[1] * x[1], two = W0.map((r, i) => r[0] * x[0] + r[1] * x[1] + B[i] * ax);
        rows.push(['合并（用第 1 步的 $\\mathbf B_1,\\mathbf A_1$）', `\\mathbf W_{\\text{merged}}=\\mathbf W_0+\\mathbf B_1\\mathbf A_1=${mat2(Wm)}`, `\\text{一路 }${colV(one)}\\ \\text{两路 }${colV(two)}`]);
        i3.set(one.every((v, i) => Math.abs(v - two[i]) < 1e-9) ? '是' : '否');
      }
    }
    i1.set(dW0zero ? '是' : '<span style="color:var(--coral)">否</span>'); i2.set(firstMove);
    let html = '<tr><th>步骤</th><th>梯度 / 初值</th><th>结果</th></tr>';
    rows.forEach(([s, a, b]) => { html += `<tr><td>${s}</td><td>$${a}$</td><td>$${b}$</td></tr>`; });
    $('#i-table').innerHTML = html; LAB.renderMath($('#i-table'));
  }
  upd3();

  let initSeed = 4;
  // 初始化对比：min ½‖BA − T‖²
  const INITS = [['lora', 'LoRA', C.c3], ['zero', '全零', C.c4], ['both', '都随机', C.c2]];
  let INIT = null;
  function buildInit() {
    const d = 16, k = 16, r = 4, lr = 0.05, steps = 150, R = LAB.rng(70 + initSeed);
    const mat = (m, n, f) => M.range(m).map(() => M.range(n).map(f));
    const mm = (A, B) => A.map((row) => B[0].map((_, j) => { let t = 0; for (let q = 0; q < row.length; q++) t += row[q] * B[q][j]; return t; }));
    const tr = (A) => A[0].map((_, j) => A.map((rw) => rw[j]));
    const fro = (A) => Math.sqrt(A.reduce((a, rw) => a + rw.reduce((b, v) => b + v * v, 0), 0));
    let T = mm(mat(d, 2, () => R.normal()), mat(2, k, () => R.normal())); const tn = fro(T); T = T.map((rw) => rw.map((x) => (x * 3) / tn));
    INIT = INITS.map(([mode]) => {
      const R2 = LAB.rng(11 + initSeed);
      let A = mode === 'zero' ? mat(r, k, () => 0) : mat(r, k, () => R2.normal() / Math.sqrt(k));
      let B = mode === 'both' ? mat(d, r, () => R2.normal() / Math.sqrt(r)) : mat(d, r, () => 0);
      const loss = []; let first = null;
      for (let t = 0; t <= steps; t++) {
        const W = mm(B, A), G = W.map((rw, i) => rw.map((x, j) => x - T[i][j]));
        loss.push(0.5 * fro(G) ** 2);
        const gB = mm(G, tr(A)), gA = mm(tr(B), G);
        if (t === 0) first = { w0: fro(W), gA: fro(gA), gB: fro(gB) };
        B = B.map((rw, i) => rw.map((x, j) => x - lr * gB[i][j])); A = A.map((rw, i) => rw.map((x, j) => x - lr * gA[i][j]));
      }
      return { loss, first };
    });
  }
  const initCv = LAB.canvas('#s-init', (ctx, w, h) => {
    if (!INIT) return;
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 150, ymin: 1e-10, ymax: 100, logy: true, ytickValues: [1e-10, 1e-8, 1e-6, 1e-4, 0.01, 1, 100], xlabel: '梯度下降步数', ylabel: '损失', pad: { l: 50, r: 10, t: 12, b: 36 } }).axes();
    P.clip(); INIT.forEach((it, q) => P.line(M.range(it.loss.length), it.loss.map((v) => Math.max(v, 1e-11)), INITS[q][2], 2.4, q === 1 ? [6, 4] : null)); P.unclip();
  });
  function initTable() {
    let html = '<tr><th>初始化</th><th>$\\|\\Delta\\mathbf W_0\\|_F$</th><th>第 1 步 $\\|\\nabla_{\\mathbf A}\\|$</th><th>第 1 步 $\\|\\nabla_{\\mathbf B}\\|$</th><th>150 步后损失</th></tr>';
    INIT.forEach((it, q) => { html += `<tr><td><b style="color:${INITS[q][2]}">●</b> ${INITS[q][1]}</td><td>${it.first.w0.toFixed(3)}</td><td>${it.first.gA.toFixed(3)}</td><td>${it.first.gB.toFixed(3)}</td><td>${fe(it.loss[it.loss.length - 1])}</td></tr>`; });
    $('#s-init-table').innerHTML = html; LAB.renderMath($('#s-init-table')); initCv.redraw();
  }
  buildInit(); initTable();
  $('#s-resample').addEventListener('click', () => { initSeed++; buildInit(); initTable(); });
})();
