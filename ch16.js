/* 第 16 章：思维链、Best-of-N 与树搜索：交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §16.1 思维链的乘法账 · §16.2 Best-of-N 与 ORM/PRM · §16.3 UCT 选路 · 练习 16.1–16.2' });

  const $ = (s) => document.querySelector(s);
  const FONT = getComputedStyle(document.body).getPropertyValue('--font');
  const NUM = '600 12px Avenir Next, Avenir, sans-serif';
  const GREY = LAB.mix(C.slate, '#ffffff', 0.55);
  const isOn = (id) => document.getElementById(id).classList.contains('active');
  function anim(secId, frame, onStop) {
    let raf = 0;
    const o = {
      running: false,
      start() { if (o.running) return; o.running = true; const tick = () => { if (!o.running) return; if (!isOn(secId) || frame() === false) { o.stop(); return; } raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); },
      stop() { if (!o.running) return; o.running = false; cancelAnimationFrame(raf); onStop && onStop(); },
    };
    return o;
  }
  const pct = (v, d) => `${(v * 100).toFixed(d == null ? 1 : d)}<small>%</small>`;

  /* ================= 实验 1：两步草稿过河 ================= */
  const cD = LAB.slider('#cot-direct', { label: '不打草稿直接猜中的概率', min: 0.001, max: 0.2, step: 0.001, value: 0.01, fmt: (v) => v.toFixed(3), onInput: () => update1() });
  const cP = LAB.slider('#cot-step', { label: '每一步草稿做对的把握 $p$', min: 0.5, max: 0.99, step: 0.01, value: 0.9, fmt: (v) => v.toFixed(2), onInput: () => update1() });
  const cK = LAB.slider('#cot-k', { label: '草稿步数 $K$', min: 1, max: 30, step: 1, value: 2, onInput: () => update1() });
  const cs = { d: LAB.stat('#cot-stats', '直接猜', 'coral'), c: LAB.stat('#cot-stats', '写 $K$ 步草稿全对', 'teal'), r: LAB.stat('#cot-stats', '倍数', 'amber'), t: LAB.stat('#cot-stats', '20 步全对 $p^{20}$', 'plum') };
  const cotBars = LAB.canvas('#cot-bars', (ctx, w, h) => {
    const d = cD.get(), p = cP.get(), K = cK.get(), v = Math.pow(p, K);
    const P = new LAB.Plot(ctx, w, h, { xmin: -0.6, xmax: 1.6, ymin: 0, ymax: 1, xtickValues: [], yticks: 5, yfmt: (y) => `${Math.round(y * 100)}%`, pad: { l: 46, r: 10, t: 16, b: 30 } }).axes();
    const bw = (P.tx(1) - P.tx(0)) * 0.5;
    P.bars([0, 1], [d, v], [C.c4, C.c6], bw);
    P.text(0, d + 0.03, (d * 100).toFixed(1) + '%', C.coral, 'center', 'bottom', NUM);
    P.text(1, v + 0.03, (v * 100).toFixed(1) + '%', C.teal, 'center', 'bottom', NUM);
    P.text(0, -0.02, '直接猜（一步跳崖）', C.ink, 'center', 'top', '12px ' + FONT);
    P.text(1, -0.02, `写 ${K} 步草稿`, C.ink, 'center', 'top', '12px ' + FONT);
  });
  const cotCurve = LAB.canvas('#cot-curve', (ctx, w, h) => {
    const p = cP.get(), K = cK.get(), ks = M.range(30).map((i) => i + 1);
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: 30, ymin: 0, ymax: 1, xlabel: '草稿步数 K', ylabel: '全对的概率', yticks: 5, pad: { l: 46, r: 12, t: 12, b: 38 } }).axes();
    P.line(ks, ks.map((k) => Math.pow(0.9, k)), GREY, 1.4, [5, 4]);
    P.line(ks, ks.map((k) => Math.pow(p, k)), C.c6, 2.6);
    P.points([2, 20], [0.81, Math.pow(0.9, 20)], C.slate, 3.5, '#fff');
    P.text(2.4, 0.81, ' 0.9² = 0.81', C.slate, 'left', 'bottom', '11px ' + FONT);
    P.text(20, Math.pow(0.9, 20) + 0.03, '0.9²⁰ ≈ 0.12', C.slate, 'center', 'bottom', '11px ' + FONT);
    P.vline(K, C.amber, [4, 3], 1.4); P.points([K], [Math.pow(p, K)], C.c6, 5.5, '#fff');
  });
  function update1() {
    const d = cD.get(), p = cP.get(), K = cK.get(), v = Math.pow(p, K);
    cs.d.set(pct(d)); cs.c.set(pct(v)); cs.r.set(`${(v / d).toFixed(v / d >= 10 ? 0 : 1)}<small>倍</small>`); cs.t.set(pct(Math.pow(p, 20)));
    cotBars.redraw(); cotCurve.redraw();
  }
  update1();

  /* ================= 实验 2：Best-of-N ================= */
  const bP = LAB.slider('#bn-p', { label: '单次做对的概率 $p$', min: 0.01, max: 0.9, step: 0.01, value: 0.2, fmt: (v) => v.toFixed(2), onInput: () => { sim = { n: 0, hit: 0 }; last = null; sched(); update2(); } });
  const bN = LAB.slider('#bn-n', { label: '独立草稿份数 $N$', min: 1, max: 40, step: 1, value: 10, onInput: () => { sim = { n: 0, hit: 0 }; last = null; update2(); } });
  const mD = LAB.slider('#mv-d', { label: '错误答案的种类数（平分其余概率）', min: 1, max: 6, step: 1, value: 3, onInput: () => sched() });
  const passN = (p, N) => 1 - Math.pow(1 - p, N);
  let sim = { n: 0, hit: 0 }, last = null, R2 = LAB.rng(2016);
  function oneRound() {
    const p = bP.get(), N = bN.get(), ok = [];
    for (let i = 0; i < N; i++) ok.push(R2() < p);
    const pick = ok.indexOf(true);
    sim.n++; if (pick >= 0) sim.hit++;
    last = { ok, pick };
  }
  // 多数投票：正确答案概率 p，D 种错误答案平分 1-p；并列时随机取一个
  function majAcc(N, trials, R, p, D) {
    const K = D + 1, cnt = new Int32Array(K); let good = 0;
    for (let t = 0; t < trials; t++) {
      cnt.fill(0);
      for (let i = 0; i < N; i++) { const u = R(); const j = u < p ? 0 : 1 + Math.min(D - 1, Math.floor((u - p) / ((1 - p) / D))); cnt[j]++; }
      let mx = 0; for (let j = 0; j < K; j++) if (cnt[j] > mx) mx = cnt[j];
      if (cnt[0] === mx) { let ties = 0; for (let j = 0; j < K; j++) if (cnt[j] === mx) ties++; if (ties === 1 || R() < 1 / ties) good++; }
    }
    return good / trials;
  }
  const VN = M.range(40).map((i) => i + 1);
  let vote = null, pend = 0;
  function runVote() { const R = LAB.rng(123), p = bP.get(), D = mD.get(); vote = VN.map((N) => majAcc(N, 1500, R, p, D)); curve2.redraw(); stats2(); }
  function sched() { if (pend) return; pend = setTimeout(() => { pend = 0; runVote(); }, 16); }
  const curve2 = LAB.canvas('#bn-curve', (ctx, w, h) => {
    const p = bP.get(), N = bN.get();
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: 40, ymin: 0, ymax: 1, xlabel: '独立草稿份数 N', ylabel: '答对的概率', yticks: 5, yfmt: (y) => `${Math.round(y * 100)}%`, pad: { l: 50, r: 12, t: 12, b: 38 } }).axes();
    P.hline(0.95, GREY, [4, 4], 1); P.text(39.5, 0.95, '95%', C.slate, 'right', 'bottom', '11px ' + FONT);
    if (vote) { P.line(VN, vote, C.c3, 2.2); P.points(VN, vote, C.c3, 2); }
    P.fn((x) => passN(p, x), C.c1, 2.6);
    if (Math.abs(p - 0.2) < 1e-9) {
      [[2, '36.0%'], [5, '67.2%'], [10, '89.3%'], [20, '98.8%']].forEach(([n, s]) => { P.points([n], [passN(0.2, n)], C.navy, 3.5, '#fff'); P.text(n + 0.4, passN(0.2, n) - 0.035, s, C.navy, 'left', 'top', '11px ' + FONT); });
    }
    P.vline(N, C.amber, [4, 3], 1.4); P.points([N], [passN(p, N)], C.c1, 5.5, '#fff');
    if (sim.n) P.points([N], [sim.hit / sim.n], C.c2, 4.5, '#fff');
  });
  const bs = { f: LAB.stat('#bn-stats', '全错 $(1-p)^N$', 'coral'), t: LAB.stat('#bn-stats', '理论 Pass@$N$', 'teal'), s: LAB.stat('#bn-stats', '实测命中率', 'amber'), v: LAB.stat('#bn-stats', '多数投票', 'leaf') };
  function stats2() {
    const p = bP.get(), N = bN.get();
    bs.f.set(M.fmt(Math.pow(1 - p, N), 4)); bs.t.set(pct(passN(p, N), 2));
    bs.s.set(sim.n ? `${pct(sim.hit / sim.n)}<small> / ${sim.n} 轮</small>` : '–');
    bs.v.set(vote ? pct(vote[N - 1]) : '–');
  }
  function sheets() {
    if (!last) { $('#bn-sheets').innerHTML = '<span class="muted">点“抽一轮草稿”看看这一轮的 N 张草稿。</span>'; return; }
    $('#bn-sheets').innerHTML = last.ok.map((o, i) => `<span class="sheet ${o ? 'ok' : 'bad'} ${i === last.pick ? 'pick' : ''}">${i + 1}<b>${o ? '✓' : '✗'}</b></span>`).join('') +
      `<p class="muted" style="margin:6px 0 0">${last.pick >= 0 ? `第 ${last.pick + 1} 张是对的，验算器把它挑出来交卷。` : `这一轮 ${last.ok.length} 张全错（概率 ${(Math.pow(1 - bP.get(), bN.get()) * 100).toFixed(1)}%）。`}</p>`;
  }
  function update2() {
    const p = bP.get(); let n95 = 1; while (passN(p, n95) < 0.95 && n95 < 1000) n95++;
    $('#bn-cap').innerHTML = `$p=${p.toFixed(2)}$ 时，至少要 $N=${n95}$ 份草稿才能越过 95%。` + (Math.abs(p - 0.2) < 1e-9 ? '图中深蓝点为书中算例。' : '') + '橙点为实测命中率。';
    LAB.renderMath($('#bn-cap'));
    stats2(); sheets(); curve2.redraw();
  }
  $('#bn-one').onclick = () => { oneRound(); update2(); };
  const bnRun = anim('bestofn', () => { for (let k = 0; k < 25 && sim.n < 1000; k++) oneRound(); update2(); return sim.n < 1000; }, () => { $('#bn-many').innerHTML = '▶ 连抽 1000 轮'; });
  $('#bn-many').onclick = () => { if (bnRun.running) { bnRun.stop(); return; } if (sim.n >= 1000) sim = { n: 0, hit: 0 }; bnRun.start(); $('#bn-many').innerHTML = '❚❚ 暂停'; };
  $('#bn-clear').onclick = () => { bnRun.stop(); sim = { n: 0, hit: 0 }; last = null; update2(); };
  runVote(); update2();

  // ---- ORM vs PRM ----
  const r2 = LAB.slider('#pr-r2', { label: '草稿乙第 2 步得分', min: 0.01, max: 0.99, step: 0.01, value: 0.05, fmt: (v) => v.toFixed(2), onInput: () => renderPR() });
  const r3 = LAB.slider('#pr-r3', { label: '草稿乙最后一步得分', min: 0.5, max: 0.99, step: 0.01, value: 0.95, fmt: (v) => v.toFixed(2), onInput: () => renderPR() });
  function renderPR() {
    const A = [0.9, 0.9, 0.9], B = [0.9, r2.get(), r3.get()];
    const prod = (r) => r.reduce((a, b) => a * b, 1), mn = (r) => Math.min(...r);
    const rows = [
      ['结果裁判 ORM（只看最后一步）', A[2], B[2]],
      ['过程裁判 PRM（连乘）', prod(A), prod(B)],
      ['过程裁判 PRM（最低步分）', mn(A), mn(B)],
    ];
    $('#pr-table').innerHTML = `<table class="data"><tr><th>裁判</th><th>草稿甲 (0.9, 0.9, 0.9)</th><th>草稿乙 (0.9, ${B[1].toFixed(2)}, ${B[2].toFixed(2)})</th><th>选中</th></tr>` +
      rows.map(([n, a, b]) => `<tr><td>${n}</td><td class="num">${a.toFixed(5).replace(/0+$/, '').replace(/\.$/, '')}</td><td class="num">${b.toFixed(5).replace(/0+$/, '').replace(/\.$/, '')}</td><td><b style="color:${a >= b ? 'var(--leaf)' : 'var(--coral)'}">${a >= b ? '甲' : '乙'}</b></td></tr>`).join('') +
      `</table><p class="muted" style="margin:8px 0 0">书中数字：ORM 看 $0.95>0.90$ 选了歪打正着的乙；PRM 连乘 $0.729$ 对 $0.04275$、最低步分 $0.90$ 对 $0.05$，都选甲。</p>`;
    LAB.renderMath($('#pr-table'));
  }
  renderPR();

  /* ================= 实验 3：UCT 老路与新路 ================= */
  const INIT = () => ({ n: [6, 3, 1], q: [0.75, 0.5, 0.6] });
  const ROLL = [0.75, 0.5, 0.2];
  const NAMES = ['分支 1 稳妥老路', '分支 2 平庸老路', '分支 3 冷门新路'];
  let st = INIT(), log = [];
  const uC = LAB.slider('#uct-c', { label: '探险系数 $c$', min: 0, max: 2, step: 0.05, value: 0.5, fmt: (v) => v.toFixed(2), onInput: () => draw3() });
  const uct = () => { const N = M.sum(st.n), c = uC.get(); return st.q.map((q, j) => ({ q, b: c * Math.sqrt(Math.log(N) / st.n[j]) })); };
  const argmax = (a) => a.reduce((bi, v, i) => (v > a[bi] + 1e-12 ? i : bi), 0);
  function step() {
    const u = uct(), tot = u.map((x) => x.q + x.b), j = argmax(tot), N = M.sum(st.n), v = ROLL[j];
    st.n[j] += 1; st.q[j] += (v - st.q[j]) / st.n[j];
    log.push({ k: N + 1, tot, j, v, q: st.q[j] });
  }
  $('#uct-one').onclick = () => { step(); draw3(); };
  $('#uct-five').onclick = () => { for (let i = 0; i < 5; i++) step(); draw3(); };
  $('#uct-reset').onclick = () => { st = INIT(); log = []; draw3(); };
  const us = { N: LAB.stat('#uct-stats', '已探路次数 $N$'), p: LAB.stat('#uct-stats', '下一步会选', 'amber'), s: LAB.stat('#uct-stats', '它的 UCT 总分', 'teal'), l: LAB.stat('#uct-stats', '$\\ln N$', 'plum') };
  const barsCv = LAB.canvas('#uct-bars', (ctx, w, h) => {
    const u = uct(), tot = u.map((x) => x.q + x.b), j = argmax(tot), X = Math.max(1.6, Math.ceil(Math.max(...tot) * 5 + 0.5) / 5);
    const lab = w < 560 ? 90 : 130, P = new LAB.Plot(ctx, w, h, { xmin: 0, xmax: X, ymin: -0.6, ymax: 2.6, ytickValues: [], xticks: 4, xlabel: 'UCT 总分', pad: { l: lab, r: 16, t: 10, b: 36 } }).axes();
    const bh = (P.ty(0) - P.ty(0.55));
    u.forEach((x, i) => {
      const y = 2 - i, Y = P.ty(y);
      ctx.save();
      ctx.fillStyle = C.c1; ctx.globalAlpha = 0.85; ctx.fillRect(P.tx(0), Y - bh / 2, P.tx(x.q) - P.tx(0), bh);
      ctx.fillStyle = C.amber; ctx.fillRect(P.tx(x.q), Y - bh / 2, P.tx(x.q + x.b) - P.tx(x.q), bh);
      ctx.restore();
      ctx.save(); ctx.fillStyle = i === j ? C.teal : C.ink; ctx.font = (i === j ? '600 ' : '') + '12px ' + FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(w < 560 ? `分支 ${i + 1}` : NAMES[i], P.x0 - 8, Y - 7);
      ctx.fillStyle = C.slate; ctx.font = '11px ' + FONT; ctx.fillText(`n = ${st.n[i]}，Q̄ = ${x.q.toFixed(3)}`, P.x0 - 8, Y + 8); ctx.restore();
      P.text(x.q + x.b, y, ` ${(x.q + x.b).toFixed(3)}${i === j ? ' ← 选它' : ''}`, i === j ? C.teal : C.ink, 'left', 'middle', NUM);
    });
  });
  function draw3() {
    const u = uct(), tot = u.map((x) => x.q + x.b), j = argmax(tot), N = M.sum(st.n);
    us.N.set(N); us.p.set(`分支 ${j + 1}`); us.s.set(tot[j].toFixed(3)); us.l.set(Math.log(N).toFixed(3));
    $('#uct-log').innerHTML = log.length ? `<table class="data"><tr><th>第几次探路</th><th>三条分支的 UCT</th><th>选中</th><th>推演得分 $v$</th><th>新平均分</th></tr>` +
      log.map((r) => `<tr><td class="num">${r.k}</td><td class="num">${r.tot.map((t, i) => (i === r.j ? `<b>${t.toFixed(3)}</b>` : t.toFixed(3))).join('　')}</td><td>分支 ${r.j + 1}</td><td class="num">${r.v.toFixed(2)}</td><td class="num">${r.q.toFixed(3)}</td></tr>`).join('') + '</table>'
      : '<span class="muted">还没有走。书中预言：$c=0.5$ 时第 11 次探路会选分支 3（总分 1.359）。</span>';
    LAB.renderMath($('#uct-log'));
    barsCv.redraw();
  }
  draw3();
})();
