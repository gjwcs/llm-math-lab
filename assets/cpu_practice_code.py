#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
《大模型的数学基础：从人类直觉、算法公理到零算力实战》（全十六章完整版）
作者：顾嘉伟（清华大学深圳国际研究生院）、李泽超（南京理工大学）
配套零算力（100% Python 标准库 math/random/cmath，零第三方依赖）全书 16 章数学定理验证脚本
运行方式：python3 cpu_practice_code.py
"""

import cmath
import math
import random

random.seed(42)


def softmax(logits, tau=1.0):
    scaled = [z / tau for z in logits]
    m = max(scaled)
    exps = [math.exp(z - m) for z in scaled]
    s = sum(exps)
    return [e / s for e in exps]


def chap01_entropy_and_perplexity():
    print("=" * 74)
    print("【第 1 章】香农自信息、交叉熵、KL 散度、困惑度与融合反向梯度 q - p")
    print("=" * 74)
    vocab = ["吃", "睡", "型", "草"]
    p_true = [0.0, 0.0, 1.0, 0.0]  # 真实标签：“型”
    logits = [-0.8, -0.3, 2.0, -0.8]
    q = softmax(logits)
    ce_loss = -sum(p * math.log(qi + 1e-12) for p, qi in zip(p_true, q))
    ppl = math.exp(ce_loss)
    grad_z = [round(qi - pi, 4) for qi, pi in zip(q, p_true)]
    print(f"候选词表: {vocab} | 预测分布 q = {[round(x, 4) for x in q]}")
    print(f"交叉熵损失 L_CE = {ce_loss:.4f} nats | 困惑度 PPL = exp(L_CE) = {ppl:.4f}")
    print(f"融合算子对 Logits 的精确反向梯度 ∂L/∂z = q - p = {grad_z}\n")


def chap02_high_dim_orthogonality():
    print("=" * 74)
    print("【第 2 章】高维空间的“正交祝福”：随机单位向量内积标准差 ≈ 1/√d")
    print("=" * 74)
    for d in [4, 64, 512]:
        dots = []
        for _ in range(400):
            u = [random.gauss(0, 1) for _ in range(d)]
            v = [random.gauss(0, 1) for _ in range(d)]
            nu = math.sqrt(sum(x * x for x in u))
            nv = math.sqrt(sum(x * x for x in v))
            dots.append(sum(x * y for x, y in zip(u, v)) / (nu * nv))
        std_val = math.sqrt(sum(x * x for x in dots) / len(dots))
        print(f"维度 d = {d:4d} | 实测内积标准差 = {std_val:.4f} (理论值 1/√d = {1/math.sqrt(d):.4f})")
    print()


def chap03_relu_approximation_and_folding():
    print("=" * 74)
    print("【第 3 章】万能逼近论与深层复合锯齿折叠 g^(L)(x) = 2^L 段线性区间")
    print("=" * 74)
    # 单隐藏层：M=8 个 ReLU 神经元 f(x) = sum_m c_m ReLU(x - m/8)，在节点 k/8 上插值 sin(2πx)
    knots = [math.sin(2 * math.pi * k / 8) for k in range(9)]
    slopes = [(knots[k + 1] - knots[k]) * 8 for k in range(8)]
    c = [slopes[0]] + [slopes[m] - slopes[m - 1] for m in range(1, 8)]
    fit = lambda x: sum(cm * max(0.0, x - m / 8) for m, cm in enumerate(c))
    err = max(abs(fit(i / 2000) - math.sin(2 * math.pi * i / 2000)) for i in range(2001))
    print(f"M = 8 个 ReLU 神经元插值 sin(2πx) | [0,1] 上最大绝对误差 = {err:.4f}")
    # 深层复合：取二进分点网格（i/1024 在浮点数中精确表示，折点 j/2^L 恰落在网格上，不会漏数）
    xs = [i / 1024.0 for i in range(1025)]
    for L in [1, 2, 3, 4]:
        vs = xs[:]
        for _ in range(L):
            vs = [abs(2.0 * v - 1.0) for v in vs]
        diffs = [vs[i + 1] - vs[i] for i in range(len(vs) - 1)]
        turns = sum(1 for i in range(len(diffs) - 1) if diffs[i] * diffs[i + 1] < 0) + 1
        print(f"深层复合层数 L = {L} | 实测线性折线段数 = {turns:2d} (理论值 2^L = {2**L:2d})")
    print()


def jacobi_eigh(A, sweeps=50, tol=1e-12):
    """对称矩阵的循环 Jacobi 特征分解（纯 Python）。返回 (特征值列表, 特征向量矩阵 V，列为特征向量)。"""
    n = len(A); A = [row[:] for row in A]
    V = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
    for _ in range(sweeps):
        off = sum(A[i][j] ** 2 for i in range(n) for j in range(n) if i != j)
        if off < tol: break
        for p in range(n - 1):
            for q in range(p + 1, n):
                if abs(A[p][q]) < 1e-15: continue
                theta = (A[q][q] - A[p][p]) / (2 * A[p][q])
                t = (1 if theta >= 0 else -1) / (abs(theta) + math.sqrt(theta * theta + 1))
                c = 1 / math.sqrt(t * t + 1); s = t * c
                for k in range(n):
                    akp, akq = A[k][p], A[k][q]
                    A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq
                for k in range(n):
                    apk, aqk = A[p][k], A[q][k]
                    A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk
                for k in range(n):
                    vkp, vkq = V[k][p], V[k][q]
                    V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq
    return [A[i][i] for i in range(n)], V

def ntk_experiment(M=512, n=40, seed=42):
    rng = random.Random(seed)
    xs = [i / (n - 1) for i in range(n)]
    w = [rng.gauss(0, 1) for _ in range(M)]; b = [rng.gauss(0, 1) for _ in range(M)]; a = [rng.gauss(0, 1) for _ in range(M)]
    sq = math.sqrt(M); J = []
    for x in xs:
        row = []
        for j in range(M):
            p = w[j] * x + b[j]
            if p > 0: row += [p / sq, a[j] * x / sq, a[j] / sq]
            else: row += [0.0, 0.0, 0.0]
        J.append(row)
    K = [[sum(u * v for u, v in zip(J[i], J[k])) for k in range(n)] for i in range(n)]
    lam, V = jacobi_eigh(K)
    eta = 1.0 / max(lam)
    def steps_to(y, frac=0.1):
        c = [sum(V[i][k] * y[i] for i in range(n)) for k in range(n)]
        L0 = sum(ci * ci for ci in c)
        loss = lambda t: sum((ci * abs(1 - eta * lk) ** t) ** 2 for ci, lk in zip(c, lam)) / L0
        lo, hi = 0, 1
        while loss(hi) > frac: lo, hi = hi, hi * 2
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if loss(mid) <= frac: hi = mid
            else: lo = mid
        return hi
    s_low = steps_to([math.sin(2 * math.pi * x) for x in xs])
    s_high = steps_to([math.sin(10 * math.pi * x) for x in xs])
    return sorted(lam, reverse=True)[:4], s_low, s_high


def chap04_ntk_spectral_bias():
    print("=" * 74)
    print("【第 4 章】核方法与神经正切核 (NTK) 弧余弦解析核及低频优先收敛")
    print("=" * 74)
    for deg in [0, 45, 90, 180]:
        rad = math.radians(deg)
        # 单层无限宽 ReLU 网络 NNGP/NTK 角度核公式
        k_val = (math.sin(rad) + (math.pi - rad) * math.cos(rad)) / (2 * math.pi)
        print(f"样本夹角 θ = {deg:3d}° | 无限宽 ReLU 核耦合强度 K(θ) = {k_val:.4f}")
    # 宽度 M=512 的双层 ReLU 网络：经验 NTK 矩阵 Θ0 的特征值谱与核梯度下降的频谱偏置
    top, s_low, s_high = ntk_experiment()
    print(f"经验 NTK 矩阵 Θ0 (M=512, 40 个采样点) 最大的 4 个特征值: " + ", ".join(f"{v:.2f}" for v in top))
    print(f"训练损失降到初始值 10% 所需步数: 低频 sin(2πx) {s_low} 步 | 高频 sin(10πx) {s_high} 步 "
          f"=> 低频快 {s_high / s_low:.1f} 倍")
    print()


def chap05_scaled_attention_and_flash_tiling():
    print("=" * 74)
    print("【第 5 章】缩放点积注意力 √d_k 保护梯度 & FlashAttention 在线分块恒等验证")
    print("=" * 74)
    scores = [1.2, -0.5, 2.8, 0.4, 3.1, -1.0]
    p_full = softmax(scores)
    # FlashAttention 分两块在线递推 (块1: 前3个, 块2: 后3个)
    b1, b2 = scores[:3], scores[3:]
    m1, m2 = max(b1), max(b2)
    l1 = sum(math.exp(x - m1) for x in b1)
    l2 = sum(math.exp(x - m2) for x in b2)
    m_new = max(m1, m2)
    l_new = math.exp(m1 - m_new) * l1 + math.exp(m2 - m_new) * l2
    p_flash = [math.exp(x - m_new) / l_new for x in scores]
    max_err = max(abs(a - b) for a, b in zip(p_full, p_flash))
    print(f"标准全局 Softmax 与 FlashAttention 在线分块递推最大绝对误差 = {max_err:.2e}\n")


def chap06_rope_rotation_invariance():
    print("=" * 74)
    print("【第 6 章】RoPE 旋转位置编码：保范正交性与相对位置内积不变性验证")
    print("=" * 74)
    q = complex(1.2, -0.7)
    k = complex(0.5, 1.4)
    theta = 0.25
    dot_2_7 = (q * cmath.exp(1j * 2 * theta) * (k * cmath.exp(1j * 7 * theta)).conjugate()).real
    dot_10_15 = (q * cmath.exp(1j * 10 * theta) * (k * cmath.exp(1j * 15 * theta)).conjugate()).real
    print(f"位置 (m=2, n=7) 旋转内积 = {dot_2_7:.6f} | 位置 (m=10, n=15) 旋转内积 = {dot_10_15:.6f}\n")


def chap07_pre_rmsnorm_and_swiglu():
    print("=" * 74)
    print("【第 7 章】Pre-RMSNorm 雅可比矩阵切空间正交性 J_RMS(x)·x = 0 验证")
    print("=" * 74)
    x = [1.5, -2.0, 0.5, 1.0]
    d = len(x)
    norm_sq = sum(xi * xi for xi in x)
    norm_x = math.sqrt(norm_sq)
    # 计算 (I - x x^T / ||x||^2) x
    proj = [
        (math.sqrt(d) / norm_x) * (x[i] - x[i] * norm_sq / norm_sq)
        for i in range(d)
    ]
    print(f"输入向量 x = {x} | 径向梯度投影 J_RMS(x)·x = {[round(v, 12) for v in proj]}\n")


def chap08_moe_and_mamba_ssm():
    print("=" * 74)
    print("【第 8 章】MoE Top-k 负载均衡辅助损失与 Mamba 零阶保持 (ZOH) 离散化")
    print("=" * 74)
    f = [1.0, 0.5, 0.5, 0.0]
    P = [0.55, 0.20, 0.15, 0.10]
    l_aux = 4 * sum(fi * pi for fi, pi in zip(f, P))
    print(f"4 专家 Top-2 路由失衡时辅助损失 L_aux = {l_aux:.4f} (理想均匀最优值 = 2.0000)")
    # Mamba-2 (标量 A = -a·I) 选择性 SSM：ZOH 离散化后逐步递推 vs. SSD 1-半可分矩阵乘法 y = (L ∘ C B̄^T) x
    rng = random.Random(8)
    T, N, a = 8, 4, 1.0
    dt = [rng.uniform(0.05, 2.0) for _ in range(T)]
    B = [[rng.gauss(0, 1) for _ in range(N)] for _ in range(T)]
    C = [[rng.gauss(0, 1) for _ in range(N)] for _ in range(T)]
    x = [rng.gauss(0, 1) for _ in range(T)]
    a_bar = [math.exp(-d * a) for d in dt]                                  # Ā_t = exp(Δ_t A)
    B_bar = [[(1 - math.exp(-d * a)) / a * b for b in row] for d, row in zip(dt, B)]  # B̄_t = A^{-1}(e^{Δ_t A} - 1) B_t
    h, y_rec = [0.0] * N, []
    for t in range(T):
        h = [a_bar[t] * hn + bn * x[t] for hn, bn in zip(h, B_bar[t])]
        y_rec.append(sum(c * hn for c, hn in zip(C[t], h)))
    y_ssd = [sum(math.prod(a_bar[j + 1:t + 1]) * sum(c * b for c, b in zip(C[t], B_bar[j])) * x[j]
                 for j in range(t + 1)) for t in range(T)]
    err = max(abs(u - v) for u, v in zip(y_rec, y_ssd))
    print(f"Mamba ZOH 逐步递推 vs. SSD 半可分矩阵乘法 (T={T}, N={N}) 输出最大绝对误差 = {err:.2e}\n")


def chap09_adamw_and_muon():
    print("=" * 74)
    print("【第 9 章】AdamW 解耦权重衰减与 Muon 奇次多项式奇异值拉平迭代")
    print("=" * 74)
    sigmas = [0.15, 0.45, 0.85]
    a, b, c = 3.4445, -4.7750, 2.0315
    for _ in range(5):
        sigmas = [a * s + b * (s ** 3) + c * (s ** 5) for s in sigmas]
    print(f"初始奇异值 [0.15, 0.45, 0.85] 经 5 步 Newton-Schulz 迭代后 = {[round(s, 3) for s in sigmas]}\n")


def chap10_chinchilla_scaling_and_emergence():
    print("=" * 74)
    print("【第 10 章】Chinchilla 算力最优分配闭式解与多步推理涌现阶跃验证")
    print("=" * 74)
    C = 6e21
    N_opt = math.sqrt((C / 6.0) / 20.0)
    D_opt = 20.0 * N_opt
    print(f"算力预算 C = 6e21 FLOPs => 最优模型规模 N_opt ≈ {N_opt/1e9:.2f}B, 最优数据量 D_opt ≈ {D_opt/1e9:.1f}B")
    print(f"50 步推理任务: 单步准确率 0.88 时总成功率 = {0.88**50*100:.2f}% | 单步 0.99 时总成功率 = {0.99**50*100:.2f}%\n")


def chap11_lora_and_nf4():
    print("=" * 74)
    print("【第 11 章】LoRA 低秩参数压缩比与非对称初始化梯度解锁")
    print("=" * 74)
    d, r = 4096, 8
    ratio = (2 * d * r) / (d * d) * 100
    print(f"维度 d={d}, LoRA 秩 r={r} => 可训练参数量占比仅为 {ratio:.3f}% (节省 {100-ratio:.3f}% 优化器显存)\n")


def chap12_topp_dpo_and_speculative():
    print("=" * 74)
    print("【第 12 章】Top-p 核采样、DPO 隐式奖励与投机采样 (Speculative Decoding) 无损验证")
    print("=" * 74)
    p = [0.55, 0.25, 0.12, 0.08]
    q = [0.45, 0.30, 0.15, 0.10]
    accept = [min(1.0, pi / qi) for pi, qi in zip(p, q)]
    alpha = sum(min(pi, qi) for pi, qi in zip(p, q))
    p_res = [max(0.0, pi - qi) / (1.0 - alpha) for pi, qi in zip(p, q)]
    p_out = [round(qi * acc + (1.0 - alpha) * res, 6) for qi, acc, res in zip(q, accept, p_res)]
    print(f"大模型目标分布 p = {p} | 投机采样无损合成分布 = {p_out}")
    # DPO 玩具迭代：4 个候选回答的策略 π_θ = softmax(θ)，参考模型 π_ref 冻结在初始策略
    theta = [1.2, 0.8, 0.3, 0.0]  # 坏回答 y_l = 0 号起初概率最高，好回答 y_w = 1 号
    ref = softmax(theta)
    w, l, beta, lr = 1, 0, 0.1, 1.0
    for step in range(21):
        pi = softmax(theta)
        margin = beta * (math.log(pi[w] / ref[w]) - math.log(pi[l] / ref[l]))  # 隐式奖励差
        if step % 5 == 0:
            loss = math.log(1.0 + math.exp(-margin))  # -ln σ(margin)
            print(f"DPO 第 {step:2d} 步: π(y_w) = {pi[w]:.4f} | π(y_l) = {pi[l]:.4f} | L_DPO = {loss:.4f}")
        weight = 1.0 / (1.0 + math.exp(margin))  # σ(-margin)：判断越错，纠错权重越大
        theta[w] += lr * beta * weight  # -∂L/∂θ = β·σ(-margin)·(e_w - e_l)，softmax 的 π 项相消
        theta[l] -= lr * beta * weight
    print()


def chap13_ddpm_and_flow_matching():
    print("=" * 74)
    print("【第 13 章】扩散模型 (DDPM) 前向一步跃迁重参数化与流匹配直线轨迹")
    print("=" * 74)
    x0, b1, b2 = 10.0, 0.19, 17.0 / 81.0
    a_bar2 = (1.0 - b1) * (1.0 - b2)
    print(f"两步累积信号保留率 ᾱ_2 = {a_bar2:.4f} => 均值 √ᾱ_2·x0 = {math.sqrt(a_bar2)*x0:.2f}, 噪声标准差 = {math.sqrt(1-a_bar2):.2f}")
    # 图 13.3 的同一对数据 x0=(2,0) 与噪声 x1=(0,2)：沿各自的条件路径用 4 步欧拉法从噪声积分回数据
    h = (math.pi / 2) / 4
    px, py = 0.0, 2.0                      # DDPM 弧线 cos(φ)x0 + sin(φ)x1，速度 dx/dφ = (-y, x)
    lx, ly = 0.0, 2.0                      # 流匹配直线 (1-t)x0 + t·x1，速度恒为 x1 - x0
    for _ in range(4):
        px, py = px + h * py, py - h * px
        lx, ly = lx + 0.25 * 2.0, ly - 0.25 * 2.0
    print(f"单对样本的条件路径，4 步欧拉法: 弧线终点 ({px:.3f}, {py:.3f}) 偏离数据 {math.hypot(px - 2, py):.3f} | 直线终点 ({lx:.3f}, {ly:.3f}) 偏离 {math.hypot(lx - 2, ly):.3f}\n")


def chap14_fno_spectral_pde():
    print("=" * 74)
    print("【第 14 章】傅里叶神经算子 (FNO) 一维热传导方程频域一步精确求解")
    print("=" * 74)
    kappa, t, k_max = 0.1, 1.0, 4
    a1_t = 3.0 * math.exp(-kappa * (1 ** 2) * t)
    a3_t = 2.0 * math.exp(-kappa * (3 ** 2) * t)
    print(f"初始温度场 3cos(x) + 2cos(3x) 在 t=1 时刻频域算子精确解: {a1_t:.4f}cos(x) + {a3_t:.4f}cos(3x)")
    u_exact = lambda x: a1_t * math.cos(x) + a3_t * math.cos(3 * x)
    freq = lambda k, N: k if k <= N // 2 else k - N       # DFT 下标 -> 带符号频率
    coef = {}
    for N in (32, 128):                                    # 同一套频域乘子 R_k = e^{-κk²t}（只保留 |k| ≤ k_max）
        xs = [2 * math.pi * j / N for j in range(N)]
        a = [3 * math.cos(x) + 2 * math.cos(3 * x) for x in xs]
        a_hat = [sum(a[j] * cmath.exp(-1j * k * xs[j]) for j in range(N)) / N for k in range(N)]
        coef[N] = {freq(k, N): a_hat[k] * math.exp(-kappa * freq(k, N) ** 2 * t)
                   for k in range(N) if abs(freq(k, N)) <= k_max}
        u = [sum(c * cmath.exp(1j * k * x) for k, c in coef[N].items()).real for x in xs]
        print(f"N = {N:3d} 点网格: 与解析解的最大误差 = {max(abs(ui - u_exact(x)) for ui, x in zip(u, xs)):.1e}")
    fine = [2 * math.pi * j / 128 for j in range(128)]     # 零样本超分：32 点网格算出的频域系数直接在 128 点上求值
    err = max(abs(sum(c * cmath.exp(1j * k * x) for k, c in coef[32].items()).real - u_exact(x)) for x in fine)
    print(f"32 点粗网格的频域解直接在 128 点细网格上求值: 最大误差 = {err:.1e}\n")


def chap15_uncertainty_and_conformal():
    print("=" * 74)
    print("【第 15 章】温度缩放校准 (ECE) 与分裂共形预测 (Split Conformal Prediction) 覆盖率")
    print("=" * 74)
    scores = [0.05, 0.08, 0.12, 0.15, 0.22, 0.30, 0.41, 0.55, 0.78]
    n, alpha = len(scores), 0.10
    m = math.ceil((n + 1) * (1.0 - alpha))
    q_hat = sorted(scores)[m - 1]
    print(f"手算算例: 校准集 n={n}, 目标覆盖率 ≥90% => 第 {m} 小分位数阈值 q̂ = {q_hat:.2f} (保留概率 ≥ {1-q_hat:.2f} 的候选答案)")
    rng = random.Random(2017)

    def sample(size):  # 与图 15.2 同一设定：真实 logits = 4·onehot + N(0,1)，标签按其 softmax 抽样，模型 logits 放大 2 倍
        out = []
        for _ in range(size):
            k = rng.randrange(10)
            z = [rng.gauss(0.0, 1.0) + 4.0 * (j == k) for j in range(10)]
            out.append(([2.0 * zj for zj in z], rng.choices(range(10), weights=softmax(z))[0]))
        return out

    def probs(data, beta):
        return [(softmax([beta * zj for zj in z]), y) for z, y in data]

    def ece(pairs):  # 10 个等宽分箱：ECE = Σ_b |B_b|/N · |acc(B_b) - conf(B_b)|
        bins = [[0.0, 0.0] for _ in range(10)]
        for p, y in pairs:
            c = max(p)
            b = bins[min(int(c * 10), 9)]
            b[0] += (p.index(c) == y)
            b[1] += c
        return sum(abs(acc - conf) for acc, conf in bins) / len(pairs)

    val, test = sample(2000), sample(5000)
    beta, it = 0.0, 0
    while True:  # 牛顿法（从 β=0 出发）：L'(β) = E_p[z] - z_y，L''(β) = Var_p(z) > 0
        it += 1
        g = h = 0.0
        for (p, y), (z, _) in zip(probs(val, beta), val):
            mean = sum(pi * zi for pi, zi in zip(p, z))
            g += mean - z[y]
            h += sum(pi * zi * zi for pi, zi in zip(p, z)) - mean * mean
        beta -= g / h
        if abs(g / h) < 1e-6:
            break
    s_cal = sorted(1.0 - p[y] for p, y in probs(val, beta))
    q_cal = s_cal[math.ceil((len(s_cal) + 1) * (1.0 - alpha)) - 1]
    scaled = probs(test, beta)
    cover = sum(1.0 - p[y] <= q_cal for p, y in scaled) / len(test)
    size = sum(sum(1.0 - pj <= q_cal for pj in p) for p, _ in scaled) / len(test)
    print(f"模拟 10 类过度自信分类器 (验证 2000 例 / 测试 5000 例): ECE {ece(probs(test, 1.0)):.1%} -> 温度缩放后 {ece(scaled):.1%} (牛顿法 {it} 步, τ* = {1/beta:.2f})")
    print(f"共形预测 α=0.10 (以验证集为校准集 n=2000): 测试集实测覆盖率 = {cover:.1%}, 平均集合大小 = {size:.2f}\n")


def chap16_test_time_scaling_grpo_puct():
    print("=" * 74)
    print("【第 16 章】测试时扩展 Pass@k、GRPO 组内相对优势与 MCTS PUCT 分支选择")
    print("=" * 74)
    for p in (0.1, 0.3):
        print(f"单次正确率 p = {p}: " + ", ".join(f"Pass@{k} = {1 - (1 - p) ** k:.3f}" for k in (1, 5, 10, 30)))
    N, c = 20, 2
    print(f"N = {N} 次采样中 c = {c} 次正确: " + ", ".join(
        f"k = {k} 时无偏估计 {1 - math.comb(N - c, k) / math.comb(N, k):.3f} vs 直接代入 {1 - (1 - c / N) ** k:.3f}" for k in (5, 10)))
    r = [1.0, 1.0, 0.0, 0.0]
    mu = sum(r) / len(r)
    std = math.sqrt(sum((x - mu) ** 2 for x in r) / len(r))
    adv = [round((x - mu) / std, 2) for x in r]
    puct_1 = 0.70 + 1.0 * 0.40 * math.sqrt(16) / (1 + 7)
    puct_2 = 0.50 + 1.0 * 0.50 * math.sqrt(16) / (1 + 1)
    print(f"规则奖励 r = {r} => GRPO 零均值标准化优势 Â = {adv}")
    print(f"MCTS 节点选择: 分支 1 PUCT = {puct_1:.2f} vs. 潜力分支 2 PUCT = {puct_2:.2f} (优先探索分支 2)\n")


if __name__ == "__main__":
    chap01_entropy_and_perplexity()
    chap02_high_dim_orthogonality()
    chap03_relu_approximation_and_folding()
    chap04_ntk_spectral_bias()
    chap05_scaled_attention_and_flash_tiling()
    chap06_rope_rotation_invariance()
    chap07_pre_rmsnorm_and_swiglu()
    chap08_moe_and_mamba_ssm()
    chap09_adamw_and_muon()
    chap10_chinchilla_scaling_and_emergence()
    chap11_lora_and_nf4()
    chap12_topp_dpo_and_speculative()
    chap13_ddpm_and_flow_matching()
    chap14_fno_spectral_pde()
    chap15_uncertainty_and_conformal()
    chap16_test_time_scaling_grpo_puct()
    print("🎉 全书 16 章零算力 CPU 数学验证实验全部运行通过！")
