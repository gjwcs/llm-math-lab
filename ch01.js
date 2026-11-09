/* 第 1 章：概率论与信息论视角下的语言 —— 交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §1.2 自回归分解 · §1.3 交叉熵与 KL · §1.4 困惑度 · 开篇故事' });

  /* ================= 实验 1：下一个词的概率分布与交叉熵罚单 ================= */
  const words = ['雨伞', '防滑鞋', '雨衣', '墨镜', '电风扇', '冰淇淋'];
  const logits = [3.2, 2.1, 1.6, -0.8, -1.6, -1.2];
  let truth = 0;
  const sliders = words.map((w, i) => LAB.slider('#logit-sliders', {
    label: `“${w}”的 Logit $z_{${i + 1}}$`, min: -5, max: 6, step: 0.1, value: logits[i],
    fmt: (v) => v.toFixed(1), onInput: (v) => { logits[i] = v; update1(); },
  }));
  const tau = LAB.slider('#tau-slider', { label: '温度 $\\tau$', min: 0.1, max: 5, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), hint: '$Q=\\operatorname{Softmax}(z/\\tau)$', onInput: update1 });
  const eps = LAB.slider('#eps-slider', { label: '标签平滑 $\\varepsilon$', min: 0, max: 0.5, step: 0.01, value: 0, fmt: (v) => v.toFixed(2), onInput: update1 });
  const pillHost = document.querySelector('#truth-pills');
  words.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'pill' + (i === truth ? ' on' : ''); b.textContent = w;
    b.onclick = () => { truth = i; pillHost.querySelectorAll('.pill').forEach((p, j) => p.classList.toggle('on', j === i)); update1(); };
    pillHost.appendChild(b);
  });
  document.querySelector('#btn-uniform').onclick = () => { sliders.forEach((s, i) => { logits[i] = 0; s.set(0); }); update1(); };
  document.querySelector('#btn-sharp').onclick = () => { sliders.forEach((s, i) => { logits[i] = i === truth ? 5 : -2; s.set(logits[i]); }); update1(); };

  const sH = LAB.stat('#stats1', '熵 $H(Q)$', 'plum');
  const sP = LAB.stat('#stats1', '困惑度 PPL $=e^{H}$', 'teal');
  const sL = LAB.stat('#stats1', '交叉熵罚单 $\\mathcal L_{\\text{CE}}$', 'coral');
  const sK = LAB.stat('#stats1', 'KL 散度 $D_{\\text{KL}}(P\\|Q)$', 'amber');

  let Q = M.softmax(logits, 1);
  const bars = LAB.canvas('#bars', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.6, xmax: words.length - 0.4, ymin: 0, ymax: 1, xtickValues: [], yticks: 5, ylabel: '概率', pad: { l: 52, r: 12, t: 12, b: 34 } }).axes();
    const bw = (P.tx(1) - P.tx(0)) * 0.56;
    P.bars(M.range(words.length), Q, Q.map((_, i) => (i === truth ? C.c3 : C.c1)), bw);
    Q.forEach((q, i) => {
      P.text(i, q, (q * 100).toFixed(1) + '%', i === truth ? C.c3 : C.navy, 'center', 'bottom', '600 12px ' + 'Avenir Next, sans-serif');
      ctx.save(); ctx.fillStyle = C.ink; ctx.font = '13px PingFang SC, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(words[i], P.tx(i), P.y0 + 8); ctx.restore();
    });
  });
  const ce = LAB.canvas('#ce-curve', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: 1, ymin: 0, ymax: 6, xlabel: '模型给真实答案的概率 Q(w*)', ylabel: '罚金', pad: { l: 40, r: 10, t: 10, b: 38 } }).axes();
    P.clip();
    const xs = M.linspace(0.002, 1, 300);
    P.area(xs, xs.map((x) => -Math.log(x)), C.c4, 0.08);
    P.line(xs, xs.map((x) => -Math.log(x)), C.c4, 2.4);
    P.fn((x) => 1 - x, C.c1, 1.6, [5, 4]);
    P.unclip();
    const q = Q[truth];
    P.points([q], [Math.min(-Math.log(q), 5.9)], C.c4, 5.5, '#fff');
    const yq = Math.min(-Math.log(q), 5.9);
    P.text(Math.min(q + 0.04, 0.97), Math.min(yq + 1.1, 5.6), `−ln ${q.toFixed(3)} = ${(-Math.log(q)).toFixed(2)}`, C.c4, q > 0.5 ? 'right' : 'left', 'middle', '600 12px Avenir Next, sans-serif');
    P.text(0.98, 5.5, '实线 −ln Q　虚线 1 − Q', C.slate, 'right');
  });
  function update1() {
    Q = M.softmax(logits, tau.get());
    const e = eps.get(), V = words.length;
    const Ptrue = words.map((_, i) => (i === truth ? 1 - e + e / V : e / V));
    const H = M.entropy(Q);
    const CE = -M.sum(Ptrue.map((p, i) => p * Math.log(Q[i])));
    const KL = M.kl(Ptrue, Q);
    sH.set(`${H.toFixed(3)}<small>nats</small>`);
    sP.set(`${Math.exp(H).toFixed(2)}<small>选 1</small>`);
    sL.set(`${CE.toFixed(3)}<small>nats</small>`);
    sK.set(`${KL.toFixed(3)}<small>nats</small>`);
    bars.redraw(); ce.redraw();
  }
  update1();

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

  /* ================= 实验 3：链式法则、困惑度与数值下溢 ================= */
  const steps = [{ w: '我', p: 0.5, cond: 'P(\\text{我})' }, { w: '爱', p: 0.8, cond: 'P(\\text{爱}\\mid\\text{我})' }, { w: '数学', p: 0.5, cond: 'P(\\text{数学}\\mid\\text{我},\\text{爱})' }];
  steps.forEach((s, i) => LAB.slider('#chain-sliders', { label: `第 ${i + 1} 步 $${s.cond}$`, min: 0.01, max: 1, step: 0.01, value: s.p, fmt: (v) => v.toFixed(2), onInput: (v) => { s.p = v; update3(); } }));
  const T = LAB.slider('#len-slider', { label: '句子长度 $T$（下溢演示）', min: 10, max: 2500, step: 10, value: 400, onInput: () => uf.redraw() });
  const pstep = LAB.slider('#pstep-slider', { label: '每一步的概率 $p$', min: 0.005, max: 0.9, step: 0.005, value: 0.1, fmt: (v) => v.toFixed(3), onInput: () => uf.redraw() });
  const cs1 = LAB.stat('#chain-stats', '整句概率 $\\prod_t p_t$');
  const cs2 = LAB.stat('#chain-stats', '平均交叉熵', 'coral');
  const cs3 = LAB.stat('#chain-stats', '困惑度 PPL', 'teal');
  function update3() {
    const prod = steps.reduce((a, s) => a * s.p, 1);
    const ce3 = -M.mean(steps.map((s) => Math.log(s.p)));
    document.querySelector('#chain-formula').innerHTML = LAB.tex(`P(\\text{我},\\text{爱},\\text{数学}) = ${steps.map((s) => s.p.toFixed(2)).join('\\times')} = ${prod.toFixed(4)}`, true);
    cs1.set(prod.toFixed(4)); cs2.set(`${ce3.toFixed(4)}<small>nats</small>`); cs3.set(Math.exp(ce3).toFixed(3));
  }
  update3();
  const uf = LAB.canvas('#underflow', (ctx, w, h) => {
    const n = T.get(), p = pstep.get();
    const xs = [], direct = [], logsum = [];
    let prod = 1, ls = 0;
    for (let t = 1; t <= n; t++) { prod *= p; ls += Math.log(p); xs.push(t); direct.push(prod > 0 ? Math.log10(prod) : NaN); logsum.push(ls / Math.LN10); }
    const ymin = Math.min(-345, logsum[logsum.length - 1] * 1.05);
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: n, ymin, ymax: 0, xlabel: '已生成的词数 t', ylabel: 'log₁₀(句子概率)', pad: { l: 58, r: 14, t: 12, b: 38 } }).axes();
    P.hline(-323.3, C.slate, [4, 4]);
    P.text(n * 0.02, -323.3, 'float64 能表示的最小正数 ≈ 4.9×10⁻³²⁴', C.slate, 'left', 'bottom');
    P.line(xs, logsum, C.c3, 2.6);
    P.line(xs, direct, C.c4, 2.6);
    const dead = direct.findIndex((v) => !isFinite(v));
    if (dead >= 0) { P.vline(dead + 1, C.c4, [3, 3]); P.text(dead + 1, ymin * 0.15, ` 第 ${dead + 1} 步连乘变成 0`, C.c4, 'left'); }
  });
})();
