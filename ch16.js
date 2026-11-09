/* 第 16 章：测试时计算扩展：交互实验 */
(function () {
  const { COLORS: C, M } = LAB;
  LAB.page({ bookRef: '对应书中 §16.2 思维链边际化 · §16.3 Pass@k、GRPO 与 PUCT · §16.5 手算算例' });

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

  /* ================= 实验 1：Pass@k ================= */
  const LF = [0]; for (let i = 1; i <= 400; i++) LF[i] = LF[i - 1] + Math.log(i);
  const lnC = (n, k) => LF[n] - LF[k] - LF[n - k];
  const unb = (n, c, k) => { if (n - c < k) return 1; let p = 1; for (let i = n - c + 1; i <= n; i++) p *= 1 - k / i; return 1 - p; };
  const naive = (n, c, k) => 1 - Math.pow(1 - c / n, k);
  const pkN = LAB.slider('#pk-n', { label: '总采样数 $n$', min: 1, max: 200, step: 1, value: 50, onInput: (v) => { pkC.setRange(0, v); pkK.setRange(1, v); update1(); } });
  const pkC = LAB.slider('#pk-c', { label: '其中答对 $c$', min: 0, max: 50, step: 1, value: 5, onInput: () => update1() });
  const pkK = LAB.slider('#pk-k', { label: '预算 $k$', min: 1, max: 50, step: 1, value: 10, onInput: () => update1() });
  const pkP = LAB.slider('#pk-p', { label: '单次真实正确率 $p$', min: 0.01, max: 0.9, step: 0.01, value: 0.1, fmt: (v) => v.toFixed(2), onInput: () => update1() });
  const ps = { u: LAB.stat('#pk-stats', '无偏 Pass@$k$', 'teal'), n: LAB.stat('#pk-stats', '直接代入', 'amber'), z: LAB.stat('#pk-stats', '全部抽错 $\\binom{n-c}{k}/\\binom{n}{k}$', 'coral'), p: LAB.stat('#pk-stats', '单次正确率 $c/n$') };
  const curve = LAB.canvas('#pk-curve', (ctx, w, h) => {
    const n = pkN.get(), c = pkC.get(), k = pkK.get(), ks = M.range(n).map((i) => i + 1);
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: Math.max(2, n), ymin: 0, ymax: 1, xlabel: '预算 k', ylabel: 'Pass@k', yticks: 5, pad: { l: 46, r: 12, t: 10, b: 38 } }).axes();
    P.line(ks, ks.map((x) => naive(n, c, x)), C.c2, 2.2, [6, 4]);
    P.line(ks, ks.map((x) => unb(n, c, x)), C.c1, 2.6);
    P.vline(k, C.slate, [3, 3], 1);
    P.points([k], [naive(n, c, k)], C.c2, 5, '#fff'); P.points([k], [unb(n, c, k)], C.c1, 5.5, '#fff');
    if (n - c + 1 <= n && c > 0) { P.vline(n - c + 1, C.leaf, [2, 3], 1); P.text(n - c + 1, 0.06, ' k = n − c + 1', C.leaf, n - c + 1 > n * 0.7 ? 'right' : 'left', 'middle', '11.5px ' + FONT); }
  });
  function expected(n, p, k) {
    let eu = 0, en = 0;
    for (let c = 0; c <= n; c++) {
      const lw = lnC(n, c) + (c ? c * Math.log(p) : 0) + (n - c ? (n - c) * Math.log(1 - p) : 0), w = Math.exp(lw);
      if (w < 1e-16) continue;
      eu += w * unb(n, c, k); en += w * naive(n, c, k);
    }
    return [eu, en];
  }
  let biasCache = null;
  const bias = LAB.canvas('#pk-bias', (ctx, w, h) => {
    const n = pkN.get(), p = pkP.get(), ks = M.range(n).map((i) => i + 1);
    const ex = biasCache;
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: Math.max(2, n), ymin: 0, ymax: 1, xlabel: '预算 k', ylabel: '期望', yticks: 5, pad: { l: 46, r: 12, t: 10, b: 38 } }).axes();
    P.line(ks, ks.map((k) => 1 - Math.pow(1 - p, k)), C.c3, 5);
    P.line(ks, ex.map((e) => e[0]), C.c1, 2, [2, 0]);
    P.line(ks, ex.map((e) => e[1]), C.c2, 2.2, [6, 4]);
    if (p === 0.1 && n >= 30) { P.points([30], [1 - Math.pow(0.9, 30)], C.leaf, 5, '#fff'); P.text(30, 1 - Math.pow(0.9, 30) - 0.06, '1 − 0.9³⁰ ≈ 95.8%', C.leaf, 30 > n * 0.7 ? 'right' : 'left', 'top', NUM); }
    P.vline(pkK.get(), C.slate, [3, 3], 1);
  });
  function update1() {
    const n = pkN.get(), c = Math.min(pkC.get(), n), k = Math.min(pkK.get(), n), p = pkP.get();
    const u = unb(n, c, k), nv = naive(n, c, k);
    ps.u.set(pct(u)); ps.n.set(pct(nv)); ps.z.set(M.fmt(1 - u, 3)); ps.p.set(pct(c / n));
    biasCache = M.range(n).map((i) => expected(n, p, i + 1));
    const [eu, en] = biasCache[k - 1], tr = 1 - Math.pow(1 - p, k);
    $('#pk-bias-cap').innerHTML = `$k=${k}$ 时：真值 <b>${(tr * 100).toFixed(2)}%</b>，无偏估计的期望 <b>${(eu * 100).toFixed(2)}%</b>，直接代入的期望 <b>${(en * 100).toFixed(2)}%</b>（偏差 ${((en - tr) * 100).toFixed(2)} 个百分点）。`;
    LAB.renderMath($('#pk-bias-cap'));
    curve.redraw(); bias.redraw();
  }
  update1();

  /* ================= 实验 2：Best-of-N 与多数投票 ================= */
  const bnN = LAB.slider('#bn-n', { label: '采样数 $N$', min: 0, max: 8, step: 1, value: 4, fmt: (v) => String(2 ** v), onInput: () => update2() });
  let dist = 0, mc = null;
  LAB.segmented('#bn-dist', ['高斯 $\\mathcal N(0,1)$', '指数 $\\operatorname{Exp}(1)$'], 0, (i) => { dist = i; mc = null; update2(); });
  const mvP = LAB.slider('#mv-p', { label: '单次答对概率 $p$', min: 0.05, max: 0.9, step: 0.01, value: 0.4, fmt: (v) => v.toFixed(2), onInput: () => sched2() });
  const mvD = LAB.slider('#mv-d', { label: '错误答案的种类数', min: 1, max: 5, step: 1, value: 3, onInput: () => sched2() });
  const mvR = LAB.slider('#mv-rho', { label: '最强干扰项占错误概率的比例', min: 0, max: 1, step: 0.01, value: 0.34, fmt: (v) => v.toFixed(2), onInput: () => sched2() });
  // E[max] 的精确值
  const H = (N) => { let s = 0; for (let i = 1; i <= N; i++) s += 1 / i; return s; };
  const GX = M.linspace(-8, 9, 1701), GDX = GX[1] - GX[0], GPHI = GX.map((x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)), GCDF = GX.map((x) => M.normcdf(x));
  const gaussMax = (N) => { let s = 0; for (let i = 0; i < GX.length; i++) s += GX[i] * N * GPHI[i] * Math.pow(GCDF[i], N - 1); return s * GDX; };
  const emax = (N) => (dist === 0 ? gaussMax(N) : H(N));
  const kl = (N) => Math.log(N) - (N - 1) / N;
  const NS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256];
  const bns = { r: LAB.stat('#bn-stats', '期望最高奖励', 'teal'), k: LAB.stat('#bn-stats', 'KL 代价', 'coral'), m: LAB.stat('#bn-stats', '多数投票 maj@$N$', 'leaf'), p: LAB.stat('#bn-stats', '完美验证器 pass@$N$', 'plum') };
  const rew = LAB.canvas('#bn-reward', (ctx, w, h) => {
    const ys = NS.map(emax), Y = Math.ceil(Math.max(...ys) + 0.4);
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: 256, logx: true, ymin: dist === 0 ? -0.2 : 0, ymax: Y, xtickValues: [1, 4, 16, 64, 256], xfmt: String, xlabel: 'N（对数刻度）', yticks: 4, pad: { l: 40, r: 10, t: 10, b: 38 } }).axes();
    P.fn((N) => (dist === 0 ? Math.sqrt(2 * Math.log(Math.max(N, 1))) : Math.log(N) + 0.5772), GREY, 1.4, [5, 4]);
    P.line(NS, ys, C.c1, 2.6); P.points(NS, ys, C.c1, 2.6);
    if (mc) P.points(mc.N, mc.v, C.c2, 4, '#fff');
    const N = 2 ** bnN.get(); P.vline(N, C.amber, [4, 3], 1.4); P.points([N], [emax(N)], C.c1, 5.5, '#fff');
    P.text(1.1, Y * 0.92, dist === 0 ? '虚线：√(2 ln N)' : '虚线：ln N + 0.577', C.slate, 'left', 'middle', '11.5px ' + FONT);
  });
  const klCv = LAB.canvas('#bn-kl', (ctx, w, h) => {
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: 256, logx: true, ymin: 0, ymax: 5, xtickValues: [1, 4, 16, 64, 256], xfmt: String, xlabel: 'N（对数刻度）', ylabel: 'nats', yticks: 5, pad: { l: 40, r: 10, t: 10, b: 38 } }).axes();
    P.fn(kl, C.c4, 2.6);
    const N = 2 ** bnN.get(); P.vline(N, C.amber, [4, 3], 1.4); P.points([N], [kl(N)], C.c4, 5.5, '#fff');
    P.text(N, kl(N) + 0.35, kl(N).toFixed(3), C.coral, N > 64 ? 'right' : 'center', 'bottom', NUM);
  });
  $('#bn-mc').onclick = () => {
    const R = LAB.rng(7 + Math.floor(Math.random() * 1000)), T = 2000, Ns = [1, 2, 4, 8, 16, 32, 64, 128, 256];
    mc = { N: Ns, v: Ns.map((N) => { let s = 0; for (let t = 0; t < T; t++) { let m = -Infinity; for (let i = 0; i < N; i++) { const r = dist === 0 ? R.normal() : -Math.log(1 - R()); if (r > m) m = r; } s += m; } return s / T; }) };
    rew.redraw();
  };
  // 多数投票（并列时随机取一个）
  function voteProbs() {
    const p = mvP.get(), D = mvD.get(), rho = mvR.get(), wr = 1 - p;
    if (D === 1) return [p, wr];
    const q1 = wr * Math.max(rho, 1 / D), rest = (wr - q1) / (D - 1);
    return [p, q1, ...new Array(D - 1).fill(rest)];
  }
  function majAcc(N, trials, R, cum) {
    const K = cum.length, cnt = new Int32Array(K); let ok = 0;
    for (let t = 0; t < trials; t++) {
      cnt.fill(0);
      for (let i = 0; i < N; i++) { const u = R(); let j = 0; while (j < K - 1 && u >= cum[j]) j++; cnt[j]++; }
      let mx = 0; for (let j = 0; j < K; j++) if (cnt[j] > mx) mx = cnt[j];
      if (cnt[0] === mx) { let ties = 0; for (let j = 0; j < K; j++) if (cnt[j] === mx) ties++; if (ties === 1 || R() < 1 / ties) ok++; }
    }
    return ok / trials;
  }
  const VN = [...M.range(40).map((i) => i + 1), 44, 48, 52, 56, 60, 64];
  let vote = null;
  function runVote() {
    const pr = voteProbs(), cum = []; let s = 0; pr.forEach((v) => { s += v; cum.push(s); });
    const R = LAB.rng(123);
    vote = { pr, acc: VN.map((N) => majAcc(N, 2000, R, cum)) };
    const N = 2 ** bnN.get();
    vote.cur = N <= 64 && VN.includes(N) ? vote.acc[VN.indexOf(N)] : majAcc(N, 2000, LAB.rng(321), cum);
    const q1 = Math.max(...pr.slice(1));
    $('#mv-cap').innerHTML = q1 < pr[0] ? `正确答案概率 ${pr[0].toFixed(2)} 高于最强干扰项 ${q1.toFixed(2)}，是众数：投票越多越准。` : `最强干扰项 ${q1.toFixed(2)} 不低于正确答案 ${pr[0].toFixed(2)}：错误答案成了众数，投票越多错得越坚定。`;
    mvPlot.redraw(); stats2();
  }
  const mvPlot = LAB.canvas('#mv-plot', (ctx, w, h) => {
    if (!vote) return;
    const P = new LAB.Plot(ctx, w, h, { xmin: 1, xmax: 64, ymin: 0, ymax: 1, xlabel: '采样数 N', ylabel: '准确率', yticks: 5, pad: { l: 46, r: 12, t: 10, b: 38 } }).axes();
    const p = vote.pr[0], q1 = Math.max(...vote.pr.slice(1));
    P.hline(p, C.c4, [4, 3], 1.2); P.hline(q1, LAB.mix(C.c4, '#ffffff', 0.4), [2, 3], 1);
    P.text(63, p, `p = ${p.toFixed(2)}`, C.coral, 'right', 'bottom', '11.5px ' + FONT);
    P.text(63, q1, `最强干扰项 ${q1.toFixed(2)}`, LAB.mix(C.c4, C.ink, 0.2), 'right', q1 > p ? 'bottom' : 'top', '11.5px ' + FONT);
    P.fn((N) => 1 - Math.pow(1 - p, N), C.c1, 1.8, [6, 4]);
    P.line(VN, vote.acc, C.c3, 2.6); P.points(VN, vote.acc, C.c3, 2.2);
    const N = 2 ** bnN.get(); if (N <= 64) P.vline(N, C.amber, [4, 3], 1.4);
  });
  function stats2() {
    const N = 2 ** bnN.get();
    bns.r.set(emax(N).toFixed(3)); bns.k.set(`${kl(N).toFixed(3)}<small>nats</small>`);
    if (vote) { bns.m.set(pct(vote.cur)); bns.p.set(pct(1 - Math.pow(1 - vote.pr[0], N))); }
  }
  let pend = 0;
  function sched2() { if (pend) return; pend = setTimeout(() => { pend = 0; runVote(); }, 16); }
  function update2() { rew.redraw(); klCv.redraw(); sched2(); stats2(); }
  runVote(); update2();

  /* ================= 实验 3：PUCT 树搜索 + GRPO ================= */
  const mk = () => ({
    label: '题目', N: 0, W: 0, children: [
      { id: 'A', text: '两边减 5：3x = 15', P: 0.35, N: 0, W: 0, children: [{ id: 'A1', text: 'x = 15 ÷ 3 = 5', P: 0.7, v: 0.95, N: 0, W: 0 }, { id: 'A2', text: 'x = 15 − 3 = 12', P: 0.3, v: 0.05, N: 0, W: 0 }] },
      { id: 'B', text: '两边除以 3：x + 5 = 20/3', P: 0.45, N: 0, W: 0, children: [{ id: 'B1', text: 'x = 20/3 − 5 = 5/3', P: 0.5, v: 0.1, N: 0, W: 0 }, { id: 'B2', text: '改正：x + 5/3 = 20/3，x = 5', P: 0.5, v: 0.6, N: 0, W: 0 }] },
      { id: 'C', text: '试数：x = 4 得 17', P: 0.2, N: 0, W: 0, children: [{ id: 'C1', text: '17 < 20，再试 x = 5，正好', P: 0.6, v: 0.9, N: 0, W: 0 }, { id: 'C2', text: '差 3，所以 x = 7', P: 0.4, v: 0.05, N: 0, W: 0 }] },
    ],
  });
  let tree = mk(), lastPath = null, tsR = LAB.rng(2025), rewardSum = 0;
  const tsC = LAB.slider('#ts-c', { label: '探索系数 $c_{\\text{puct}}$', min: 0, max: 3, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), onInput: () => draw3() });
  const Q = (n) => (n.N ? n.W / n.N : 0);
  const score = (parentTotal, a, c) => Q(a) + c * a.P * Math.sqrt(parentTotal) / (1 + a.N);
  function select(node) {
    const tot = node.children.reduce((s, a) => s + a.N, 0), c = tsC.get();
    let best = null, bs = -Infinity;
    node.children.forEach((a) => { const s = score(tot, a, c); if (s > bs + 1e-12 || (Math.abs(s - bs) <= 1e-12 && a.P > best.P)) { bs = s; best = a; } });
    return best;
  }
  function simulate() {
    const a = select(tree), leaf = select(a), r = tsR() < leaf.v ? 1 : 0;
    [tree, a, leaf].forEach((n) => { n.N++; n.W += r; });
    rewardSum += r; lastPath = [a, leaf, r];
  }
  $('#ts-one').onclick = () => { simulate(); draw3(); };
  let tsTick = 0;
  const tsRun = anim('search', () => { if (++tsTick % 5) return true; simulate(); draw3(); return tree.N < 400; }, () => { $('#ts-auto').innerHTML = '▶ 自动模拟'; });
  $('#ts-auto').onclick = () => { if (tsRun.running) { tsRun.stop(); return; } tsRun.start(); $('#ts-auto').innerHTML = '❚❚ 暂停'; };
  $('#ts-reset').onclick = () => { tsRun.stop(); tree = mk(); lastPath = null; rewardSum = 0; tsR = LAB.rng(2025); draw3(); };
  const tss = { n: LAB.stat('#ts-stats', '模拟次数'), r: LAB.stat('#ts-stats', '平均奖励', 'teal'), b: LAB.stat('#ts-stats', '访问最多的路径', 'amber'), v: LAB.stat('#ts-stats', '该路径真实答对率', 'leaf') };
  $('#ts-legend').innerHTML = tree.children.map((a) => `<b>${a.id}</b> ${a.text}（${a.children.map((l) => `<b>${l.id}</b> ${l.text}`).join('；')}）`).join('<br>');
  const treeCv = LAB.canvas('#ts-tree', (ctx, w, h) => {
    const narrow = w < 600, root = { x: w / 2, y: 26 }, ys = [h * 0.42, h * 0.8];
    const tot = Math.max(1, tree.N), cw = Math.min(210, w / 3.3), lw = Math.min(150, w / 6.6);
    const pos = new Map();
    tree.children.forEach((a, i) => { const x = w * (1 + 2 * i) / 6; pos.set(a, { x, y: ys[0] }); a.children.forEach((l, j) => pos.set(l, { x: x + (j ? 1 : -1) * w / 12, y: ys[1] })); });
    const onPath = (n) => lastPath && (lastPath[0] === n || lastPath[1] === n);
    const edge = (p0, p1, n) => { ctx.save(); ctx.strokeStyle = onPath(n) ? C.amber : LAB.mix(C.c1l, C.navy, Math.min(1, n.N / tot * 1.5)); ctx.lineWidth = 1.2 + 9 * n.N / tot; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); ctx.restore(); };
    tree.children.forEach((a) => { const pa = pos.get(a); edge(root, pa, a); a.children.forEach((l) => edge(pa, pos.get(l), l)); });
    const box = (p, bw, bh, lines, hl, fill) => {
      ctx.save(); ctx.fillStyle = fill || '#fff'; ctx.strokeStyle = hl ? C.amber : C.line; ctx.lineWidth = hl ? 2.2 : 1.2;
      LAB.roundRect(ctx, p.x - bw / 2, p.y - bh / 2, bw, bh, 9); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lines.forEach(([t, f, col], i) => { ctx.fillStyle = col || C.ink; ctx.font = f; ctx.fillText(t, p.x, p.y + (i - (lines.length - 1) / 2) * 14.5, bw - 8); });
      ctx.restore();
    };
    box(root, narrow ? 64 : 120, 30, [[narrow ? '题目' : `题目　N = ${tree.N}`, '600 12.5px ' + FONT, C.navy]], false, C.c1l);
    tree.children.forEach((a) => {
      const p = pos.get(a);
      box(p, cw, narrow ? 46 : 48, narrow ? [[a.id + `  P ${a.P}`, '600 12px ' + FONT, C.navy], [`N ${a.N}  Q ${Q(a).toFixed(2)}`, '11px Avenir Next, sans-serif', C.slate]]
        : [[`${a.id}  ${a.text}`, '600 12px ' + FONT, C.navy], [`P ${a.P.toFixed(2)} · N ${a.N} · Q ${Q(a).toFixed(2)}`, '11.5px Avenir Next, sans-serif', C.slate]], onPath(a));
      a.children.forEach((l) => {
        const q = pos.get(l);
        box(q, lw, narrow ? 58 : 62, [[narrow ? l.id : `${l.id}  ${l.text}`, (narrow ? '600 12px ' : '600 11px ') + FONT, C.navy], [narrow ? `N ${l.N}` : `P ${l.P} · N ${l.N}`, '11px Avenir Next, sans-serif', C.slate], [narrow ? l.v.toFixed(2) : `真实 ${l.v.toFixed(2)}`, '600 11px Avenir Next, sans-serif', l.v > 0.5 ? C.leaf : C.coral]], onPath(l));
      });
    });
    if (lastPath) { const p = pos.get(lastPath[1]); ctx.save(); ctx.fillStyle = lastPath[2] ? C.leaf : C.coral; ctx.font = '700 13px Avenir Next, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lastPath[2] ? '+1' : '0', p.x, p.y + 44); ctx.restore(); }
  });
  function draw3() {
    const c = tsC.get(), tot = tree.children.reduce((s, a) => s + a.N, 0), pick = select(tree);
    $('#ts-table').innerHTML = `<table class="data"><tr><th>分支</th><th>$P$</th><th>$N$</th><th>$Q$</th><th>探索项</th><th>PUCT</th></tr>` + tree.children.map((a) => {
      const u = c * a.P * Math.sqrt(tot) / (1 + a.N);
      return `<tr class="${a === pick ? 'pick' : ''}"><td><b>${a.id}</b></td><td class="num">${a.P.toFixed(2)}</td><td class="num">${a.N}</td><td class="num">${Q(a).toFixed(3)}</td><td class="num">${u.toFixed(3)}</td><td class="num"><b>${(Q(a) + u).toFixed(3)}</b></td></tr>`;
    }).join('') + `</table><p class="muted" style="margin:8px 0 0">琥珀色一行是下一次模拟会选的分支（$\\sum_b N=${tot}$）。${tot === 0 ? '还没有访问时探索项都为 0，按先验 $P$ 打破平局。' : ''}</p>`;
    LAB.renderMath($('#ts-table'));
    // 书中手算
    const p1 = 0.70 + c * 0.40 * 4 / 8, p2 = 0.50 + c * 0.50 * 4 / 2, ch = p2 > p1 ? 2 : 1;
    const row = (name, q, pp, n, val, on) => `<div class="formula" style="${on ? 'border-left-color:var(--amber);background:var(--c2l)' : ''}"><div class="small">${name}：$Q=${q}$，$P=${pp}$，$N=${n}$${on ? '　<b style="color:var(--amber)">← 选它</b>' : ''}</div>$$${q}+${c.toFixed(2)}\\times ${pp}\\times\\frac{\\sqrt{16}}{1+${n}}=${val.toFixed(2)}$$</div>`;
    $('#ts-book').innerHTML = `<p class="muted" style="margin:0 0 6px">根节点已访问 $\\sum_b N=16$ 次，当前 $c_{\\text{puct}}=${c.toFixed(2)}$：</p>` +
      row('分支 1（老路）', '0.70', '0.40', 7, p1, ch === 1) + row('分支 2（新路）', '0.50', '0.50', 1, p2, ch === 2) + `
      <p class="muted" style="margin:8px 0 0">两者相等的临界点：$0.70+0.2c=0.50+c\\Rightarrow c=0.25$。${ch === 2 ? '现在选新路，去探索访问不足的高先验分支。' : '现在选老路，只吃已知的高分。'}</p>`;
    LAB.renderMath($('#ts-book'));
    // 统计
    let bestLeaf = null; tree.children.forEach((a) => a.children.forEach((l) => { if (!bestLeaf || l.N > bestLeaf.N) bestLeaf = l; }));
    tss.n.set(tree.N); tss.r.set(tree.N ? (rewardSum / tree.N).toFixed(3) : '–');
    tss.b.set(tree.N ? `${bestLeaf.id}<small>${bestLeaf.N} 次</small>` : '–'); tss.v.set(tree.N ? bestLeaf.v.toFixed(2) : '–');
    treeCv.redraw();
  }
  draw3();

  // ---- GRPO ----
  let G = 4, rw = [1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0];
  const grG = LAB.slider('#gr-g', { label: '组大小 $G$', min: 2, max: 16, step: 1, value: 4, onInput: (v) => { G = v; renderGR(); } });
  LAB.segmented('#gr-preset', ['书中例子', '只有 1 个对', '全对'], 0, (i) => {
    if (i === 0) { G = 4; rw = [1, 1, 0, 0].concat(rw.slice(4)); }
    else if (i === 1) { rw = rw.map((_, j) => (j === 0 ? 1 : 0)); }
    else rw = rw.map(() => 1);
    grG.set(G); renderGR();
  });
  function adv() {
    const r = rw.slice(0, G), m = M.mean(r), sd = M.std(r);
    return { r, m, sd, A: r.map((x) => (x - m) / (sd + 1e-6)) };
  }
  function renderGR() {
    const host = $('#gr-chips'); host.innerHTML = '';
    rw.slice(0, G).forEach((x, i) => {
      const b = document.createElement('button'); b.className = 'rw ' + (x ? 'ok' : 'bad'); b.innerHTML = `#${i + 1}<br><b>${x ? '对 1' : '错 0'}</b>`;
      b.onclick = () => { rw[i] = 1 - rw[i]; renderGR(); };
      host.appendChild(b);
    });
    const a = adv();
    $('#gr-cap').innerHTML = `组均值 $\\operatorname{mean}(\\mathbf r)=${a.m.toFixed(3)}$，标准差 $\\operatorname{std}(\\mathbf r)=${a.sd.toFixed(3)}$，优势之和 $\\sum_i\\hat A_i=${Math.abs(M.sum(a.A)) < 1e-9 ? '0' : M.sum(a.A).toFixed(3)}$。` + (a.sd < 1e-9 ? '<b style="color:var(--coral)">整组得分相同：所有优势都是 0，这道题对训练没有贡献。</b>' : '');
    LAB.renderMath($('#gr-cap'));
    grBars.redraw();
  }
  const grBars = LAB.canvas('#gr-bars', (ctx, w, h) => {
    const a = adv(), Y = Math.max(2, Math.ceil(Math.max(...a.A.map(Math.abs)) + 0.3));
    const P = new LAB.Plot(ctx, w, h, { xmin: 0.4, xmax: G + 0.6, ymin: -Y, ymax: Y, xtickValues: M.range(G).map((i) => i + 1), xfmt: (v) => '#' + v, ylabel: '优势 Â', yticks: 4, pad: { l: 44, r: 10, t: 12, b: 28 } }).axes();
    P.hline(0, C.slate, null, 1.2);
    const bw = Math.min(46, (P.tx(2) - P.tx(1)) * 0.6);
    P.bars(a.A.map((_, i) => i + 1), a.A, a.A.map((v) => (v >= 0 ? C.c3 : C.c4)), bw);
    a.A.forEach((v, i) => P.text(i + 1, v + (v >= 0 ? 0.08 : -0.08), (v >= 0 ? '+' : '') + v.toFixed(2), v >= 0 ? C.leaf : C.coral, 'center', v >= 0 ? 'bottom' : 'top', G > 10 ? '600 10px Avenir Next, sans-serif' : NUM));
  });
  renderGR();
})();
