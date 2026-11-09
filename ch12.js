/* 第 12 章：解码、生成与人类对齐：交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §12.1 贪心解码与复读 · §12.2 温度与 Top-p · §12.3–12.4 DPO 推导与手算算例' });

  const $ = (s) => document.querySelector(s);
  const FONT = getComputedStyle(document.body).getPropertyValue('--font');
  const NUM = '600 12px Avenir Next, Avenir, sans-serif';
  const GREY = LAB.mix(C.slate, '#ffffff', 0.55);
  const isOn = (id) => document.getElementById(id).classList.contains('active');
  // requestAnimationFrame 循环：实验被切走或 frame() 返回 false 时自动停止
  function anim(secId, frame, onStop) {
    let raf = 0;
    const o = {
      running: false,
      start() {
        if (o.running) return; o.running = true;
        const tick = () => { if (!o.running) return; if (!isOn(secId) || frame() === false) { o.stop(); return; } raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
      },
      stop() { if (!o.running) return; o.running = false; cancelAnimationFrame(raf); onStop && onStop(); },
    };
    return o;
  }
  // 指针拖动（鼠标 + 触屏）
  function drag(cv, on) {
    cv.style.touchAction = 'none'; cv.style.cursor = 'pointer';
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let active = false;
    cv.addEventListener('pointerdown', (e) => { active = true; cv.setPointerCapture(e.pointerId); on('down', ...pos(e)); e.preventDefault(); });
    cv.addEventListener('pointermove', (e) => { if (active) on('move', ...pos(e)); });
    const end = () => { if (active) { active = false; on('up'); } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }
  const sigmoid = (x) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)));
  const softplus = (x) => (x > 30 ? x : Math.log1p(Math.exp(x)));

  /* ================= 实验 1：贪心复读机 ================= */
  // 书中 12.1 节：句尾“知道”→ 我 45%、。40%；“知道我”→ 不 80%；“知道我不”→ 知道 95%；重复一遍后“我”涨到 75%
  const G1 = { T: 1, boost: true };
  function nextDist(state, loops) {
    if (state === '知道') {
      const pw = G1.boost ? Math.min(0.95, 0.45 + 0.30 * loops) : 0.45, rest = 1 - pw;
      return { w: ['我', '。', '，'], p: [pw, rest * 0.40 / 0.55, rest * 0.15 / 0.55] };
    }
    if (state === '我') return { w: ['不', '真的', '。'], p: [0.80, 0.15, 0.05] };
    if (state === '真的') return { w: ['不', '。'], p: [0.90, 0.10] };
    if (state === '不') return { w: ['知道', '。'], p: [0.95, 0.05] };
    if (state === '，') return { w: ['我', '。'], p: [0.70, 0.30] };
    return { w: ['。'], p: [1] };
  }
  const warp = (p, T) => { if (T <= 0.02) { const m = Math.max(...p); return p.map((v) => (v === m ? 1 : 0)); } const q = p.map((v) => Math.pow(v, 1 / T)), s = M.sum(q); return q.map((v) => v / s); };
  function chain(R, greedy) {
    let state = '知道', loops = 0; const out = [];
    for (let t = 0; t < 40; t++) {
      const d = nextDist(state, loops), q = greedy ? warp(d.p, 0) : warp(d.p, G1.T);
      const i = greedy ? q.indexOf(1) : R.choice(q), w = d.w[i];
      out.push(w); if (w === '知道') loops++; if (w === '。') return { out, loops, ended: true };
      state = w;
    }
    return { out, loops, ended: false };
  }
  const gT = LAB.slider('#g-T', { label: '温度 $T$', min: 0.1, max: 2, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), onInput: (v) => { G1.T = v; tableCv.redraw(); many = null; histCv.redraw(); } });
  LAB.checkbox('#g-boost', '重复一遍，“我”的概率就涨一截（45% → 75% → 95%）', true, (v) => { G1.boost = v; tableCv.redraw(); many = null; histCv.redraw(); });
  const gs1 = LAB.stat('#g-stats', '接了几个词'), gs2 = LAB.stat('#g-stats', '复读“我不知道”几遍', 'coral'), gs3 = LAB.stat('#g-stats', '结局', 'teal');
  function showChain(c, how) {
    const html = '<span style="color:var(--slate)">我不知道</span>' + c.out.map((w) => (w === '。' ? `<b style="color:var(--leaf)">${w}</b>` : w)).join('') + (c.ended ? '' : '……');
    $('#g-text').innerHTML = html;
    gs1.set(String(c.out.length)); gs2.set(String(c.loops)); gs3.set(c.ended ? '画上句号' : '<span style="color:var(--coral)">停不下来</span>');
    $('#g-cap').innerHTML = how;
  }
  $('#g-greedy').onclick = () => showChain(chain(null, true), '贪心解码每步只挑第 1 名：句尾“知道”后面永远选 45% 的“我”，一脚踩进环路，直到 40 个词的上限。');
  let gSeed = 11;
  $('#g-sample').onclick = () => showChain(chain(LAB.rng(gSeed++), false), `按温度 $T=${G1.T.toFixed(2)}$ 抽签：句号也有被抽中的机会。`) || LAB.renderMath($('#g-cap'));
  let many = null;
  $('#g-many').onclick = () => {
    const R = LAB.rng(2024), cnt = new Array(12).fill(0); let ended = 0, sumL = 0;
    for (let n = 0; n < 1000; n++) { const c = chain(R, false); if (c.ended) { ended++; cnt[Math.min(10, c.loops)]++; } else cnt[11]++; sumL += c.loops; }
    many = { cnt, ended, mean: sumL / 1000 }; histCv.redraw();
  };
  const tableCv = LAB.canvas('#g-table', (ctx, w, h) => {
    const rows = [['句尾“知道”（第 1 次）', nextDist('知道', 0)], ['句尾“知道”（重复 1 遍后）', nextDist('知道', 1)], ['句尾“知道我”', nextDist('我', 0)], ['句尾“知道我不”', nextDist('不', 0)]];
    const l = w < 520 ? 120 : 170, bw = w - l - 16, rh = (h - 24) / rows.length;
    rows.forEach(([name, d], r) => {
      const q = warp(d.p, G1.T), y = 10 + r * rh, bh = Math.min(26, rh - 14), top = d.p.indexOf(Math.max(...d.p));
      ctx.fillStyle = C.ink; ctx.font = '13px PingFang SC, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(name, l - 10, y + bh / 2);
      let x = l;
      q.forEach((v, i) => {
        const ww = v * bw; ctx.fillStyle = i === top ? C.amber : [C.c6, C.c1, C.slate][i % 3];
        if (d.w[i] === '。') ctx.fillStyle = C.leaf;
        ctx.globalAlpha = i === top ? 1 : 0.75; ctx.fillRect(x, y, Math.max(0, ww - 1), bh); ctx.globalAlpha = 1;
        if (ww > 38) { ctx.fillStyle = '#fff'; ctx.font = '600 12px PingFang SC, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${d.w[i]} ${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`, x + ww / 2, y + bh / 2); }
        x += ww;
      });
      ctx.fillStyle = C.slate; ctx.font = '11px PingFang SC, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`原始：${d.w.map((t, i) => `${t} ${(d.p[i] * 100).toFixed(0)}%`).join('，')}`, l, y + bh + 2);
    });
  });
  const histCv = LAB.canvas('#g-hist', (ctx, w, h) => {
    const labels = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '≥10', '未停'];
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.6, xmax: 11.6, ymin: 0, ymax: 1000, xtickValues: [], ylabel: '句数', pad: { l: 46, r: 8, t: 14, b: 40 } }).axes();
    if (!many) { P.text(5.5, 500, '点左侧“抽 1000 句统计”', C.slate, 'center', 'middle', '13px PingFang SC, sans-serif'); return; }
    P.bars(M.range(12), many.cnt, M.range(12).map((i) => (i === 11 ? C.c4 : C.c1)), Math.max(6, (P.x1 - P.x0) / 16), 0);
    ctx.fillStyle = C.ink; ctx.font = '11px PingFang SC, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    labels.forEach((t, i) => ctx.fillText(t, P.tx(i), P.y0 + 6));
    P.text(11.4, 940, `画上句号 ${(many.ended / 10).toFixed(1)}%`, C.navy, 'right', 'middle', '600 12px PingFang SC, sans-serif');
    P.text(11.4, 850, `平均复读 ${many.mean.toFixed(2)} 遍（T = ${G1.T.toFixed(2)}）`, C.slate, 'right', 'middle', '12px PingFang SC, sans-serif');
  });
  // 两步树枝
  const TR = { pa: 0.6, a2: 0.2, b2: 0.9 };
  LAB.slider('#t-pa', { label: '第 1 步词 A 的概率（B = 1 − A）', min: 0.5, max: 0.95, step: 0.05, value: 0.6, fmt: (v) => v.toFixed(2), onInput: (v) => { TR.pa = v; treeCv.redraw(); } });
  LAB.slider('#t-a2', { label: 'A 之后最好的词的概率', min: 0.05, max: 1, step: 0.05, value: 0.2, fmt: (v) => v.toFixed(2), onInput: (v) => { TR.a2 = v; treeCv.redraw(); } });
  LAB.slider('#t-b2', { label: 'B 之后最好的词的概率', min: 0.05, max: 1, step: 0.05, value: 0.9, fmt: (v) => v.toFixed(2), onInput: (v) => { TR.b2 = v; treeCv.redraw(); } });
  const treeCv = LAB.canvas('#t-tree', (ctx, w, h) => {
    const pa = TR.pa, pb = 1 - pa, A = pa * TR.a2, B = pb * TR.b2, win = A >= B ? 'A' : 'B';
    const node = (x, y, t, col, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r || 17, 0, 2 * Math.PI); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '600 13px PingFang SC, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); };
    const edge = (x0, y0, x1, y1, lab, col, bold) => { LAB.arrow(ctx, x0, y0, x1, y1, col, bold ? 3 : 1.6, 8); ctx.fillStyle = col; ctx.font = '600 12px Avenir Next, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(lab, (x0 + x1) / 2, (y0 + y1) / 2 - 4); };
    const x0 = 34, x1 = w * 0.42, x2 = w * 0.74, yA = h * 0.28, yB = h * 0.72;
    node(x0, h / 2, '起', C.navy);
    edge(x0 + 18, h / 2 - 8, x1 - 19, yA + 6, pa.toFixed(2), C.c4, true);
    edge(x0 + 18, h / 2 + 8, x1 - 19, yB - 6, pb.toFixed(2), C.c3, false);
    node(x1, yA, 'A', C.c4); node(x1, yB, 'B', C.c3);
    edge(x1 + 18, yA, x2 - 19, yA, TR.a2.toFixed(2), C.c4, win === 'A');
    edge(x1 + 18, yB, x2 - 19, yB, TR.b2.toFixed(2), C.c3, win === 'B');
    node(x2, yA, '…', C.c4, 15); node(x2, yB, '…', C.c3, 15);
    ctx.font = '600 15px Avenir Next, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = win === 'A' ? C.c4 : C.slate; ctx.fillText(A.toFixed(3), x2 + 24, yA);
    ctx.fillStyle = win === 'B' ? C.c3 : C.slate; ctx.fillText(B.toFixed(3), x2 + 24, yB);
    ctx.font = '12px PingFang SC, sans-serif'; ctx.fillStyle = C.slate; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`贪心走 A；整句概率 ${win === 'B' ? `B 是 A 的 ${(B / A).toFixed(1)} 倍` : 'A 也确实更高'}`, w / 2, h - 22);
  });
  showChain(chain(null, true), '贪心解码每步只挑第 1 名：句尾“知道”后面永远选 45% 的“我”，一脚踩进环路，直到 40 个词的上限。');

  /* ================= 实验 2：温度与 Top-p 筛子 ================= */
  const ln = Math.log;
  const CTX = [
    { name: '(4, 2, 0)', short: '(4, 2, 0)', text: '书中 12.2 节：三个候选词“好、棒、妙”的打分是 $(4, 2, 0)$。',
      words: ['好', '棒', '妙'], logits: [4, 2, 0] },
    { name: '今天天气真', short: '天气真…', text: '“今天天气真<b>＿＿</b>”：书中 Top-$p$ 算例，$T=1$ 时 5 个词依次是 55%、25%、12%、5%、3%。',
      words: ['好', '晴', '棒', '火锅', '挖掘机'], logits: [0.55, 0.25, 0.12, 0.05, 0.03].map(ln) },
    { name: '床前明月', short: '床前明月…', text: '“床前明月<b>＿＿</b>”：答案唯一，“光”独占 99%，4 个错别字合计 1%。',
      words: ['光', '广', '逛', '咣', '晃'], logits: [0.99, 0.0025, 0.0025, 0.0025, 0.0025].map(ln) },
    { name: '周末我想去', short: '周末去…', text: '“今天周末我想去<b>＿＿</b>”：20 个去处全都合理，每个各占 5%。',
      words: ['公园', '看电影', '图书馆', '爬山', '海边', '逛街', '钓鱼', '健身房', '咖啡馆', '博物馆', '外婆家', '动物园', '游乐场', '书店', '露营', '游泳', '打球', '美术馆', '植物园', '奶茶店'],
      logits: new Array(20).fill(0) },
  ];
  let ctxI = 0, sampleCounts = null;
  LAB.segmented('#ctx-seg', CTX.map((c) => c.short), 0, (i) => { ctxI = i; sampleCounts = null; $('#sample-chips').innerHTML = ''; $('#sample-cap').textContent = '点左侧“采样 20 次”。'; update1(); });
  const tauS = LAB.slider('#tau-s', { label: '温度 $T$', min: 0.05, max: 3, step: 0.01, value: 1, fmt: (v) => v.toFixed(2), onInput: () => { sampleCounts = null; update1(); } });
  const kS = LAB.slider('#k-s', { label: 'Top-$K$', min: 1, max: 20, step: 1, value: 20, fmt: (v) => (v === 20 ? '20（关）' : v), onInput: () => { sampleCounts = null; update1(); } });
  const pS = LAB.slider('#p-s', { label: 'Top-$p$ 阈值 $p$', min: 0.05, max: 1, step: 0.01, value: 0.9, fmt: (v) => (v >= 1 ? '1（关）' : v.toFixed(2)), onInput: () => { sampleCounts = null; update1(); } });
  $('#btn-reset1').onclick = () => { tauS.set(1); kS.set(20); pS.set(0.9); sampleCounts = null; update1(); };
  $('#btn-greedy').onclick = () => { tauS.set(0.05); sampleCounts = null; update1(); };

  // 温度 → Top-k → Top-p → 重新归一化
  function decode(logits, tau, k, p) {
    const P = M.softmax(logits, tau);
    const order = M.range(P.length).sort((a, b) => P[b] - P[a]);
    const kk = Math.min(k, P.length);
    let massK = 0; for (let r = 0; r < kk; r++) massK += P[order[r]];
    const keep = new Array(P.length).fill(false);
    let cum = 0, n = 0, Z = 0;
    for (let r = 0; r < kk; r++) { const i = order[r]; keep[i] = true; n++; Z += P[i]; cum += P[i] / massK; if (cum >= p - 1e-12) break; }
    const Q = P.map((v, i) => (keep[i] ? v / Z : 0));
    return { P, Q, keep, order, n, cut: 1 - Z };
  }
  let D1 = null;
  const sN = LAB.stat('#stats-dec', '候选池大小 $|\\mathcal V\'|$');
  const sH = LAB.stat('#stats-dec', '采样分布的熵', 'plum');
  const sTop = LAB.stat('#stats-dec', '第一名的概率', 'amber');
  const sCut = LAB.stat('#stats-dec', '被截掉的概率', 'coral');

  const bars1 = LAB.canvas('#dec-bars', (ctx, w, h) => {
    const cx = CTX[ctxI], d = D1, V = cx.words.length;
    const stripH = 30, narrow = w < 560;
    const labH = narrow ? 44 : 26;
    const top = Math.max(...d.Q, ...d.P);
    const ymax = Math.min(1, Math.ceil(top * 11) / 10 + 0.0001);
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.6, xmax: V - 0.4, ymin: 0, ymax, xtickValues: [], yticks: 4, ylabel: '概率', pad: { l: 46, r: 8, t: 16, b: labH + stripH + 26 } }).axes();
    const step = P.tx(1) - P.tx(0), bw = step * 0.66;
    d.order.forEach((i, r) => {
      const kept = d.keep[i];
      // 截断前的“幽灵柱”
      ctx.save(); ctx.strokeStyle = kept ? C.c2 : GREY; ctx.fillStyle = kept ? C.c2l : C.mist; ctx.lineWidth = 1;
      const X = P.tx(r), Y = P.ty(d.P[i]);
      ctx.fillRect(X - bw / 2, Y, bw, P.y0 - Y); ctx.strokeRect(X - bw / 2 + 0.5, Y + 0.5, bw - 1, P.y0 - Y - 1); ctx.restore();
      if (kept) P.bars([r], [d.Q[i]], C.c2, bw * 0.56);
      const v = kept ? d.Q[i] : d.P[i];
      const lab = narrow ? (v >= 0.01 ? Math.round(v * 100) + '%' : '') : (v > 0.004 || kept) ? (v * 100 >= 10 ? (v * 100).toFixed(0) : (v * 100).toFixed(1)) + '%' : '';
      if (lab) P.text(r, Math.min(Math.max(v, d.P[i]), ymax * 0.97), lab, kept ? LAB.mix(C.amber, C.ink, 0.35) : C.slate, 'center', 'bottom', narrow ? '600 10px Avenir Next, sans-serif' : NUM);
      if (sampleCounts) { const f = sampleCounts[i] / 20; if (f > 0) { P.points([r], [f], C.navy, narrow ? 3.5 : 4.5, '#fff'); } }
      // 词标签
      ctx.save(); ctx.fillStyle = kept ? C.ink : GREY; ctx.font = (narrow ? '11px ' : '13px ') + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const word = cx.words[i];
      if (narrow) [...word].forEach((ch, j) => ctx.fillText(ch, X, P.y0 + 5 + j * 12));
      else ctx.fillText(word, X, P.y0 + 7);
      ctx.restore();
    });
    // 累积概率横条
    const sy = h - stripH - 4, sx0 = P.x0, sx1 = P.x1;
    let acc = 0;
    ctx.save();
    d.order.forEach((i) => {
      const a = sx0 + acc * (sx1 - sx0), b = sx0 + (acc + d.P[i]) * (sx1 - sx0);
      ctx.fillStyle = d.keep[i] ? C.c2 : C.mist; ctx.fillRect(a, sy, Math.max(0, b - a - 0.6), 16);
      if (b - a > 22) { ctx.fillStyle = d.keep[i] ? '#fff' : C.slate; ctx.font = '11px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(CTX[ctxI].words[i], (a + b) / 2, sy + 8.5); }
      acc += d.P[i];
    });
    const p = pS.get();
    if (p < 1) {
      const X = sx0 + p * (sx1 - sx0);
      ctx.strokeStyle = C.coral; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, sy - 5); ctx.lineTo(X, sy + 21); ctx.stroke();
      ctx.fillStyle = C.coral; ctx.font = NUM; ctx.textAlign = X > sx1 - 40 ? 'right' : 'center'; ctx.textBaseline = 'top'; ctx.fillText('p = ' + p.toFixed(2), X, sy + 21);
    }
    ctx.fillStyle = C.slate; ctx.font = '11px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('累积 0', sx0, sy + 19);
    ctx.textAlign = 'right'; if (p < 0.9) ctx.fillText('1', sx1, sy + 19);
    ctx.restore();
  });
  function update1() {
    D1 = decode(CTX[ctxI].logits, tauS.get(), kS.get(), pS.get());
    $('#ctx-text').innerHTML = CTX[ctxI].text; LAB.renderMath($('#ctx-text'));
    sN.set(`${D1.n}<small>/ ${CTX[ctxI].words.length}</small>`);
    sH.set(`${M.entropy(D1.Q).toFixed(3)}<small>nats</small>`);
    sTop.set(`${(Math.max(...D1.Q) * 100).toFixed(1)}<small>%</small>`);
    sCut.set(`${(D1.cut * 100).toFixed(D1.cut < 0.001 && D1.cut > 0 ? 3 : 1)}<small>%</small>`);
    bars1.redraw();
  }
  let seed1 = 1;
  $('#btn-sample').onclick = () => {
    const R = LAB.rng(1000 + seed1++), words = CTX[ctxI].words;
    sampleCounts = new Array(words.length).fill(0);
    const picks = M.range(20).map(() => R.choice(D1.Q));
    picks.forEach((i) => sampleCounts[i]++);
    $('#sample-chips').innerHTML = picks.map((i) => `<span class="pill" style="cursor:default;${i === D1.order[0] ? 'background:var(--c2l);border-color:var(--c2)' : ''}">${words[i]}</span>`).join('');
    const distinct = sampleCounts.filter((c) => c > 0).length;
    $('#sample-cap').innerHTML = `20 次里出现了 <b>${distinct}</b> 种不同的词；第一名“${words[D1.order[0]]}”被抽中 <b>${sampleCounts[D1.order[0]]}</b> 次。深蓝圆点是各词的抽中频率。`;
    bars1.redraw();
  };

  // ---- 玩具二元语法语言模型 ----
  const BIGRAM = {
    '<s>': { 今天: 3, 我们: 1.5, 周末: 1.5 },
    今天: { 天气: 3, 我们: 1.8, 心情: 1.2 },
    天气: { 真: 3, 很: 2.2, 不错: 1.5 },
    真: { 好: 3, 不错: 2.6, 热: 1.6 },
    很: { 好: 2.6, 不错: 2.4, 热: 1.8 },
    好: { '，': 3, '。': 2.4 },
    不错: { '，': 3, '。': 2.5 },
    热: { '，': 2.6, '。': 2.4 },
    '，': { 今天: 2.8, 我们: 2.5, 阳光: 1.8, 心情: 1.5 },
    '。': { 今天: 2.6, 我们: 2.4, 周末: 1.6, 阳光: 1.5 },
    '！': { 今天: 2.4, 我们: 2.2, 阳光: 1.6 },
    我们: { 去: 2.6, 一起: 2.3 },
    一起: { 去: 3 },
    去: { 公园: 2.6, 海边: 2.2, 爬山: 2.0 },
    公园: { 散步: 2.5, 吧: 1.5, '，': 1.2 },
    海边: { 吹风: 2.2, 散步: 2.0, 吧: 1.4 },
    爬山: { 吧: 2.4, '。': 1.8, '，': 1.5 },
    散步: { 吧: 2.6, '。': 2.0 },
    吹风: { 吧: 2.4, '。': 2.0 },
    吧: { '。': 3.2, '！': 1.8 },
    阳光: { 明媚: 3, 很: 1.5 },
    明媚: { '，': 3, '。': 2 },
    心情: { 也: 2.6, 很: 2.2, 真: 1.6 },
    也: { 很: 2.6, 真: 1.8, 不错: 1.2 },
    周末: { 我们: 2.6, 天气: 1.8 },
  };
  const JUNK = ['香蕉', '量子', '齿轮', '的的', '了吗', '蓝莓', '拖拉机', '呃', '函数', '桌子', '喵', '硬盘', '三角形', '螺丝'];
  const VOCAB = Array.from(new Set([...Object.keys(BIGRAM).filter((w) => w !== '<s>'), ...Object.values(BIGRAM).flatMap((o) => Object.keys(o)), ...JUNK]));
  const FLOOR = -4;
  function generate(seed) {
    const R = LAB.rng(seed), tau = tauS.get(), k = kS.get() >= 20 ? Infinity : kS.get(), p = pS.get();
    let prev = '<s>'; const out = []; let Hsum = 0;
    for (let t = 0; t < 30; t++) {
      const table = BIGRAM[prev] || {};
      const z = VOCAB.map((w) => (w in table ? table[w] : FLOOR));
      const d = decode(z, tau, k, p);
      Hsum += M.entropy(d.Q);
      const w = VOCAB[R.choice(d.Q)];
      out.push(w); prev = w;
    }
    return { out, H: Hsum / 30 };
  }
  let genSeed = 7;
  function runGen() {
    const g = generate(genSeed++);
    const bi = []; for (let i = 1; i < g.out.length; i++) bi.push(g.out[i - 1] + '|' + g.out[i]);
    const distinct = new Set(bi).size / bi.length;
    // 标出离谱词（不在任何合理后继里）
    let html = '', prev = '<s>';
    g.out.forEach((w) => {
      const ok = BIGRAM[prev] && w in BIGRAM[prev];
      html += ok ? w : `<span style="color:var(--coral);background:var(--c4l);border-radius:4px;padding:0 2px">${w}</span>`;
      prev = w;
    });
    $('#gen-text').innerHTML = html + '…';
    const bad = g.out.filter((w, i) => !(BIGRAM[i ? g.out[i - 1] : '<s>'] && w in BIGRAM[i ? g.out[i - 1] : '<s>'])).length;
    $('#gen-cap').innerHTML = `30 个词里：不重复的相邻词对占 <b>${(distinct * 100).toFixed(0)}%</b>（越低越像复读机），离谱跳转 <b style="color:var(--coral)">${bad}</b> 次（红底），平均每步熵 ${g.H.toFixed(2)} nats。当前 $T=${tauS.get().toFixed(2)}$，Top-$K$ ${kS.get()}，Top-$p$ ${pS.get().toFixed(2)}。`;
    LAB.renderMath($('#gen-cap'));
  }
  $('#btn-gen').onclick = runGen;
  update1();
  runGen();

  /* ================= 实验 3：DPO 一拉一踩 ================= */
  const L01 = Math.log(0.1);
  const REF = { w: L01, l: L01 };
  const pol = { w: L01, l: L01 };
  let trail = [];
  const betaS = LAB.slider('#beta-s', { label: '安全绳系数 $\\beta$', min: 0.05, max: 1, step: 0.01, value: 1, fmt: (v) => v.toFixed(2), onInput: update2 });
  const lpDefs = [
    ['$\\ln\\pi_{\\boldsymbol\\theta}(y_w\\mid x)$', 'pw'], ['$\\ln\\pi_{\\text{ref}}(y_w\\mid x)$', 'rw'],
    ['$\\ln\\pi_{\\boldsymbol\\theta}(y_l\\mid x)$', 'pl'], ['$\\ln\\pi_{\\text{ref}}(y_l\\mid x)$', 'rl'],
  ];
  const getLP = { pw: () => pol.w, rw: () => REF.w, pl: () => pol.l, rl: () => REF.l };
  const setLP = { pw: (v) => (pol.w = v), rw: (v) => (REF.w = v), pl: (v) => (pol.l = v), rl: (v) => (REF.l = v) };
  const lpS = {};
  lpDefs.forEach(([lab, key]) => { lpS[key] = LAB.slider('#lp-s', { label: lab, min: -12, max: -0.05, step: 0.0001, value: getLP[key](), fmt: (v) => `${v.toFixed(3)}<small>（概率 ${Math.exp(v) >= 0.001 ? Math.exp(v).toFixed(4) : Math.exp(v).toExponential(1)}）</small>`, onInput: (v) => { setLP[key](v); trail = []; update2(); } }); });
  const etaS = LAB.slider('#eta-s', { label: '学习率 $\\eta$', min: 0.05, max: 3, step: 0.05, value: 0.5, fmt: (v) => v.toFixed(2), onInput: () => {} });
  const st2 = {
    dw: LAB.stat('#stats-dpo', '$\\Delta_w$ 好回答涨幅'), dl: LAB.stat('#stats-dpo', '$\\Delta_l$ 坏回答涨幅'),
    m: LAB.stat('#stats-dpo', '隐式奖励差 $\\beta u$', 'teal'), L: LAB.stat('#stats-dpo', '$\\mathcal L_{\\text{DPO}}$', 'coral'),
    g: LAB.stat('#stats-dpo', '纠错权重 $\\sigma(-\\beta u)$', 'amber'), pr: LAB.stat('#stats-dpo', '$P(y_w\\succ y_l)$', 'plum'),
  };
  const dw = () => pol.w - REF.w, dl = () => pol.l - REF.l;
  function step2() {
    const beta = betaS.get(), u = dw() - dl(), g = beta * sigmoid(-beta * u), eta = etaS.get();
    if (!trail.length) trail.push([dw(), dl()]);
    pol.w = Math.min(-0.05, pol.w + eta * g); pol.l = Math.max(-12, pol.l - eta * g);
    trail.push([dw(), dl()]);
    lpS.pw.set(pol.w); lpS.pl.set(pol.l);
    update2();
  }
  let frameSkip = 0;
  const trainLoop = anim('dpo', () => { if (++frameSkip % 4) return true; step2(); return softplus(-betaS.get() * (dw() - dl())) > 0.02 && Math.abs(dw()) < 4.8 && Math.abs(dl()) < 4.8 && pol.w < -0.06; }, () => { $('#btn-train').textContent = '连续训练'; });
  $('#btn-step').onclick = step2;
  $('#btn-train').onclick = () => { if (trainLoop.running) trainLoop.stop(); else { trainLoop.start(); $('#btn-train').textContent = '暂停'; } };
  $('#btn-reset2').onclick = () => { trainLoop.stop(); REF.w = L01; REF.l = L01; pol.w = L01; pol.l = L01; betaS.set(1); trail = []; Object.keys(lpS).forEach((k) => lpS[k].set(getLP[k]())); update2(); };
  $('#btn-book2').onclick = () => { trainLoop.stop(); REF.w = L01; REF.l = L01; pol.w = Math.log(0.2718); pol.l = Math.log(0.0368); betaS.set(1); trail = []; Object.keys(lpS).forEach((k) => lpS[k].set(getLP[k]())); update2(); };

  const curve2 = LAB.canvas('#dpo-curve', (ctx, w, h) => {
    const beta = betaS.get(), U = Math.min(20, Math.max(5, 5 / beta));
    const P = new LAB.Plot(ctx, w, h, { xmin: -U, xmax: U, ymin: 0, ymax: 3, xlabel: 'u = Δw − Δl（对数概率涨幅之差）', ylabel: '损失 / 权重', pad: { l: 42, r: 10, t: 10, b: 38 } }).axes();
    P.clip();
    [0.1, 0.5, 1].filter((b) => Math.abs(b - beta) > 0.02).forEach((b) => P.fn((u) => softplus(-b * u), GREY, 1.2, [4, 4]));
    P.fn((u) => sigmoid(-beta * u), C.c1, 2, [6, 4]);
    P.fn((u) => softplus(-beta * u), C.c4, 2.6);
    P.unclip();
    P.vline(0, C.slate, [2, 3], 1);
    const u = dw() - dl(), uc = M.clamp(u, -U, U), L = softplus(-beta * u);
    P.points([uc], [Math.min(L, 2.95)], C.c4, 5.5, '#fff');
    P.points([uc], [sigmoid(-beta * u)], C.c1, 4.5, '#fff');
    P.text(uc + (uc > 4 ? -0.6 : 0.6), Math.min(L, 2.6) + 0.22, `L = ${L.toFixed(3)}`, C.c4, uc > 4 ? 'right' : 'left', 'bottom', NUM);
    P.text(U * 0.97, 2.85, `β = ${beta.toFixed(2)}`, C.slate, 'right', 'middle', NUM);
  });
  let surfPlot = null;
  const surf2 = LAB.canvas('#dpo-surf', (ctx, w, h) => {
    const beta = betaS.get(), R = 5;
    const P = new LAB.Plot(ctx, w, h, { xmin: -R, xmax: R, ymin: -R, ymax: R, xlabel: 'Δw = ln πθ(yw)/πref(yw)', ylabel: 'Δl', grid: false, pad: { l: 40, r: 10, t: 10, b: 38 } });
    surfPlot = P;
    const n = 64, cw = (P.x1 - P.x0) / n, ch = (P.y0 - P.y1) / n, Lmax = softplus(2 * R * beta);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const x = -R + (a + 0.5) * 2 * R / n, y = -R + (b + 0.5) * 2 * R / n;
      const L = softplus(-beta * (x - y));
      ctx.fillStyle = LAB.heat(Math.min(1, L / Lmax) * 0.9);
      ctx.fillRect(P.x0 + a * cw, P.y0 - (b + 1) * ch, cw + 0.6, ch + 0.6);
    }
    P.axes();
    P.clip();
    [0.05, 0.2, Math.LN2, 1.5, 3].forEach((L) => {
      const u = -Math.log(Math.expm1(L)) / beta; // Δw − Δl = u
      P.line([-R, R], [-R - u, R - u], L === Math.LN2 ? C.amber : 'rgba(29,53,87,.35)', L === Math.LN2 ? 1.8 : 1, [4, 3]);
    });
    P.text(-R * 0.55, -R * 0.55 + 0.6, 'L = ln 2', C.amber, 'center', 'bottom', NUM);
    if (trail.length > 1) P.line(trail.map((t) => t[0]), trail.map((t) => t[1]), C.c4, 2);
    P.unclip();
    const x = M.clamp(dw(), -R, R), y = M.clamp(dl(), -R, R);
    P.points([x], [y], C.c4, 6.5, '#fff');
    const sgx = 1.8;
    LAB.arrow(ctx, P.tx(x), P.ty(y), P.tx(x + sgx), P.ty(y - sgx), C.coral, 2, 7);
    P.text(-R * 0.94, R * 0.9, '左上：差回答更受宠', '#fff', 'left', 'middle', '600 12px ' + FONT);
    P.text(R * 0.94, -R * 0.9, '右下：损失 → 0', C.navy, 'right', 'middle', '12px ' + FONT);
  });
  drag(surf2.canvas, (type, px, py) => {
    if (type === 'up' || !surfPlot) return;
    const P = surfPlot, a = M.clamp(P.ix(px), -5, 5), b = M.clamp(P.iy(py), -5, 5);
    pol.w = M.clamp(REF.w + a, -12, -0.05); pol.l = M.clamp(REF.l + b, -12, -0.05);
    lpS.pw.set(pol.w); lpS.pl.set(pol.l); trail = []; update2();
  });
  function update2() {
    const beta = betaS.get(), u = dw() - dl();
    st2.dw.set(dw().toFixed(2)); st2.dl.set(dl().toFixed(2));
    st2.m.set((beta * u).toFixed(3)); st2.L.set(softplus(-beta * u).toFixed(3));
    st2.g.set(sigmoid(-beta * u).toFixed(3)); st2.pr.set(`${(sigmoid(beta * u) * 100).toFixed(1)}<small>%</small>`);
    curve2.redraw(); surf2.redraw();
  }
  update2();

})();
