/* 第 12 章：解码、生成与人类对齐：交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §12.2 温度与 Top-p · §12.3 DPO · §12.4 投机采样' });

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

  /* ================= 实验 1：温度、Top-k 与 Top-p ================= */
  const CTX = [
    { name: '今天天气真', short: '天气真…', text: '“今天天气真<b>＿＿</b>”：好几个词都说得通，属于半开放语境。',
      words: ['好', '不错', '热', '冷', '棒', '晴朗', '糟糕', '闷', '舒服', '奇怪', '香蕉', '的'],
      logits: [4.0, 3.4, 2.9, 2.5, 2.0, 1.6, 1.1, 0.7, 0.4, -0.8, -2.6, -3.0] },
    { name: '中国的首都是', short: '首都是…', text: '“中国的首都是<b>＿＿</b>”：答案唯一，模型胸有成竹。',
      words: ['北京', '南京', '上海', '哪里', '西安', '一座', '北', '东京', '首尔', '香蕉', '的', '。'],
      logits: [9.0, 2.2, 1.6, 0.9, 0.3, -0.3, -0.8, -1.2, -1.6, -3.0, -3.2, -3.5] },
    { name: '周末我喜欢去', short: '周末去…', text: '“周末我喜欢去<b>＿＿</b>”：开放问题，前十几个词都很合理。',
      words: ['公园', '爬山', '看电影', '图书馆', '海边', '逛街', '钓鱼', '健身房', '咖啡馆', '博物馆', '外婆家', '香蕉'],
      logits: [2.4, 2.3, 2.2, 2.0, 1.9, 1.8, 1.6, 1.5, 1.4, 1.3, 1.0, -2.5] },
  ];
  let ctxI = 0, sampleCounts = null;
  LAB.segmented('#ctx-seg', CTX.map((c) => c.short), 0, (i) => { ctxI = i; sampleCounts = null; $('#sample-chips').innerHTML = ''; $('#sample-cap').textContent = '点左侧“采样 20 次”。'; update1(); });
  const tauS = LAB.slider('#tau-s', { label: '温度 $\\tau$', min: 0.05, max: 3, step: 0.01, value: 1, fmt: (v) => v.toFixed(2), onInput: () => { sampleCounts = null; update1(); } });
  const kS = LAB.slider('#k-s', { label: 'Top-k', min: 1, max: 12, step: 1, value: 12, fmt: (v) => (v === 12 ? '12（关）' : v), onInput: () => { sampleCounts = null; update1(); } });
  const pS = LAB.slider('#p-s', { label: 'Top-p 阈值 $p$', min: 0.05, max: 1, step: 0.01, value: 0.9, fmt: (v) => (v >= 1 ? '1（关）' : v.toFixed(2)), onInput: () => { sampleCounts = null; update1(); } });
  $('#btn-reset1').onclick = () => { tauS.set(1); kS.set(12); pS.set(0.9); sampleCounts = null; update1(); };
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
    $('#ctx-text').innerHTML = CTX[ctxI].text;
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
    const R = LAB.rng(seed), tau = tauS.get(), k = kS.get() >= 12 ? Infinity : kS.get(), p = pS.get();
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
    $('#gen-cap').innerHTML = `30 个词里：不重复的相邻词对占 <b>${(distinct * 100).toFixed(0)}%</b>（越低越像复读机），离谱跳转 <b style="color:var(--coral)">${bad}</b> 次（红底），平均每步熵 ${g.H.toFixed(2)} nats。当前 $\\tau=${tauS.get().toFixed(2)}$，Top-k ${kS.get()}，Top-p ${pS.get().toFixed(2)}。`;
    LAB.renderMath($('#gen-cap'));
  }
  $('#btn-gen').onclick = runGen;
  update1();
  runGen();

  /* ================= 实验 2：DPO ================= */
  const REF = { w: -14.0, l: -11.0 };
  const pol = { w: -14.0, l: -11.0 };
  let trail = [];
  const betaS = LAB.slider('#beta-s', { label: 'KL 惩罚系数 $\\beta$', min: 0.05, max: 1, step: 0.01, value: 0.1, fmt: (v) => v.toFixed(2), onInput: update2 });
  const lpDefs = [
    ['$\\ln\\pi_{\\boldsymbol\\theta}(y_w\\mid x)$', 'pw'], ['$\\ln\\pi_{\\text{ref}}(y_w\\mid x)$', 'rw'],
    ['$\\ln\\pi_{\\boldsymbol\\theta}(y_l\\mid x)$', 'pl'], ['$\\ln\\pi_{\\text{ref}}(y_l\\mid x)$', 'rl'],
  ];
  const getLP = { pw: () => pol.w, rw: () => REF.w, pl: () => pol.l, rl: () => REF.l };
  const setLP = { pw: (v) => (pol.w = v), rw: (v) => (REF.w = v), pl: (v) => (pol.l = v), rl: (v) => (REF.l = v) };
  const lpS = {};
  lpDefs.forEach(([lab, key]) => { lpS[key] = LAB.slider('#lp-s', { label: lab, min: -30, max: -2, step: 0.1, value: getLP[key](), fmt: (v) => v.toFixed(1), onInput: (v) => { setLP[key](v); trail = []; update2(); } }); });
  const etaS = LAB.slider('#eta-s', { label: '学习率 $\\eta$', min: 1, max: 40, step: 1, value: 15, onInput: () => {} });
  const st2 = {
    dw: LAB.stat('#stats-dpo', '$\\Delta_w$ 好回答涨幅'), dl: LAB.stat('#stats-dpo', '$\\Delta_l$ 坏回答涨幅'),
    m: LAB.stat('#stats-dpo', '隐式奖励差 $\\beta u$', 'teal'), L: LAB.stat('#stats-dpo', '$\\mathcal L_{\\text{DPO}}$', 'coral'),
    g: LAB.stat('#stats-dpo', '纠错权重 $\\sigma(-\\beta u)$', 'amber'), pr: LAB.stat('#stats-dpo', '$P(y_w\\succ y_l)$', 'plum'),
  };
  const dw = () => pol.w - REF.w, dl = () => pol.l - REF.l;
  function step2() {
    const beta = betaS.get(), u = dw() - dl(), g = beta * sigmoid(-beta * u), eta = etaS.get();
    if (!trail.length) trail.push([dw(), dl()]);
    pol.w = Math.min(-0.5, pol.w + eta * g); pol.l = Math.max(-60, pol.l - eta * g);
    trail.push([dw(), dl()]);
    lpS.pw.set(pol.w); lpS.pl.set(pol.l);
    update2();
  }
  let frameSkip = 0;
  const trainLoop = anim('dpo', () => { if (++frameSkip % 4) return true; step2(); return softplus(-betaS.get() * (dw() - dl())) > 0.05 && Math.abs(dw()) < 9.5 && Math.abs(dl()) < 9.5; }, () => { $('#btn-train').textContent = '连续训练'; });
  $('#btn-step').onclick = step2;
  $('#btn-train').onclick = () => { if (trainLoop.running) trainLoop.stop(); else { trainLoop.start(); $('#btn-train').textContent = '暂停'; } };
  $('#btn-reset2').onclick = () => { trainLoop.stop(); REF.w = -14; REF.l = -11; pol.w = -14; pol.l = -11; trail = []; Object.keys(lpS).forEach((k) => lpS[k].set(getLP[k]())); update2(); };

  const curve2 = LAB.canvas('#dpo-curve', (ctx, w, h) => {
    const beta = betaS.get(), U = 20;
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
    const beta = betaS.get(), R = 10;
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
    P.text(-R * 0.94, R * 0.9, '左上：坏回答更受宠', '#fff', 'left', 'middle', '600 12px ' + FONT);
    P.text(R * 0.94, -R * 0.9, '右下：损失 → 0', C.navy, 'right', 'middle', '12px ' + FONT);
  });
  drag(surf2.canvas, (type, px, py) => {
    if (type === 'up' || !surfPlot) return;
    const P = surfPlot, a = M.clamp(P.ix(px), -10, 10), b = M.clamp(P.iy(py), -10, 10);
    pol.w = M.clamp(REF.w + a, -30, -2); pol.l = M.clamp(REF.l + b, -30, -2);
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

  /* ================= 实验 3：投机采样 ================= */
  const FOODS = ['火锅', '面条', '饺子', '米饭', '披萨', '沙拉'];
  const pT = [0.40, 0.22, 0.15, 0.12, 0.07, 0.04];
  const PRESETS = [
    { name: '默契草稿', q: [0.30, 0.30, 0.10, 0.10, 0.15, 0.05] },
    { name: '过度自信', q: [0.85, 0.05, 0.04, 0.03, 0.02, 0.01] },
    { name: '南辕北辙', q: [0.03, 0.05, 0.07, 0.10, 0.35, 0.40] },
    { name: '$q=p$', q: pT.slice() },
  ];
  let qD = PRESETS[0].q.slice(), mc = null;
  LAB.segmented('#spec-seg', PRESETS.map((p) => p.name), 0, (i) => { qD = PRESETS[i].q.slice(); mc = null; resetMcCap(); update3(); });
  const gammaS = LAB.slider('#gamma-s', { label: '草稿长度 $\\gamma$', min: 1, max: 12, step: 1, value: 5, onInput: () => { update3(); } });
  const costS = LAB.slider('#cost-s', { label: '成本比 $c$（小模型 / 大模型）', min: 0, max: 0.5, step: 0.01, value: 0.05, fmt: (v) => v.toFixed(2), onInput: () => update3() });
  const s3 = {
    a: LAB.stat('#stats-spec', '接受率 $\\alpha=1-D_{\\text{TV}}$', 'teal'),
    e: LAB.stat('#stats-spec', '每次迭代产出词数'), sp: LAB.stat('#stats-spec', '加速比', 'leaf'), g: LAB.stat('#stats-spec', '最佳 $\\gamma^*$', 'amber'),
  };
  const alphaOf = () => M.sum(pT.map((p, i) => Math.min(p, qD[i])));
  const expTok = (a, g) => (a >= 1 - 1e-12 ? g + 1 : (1 - Math.pow(a, g + 1)) / (1 - a));
  const speed = (a, g, c) => expTok(a, g) / (g * c + 1);
  function residual() { const r = pT.map((p, i) => Math.max(0, p - qD[i])); const s = M.sum(r); return s > 1e-12 ? r.map((v) => v / s) : r.map(() => 0); }
  function resetMcCap() { $('#mc-cap').innerHTML = '点“蒙特卡洛验证”：按“接受或从残差补抽”的规则真实抽样，看看输出频率是否等于 $p$。'; LAB.renderMath($('#mc-cap')); }

  let barPlot = null, dragI = -1;
  const bars3 = LAB.canvas('#spec-bars', (ctx, w, h) => {
    const n = FOODS.length, res = residual();
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.6, xmax: n - 0.4, ymin: 0, ymax: 1, xtickValues: [], yticks: 5, ylabel: '概率', pad: { l: 44, r: 8, t: 22, b: 30 } }).axes();
    barPlot = P;
    const step = P.tx(1) - P.tx(0), bw = Math.min(26, step * 0.24);
    FOODS.forEach((f, i) => {
      const X = P.tx(i);
      // 公共部分 min(p,q) 的底色
      const mn = Math.min(pT[i], qD[i]);
      ctx.save(); ctx.fillStyle = C.c3l; ctx.fillRect(X - bw * 1.5 - 3, P.ty(mn), bw * 2 + 3, P.y0 - P.ty(mn)); ctx.restore();
      P.bars([i - bw / step], [pT[i]], C.c1, bw);
      P.bars([i + 0], [qD[i]], i === dragI ? C.amber : C.c2, bw);
      P.bars([i + bw / step + 0.02], [res[i]], LAB.mix(C.c4, '#ffffff', 0.25), bw * 0.8);
      const acc = qD[i] > 0 ? Math.min(1, pT[i] / qD[i]) : NaN;
      P.text(i, Math.max(pT[i], qD[i], res[i]) + 0.02, isFinite(acc) ? (acc * 100).toFixed(0) + '%' : '—', acc >= 1 ? C.leaf : C.coral, 'center', 'bottom', NUM);
      ctx.save(); ctx.fillStyle = C.ink; ctx.font = '13px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(f, X, P.y0 + 7); ctx.restore();
    });
    P.text(n - 0.45, 0.95, '浅绿底 = min(p, q)，其总面积就是 α', C.slate, 'right', 'middle', '11.5px ' + FONT);
  });
  drag(bars3.canvas, (type, px, py) => {
    if (type === 'up') { dragI = -1; bars3.redraw(); return; }
    const P = barPlot; if (!P) return;
    if (type === 'down') dragI = M.clamp(Math.round(P.ix(px)), 0, FOODS.length - 1);
    const v = M.clamp(P.iy(py), 0.0, 0.97);
    const rest = qD.reduce((a, x, j) => a + (j === dragI ? 0 : x), 0);
    qD = qD.map((x, j) => (j === dragI ? v : rest > 1e-9 ? (x * (1 - v)) / rest : (1 - v) / (FOODS.length - 1)));
    mc = null; resetMcCap(); update3();
  });
  let speedPlot = null;
  const speed3 = LAB.canvas('#spec-speed', (ctx, w, h) => {
    const a = alphaOf(), c = costS.get(), G = 12, g = gammaS.get();
    const gs = M.range(G).map((i) => i + 1);
    const E = gs.map((x) => expTok(a, x)), S = gs.map((x) => speed(a, x, c));
    const ymax = Math.max(2, Math.ceil(Math.max(...E, ...S) + 0.5));
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.5, xmax: G + 0.5, ymin: 0, ymax, xtickValues: [1, 3, 5, 7, 9, 11], xlabel: '草稿长度 γ', pad: { l: 36, r: 10, t: 12, b: 38 } }).axes();
    speedPlot = P;
    P.hline(1, C.slate, [3, 3], 1);
    P.line(gs, E, C.c1, 2); P.points(gs, E, C.c1, 3);
    P.line(gs, S, C.c3, 2.4); P.points(gs, S, C.c3, 3.2);
    const best = gs[S.indexOf(Math.max(...S))];
    P.vline(g, C.amber, [4, 3], 1.4);
    P.points([g], [speed(a, g, c)], C.c3, 6, '#fff'); P.points([g], [expTok(a, g)], C.c1, 5, '#fff');
    P.text(best, Math.max(...S) + ymax * 0.06, 'γ* = ' + best, C.leaf, 'center', 'bottom', NUM);
  });
  drag(speed3.canvas, (type, px) => { if (type === 'up' || !speedPlot) return; const g = M.clamp(Math.round(speedPlot.ix(px)), 1, 12); if (g !== gammaS.get()) { gammaS.set(g); update3(); } });
  const mc3 = LAB.canvas('#spec-mc', (ctx, w, h) => {
    const n = FOODS.length;
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.6, xmax: n - 0.4, ymin: 0, ymax: Math.max(0.5, Math.ceil(Math.max(...pT, ...qD) * 10 + 0.5) / 10), xtickValues: [], yticks: 4, pad: { l: 36, r: 8, t: 12, b: 28 } }).axes();
    const step = P.tx(1) - P.tx(0), bw = step * 0.5;
    FOODS.forEach((f, i) => {
      const X = P.tx(i), Y = P.ty(pT[i]);
      if (mc) P.bars([i], [mc.freq[i]], C.c6, bw * 0.62);
      ctx.save(); ctx.strokeStyle = C.c1; ctx.lineWidth = 1.6; ctx.strokeRect(X - bw / 2, Y, bw, P.y0 - Y); ctx.restore();
      P.points([i + 0.36], [qD[i]], C.c2, 3.5);
      ctx.save(); ctx.fillStyle = C.ink; ctx.font = '12px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(f, X, P.y0 + 6); ctx.restore();
    });
    P.text(n - 0.45, P.o.ymax * 0.93, mc ? '蓝框 = p　青柱 = 实测输出　琥珀点 = q' : '蓝框 = p　琥珀点 = q', C.slate, 'right', 'middle', '11.5px ' + FONT);
  });
  $('#btn-mc').onclick = () => {
    const R = LAB.rng(4242 + Math.floor(Math.random() * 1e6)), res = residual(), Ntrial = 20000;
    const cnt = new Array(FOODS.length).fill(0);
    let accN = 0;
    for (let t = 0; t < Ntrial; t++) {
      const x = R.choice(qD);
      if (R() < Math.min(1, pT[x] / qD[x])) { cnt[x]++; accN++; } else cnt[R.choice(res)]++;
    }
    // 多词块：每次迭代产出的词数
    const g = gammaS.get(), Nit = 5000; let tok = 0;
    for (let it = 0; it < Nit; it++) {
      let k = 0;
      for (; k < g; k++) { const x = R.choice(qD); if (!(R() < Math.min(1, pT[x] / qD[x]))) break; }
      tok += k + 1; // 被拒时补 1 个残差词；全部接受时大模型再送 1 个
    }
    const freq = cnt.map((c) => c / Ntrial);
    const tv = 0.5 * M.sum(freq.map((f, i) => Math.abs(f - pT[i])));
    const tvq = 0.5 * M.sum(qD.map((f, i) => Math.abs(f - pT[i])));
    mc = { freq };
    const a = alphaOf();
    $('#mc-cap').innerHTML = `抽样 ${Ntrial.toLocaleString()} 次：实测接受率 <b>${(accN / Ntrial).toFixed(3)}</b>（理论 α = ${a.toFixed(3)}）；输出与 $p$ 的全变差只有 <b>${tv.toFixed(4)}</b>，而 $q$ 与 $p$ 相差 ${tvq.toFixed(3)}。再模拟 ${Nit} 次 γ = ${g} 的完整迭代：平均每次产出 <b>${(tok / Nit).toFixed(3)}</b> 个词，公式给出 ${expTok(a, g).toFixed(3)}。`;
    LAB.renderMath($('#mc-cap'));
    mc3.redraw();
  };
  function update3() {
    const a = alphaOf(), g = gammaS.get(), c = costS.get();
    let best = 1; for (let x = 2; x <= 12; x++) if (speed(a, x, c) > speed(a, best, c)) best = x;
    s3.a.set(a.toFixed(3));
    s3.e.set(`${expTok(a, g).toFixed(2)}<small>词</small>`); s3.sp.set(`${speed(a, g, c).toFixed(2)}<small>×</small>`);
    s3.g.set(best);
    bars3.redraw(); speed3.redraw(); mc3.redraw();
  }
  update3();
})();
