/* 第 1 章：概率：大模型到底在算什么 · 交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §1.1 自回归分解 · §1.2 下溢与对数 · §1.3 交叉熵与 KL · §1.4 困惑度 · 开篇故事' });
  // 窄屏下长公式与宽表格改为横向滚动，不撑破版面（position: relative 让 KaTeX 隐藏的 MathML 也被裁在框内）
  document.querySelectorAll('.formula, [style*="overflow-x"]').forEach((f) => { f.style.width = '0'; f.style.minWidth = '100%'; f.style.position = 'relative'; });
  const $ = (s) => document.querySelector(s);
  const FONT = getComputedStyle(document.body).getPropertyValue('--font');
  const NUMF = getComputedStyle(document.body).getPropertyValue('--font-num');
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (e) => String(e).split('').map((ch) => SUP[ch] || ch).join('');
  const neg = (s) => String(s).replace(/^-/, '−');
  const fx = (x, d) => neg((Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x).toFixed(d)); // 固定小数位，负号用 “−”
  const tr = (x, d) => neg(String(+x.toFixed(d)));                                       // 去掉末尾的 0
  const sci = (x, d) => neg(M.fmt(x, d));
  const unseg = (s) => s.el.querySelectorAll('button').forEach((b) => b.classList.remove('active'));

  /* ================= 实验 1：罚单、熵与 KL 散度 ================= */
  // ---------- A：太阳从＿＿边升起
  let qA = 0.01;
  const roundQ = (x) => Math.min(1, +x.toPrecision(3));
  const fq = (q) => (Math.abs(q * 100 - Math.round(q * 100)) < 1e-7 ? q.toFixed(2) : String(+q.toPrecision(3)));
  const fg = (g) => (g === 0 ? '0' : Math.abs(g) < 1e-3 ? sci(g, 2) : fx(g, 4));
  const PRE_A = [0.99, 0.5, 0.01, 0.0001];
  const segA = LAB.segmented('#a-preset', PRE_A.map(fq), 2, (i) => { qA = PRE_A[i]; sA.set(Math.log10(qA)); updA(); });
  const sA = LAB.slider('#a-q', {
    label: '模型给“东”的概率 $Q(\\text{东})$', min: -4, max: 0, step: 0.001, value: Math.log10(qA),
    fmt: (v) => fq(Math.abs(Math.log10(qA) - v) < 6e-4 ? qA : roundQ(Math.pow(10, v))),
    hint: '对数刻度：最左 0.0001，最右 1', onInput: (v) => { qA = roundQ(Math.pow(10, v)); unseg(segA); updA(); },
  });
  const stA = [LAB.stat('#a-stats', '交叉熵罚单 $-\\ln Q(\\text{东})$', 'coral'), LAB.stat('#a-stats', '平方误差罚单 $\\tfrac12(1-Q)^2$', ''),
    LAB.stat('#a-stats', '交叉熵传给 logit 的梯度 $Q-1$', 'coral'), LAB.stat('#a-stats', '平方误差传给 logit 的梯度', '')];
  function updA() {
    const q = qA, ce = -Math.log(q), sq = 0.5 * (1 - q) * (1 - q), g1 = q - 1, g2 = -(1 - q) * q * (1 - q);
    stA[0].set(`${fx(ce, 3)}<small>nats</small>`);
    stA[1].set(fx(sq, 3));
    stA[2].set(fx(g1, 3));
    const r = q > 0 && q < 1 ? 1 / (q * (1 - q)) : NaN;
    stA[3].set(fg(g2) + (isFinite(r) ? `<small>弱 ${r >= 10 ? Math.round(r).toLocaleString() : r.toFixed(1)} 倍</small>` : ''));
    $('#a-sub').textContent = `Q(东) = ${fq(q)}`;
    penA.redraw(); gradA.redraw();
  }
  const penA = LAB.canvas('#a-pen', (ctx, w, h) => {
    const YM = 6, q = qA, ce = -Math.log(q), sq = 0.5 * (1 - q) * (1 - q);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: 0, ymax: YM, xlabel: '模型给“东”的概率 Q', ylabel: '罚单', pad: { l: 40, r: 12, t: 12, b: 38 } }).axes();
    P.clip();
    const xs = M.linspace(0.0005, 1, 500);
    P.area(xs, xs.map((x) => -Math.log(x)), C.c4, 0.08);
    P.line(xs, xs.map((x) => -Math.log(x)), C.c4, 2.4);
    P.fn((x) => 0.5 * (1 - x) * (1 - x), C.c1, 2, [6, 4]);
    P.unclip();
    P.points([q], [sq], C.c1, 5, '#fff');
    P.points([q], [Math.min(ce, YM - 0.12)], C.c4, 6, '#fff');
    const f = '600 12px ' + NUMF;
    P.text(0.97, YM - 0.55, `−ln Q = ${fx(ce, 3)}${ce > YM ? '（点已出界 ↑）' : ''}`, C.c4, 'right', 'middle', f);
    P.text(0.97, YM - 1.2, `½(1 − Q)² = ${fx(sq, 3)}`, C.c1, 'right', 'middle', f);
  });
  const gradA = LAB.canvas('#a-grad', (ctx, w, h) => {
    const q = qA, g1 = q - 1, g2 = -(1 - q) * q * (1 - q);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: -1.1, ymax: 0.1, ytickValues: [-1, -0.75, -0.5, -0.25, 0], xlabel: '模型给“东”的概率 Q', ylabel: '传给 logit 的梯度', pad: { l: 58, r: 12, t: 12, b: 38 } }).axes();
    P.clip();
    P.fn((x) => x - 1, C.c4, 2.4);
    P.fn((x) => -x * (1 - x) * (1 - x), C.c1, 2, [6, 4], 400);
    P.unclip();
    P.points([q], [g2], C.c1, 5, '#fff');
    P.points([q], [g1], C.c4, 6, '#fff');
    const f = '600 12px ' + NUMF;
    P.text(0.97, -0.76, `交叉熵 Q − 1 = ${fx(g1, 3)}`, C.c4, 'right', 'middle', f);
    P.text(0.97, -0.92, `平方误差 = ${fg(g2)}`, C.c1, 'right', 'middle', f);
  });

  // ---------- B：两个词“甲”“乙”
  let pB = 0.8, qB = 0.5;
  const PRE_B = [{ p: 0.8, q: 0.5 }, { p: 0.8, q: 0.8 }, { p: 0.5, q: 0.1 }];
  const segB = LAB.segmented('#b-preset', ['$q=0.5$', '$q=0.8$', '习题 1.3'], 0, (i) => { pB = PRE_B[i].p; qB = PRE_B[i].q; sP.set(pB); sQ.set(qB); updB(); });
  const sP = LAB.slider('#b-p', { label: '真实分布 $P(\\text{甲})=p$', min: 0.01, max: 0.99, step: 0.01, value: pB, fmt: (v) => v.toFixed(2), onInput: (v) => { pB = v; unseg(segB); updB(); } });
  const sQ = LAB.slider('#b-q', { label: '模型预测 $Q(\\text{甲})=q$', min: 0.01, max: 0.99, step: 0.01, value: qB, fmt: (v) => v.toFixed(2), onInput: (v) => { qB = v; unseg(segB); updB(); } });
  const stB = [LAB.stat('#b-stats', '底线：真实分布的熵 $H(P)$', 'plum'), LAB.stat('#b-stats', '平均罚单 $H(P,Q)$', 'coral'),
    LAB.stat('#b-stats', '冤枉分 $D_{\\text{KL}}(P\\|Q)$', 'amber'), LAB.stat('#b-stats', '反向 $D_{\\text{KL}}(Q\\|P)$', '')];
  const hpqF = (p, x) => -p * Math.log(x) - (1 - p) * Math.log(1 - x);
  function updB() {
    const P = [pB, 1 - pB], Q = [qB, 1 - qB];
    stB[0].set(`${fx(M.entropy(P), 4)}<small>nats</small>`);
    stB[1].set(`${fx(hpqF(pB, qB), 4)}<small>nats</small>`);
    stB[2].set(fx(M.kl(P, Q), 4));
    stB[3].set(fx(M.kl(Q, P), 4));
    $('#b-sub').textContent = `P = (${pB.toFixed(2)}, ${(1 - pB).toFixed(2)})，Q = (${qB.toFixed(2)}, ${(1 - qB).toFixed(2)})`;
    bPlot.redraw();
  }
  const bPlot = LAB.canvas('#b-plot', (ctx, w, h) => {
    const p = pB, q = qB, YM = 2.5, hp = M.entropy([p, 1 - p]);
    const rkl = (x) => x * Math.log(x / p) + (1 - x) * Math.log((1 - x) / (1 - p));
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: 0, ymax: YM, xlabel: '模型给“甲”的概率 q', ylabel: '罚单（nats）', pad: { l: 46, r: 14, t: 12, b: 38 } }).axes();
    P.clip();
    const xs = M.linspace(0.001, 0.999, 500);
    P.line(xs, xs.map(rkl), C.c1, 1.8, [6, 4]);
    P.line(xs, xs.map((x) => hpqF(p, x)), C.c4, 2.6);
    P.unclip();
    P.hline(hp, C.c5, [5, 4], 1.4);
    const yq = hpqF(p, q), top = Math.min(yq, YM);
    ctx.save(); ctx.strokeStyle = C.c2; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(P.tx(q), P.ty(hp)); ctx.lineTo(P.tx(q), P.ty(top)); ctx.stroke(); ctx.restore();
    P.points([p], [hp], C.c5, 4.5, '#fff');
    P.points([q], [Math.min(rkl(q), YM)], C.c1, 4, '#fff');
    P.points([q], [Math.min(yq, YM - 0.04)], C.c4, 6, '#fff');
    const f = '600 12px ' + NUMF;
    // H(P) 标在最低点正下方：H(P,Q) 曲线永远不会低于 H(P)
    const lx = M.clamp(p, 0.12, 0.88);
    if (hp > 0.3) P.text(lx, hp - 0.15, `最低点 H(P) = ${fx(hp, 4)}`, C.c5, 'center', 'middle', f);
    else P.text(lx, hp + 0.18, `H(P) = ${fx(hp, 4)}`, C.c5, 'center', 'middle', f);
    // KL 标在竖线背离 p 的一侧（那一侧曲线更高，不会压字）；没地方时改放到竖线顶端
    const kl = M.kl([p, 1 - p], [q, 1 - q]);
    if (kl > 0.015) {
      const s = `KL = ${fx(kl, 4)}`, away = q < p ? -1 : 1;
      const roomy = away < 0 ? q > 0.3 : q < 0.7;
      if (roomy) P.text(q + away * 0.02, (hp + top) / 2, s, C.amber, away < 0 ? 'right' : 'left', 'middle', f);
      else P.text(q - away * 0.02, Math.min(top + 0.13, YM - 0.12), s, C.amber, away < 0 ? 'left' : 'right', 'middle', f);
    }
  });

  // ---------- C：温度（习题 1.2）
  let tC = 1;
  const Z = [Math.log(4), 0];
  const PRE_C = [0.5, 1, 2];
  const segC = LAB.segmented('#c-preset', PRE_C.map((t) => `$T=${t}$`), 1, (i) => { tC = PRE_C[i]; sT.set(tC); updC(); });
  const sT = LAB.slider('#c-T', { label: '温度 $T$', min: 0.1, max: 5, step: 0.05, value: tC, fmt: (v) => v.toFixed(2), hint: '$Q=\\operatorname{Softmax}(\\mathbf z/T)$', onInput: (v) => { tC = v; unseg(segC); updC(); } });
  const stC = [LAB.stat('#c-stats', '$Q_1$', ''), LAB.stat('#c-stats', '$Q_2$', 'amber'), LAB.stat('#c-stats', '熵 $H(Q)$', 'plum')];
  const FRAC = { 0.5: ['16/17', '1/17'], 1: ['4/5', '1/5'], 2: ['2/3', '1/3'] };
  function updC() {
    const Q = M.softmax(Z, tC), fr = FRAC[tC];
    stC[0].set(Q[0].toFixed(3) + (fr ? `<small>= ${fr[0]}</small>` : ''));
    stC[1].set(Q[1].toFixed(3) + (fr ? `<small>= ${fr[1]}</small>` : ''));
    stC[2].set(`${fx(M.entropy(Q), 4)}<small>nats</small>`);
    cPlot.redraw();
  }
  const cPlot = LAB.canvas('#c-plot', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.1, xmax: 10, logx: true, ymin: 0, ymax: 1, xtickValues: [0.1, 0.2, 0.5, 1, 2, 5, 10], xfmt: (v) => String(v), xlabel: '温度 T（对数刻度）', ylabel: '概率 / 熵', pad: { l: 44, r: 12, t: 12, b: 38 } }).axes();
    const xs = []; for (let i = 0; i <= 300; i++) xs.push(0.1 * Math.pow(100, i / 300));
    const q1 = xs.map((t) => M.softmax(Z, t)[0]);
    P.line(xs, q1.map((v) => M.entropy([v, 1 - v])), C.c5, 1.8, [6, 4]);
    P.line(xs, q1, C.c1, 2.4);
    P.line(xs, q1.map((v) => 1 - v), C.c2, 2.4);
    P.vline(tC, C.slate, [3, 3]);
    const Q = M.softmax(Z, tC);
    P.points([tC], [M.entropy(Q)], C.c5, 4.5, '#fff');
    P.points([tC], [Q[0]], C.c1, 5.5, '#fff');
    P.points([tC], [Q[1]], C.c2, 5.5, '#fff');
  });
  updA(); updB(); updC();

  /* ================= 实验 2：香农的猜字母赌局 ================= */
  const TEXTS = [
    'THE ROOM WAS NOT VERY LIGHT A SMALL OBLONG READING LAMP ON THE DESK SHED GLOW ON POLISHED WOOD',
    'THERE IS NO REVERSE ON A MOTORCYCLE',
    'TO PREDICT THE NEXT WORD WELL A MODEL MUST UNDERSTAND THE WORLD',
    'ATTENTION IS ALL YOU NEED',
  ];
  const CORPUS = (TEXTS.join(' ') + ' ' +
    'IT WAS THE BEST OF TIMES IT WAS THE WORST OF TIMES IT WAS THE AGE OF WISDOM IT WAS THE AGE OF FOOLISHNESS ' +
    'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG AND THE CAT SAT ON THE MAT WHILE THE RAIN FELL ON THE ROOF ' +
    'IN THE BEGINNING THE MACHINE KNEW NOTHING BUT AFTER READING MANY BOOKS IT LEARNED THAT SOME LETTERS FOLLOW OTHERS ' +
    'THE PROBABILITY OF THE NEXT LETTER DEPENDS ON THE LETTERS THAT CAME BEFORE AND THIS IS THE HEART OF LANGUAGE ' +
    'SHANNON ASKED HIS WIFE TO GUESS THE NEXT LETTER IN A BOOK AND COUNTED HOW MANY GUESSES SHE NEEDED EACH TIME ' +
    'WHEN THE SUN RISES IN THE EAST THERE IS NOTHING TO LEARN BUT WHEN IT SNOWS IN THE DESERT THE NEWS IS SURPRISING ').replace(/[^A-Z ]/g, '');
  const ALPHA = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  // 三元频率表（带加一平滑）
  const tri = {}, bi = {}, uni = {};
  for (let i = 0; i < CORPUS.length; i++) {
    const c = CORPUS[i]; uni[c] = (uni[c] || 0) + 1;
    if (i >= 1) { const k = CORPUS[i - 1]; bi[k] = bi[k] || {}; bi[k][c] = (bi[k][c] || 0) + 1; }
    if (i >= 2) { const k = CORPUS.substr(i - 2, 2); tri[k] = tri[k] || {}; tri[k][c] = (tri[k][c] || 0) + 1; }
  }
  function ranking(prefix) {
    const k2 = prefix.slice(-2), k1 = prefix.slice(-1);
    const score = (c) => 100 * ((tri[k2] && tri[k2][c]) || 0) + 10 * ((bi[k1] && bi[k1][c]) || 0) + (uni[c] || 0) * 0.01;
    return ALPHA.slice().sort((a, b) => score(b) - score(a));
  }
  const sel = document.querySelector('#text-choice');
  TEXTS.forEach((t, i) => { const o = document.createElement('option'); o.value = i; o.textContent = t.length > 42 ? t.slice(0, 40) + '…' : t; sel.appendChild(o); });
  let target = TEXTS[0], pos = 0, tries = [], counts = [], autoTimer = null;
  const textEl = document.querySelector('#sh-text'), inp = document.querySelector('#sh-input');
  const fb = document.querySelector('#sh-feedback'), triedEl = document.querySelector('#sh-tried');
  const shH = LAB.stat('#sh-stats', '已猜字符数'); const shG = LAB.stat('#sh-stats', '平均猜测次数', 'amber');
  const shE = LAB.stat('#sh-stats', '熵上界估计', 'plum'); const shR = LAB.stat('#sh-stats', '随机基线', 'coral');
  shR.set('4.75<small>bit</small>');
  const hist = LAB.canvas('#sh-hist', (ctx, w, h) => {
    const K = 8, f = new Array(K).fill(0);
    counts.forEach((c) => { f[Math.min(c, K) - 1]++; });
    const tot = Math.max(1, counts.length), q = f.map((v) => v / tot);
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.4, xmax: K + 0.6, ymin: 0, ymax: Math.max(0.5, Math.ceil(Math.max(...q) * 10) / 10), xtickValues: M.range(K).map((i) => i + 1), xfmt: (v) => (v === K ? K + '+' : v), xlabel: '第几次才猜中', ylabel: '频率', pad: { l: 44, r: 10, t: 10, b: 38 } }).axes();
    P.bars(M.range(K).map((i) => i + 1), q, M.range(K).map((i) => LAB.mix(C.c3, C.c4, i / (K - 1))), (P.tx(2) - P.tx(1)) * 0.6);
  });
  function renderText() {
    let html = '';
    for (let i = 0; i < target.length; i++) {
      const ch = target[i] === ' ' ? '␣' : target[i];
      if (i < pos) { const c = counts[i]; const col = LAB.mix(C.c3, C.c4, Math.min(c - 1, 7) / 7); html += `<span title="猜了 ${c} 次" style="display:inline-block;text-align:center;min-width:1.05em;border-bottom:3px solid ${col}">${ch}<sub style="font-size:9px;color:${col};display:block;line-height:1">${c}</sub></span>`; }
      else if (i === pos) html += `<span style="display:inline-block;min-width:1.05em;text-align:center;background:var(--c2l);border-radius:4px;color:var(--amber)">?</span>`;
      else html += `<span style="display:inline-block;min-width:1.05em;text-align:center;color:#cfd6de">·</span>`;
    }
    textEl.innerHTML = html;
    triedEl.textContent = tries.length ? '本位置已试：' + tries.map((t) => (t === ' ' ? '␣' : t)).join(' ') : '';
    const n = counts.length;
    shH.set(`${n}<small>/ ${target.length}</small>`);
    if (n) {
      shG.set((M.mean(counts)).toFixed(2));
      const f = {}; counts.forEach((c) => (f[c] = (f[c] || 0) + 1));
      const H = -Object.values(f).reduce((a, v) => a + (v / n) * Math.log2(v / n), 0);
      shE.set(`${H.toFixed(2)}<small>bit/字符</small>`);
    } else { shG.set('–'); shE.set('–'); }
    hist.redraw();
  }
  function guess(ch) {
    if (pos >= target.length) return;
    ch = ch.toUpperCase(); if (!ALPHA.includes(ch) || tries.includes(ch)) return;
    tries.push(ch);
    if (ch === target[pos]) { counts.push(tries.length); fb.innerHTML = `<span style="color:var(--leaf)">✓ 猜中！用了 ${tries.length} 次</span>`; pos++; tries = []; }
    else fb.innerHTML = `<span style="color:var(--coral)">✗ 不是 “${ch === ' ' ? '空格' : ch}”，再猜</span>`;
    if (pos >= target.length) fb.innerHTML = '<b style="color:var(--navy)">全部猜完！看看右边的熵估计。</b>';
    renderText();
  }
  inp.addEventListener('input', () => { const v = inp.value; inp.value = ''; if (v) guess(v === ' ' ? ' ' : v); });
  inp.addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); guess(' '); } });
  function reset() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } target = TEXTS[+sel.value]; pos = 0; tries = []; counts = []; fb.textContent = ''; renderText(); }
  sel.onchange = reset;
  document.querySelector('#btn-reset').onclick = reset;
  document.querySelector('#btn-auto').onclick = () => {
    reset();
    autoTimer = setInterval(() => {
      if (pos >= target.length) { clearInterval(autoTimer); autoTimer = null; return; }
      const r = ranking(target.slice(0, pos));
      const k = r.indexOf(target[pos]) + 1;
      counts.push(k); pos++; renderText();
    }, 90);
  };
  LAB.segmented('#mode-seg', ['我来猜', '只看电脑猜'], 0, (i) => { if (i === 1) document.querySelector('#btn-auto').click(); else reset(); });
  reset();

  /* ================= 实验 3：词语接龙、下溢与困惑度 ================= */
  // ---------- “我 / 爱 / 数学”
  const BOOK3 = [0.5, 0.4, 0.8];
  const steps = [{ cond: 'P(\\text{我})' }, { cond: 'P(\\text{爱}\\mid\\text{我})' }, { cond: 'P(\\text{数学}\\mid\\text{我},\\text{爱})' }].map((s, i) => Object.assign(s, { p: BOOK3[i] }));
  const chS = steps.map((s, i) => LAB.slider('#chain-sliders', { label: `第 ${i + 1} 步 $${s.cond}$`, min: 0.01, max: 1, step: 0.01, value: s.p, fmt: (v) => v.toFixed(2), onInput: (v) => { s.p = v; update3(); } }));
  $('#chain-book').onclick = () => { steps.forEach((s, i) => { s.p = BOOK3[i]; chS[i].set(s.p); }); update3(); };
  const cs = [LAB.stat('#chain-stats', '整句概率 $P$'), LAB.stat('#chain-stats', '$\\ln P$', ''), LAB.stat('#chain-stats', '平均罚单 $\\mathcal L=-\\tfrac13\\ln P$', 'coral'), LAB.stat('#chain-stats', '困惑度 PPL $=e^{\\mathcal L}$', 'teal')];
  const fP = (x) => (x >= 1e-3 ? tr(x, 4) : sci(x, 2));
  const texP = (x) => { if (x >= 1e-3) return tr(x, 4); const e = Math.floor(Math.log10(x)); return `${(x / Math.pow(10, e)).toFixed(2)}\\times10^{${e}}`; };
  function update3() {
    const ps = steps.map((s) => s.p), prod = ps.reduce((a, b) => a * b, 1), lnP = Math.log(prod), L = -lnP / 3, ppl = Math.exp(L);
    $('#chain-formula').innerHTML = LAB.tex(`P(\\text{我},\\text{爱},\\text{数学}) = ${ps.map((p) => tr(p, 2)).join('\\times')} = ${texP(prod)},\\qquad \\operatorname{PPL}=\\Big(\\frac{1}{P}\\Big)^{1/3}\\approx ${ppl.toFixed(3)}`, true);
    cs[0].set(fP(prod)); cs[1].set(fx(lnP, 4)); cs[2].set(`${fx(L, 4)}<small>nats</small>`); cs[3].set(ppl.toFixed(3));
    funnel.redraw();
  }
  const fc = (c) => (Math.abs(c - Math.round(c)) < 1e-6 ? String(Math.round(c)) : c >= 0.1 ? c.toFixed(1) : String(+c.toPrecision(2)));
  const funnel = LAB.canvas('#chain-funnel', (ctx, w, h) => {
    const ps = steps.map((s) => s.p), cnt = [100];
    ps.forEach((p) => cnt.push(cnt[cnt.length - 1] * p));
    const names = ['语料里的全部句子', '以“我”开头', '以“我爱”开头', '以“我爱数学”开头'];
    const cols = [C.slate, C.c1, C.c6, C.c3];
    const narrow = w < 460, L = narrow ? 104 : 150, R = narrow ? 96 : 130, rowH = (h - 16) / 4, bh = Math.min(32, rowH * 0.62), maxW = w - L - R - 10;
    ctx.save(); ctx.textBaseline = 'middle';
    cnt.forEach((c, i) => {
      const y = 8 + rowH * i + rowH / 2, bw = Math.max(2, maxW * c / 100);
      ctx.fillStyle = cols[i]; ctx.globalAlpha = 0.9; LAB.roundRect(ctx, L, y - bh / 2, bw, bh, 5); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = C.ink; ctx.font = (narrow ? '12px ' : '13px ') + FONT; ctx.textAlign = 'right'; ctx.fillText(names[i], L - 10, y);
      const s = `${fc(c)} 句`; ctx.font = '600 13px ' + NUMF;
      const tw = ctx.measureText(s).width;
      let x = L + bw + 8;
      if (bw > tw + 16) { ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.fillText(s, L + bw - 8, y); }
      else { ctx.fillStyle = C.navy; ctx.textAlign = 'left'; ctx.fillText(s, x, y); x += tw + 8; }
      if (i) { ctx.fillStyle = C.amber; ctx.textAlign = 'left'; ctx.fillText(`= ${fc(cnt[i - 1])} × ${tr(ps[i - 1], 2)}`, x, y); }
    });
    ctx.restore();
  });
  update3();

  // ---------- 下溢：float64 / float16 直接连乘 vs 对数求和
  const sLen = LAB.slider('#len-slider', { label: '句子长度 $T$', min: 50, max: 2500, step: 10, value: 400, onInput: () => updUF() });
  const sPs = LAB.slider('#pstep-slider', { label: '每一步的概率 $p$', min: 0.005, max: 0.9, step: 0.005, value: 0.1, fmt: (v) => v.toFixed(3), onInput: () => updUF() });
  function f16(x) { // 把 x 舍入到 float16 能表示的最近的数（含次正规数，最小正数 2⁻²⁴ ≈ 6×10⁻⁸）
    if (x === 0) return 0;
    const a = Math.abs(x);
    if (a < Math.pow(2, -14)) { const u = Math.pow(2, -24); return Math.sign(x) * Math.round(a / u) * u; }
    const u = Math.pow(2, Math.floor(Math.log2(a)) - 10);
    return Math.sign(x) * Math.round(a / u) * u;
  }
  const ufS = [LAB.stat('#uf-stats', 'float64 直接连乘', 'coral'), LAB.stat('#uf-stats', 'float16 直接连乘', 'amber'), LAB.stat('#uf-stats', '对数求和 $\\sum_t\\log_{10}p$', 'leaf')];
  let UF = null;
  function updUF() {
    const n = sLen.get(), p = sPs.get(), p16 = f16(p), lp = Math.log10(p);
    const xs = [], d64 = [], d16 = [], ls = [];
    let a = 1, b = 1, dead64 = 0, dead16 = 0;
    for (let t = 1; t <= n; t++) {
      a *= p; b = f16(b * p16);
      xs.push(t); d64.push(a > 0 ? Math.log10(a) : NaN); d16.push(b > 0 ? Math.log10(b) : NaN); ls.push(t * lp);
      if (!dead64 && a === 0) dead64 = t;
      if (!dead16 && b === 0) dead16 = t;
    }
    UF = { n, xs, d64, d16, ls, dead64, dead16 };
    ufS[0].set(dead64 ? `第 ${dead64} 步<small>变成 0</small>` : '没有归零');
    ufS[1].set(dead16 ? `第 ${dead16} 步<small>变成 0</small>` : '没有归零');
    ufS[2].set(`${fx(n * lp, 1)}<small>永不归零</small>`);
    uf.redraw();
  }
  const uf = LAB.canvas('#underflow', (ctx, w, h) => {
    if (!UF) return;
    const { n, xs, d64, d16, ls, dead64, dead16 } = UF;
    const ymin = Math.min(-345, ls[ls.length - 1] * 1.05);
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: n, ymin, ymax: 0, xlabel: '已生成的词数 t', ylabel: 'log₁₀(句子概率)', pad: { l: 58, r: 14, t: 12, b: 38 } }).axes();
    const F64 = Math.log10(Number.MIN_VALUE), F16 = Math.log10(Math.pow(2, -24)), f = '12px ' + FONT, fb = '600 12px ' + FONT;
    P.hline(F64, C.slate, [4, 4]);
    P.text(1 + (n - 1) * 0.02, F64, 'float64 的下限 ≈ 4.9×10⁻³²⁴', C.slate, 'left', 'bottom', f);
    P.hline(F16, C.amber, [4, 4]);
    P.clip();
    P.line(xs, ls, C.c3, 2.6);
    P.line(xs, d64, C.c4, 2.6);
    P.line(xs, d16, C.c2, 2.6);
    P.unclip();
    if (dead16) {
      const y1 = ymin * 0.6;
      ctx.save(); ctx.strokeStyle = C.amber; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(P.tx(dead16), P.ty(0)); ctx.lineTo(P.tx(dead16), P.ty(y1)); ctx.stroke(); ctx.restore();
      const right = dead16 > 0.6 * n;
      const s16 = `float16 第 ${dead16} 步就归零`;
      P.text(dead16, y1, right ? s16 + ' ' : ' ' + s16, C.amber, right ? 'right' : 'left', 'top', fb);
    }
    if (dead64) {
      P.vline(dead64, C.c4, [3, 3]);
      const right = dead64 > 0.6 * n;
      P.text(dead64, ymin * 0.12, right ? `float64 第 ${dead64} 步归零 ` : ` float64 第 ${dead64} 步归零`, C.c4, right ? 'right' : 'left', 'middle', fb);
    }
  });
  updUF();

  // ---------- 困惑度 = 平均几选一
  let kU = 4;
  const PRE_K = [4, 10, 50000, 100000];
  const segK = LAB.segmented('#k-preset', ['4 选 1', '10 选 1', '词表 5 万', '词表 10 万'], 0, (i) => { kU = PRE_K[i]; sK.set(Math.log10(kU)); updK(); });
  const sK = LAB.slider('#k-slider', {
    label: '均匀瞎猜的选项个数 $k$', min: 0.301, max: 5.301, step: 0.001, value: Math.log10(kU),
    fmt: (v) => (Math.abs(Math.log10(kU) - v) < 6e-4 ? kU : Math.max(2, Math.round(Math.pow(10, v)))).toLocaleString(),
    hint: '对数刻度：2 到 20 万', onInput: (v) => { kU = Math.max(2, Math.round(Math.pow(10, v))); unseg(segK); updK(); },
  });
  const kS = [LAB.stat('#k-stats', '每一步的罚单 $\\mathcal L=\\ln k$', 'coral'), LAB.stat('#k-stats', '困惑度 $e^{\\mathcal L}$', 'teal')];
  function updK() {
    const L = Math.log(kU);
    kS[0].set(`${fx(L, L >= 10 ? 2 : 4)}<small>nats</small>`);
    kS[1].set(`${kU.toLocaleString()}<small>选 1</small>`);
    kPlot.redraw();
  }
  const kPlot = LAB.canvas('#k-plot', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 12.5, ymin: 1, ymax: 1e6, logy: true, ytickValues: [1, 10, 100, 1e3, 1e4, 1e5, 1e6], xlabel: '每一步的平均罚单 L（nats）', ylabel: 'PPL', pad: { l: 50, r: 12, t: 12, b: 38 } }).axes();
    P.fn((x) => Math.exp(x), C.teal, 2.2);
    PRE_K.forEach((k) => P.points([Math.log(k)], [k], '#fff', 4.5, C.teal));
    const L = Math.log(kU), f = '600 12px ' + NUMF;
    P.points([L], [kU], C.c4, 6, '#fff');
    const s = `L = ${fx(L, L >= 10 ? 2 : 4)}，PPL = ${kU.toLocaleString()}`;
    if (L < 6) P.text(L + 0.35, kU, s, C.c4, 'left', 'top', f);
    else P.text(L - 0.35, kU, s, C.c4, 'right', 'bottom', f);
  });
  updK();

  // ---------- 几何平均 vs 算术平均
  const sGe = LAB.slider('#g-e', { label: '最后一个生僻词的 $1/Q$', min: 0, max: 8, step: 1, value: 6, fmt: (v) => (v === 0 ? '1' : v === 1 ? '10' : '10' + sup(v)), onInput: () => updG() });
  const sGT = LAB.slider('#g-T', { label: '句长 $T$（其余词都猜得极准：$1/Q=1$）', min: 10, max: 1000, step: 10, value: 100, onInput: () => updG() });
  const gS = [LAB.stat('#g-stats', '几何平均（PPL）', 'leaf'), LAB.stat('#g-stats', '算术平均 $\\tfrac1T\\sum_t 1/Q_t$', 'coral')];
  const fmean = (x) => (x >= 1000 ? Math.round(x).toLocaleString() : x.toFixed(3));
  let G = null;
  function updG() {
    const e = sGe.get(), T = sGT.get(), geo = Math.pow(10, e / T), ari = (T - 1 + Math.pow(10, e)) / T;
    G = { e, T, geo, ari };
    gS[0].set(fmean(geo));
    gS[1].set(fmean(ari));
    gPlot.redraw();
  }
  const gPlot = LAB.canvas('#g-plot', (ctx, w, h) => {
    if (!G) return;
    const { e, T, geo, ari } = G, ymax = Math.pow(10, Math.max(2, e + 0.8));
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: T + 1, ymin: 0.4, ymax, logy: true, xlabel: '第几个词 t', ylabel: '1/Q', pad: { l: 50, r: 12, t: 12, b: 38 } }).axes();
    const bw = Math.max(0.8, (P.tx(1) - P.tx(0)) * 0.7);
    ctx.save();
    for (let t = 1; t <= T; t++) {
      const v = t === T ? Math.pow(10, e) : 1, X = P.tx(t), Y = P.ty(v), B = P.ty(0.4);
      ctx.fillStyle = t === T ? C.c4 : C.c1l; ctx.fillRect(X - bw / 2, Math.min(Y, B), bw, Math.abs(B - Y));
    }
    ctx.restore();
    P.hline(geo, C.leaf, null, 2); P.hline(ari, C.coral, [6, 4], 2);
    const f = '600 12px ' + NUMF, lg = Math.log10(geo), sep = Math.log10(ymax / 0.4) * 16 / Math.max(80, h - 50), la = Math.max(Math.log10(ari), lg + sep);
    P.text(T * 0.03, geo, `几何平均 ${fmean(geo)}`, C.leaf, 'left', 'bottom', f);
    P.text(T * 0.03, Math.pow(10, la), `算术平均 ${fmean(ari)}`, C.coral, 'left', 'bottom', f);
  });
  updG();

  // ---------- 分词器陷阱（习题 1.4）
  const TOK0 = [{ n: '模型 A', seg: 'unbelievable', q: [0.01] }, { n: '模型 B', seg: 'un|believ|able', q: [0.5, 0.2, 0.5] }, { n: '模型 C', seg: 'un|believ|able', q: [0.2, 0.2, 0.2] }];
  let TOK = [];
  const tbl = $('#tok-table');
  const fppl = (x) => (x < 10 ? tr(x, 3) : tr(x, 2));
  function renderTok() {
    TOK = TOK0.map((r) => ({ n: r.n, seg: r.seg, q: r.q.slice() }));
    const th = (t, m) => `<th style="white-space:nowrap;vertical-align:bottom">${t}${m ? '<br>' + LAB.tex(m) : ''}</th>`;
    tbl.innerHTML = `<thead><tr>${th('模型')}${th('切分（token 数）')}${th('每一步的概率', 'Q_t')}${th('整词概率', 'P=\\prod_t Q_t')}${th('每 token 的 PPL', 'P^{-1/T}')}${th('每个整词的 PPL', '1/P')}</tr></thead><tbody>` +
      TOK.map((r, i) => `<tr><td style="white-space:nowrap"><b>${r.n}</b></td><td class="mono" style="white-space:nowrap">${r.seg}<span class="muted">（${r.q.length}）</span></td><td style="white-space:nowrap">${r.q.map((v, k) => `<input type="number" min="0.001" max="1" step="0.01" value="${v}" data-i="${i}" data-k="${k}" style="width:58px;padding:4px 5px;margin-right:3px">`).join('')}</td><td class="num" id="tk-p${i}" style="white-space:nowrap"></td><td class="num" id="tk-t${i}" style="border-radius:6px"></td><td class="num" id="tk-w${i}" style="border-radius:6px"></td></tr>`).join('') + '</tbody>';
    tbl.querySelectorAll('input').forEach((el) => (el.oninput = () => { const v = parseFloat(el.value); if (isFinite(v) && v > 0 && v <= 1) { TOK[+el.dataset.i].q[+el.dataset.k] = v; updTok(); } }));
    updTok();
  }
  function updTok() {
    const R = TOK.map((r) => { const P = r.q.reduce((a, b) => a * b, 1); return { n: r.n.slice(-1), P, tok: Math.pow(P, -1 / r.q.length), word: 1 / P }; });
    const minT = Math.min(...R.map((r) => r.tok)), minW = Math.min(...R.map((r) => r.word));
    R.forEach((r, i) => {
      $(`#tk-p${i}`).innerHTML = `<b>${String(+r.P.toPrecision(4))}</b><br><span class="small muted">罚单 −ln P = ${r.P === 1 ? '0' : fx(-Math.log(r.P), 3)}</span>`;
      const t = $(`#tk-t${i}`), wd = $(`#tk-w${i}`);
      t.innerHTML = `<b>${fppl(r.tok)}</b>`; wd.innerHTML = `<b>${fppl(r.word)}</b>`;
      t.style.background = r.tok === minT ? C.c3l : '';
      wd.style.background = r.word === minW ? C.c3l : '';
    });
    const byTok = R.slice().sort((a, b) => a.tok - b.tok).map((r) => `${r.n}（${fppl(r.tok)}）`).join(' < ');
    const byP = R.slice().sort((a, b) => b.P - a.P).map((r) => `${r.n}（${String(+r.P.toPrecision(4))}）`).join(' > ');
    $('#tok-cap').innerHTML = `按每 token 的 PPL 排：${byTok}。按整词概率排：${byP}。把同一个词切成 3 步，总罚单被平摊到 3 步上（开了三次方根），每 token 的 PPL 自然显得小。<b>每 token 的 PPL 只有在分词器相同时才能互相比较</b>；分词器不同，就换成同一把尺子（每个整词，或者书中说的每字节）再比。`;
  }
  $('#tok-book').onclick = renderTok;
  renderTok();
})();
