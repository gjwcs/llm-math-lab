/* =========================================================================
   《大模型的数学基础》在线交互实验室 —— 公共脚本
   提供：章节目录、顶栏/页脚、滑块与按钮组件、Canvas 绘图（Plot）、数学工具
   每个章节页面：<body data-chapter="5">，并在页面脚本里调用 LAB.page({...})
   ========================================================================= */
(function () {
  'use strict';

  const COLORS = {
    navy: '#1D3557', navy2: '#2C4F7C', sky: '#4A90C8', teal: '#1A8C8C', amber: '#E09A2D',
    coral: '#D1495B', plum: '#6B4C9A', leaf: '#2F8F5B', slate: '#5C6773', ink: '#1F2329',
    mist: '#E8EDF3', line: '#E3E8EF', paper: '#FBF7EF',
    c1: '#2F6DB5', c2: '#E09A2D', c3: '#2F8F5B', c4: '#D1495B', c5: '#6B4C9A', c6: '#1A8C8C',
    c1l: '#DCE8F6', c2l: '#FBEBD2', c3l: '#D9EFE2', c4l: '#F8DCE0', c5l: '#E7DFF3', c6l: '#D3EEEE',
  };
  const SERIES = [COLORS.c1, COLORS.c2, COLORS.c3, COLORS.c4, COLORS.c5, COLORS.c6];

  const PARTS = [
    { no: 'PART I', title: '第一篇 · 语言如何变成几何与概率？', en: 'Information, High-Dimensional Geometry, and Approximation' },
    { no: 'PART II', title: '第二篇 · Transformer 架构的数学解剖', en: 'The Mathematical Anatomy of Transformer Architecture' },
    { no: 'PART III', title: '第三篇 · 训练动力学、泛化定律与高效适配', en: 'Optimization Dynamics, Scaling Laws, and Low-Resource Adaptation' },
    { no: 'PART IV', title: '第四篇 · 扩散模型、神经算子、不确定性量化与推理前沿', en: 'Diffusion, Neural Operators, Uncertainty, and Test-Time Scaling' },
  ];

  // icon: 单个 emoji 或字符；color：卡片图标底色
  const CHAPTERS = [
    { n: 1, part: 0, icon: '🎲', color: COLORS.c1, title: '概率论与信息论视角下的语言', sub: '大模型到底在算什么？', demo: '给“太阳从＿＿边升起”开罚单，看交叉熵、KL 与温度；亲自玩一局香农的“猜字母赌局”；再看连乘下溢与困惑度“平均几选一”。' },
    { n: 2, part: 0, icon: '🧭', color: COLORS.c6, title: '高维空间的几何学', sub: '词向量、内积与为什么高维空间这么奇妙？', demo: '拖动猫、狗、国王的词向量算余弦，验证“国王 − 男人 + 女人 ≈ 王后”；扔硬币造随机箭头看高维近似正交；切高维西瓜，看注意力为什么要除以 √d。' },
    { n: 3, part: 0, icon: '📐', color: COLORS.c3, title: '逼近论与表征学习', sub: '为什么简单的折线（ReLU）能拼出世间万物？', demo: '三个 ReLU 搭帐篷并拼出抛物线；对折 L 次数出 2^L 段折线；比较 ReLU、SiLU、GELU 与死亡 ReLU。' },
    { n: 4, part: 0, icon: '🌀', color: COLORS.c5, title: '从“把床单提起来切蛋糕”看懂核方法与神经正切核（NTK）', sub: '', demo: '把异或点提到三维一刀切开；先点积再平方，验证核技巧与指数核展开；两道题的 NTK 误差赛跑。' },
    { n: 5, part: 1, icon: '🔦', color: COLORS.c1, title: '注意力机制（Attention）到底在算什么？', sub: '从查字典、Softmax 到为什么要除以 √dₖ', demo: '图书馆借书三步走（打分、Softmax、加权抄笔记）；√dₖ 如何救活导数；“我/喝/水”的因果掩码与 KV 缓存。' },
    { n: 6, part: 1, icon: '🕰️', color: COLORS.c2, title: '怎么让模型知道词的先后顺序？', sub: '从贴门牌号到 RoPE（旋转位置编码）的钟表指针魔法', demo: '钟表指针转出相对距离；4 维向量里秒针时针一起转；调慢表针（位置插值与 NTK 缩放）读长文。' },
    { n: 7, part: 1, icon: '🛣️', color: COLORS.c3, title: '为什么 100 层的深网络不会传丢信号？', sub: '残差直通车（Residual）、RMSNorm 与 SwiGLU 门控', demo: '百层连乘与 +1 直通车；(1,2,3,4) 的 LayerNorm 与 RMSNorm 手算对比；SwiGLU 水龙头车间。' },
    { n: 8, part: 1, icon: '📮', color: COLORS.c4, title: '怎么让大模型又大又快？', sub: '稀疏混合专家（MoE 专科医院分诊）与状态空间模型（Mamba）', demo: '分诊台与负载均衡罚款；Mamba 抗噪备忘录；注意力 T² 与 MoE 激活参数“两堵墙”。' },
    { n: 9, part: 2, icon: '🧗', color: COLORS.c4, title: '怎么一步步拧好几百亿个旋钮？', sub: '从梯度下降（SGD）、动量惯性到 AdamW 与余弦退火', demo: '窄山谷 f=x²+25y² 上的 SGD / 动量 / AdamW 赛跑；“的”与“熵”的两个记账本与权重衰减橡皮筋；预热加余弦退火时刻表。' },
    { n: 10, part: 2, icon: '📈', color: COLORS.c1, title: '为什么“大力出奇迹”是一条精确的数学规律？', sub: '双下降现象与 Chinchilla 算力缩放定律（Scaling Laws）', demo: '给定算力求 Chinchilla 最优 N、D；N 个旋钮平分一道题与临界插值爆炸；双下降曲线。' },
    { n: 11, part: 2, icon: '🧩', color: COLORS.c3, title: '怎么用一张游戏显卡微调百亿大模型？', sub: 'LoRA 低秩适配的线性代数魔术', demo: '一列乘一行拼出低秩矩阵；LoRA 显存账本；B=0 初始化的第 1 步求导与无痕合并。' },
    { n: 12, part: 2, icon: '🌡️', color: COLORS.c2, title: '模型怎么开口说话、怎么听懂人类好恶？', sub: '温度采样、Top-p 核采样与 DPO 直接偏好优化', demo: '贪心接龙为什么会复读；温度与 Top-p 筛子；DPO 一拉一踩，损失从 0.693 降到 0.127。' },
    { n: 13, part: 3, icon: '☕', color: COLORS.c5, title: '怎么让 AI 像画家一样从雪花噪点里画出高清大片？', sub: '去噪扩散模型（DDPM）、指路箭头（Score）与直线滑梯（流匹配 Flow Matching）', demo: '一步加雪花的闭式公式；猜雪花与指路箭头（Score）；直线滑梯（流匹配）与 CFG 引导。' },
    { n: 14, part: 3, icon: '🔥', color: COLORS.c4, title: '怎么用神经网络一秒钟算出台风路径与流体力学？', sub: '神经算子 DeepONet 与傅里叶神经算子（FNO）', demo: '铁棒热量散开算子；FNO 的频谱截断；物理残差罚分。' },
    { n: 15, part: 3, icon: '🩺', color: COLORS.c6, title: '怎么知道大模型是不是在“一本正经地胡说八道”？', sub: '不确定性拆解、温度校准与共形预测（Conformal Prediction）', demo: '三个同桌的熵分解与语义熵；打分除以温度 T 与可靠性图；摸底考排名画共形预测分数线。' },
    { n: 16, part: 3, icon: '♟️', color: COLORS.c1, title: '为什么让模型“先打草稿一步步想”就能做出奥数题？', sub: '思维链（CoT）、Best-of-N 抽卡与树搜索（Test-Time Compute）', demo: '两步草稿过河（思维链的连乘账）；Best-of-N 抽卡命中率、ORM 与 PRM、多数投票；UCT 选路逐步演示。' },
  ];
  const pad2 = (n) => String(n).padStart(2, '0');
  const chapterUrl = (n) => `ch${pad2(n)}.html`;

  // ------------------------------------------------------------------ 顶栏与页脚
  function topbar(current) {
    const opts = CHAPTERS.map((c) => `<option value="${chapterUrl(c.n)}" ${c.n === current ? 'selected' : ''}>第 ${c.n} 章 · ${c.title}</option>`).join('');
    const prev = current > 1 ? chapterUrl(current - 1) : null;
    const next = current && current < 16 ? chapterUrl(current + 1) : null;
    return `<div class="topbar"><div class="topbar-inner">
      <a class="brand" href="index.html"><span class="brand-mark">LM</span><span>大模型的数学基础<small>在线交互实验室</small></span></a>
      <span class="spacer"></span>
      ${current ? `<a class="icon-btn ${prev ? '' : 'disabled'}" href="${prev || '#'}" title="上一章">‹</a>` : ''}
      <select class="chap-select" onchange="location.href=this.value" aria-label="选择章节">
        ${current ? '' : '<option selected disabled>选择章节…</option>'}${opts}</select>
      ${current ? `<a class="icon-btn ${next ? '' : 'disabled'}" href="${next || '#'}" title="下一章">›</a>` : ''}
    </div></div>`;
  }
  function hero(c, bookRef) {
    return `<section class="hero"><div class="hero-inner"><div>
      <div class="eyebrow">Chapter ${pad2(c.n)} · ${PARTS[c.part].no}</div>
      <h1>第 ${c.n} 章　${c.title}</h1>
      <p>${c.sub ? c.sub + (/[？?！!。]$/.test(c.sub) ? '' : '。') : ''}${c.demo}</p>
      ${bookRef ? `<div class="book-ref">📖 ${bookRef}</div>` : ''}
    </div><div class="chap-no">${pad2(c.n)}</div></div></section>`;
  }
  function pager(n) {
    const p = CHAPTERS[n - 2], q = CHAPTERS[n];
    return `<nav class="pager">
      ${p ? `<a class="prev" href="${chapterUrl(p.n)}"><div class="dir">‹ 上一章</div><div class="t">第 ${p.n} 章 · ${p.title}</div></a>` : '<span style="flex:1"></span>'}
      ${q ? `<a class="next" href="${chapterUrl(q.n)}"><div class="dir">下一章 ›</div><div class="t">第 ${q.n} 章 · ${q.title}</div></a>` : '<span style="flex:1"></span>'}
    </nav>`;
  }
  const FOOTER = `<footer class="site">《大模型的数学基础：从人类直觉、算法公理到零算力实战》配套在线实验室 · 顾嘉伟　李泽超 著<br>
    所有计算都在你的浏览器本地完成，无需安装、无需显卡、不收集任何数据。</footer>`;

  // 页面装配：LAB.page({ bookRef: '对应书中 §5.2–5.4', experiments: [{id, title, init}] })
  function page(cfg) {
    const n = Number(document.body.dataset.chapter);
    const c = CHAPTERS[n - 1];
    document.title = `第 ${n} 章 · ${c.title} | 大模型的数学基础 · 在线实验室`;
    const main = document.querySelector('main');
    document.body.insertAdjacentHTML('afterbegin', topbar(n) + hero(c, cfg.bookRef));
    // 实验切换标签
    const exps = Array.from(main.querySelectorAll('.experiment'));
    if (exps.length > 1) {
      const tabs = document.createElement('div');
      tabs.className = 'tabs';
      exps.forEach((e, i) => {
        const b = document.createElement('button');
        b.className = 'tab' + (i === 0 ? ' active' : '');
        b.innerHTML = `<span class="k">${i + 1}</span>${e.dataset.title}`;
        b.onclick = () => {
          tabs.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
          exps.forEach((x) => x.classList.remove('active'));
          b.classList.add('active'); e.classList.add('active');
          history.replaceState(null, '', '#' + e.id);
          window.dispatchEvent(new Event('resize'));
        };
        tabs.appendChild(b);
      });
      main.prepend(tabs);
      const h = location.hash.slice(1);
      const target = exps.findIndex((e) => e.id === h);
      const k = target >= 0 ? target : 0;
      exps.forEach((e, i) => e.classList.toggle('active', i === k));
      tabs.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === k));
      window.addEventListener('hashchange', () => { const i = exps.findIndex((e) => e.id === location.hash.slice(1)); if (i >= 0) tabs.querySelectorAll('.tab')[i].click(); });
    } else if (exps[0]) exps[0].classList.add('active');
    main.insertAdjacentHTML('beforeend', pager(n));
    document.body.insertAdjacentHTML('beforeend', FOOTER);
    renderMath(document.body);
  }

  // ------------------------------------------------------------------ KaTeX
  function renderMath(el) {
    if (window.renderMathInElement) {
      window.renderMathInElement(el || document.body, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }],
        throwOnError: false,
      });
    }
  }
  function tex(str, display) {
    if (!window.katex) return str;
    return window.katex.renderToString(str, { displayMode: !!display, throwOnError: false });
  }

  // ------------------------------------------------------------------ 控件
  // LAB.slider('#host', {label, min, max, step, value, fmt, hint, onInput})  → {get, set, el}
  function slider(host, o) {
    host = typeof host === 'string' ? document.querySelector(host) : host;
    const wrap = document.createElement('div');
    wrap.className = 'control';
    const fmt = o.fmt || ((v) => v);
    wrap.innerHTML = `<div class="control-head"><span>${o.label}</span><span class="val"></span></div>
      <input type="range" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${o.value}">
      ${o.hint ? `<div class="hint">${o.hint}</div>` : ''}`;
    host.appendChild(wrap);
    const input = wrap.querySelector('input[type=range]'), val = wrap.querySelector('.val');
    const paint = () => {
      const lo = Number(input.min), hi = Number(input.max);
      const p = hi > lo ? ((input.value - lo) / (hi - lo)) * 100 : 0;
      input.style.setProperty('--p', p + '%');
      val.innerHTML = fmt(Number(input.value));
    };
    input.addEventListener('input', () => { paint(); o.onInput && o.onInput(Number(input.value)); });
    paint();
    renderMath(wrap);
    return {
      el: wrap, input,
      get: () => Number(input.value),
      set: (v, fire) => { input.value = v; paint(); if (fire && o.onInput) o.onInput(Number(input.value)); },
      setRange: (min, max, step) => { input.min = min; input.max = max; if (step != null) input.step = step; paint(); },
    };
  }
  // LAB.segmented('#host', ['A','B'], idx, onChange) → {get, set}
  function segmented(host, labels, idx, onChange) {
    host = typeof host === 'string' ? document.querySelector(host) : host;
    const seg = document.createElement('div');
    seg.className = 'seg';
    let cur = idx || 0;
    labels.forEach((l, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.innerHTML = l;
      if (i === cur) b.classList.add('active');
      b.onclick = () => { cur = i; seg.querySelectorAll('button').forEach((x, j) => x.classList.toggle('active', j === i)); onChange && onChange(i); };
      seg.appendChild(b);
    });
    host.appendChild(seg);
    renderMath(seg);
    return { el: seg, get: () => cur, set: (i) => seg.querySelectorAll('button')[i].click() };
  }
  function checkbox(host, label, checked, onChange) {
    host = typeof host === 'string' ? document.querySelector(host) : host;
    const l = document.createElement('label');
    l.className = 'check';
    l.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''}><span>${label}</span>`;
    host.appendChild(l);
    const inp = l.querySelector('input');
    inp.addEventListener('change', () => onChange && onChange(inp.checked));
    renderMath(l);
    return { el: l, get: () => inp.checked, set: (v) => { inp.checked = v; } };
  }
  function stat(host, label, cls) {
    host = typeof host === 'string' ? document.querySelector(host) : host;
    const d = document.createElement('div');
    d.className = 'stat ' + (cls || '');
    d.innerHTML = `<div class="label">${label}</div><div class="value">–</div>`;
    host.appendChild(d);
    renderMath(d);
    const v = d.querySelector('.value');
    return { el: d, set: (html) => { v.innerHTML = html; } };
  }

  // ------------------------------------------------------------------ Canvas
  // LAB.canvas('#host', draw) ：自动适配高分屏与尺寸变化；draw(ctx, w, h) 每次重绘时调用
  function canvas(host, draw) {
    host = typeof host === 'string' ? document.querySelector(host) : host;
    const cv = document.createElement('canvas');
    cv.className = 'canvas-fill';
    host.appendChild(cv);
    const ctx = cv.getContext('2d');
    const state = { w: 0, h: 0, draw };
    function resize() {
      const r = host.getBoundingClientRect();
      if (r.width < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      state.w = r.width; state.h = r.height || r.width * 0.62;
      cv.width = Math.round(state.w * dpr); cv.height = Math.round(state.h * dpr);
      cv.style.height = state.h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }
    function redraw() { if (state.w > 0) { ctx.clearRect(0, 0, state.w, state.h); state.draw && state.draw(ctx, state.w, state.h); } }
    new ResizeObserver(resize).observe(host);
    window.addEventListener('resize', resize);
    setTimeout(resize, 0);
    return { canvas: cv, ctx, redraw, get w() { return state.w; }, get h() { return state.h; }, setDraw(f) { state.draw = f; redraw(); } };
  }

  // ------------------------------------------------------------------ Plot：坐标系绘图
  // const P = new LAB.Plot(ctx, w, h, {xmin,xmax,ymin,ymax, xlabel, ylabel, logx, logy, pad})
  class Plot {
    constructor(ctx, w, h, o) {
      this.ctx = ctx; this.o = Object.assign({ pad: { l: 52, r: 16, t: 14, b: 40 }, grid: true, xticks: 5, yticks: 5 }, o);
      const p = this.o.pad;
      this.x0 = p.l; this.x1 = w - p.r; this.y0 = h - p.b; this.y1 = p.t; this.w = w; this.h = h;
    }
    tx(x) { const o = this.o; const f = o.logx ? (Math.log10(x) - Math.log10(o.xmin)) / (Math.log10(o.xmax) - Math.log10(o.xmin)) : (x - o.xmin) / (o.xmax - o.xmin); return this.x0 + f * (this.x1 - this.x0); }
    ty(y) { const o = this.o; const f = o.logy ? (Math.log10(y) - Math.log10(o.ymin)) / (Math.log10(o.ymax) - Math.log10(o.ymin)) : (y - o.ymin) / (o.ymax - o.ymin); return this.y0 - f * (this.y0 - this.y1); }
    ix(px) { const o = this.o; const f = (px - this.x0) / (this.x1 - this.x0); return o.logx ? Math.pow(10, Math.log10(o.xmin) + f * (Math.log10(o.xmax) - Math.log10(o.xmin))) : o.xmin + f * (o.xmax - o.xmin); }
    iy(py) { const o = this.o; const f = (this.y0 - py) / (this.y0 - this.y1); return o.logy ? Math.pow(10, Math.log10(o.ymin) + f * (Math.log10(o.ymax) - Math.log10(o.ymin))) : o.ymin + f * (o.ymax - o.ymin); }
    ticks(min, max, n, log) {
      if (log) {
        const a = [], e0 = Math.floor(Math.log10(min)), e1 = Math.ceil(Math.log10(max));
        const mults = e1 - e0 <= 1 ? [1, 2, 3, 5, 7] : e1 - e0 <= 3 ? [1, 2, 5] : [1];
        for (let e = e0; e <= e1; e++) for (const m of mults) { const v = m * Math.pow(10, e); if (v >= min * (1 - 1e-9) && v <= max * (1 + 1e-9)) a.push(v); }
        return a;
      }
      const span = max - min, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || mag * 10;
      const a = []; for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) a.push(+v.toFixed(10));
      return a;
    }
    fmt(v) { if (v === 0) return '0'; const a = Math.abs(v); if (a >= 1e4 || a < 1e-3) { const e = Math.floor(Math.log10(a)); const m = v / Math.pow(10, e); return (Math.abs(m - 1) < 1e-9 ? '' : m.toFixed(1) + '×') + '10' + sup(e); } return String(+v.toFixed(4)); }
    axes() {
      const c = this.ctx, o = this.o;
      c.save();
      c.font = '11px ' + getComputedStyle(document.body).getPropertyValue('--font-num');
      c.fillStyle = COLORS.slate; c.strokeStyle = COLORS.line; c.lineWidth = 1;
      const xt = o.xtickValues || this.ticks(o.xmin, o.xmax, o.xticks, o.logx);
      const yt = o.ytickValues || this.ticks(o.ymin, o.ymax, o.yticks, o.logy);
      c.textAlign = 'center'; c.textBaseline = 'top';
      xt.forEach((v) => { const X = this.tx(v); if (o.grid) { c.beginPath(); c.moveTo(X, this.y0); c.lineTo(X, this.y1); c.stroke(); } c.fillText(o.xfmt ? o.xfmt(v) : this.fmt(v), X, this.y0 + 6); });
      c.textAlign = 'right'; c.textBaseline = 'middle';
      yt.forEach((v) => { const Y = this.ty(v); if (o.grid) { c.beginPath(); c.moveTo(this.x0, Y); c.lineTo(this.x1, Y); c.stroke(); } c.fillText(o.yfmt ? o.yfmt(v) : this.fmt(v), this.x0 - 7, Y); });
      c.strokeStyle = '#9aa5b1'; c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(this.x0, this.y1); c.lineTo(this.x0, this.y0); c.lineTo(this.x1, this.y0); c.stroke();
      c.fillStyle = COLORS.ink; c.font = '12px ' + getComputedStyle(document.body).getPropertyValue('--font');
      if (o.xlabel) { c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(o.xlabel, (this.x0 + this.x1) / 2, this.h - 2); }
      if (o.ylabel) { c.save(); c.translate(12, (this.y0 + this.y1) / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.ylabel, 0, 0); c.restore(); }
      c.restore();
      return this;
    }
    clip() { const c = this.ctx; c.save(); c.beginPath(); c.rect(this.x0, this.y1 - 1, this.x1 - this.x0 + 1, this.y0 - this.y1 + 2); c.clip(); return this; }
    unclip() { this.ctx.restore(); return this; }
    line(xs, ys, color, width, dash) {
      const c = this.ctx; c.save(); c.strokeStyle = color || COLORS.c1; c.lineWidth = width || 2; c.lineJoin = 'round';
      if (dash) c.setLineDash(dash);
      c.beginPath(); let started = false;
      for (let i = 0; i < xs.length; i++) { const y = ys[i]; if (!isFinite(y)) { started = false; continue; } const X = this.tx(xs[i]), Y = this.ty(y); if (!started) { c.moveTo(X, Y); started = true; } else c.lineTo(X, Y); }
      c.stroke(); c.restore(); return this;
    }
    fn(f, color, width, dash, n) { const o = this.o, N = n || 300, xs = [], ys = []; for (let i = 0; i <= N; i++) { const x = o.logx ? Math.pow(10, Math.log10(o.xmin) + i / N * (Math.log10(o.xmax) - Math.log10(o.xmin))) : o.xmin + (o.xmax - o.xmin) * i / N; xs.push(x); ys.push(f(x)); } return this.line(xs, ys, color, width, dash); }
    area(xs, ys, color, alpha, base) {
      const c = this.ctx; c.save(); c.fillStyle = color; c.globalAlpha = alpha == null ? 0.18 : alpha;
      const b = this.ty(base == null ? Math.max(this.o.ymin, 0) : base);
      c.beginPath(); c.moveTo(this.tx(xs[0]), b);
      xs.forEach((x, i) => c.lineTo(this.tx(x), this.ty(ys[i]))); c.lineTo(this.tx(xs[xs.length - 1]), b); c.closePath(); c.fill(); c.restore(); return this;
    }
    points(xs, ys, color, r, stroke) { const c = this.ctx; c.save(); c.fillStyle = color || COLORS.c1; for (let i = 0; i < xs.length; i++) { c.beginPath(); c.arc(this.tx(xs[i]), this.ty(ys[i]), r || 3, 0, 2 * Math.PI); c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.2; c.stroke(); } } c.restore(); return this; }
    bars(xs, ys, color, width, base) { const c = this.ctx; c.save(); for (let i = 0; i < xs.length; i++) { c.fillStyle = Array.isArray(color) ? color[i] : color; const bw = width || 10; const X = this.tx(xs[i]); const Y = this.ty(ys[i]); const B = this.ty(base == null ? 0 : base); roundRect(c, X - bw / 2, Math.min(Y, B), bw, Math.abs(B - Y), Math.min(3, bw / 3)); c.fill(); } c.restore(); return this; }
    vline(x, color, dash, width) { const c = this.ctx; c.save(); c.strokeStyle = color || COLORS.slate; c.lineWidth = width || 1.2; if (dash) c.setLineDash(dash); c.beginPath(); c.moveTo(this.tx(x), this.y0); c.lineTo(this.tx(x), this.y1); c.stroke(); c.restore(); return this; }
    hline(y, color, dash, width) { const c = this.ctx; c.save(); c.strokeStyle = color || COLORS.slate; c.lineWidth = width || 1.2; if (dash) c.setLineDash(dash); c.beginPath(); c.moveTo(this.x0, this.ty(y)); c.lineTo(this.x1, this.ty(y)); c.stroke(); c.restore(); return this; }
    text(x, y, s, color, align, base, font) { const c = this.ctx; c.save(); c.fillStyle = color || COLORS.ink; c.textAlign = align || 'left'; c.textBaseline = base || 'middle'; c.font = font || '12px ' + getComputedStyle(document.body).getPropertyValue('--font'); c.fillText(s, this.tx(x), this.ty(y)); c.restore(); return this; }
  }
  function sup(e) { const m = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }; return String(e).split('').map((ch) => m[ch] || ch).join(''); }
  function roundRect(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function arrow(c, x0, y0, x1, y1, color, width, head) {
    const a = Math.atan2(y1 - y0, x1 - x0), h = head || 8;
    c.save(); c.strokeStyle = c.fillStyle = color || COLORS.navy; c.lineWidth = width || 2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1 - Math.cos(a) * h * 0.6, y1 - Math.sin(a) * h * 0.6); c.stroke();
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - h * Math.cos(a - 0.42), y1 - h * Math.sin(a - 0.42)); c.lineTo(x1 - h * Math.cos(a + 0.42), y1 - h * Math.sin(a + 0.42)); c.closePath(); c.fill(); c.restore();
  }
  // 颜色插值：mix('#ffffff', '#1D3557', t)
  function mix(a, b, t) { const pa = hex(a), pb = hex(b); return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`; }
  function hex(h) { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)); }
  function heat(t) { // 白 → 浅蓝 → 海军蓝
    t = Math.max(0, Math.min(1, t)); return t < 0.5 ? mix('#ffffff', COLORS.c1l, t * 2) : mix(COLORS.c1l, COLORS.navy, (t - 0.5) * 2);
  }
  function diverge(t) { // -1..1 : 蓝 → 白 → 红
    t = Math.max(-1, Math.min(1, t)); return t < 0 ? mix('#ffffff', COLORS.c1, -t) : mix('#ffffff', COLORS.c4, t);
  }

  // ------------------------------------------------------------------ 数学工具
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function rng(seed) {
    const u = mulberry32(seed == null ? 12345 : seed);
    let spare = null;
    const r = () => u();
    r.normal = () => { if (spare !== null) { const s = spare; spare = null; return s; } let a, b, s; do { a = u() * 2 - 1; b = u() * 2 - 1; s = a * a + b * b; } while (s >= 1 || s === 0); const m = Math.sqrt(-2 * Math.log(s) / s); spare = b * m; return a * m; };
    r.int = (n) => Math.floor(u() * n);
    r.choice = (p) => { let x = u(), acc = 0; for (let i = 0; i < p.length; i++) { acc += p[i]; if (x < acc) return i; } return p.length - 1; };
    return r;
  }
  const M = {
    softmax(z, tau) { tau = tau || 1; const m = Math.max(...z); if (!isFinite(m)) return z.map(() => 1 / z.length); const e = z.map((v) => Math.exp((v - m) / tau)); const s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); },
    logsumexp(z) { const m = Math.max(...z); return m + Math.log(z.reduce((a, v) => a + Math.exp(v - m), 0)); },
    entropy(p, base) { const lb = base ? Math.log(base) : 1; return -p.reduce((a, v) => a + (v > 0 ? v * Math.log(v) : 0), 0) / lb; },
    kl(p, q) { return p.reduce((a, v, i) => a + (v > 0 ? v * Math.log(v / Math.max(q[i], 1e-300)) : 0), 0); },
    linspace(a, b, n) { const r = []; for (let i = 0; i < n; i++) r.push(a + (b - a) * i / (n - 1)); return r; },
    range(n) { return Array.from({ length: n }, (_, i) => i); },
    sum(a) { return a.reduce((x, y) => x + y, 0); },
    mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; },
    std(a) { const m = M.mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length); },
    dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; },
    norm(a) { return Math.sqrt(M.dot(a, a)); },
    clamp(x, a, b) { return Math.max(a, Math.min(b, x)); },
    erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; },
    normcdf(x) { return 0.5 * (1 + M.erf(x / Math.SQRT2)); },
    // 逆正态 CDF（Acklam 近似）
    norminv(p) { const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239]; const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]; const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]; const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]; const pl = 0.02425; let q, r; if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); } if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); } q = p - 0.5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); },
    fmt(x, d) { if (!isFinite(x)) return x > 0 ? '∞' : (x < 0 ? '−∞' : '–'); const a = Math.abs(x); if (a !== 0 && (a >= 1e6 || a < 1e-3 || a < Math.pow(10, -(d == null ? 3 : d)))) return x.toExponential(d == null ? 2 : d).replace('e', '×10^').replace(/\^\+?(-?\d+)/, (_, e) => sup(e)); return x.toFixed(d == null ? 3 : d); },
    // 人类可读的大数：1.2B / 340M
    big(x) { const u = [['T', 1e12], ['B', 1e9], ['M', 1e6], ['K', 1e3]]; for (const [s, v] of u) if (Math.abs(x) >= v) return (x / v).toFixed(x / v >= 100 ? 0 : x / v >= 10 ? 1 : 2) + s; return String(Math.round(x)); },
  };

  window.LAB = { COLORS, SERIES, CHAPTERS, PARTS, page, topbar, slider, segmented, checkbox, stat, canvas, Plot, arrow, roundRect, mix, heat, diverge, rng, M, tex, renderMath, chapterUrl, pad2, FOOTER };
})();
