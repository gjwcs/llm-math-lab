#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
《大模型的数学基础：从人类直觉、算法公理到零算力实战》配套零算力实战代码合集
作者：顾嘉伟、李泽超（南京理工大学）

收录全书 16 章“零算力实战”框中的 Python 代码，以及附录 C 的第四篇四合一脚本，内容与书中逐字一致。
依赖：Python 3.9+ 与 NumPy（pip install numpy），普通笔记本电脑的 CPU 几秒内跑完。
运行全部：python3 cpu_practice_code.py        只运行某几章：python3 cpu_practice_code.py 5 13
在线交互实验室：https://gjwcs.github.io/llm-math-lab/
"""

import sys


def chapter_01():
    """第 1 章　概率：大模型到底在算什么"""
    import numpy as np

    # === 实验 1：眼见为实看 400 个 0.1 连乘如何在电脑里下溢变成 0.0 ===
    T_long = 400
    prob_prod = 1.0
    log_prob_sum = 0.0
    for _ in range(T_long):
        prob_prod *= 0.1
        log_prob_sum += np.log10(0.1)

    print(f"[实验 1] 400 个 0.1 直接连乘的电脑结果: {prob_prod}  <-- 惨遭下溢变成 0.0！")
    print(f"[实验 1] 400 个 0.1 取 log10 连加结果 : {log_prob_sum:.1f} <-- 稳稳保留 10^(-400)！\n")

    # === 实验 2：复现 1.5 节手算算例“我 / 爱 / 数学”的 Softmax、Loss 与 PPL ===
    logits = np.array([
        [np.log(2.0), 0.0, 0.0],          # t=1: 真实词为 0号 ("我")
        [0.0, np.log(2.0), np.log(2.0)],  # t=2: 真实词为 1号 ("爱")
        [0.0, 0.0, np.log(8.0)]           # t=3: 真实词为 2号 ("数学")
    ])
    targets = [0, 1, 2]

    # 手写 Softmax: 先取 exp 再除以每行总和
    exp_logits = np.exp(logits)
    probs = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)

    target_probs = [probs[t, targets[t]] for t in range(3)]
    step_losses = [-np.log(p) for p in target_probs]
    avg_loss = np.mean(step_losses)
    ppl = np.exp(avg_loss)

    print("[实验 2] 三步真实词预测概率 Q_t :", np.round(target_probs, 4))
    print("[实验 2] 整句话连乘总概率       :", np.round(np.prod(target_probs), 4))
    print("[实验 2] 三步单步交叉熵罚单     :", np.round(step_losses, 4))
    print(f"[实验 2] 平均交叉熵 Loss = {avg_loss:.4f}, 困惑度 PPL = {ppl:.4f}")


def chapter_02():
    """第 2 章　几何：把词变成高维空间里的向量"""
    import numpy as np

    # === 实验 1：验证 2.1 节手算的“猫、狗、国王”余弦相似度 ===
    v_cat  = np.array([0.9, 0.1])
    v_dog  = np.array([0.8, 0.2])
    v_king = np.array([0.1, 0.9])

    def cos_sim(a, b):
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

    print(f"[实验 1] 猫与狗的余弦相似度  : {cos_sim(v_cat, v_dog):.4f} (手算值: 0.9910)")
    print(f"[实验 1] 猫与国王的余弦相似度: {cos_sim(v_cat, v_king):.4f} (手算值: 0.2195)\n")

    # === 实验 2：验证“国王 - 男人 + 女人 ≈ 王后” ===
    king  = np.array([0.95, 0.90, 0.05])
    man   = np.array([0.05, 0.92, 0.03])
    woman = np.array([0.04, 0.04, 0.91])
    queen = np.array([0.92, 0.05, 0.92])
    pred_queen = king - man + woman
    print(f"[实验 2] 国王 - 男人 + 女人 = {pred_queen}, 与真实王后的余弦相似度 = {cos_sim(pred_queen, queen):.4f}\n")

    # === 实验 3：验证不同维度 d 下，随机扔硬币单位向量的内积标准差 = 1/sqrt(d) ===
    np.random.seed(42)
    for d in [4, 100, 1000, 4096]:
        # 生成 5000 对随机扔硬币单位向量 (+1/sqrt(d) 或 -1/sqrt(d))
        U = np.random.choice([-1.0, 1.0], size=(5000, d)) / np.sqrt(d)
        V = np.random.choice([-1.0, 1.0], size=(5000, d)) / np.sqrt(d)
        dots = np.sum(U * V, axis=1)
        print(f"[实验 3] 维度 d = {d:4d} | 实测内积均值 = {np.mean(dots):+.4f} | "
              f"实测标准差 = {np.std(dots):.4f} | 理论公式 1/sqrt(d) = {1/np.sqrt(d):.4f}")


def chapter_03():
    """第 3 章　逼近：用折线拼出任意函数"""
    import numpy as np

    def relu(x):
        return np.maximum(0.0, x)

    # === 实验 1：验证 3.2 节手算的 3 个 ReLU 拼出三角小帐篷 ===
    def tent(x):
        return relu(x) - 2.0 * relu(x - 1.0) + relu(x - 2.0)

    test_x = np.array([-0.5, 0.0, 0.5, 1.0, 1.5, 2.0, 2.5])
    print("[实验 1] 输入 x       :", test_x)
    print("[实验 1] 帐篷输出 T(x):", tent(test_x), " <-- 只在 [0, 2] 隆起，尖顶为 1，其余全为 0！\n")

    # === 实验 2：验证 3.3 节深层复合折纸 g^(L)(x) 的折线段数 = 2^L ===
    def fold_once(u):
        # 在 [0, 1] 上的单峰折纸函数 g(u) = ReLU(2u) - 2*ReLU(2u - 1) + ReLU(2u - 2)
        return relu(2.0 * u) - 2.0 * relu(2.0 * u - 1.0) + relu(2.0 * u - 2.0)

    # 在 [0, 1] 上取 2^14+1 个采样点（拐点都落在采样点上），统计斜率改变符号的折线段数
    x_grid = np.linspace(0.0, 1.0, 2**14 + 1)
    h = x_grid.copy()
    for L in range(1, 11):
        h = fold_once(h)
        # 计算相邻点差分正负号的变化次数，统计共有多少段单调折线
        diffs = np.sign(np.diff(h))
        num_pieces = 1 + np.sum(diffs[1:] != diffs[:-1])
        print(f"[实验 2] 深度 L = {L:2d} 层 (仅用 {2*L:2d} 个核心神经元) | "
              f"实测折线段数 = {num_pieces:4d} | 理论公式 2^L = {2**L:4d}")


def chapter_04():
    """第 4 章　核方法：超宽网络怎样学习"""
    import numpy as np

    # === 实验 1：验证 4.2 节手算的二次核技巧 (x^T z)^2 == phi(x)^T phi(z) ===
    x = np.array([2.0, 3.0])
    z = np.array([4.0, 1.0])

    def phi_2(v):
        return np.array([v[0]**2, np.sqrt(2.0) * v[0] * v[1], v[1]**2])

    kernel_val = (np.dot(x, z)) ** 2
    feature_dot = np.dot(phi_2(x), phi_2(z))
    print(f"[实验 1] 直接在 2 维算 (x^T z)^2      = {kernel_val:.1f}")
    print(f"[实验 1] 升到 3 维算 phi(x)^T phi(z) = {feature_dot:.1f}  <-- 分毫不差全等于 121！\n")

    # === 实验 2：在宽度 m = 4000 的超宽 ReLU 网络上验证 NTK 理论公式 ===
    np.random.seed(0)
    m = 4000  # 隐藏层神经元宽度
    X = np.array([[1.0, 0.2], [0.2, 1.0]])  # N = 2 个训练样本
    y = np.array([1.5, -1.0])               # 2 个样本的目标标签

    # 随机初始化内层权重 U (固定) 与外层权重 w: f(x) = (1/sqrt(m)) * sum_k w_k * ReLU(u_k^T x)
    U = np.random.randn(m, 2)
    w = np.random.randn(m)
    Phi = np.maximum(0.0, X @ U.T) / np.sqrt(m)  # 切线特征矩阵 G: 形状 (2, m)
    K0 = Phi @ Phi.T                             # 2x2 的神经正切核矩阵 K0 = G @ G^T
    print("[实验 2] 2x2 神经正切核矩阵 K0:\n", np.round(K0, 4))

    # 运行 50 步梯度下降，对比真实误差 e_t 与矩阵指数理论预测 (I - eta*K0)^t e_0
    eta = 0.2
    e0 = (Phi @ w) - y
    w_curr = w.copy()
    for step in [0, 10, 25, 50]:
        if step > 0:
            for _ in range(step - prev_step):
                err = (Phi @ w_curr) - y
                grad_w = Phi.T @ err
                w_curr -= eta * grad_w
        prev_step = step
        err_actual = (Phi @ w_curr) - y
        err_ntk_theory = np.linalg.matrix_power(np.eye(2) - eta * K0, step) @ e0
        print(f"步数 t = {step:2d} | 真实误差 e(t) = {np.round(err_actual, 4)} | "
              f"NTK 线性方程预测 = {np.round(err_ntk_theory, 4)}")


def chapter_05():
    """第 5 章　注意力：让每个词回头查找上文"""
    import numpy as np

    def softmax(x):
        # 先减去最大值防止 e^x 溢出 (平移不变性)
        e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
        return e_x / np.sum(e_x, axis=-1, keepdims=True)

    def run_attention_demo():
        # 1. 验证 5.1 节手算的“图书馆 3 本书”例子
        q = np.array([1.0, 0.0])
        K = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
        V = np.array([[10.0, 20.0], [0.0, 100.0], [30.0, 40.0]])

        scores = q @ K.T                 # 内积打分: [1.0, 0.0, 1.0]
        weights = softmax(scores)        # Softmax 百分比: [0.422, 0.155, 0.422]
        output = weights @ V             # 按百分比抄笔记: [16.89, 40.88] (手算取两位小数得 16.8, 41.2)
        print(f"[图书馆手算验证] 原始打分: {scores}")
        print(f"[图书馆手算验证] 注意力百分比: {np.round(weights, 4)} -> 汇总输出: {np.round(output, 2)}")

        # 2. 验证 5.3 节 d_k = 100 时不除以 sqrt(d_k) 怎么害死导数 p*(1-p)
        d_k = 100
        raw_scores = np.array([20.0, 0.0])  # d_k=100 项 +-1 相加常见的随机打分
        p_unscaled = softmax(raw_scores)
        grad_unscaled = p_unscaled[0] * (1.0 - p_unscaled[0])

        scaled_scores = raw_scores / np.sqrt(d_k)  # 除以 sqrt(100) = 10
        p_scaled = softmax(scaled_scores)
        grad_scaled = p_scaled[0] * (1.0 - p_scaled[0])

        print(f"\n[不除 sqrt(d_k)] 概率分布: {p_unscaled} -> 导数 p(1-p): {grad_unscaled:.10f} (彻底锁死!)")
        print(f"[除以 sqrt(d_k)] 概率分布: {np.round(p_scaled, 4)} -> 导数 p(1-p): {grad_scaled:.6f} (活力充沛!)")

    if __name__ == "__main__":
        run_attention_demo()


def chapter_06():
    """第 6 章　位置编码：让模型分清词的先后"""
    import numpy as np

    def apply_rope_2d(vec, pos, theta=np.pi / 6):
        # 将二维向量 vec 在位置 pos 处逆时针旋转 pos * theta 弧度
        angle = pos * theta
        cos_a, sin_a = np.cos(angle), np.sin(angle)
        return np.array([vec[0] * cos_a - vec[1] * sin_a,
                         vec[0] * sin_a + vec[1] * cos_a])

    def run_rope_demo():
        q = np.array([1.5, -0.8])
        k = np.array([0.6,  1.2])

        # 1. 验证相对距离不变性: (m=5, n=8) 与 (m=105, n=108) 均相隔 3 个词
        score_5_8 = apply_rope_2d(q, 5) @ apply_rope_2d(k, 8)
        score_105_108 = apply_rope_2d(q, 105) @ apply_rope_2d(k, 108)
        print(f"[相对距离验证] 第 5 位与第 8 位内积:     {score_5_8:.12f}")
        print(f"[相对距离验证] 第 105 位与第 108 位内积: {score_105_108:.12f} (分毫不差!)")

        # 2. 验证打破前后对称: “狗(1) 咬(2)” vs “咬(2) 狗(3)”
        score_dog_before = apply_rope_2d(q, 2) @ apply_rope_2d(k, 1)  # 狗在咬前面 1 位 (m-n = +1)
        score_dog_after  = apply_rope_2d(q, 2) @ apply_rope_2d(k, 3)  # 狗在咬后面 1 位 (m-n = -1)
        print(f"[前后词序区分] 狗在咬前面 1 位打分: {score_dog_before:.6f}")
        print(f"[前后词序区分] 狗在咬后面 1 位打分: {score_dog_after:.6f} (彻底分清谁咬谁!)")

    if __name__ == "__main__":
        run_rope_demo()


def chapter_07():
    """第 7 章　深度：让百层网络稳定传递信号"""
    import numpy as np

    def run_chap07_demo():
        # 1. 验证 7.1 节: 100 层网络若每层支线导数为 -0.2 (即串行导数 0.8 vs 残差导数 1 + (-0.2) 或纯直通 1)
        L = 100
        grad_plain = 0.8 ** L          # 无残差连乘 100 层
        grad_residual_highway = 1.0    # 残差直通车保底项 (即便所有支线 F'=0)
        print(f"[100层梯度对比] 无残差串行网络传回第1层的梯度比例: {grad_plain:.4e} (彻底消失!)")
        print(f"[100层梯度对比] 残差直通车 (+1 高速路) 保底梯度比例: {grad_residual_highway:.4f} (毫发无损!)")

        # 2. 验证 7.2 节: 在 x = [1, 2, 3, 4] 上手算对比 LayerNorm 与 RMSNorm
        x = np.array([1.0, 2.0, 3.0, 4.0])
        mu = np.mean(x)
        sigma = np.sqrt(np.mean((x - mu) ** 2))
        ln_x = (x - mu) / sigma

        rms = np.sqrt(np.mean(x ** 2))
        rms_x = x / rms
        print(f"\n[归一化手算验证] LayerNorm (mu={mu}, sigma={sigma:.4f}) -> {np.round(ln_x, 4)}")
        print(f"[归一化手算验证] RMSNorm   (rms={rms:.4f})          -> {np.round(rms_x, 4)}")
        print(f"[缩放不变性验证] 把 x 放大 10 倍后 RMSNorm 输出差值: {np.max(np.abs((10*x)/np.sqrt(np.mean((10*x)**2)) - rms_x)):.1e}")

    if __name__ == "__main__":
        run_chap07_demo()


def chapter_08():
    """第 8 章　效率：让大模型又大又快"""
    import numpy as np

    def run_moe_and_mamba_demo():
        # 1. 验证 8.2 节: 动态补贴 b_i 如何治好路由坍缩 (4 位专家, 每次选 Top-2)
        np.random.seed(42)
        N, K, num_tokens = 4, 2, 100
        # 假设分诊台初始严重偏心 0 号和 1 号专家 (打分自带 +2.0 偏置)
        raw_scores = np.random.randn(num_tokens, N) + np.array([2.0, 1.5, 0.0, -0.5])

        top2_no_balance = np.argsort(-raw_scores, axis=1)[:, :K]
        counts_no_bal = [int(np.sum(top2_no_balance == i)) for i in range(N)]
        print(f"[无均衡补贴] 100个词各专家接诊人次: {counts_no_bal} (2号、3号专家几乎饿死!)")

        # 开启 DeepSeek-V3 风格动态挂号补贴 b_i
        bias = np.zeros(N)
        counts_bal = np.zeros(N, dtype=int)
        for t in range(num_tokens):
            chosen = np.argsort(-(raw_scores[t] + bias))[:K]
            for c in chosen:
                counts_bal[c] += 1
            # 动态调节补贴: 接诊高于平均值的扣补贴, 低于平均值的加补贴
            avg_load = np.mean(counts_bal)
            bias += 0.05 * np.sign(avg_load - counts_bal)
        print(f"[动态补贴后] 100个词各专家接诊人次: {counts_bal.tolist()} (全院专家均匀分流!)")

        # 2. 验证 8.4 节手算的 Mamba 选择性备忘录抗噪算例
        xs = [5.0, 100.0, -80.0, 2.0]       # [关键词, 噪音, 噪音, 关键词]
        a_list = [0.2, 1.0, 1.0, 0.8]       # 遇到噪音时保留率 a_t = 1.0
        b_list = [1.0, 0.0, 0.0, 1.0]       # 遇到噪音时写入开关 b_t = 0.0
        h = 0.0
        history = []
        for x, a, b in zip(xs, a_list, b_list):
            h = a * h + b * x
            history.append(h)
        print(f"\n[Mamba备忘录] 4步状态轨迹 h_t: {history} (完美过滤 100 与 -80 噪音!)")

    if __name__ == "__main__":
        run_moe_and_mamba_demo()


def chapter_09():
    """第 9 章　优化器：怎样拧动几百亿个旋钮"""
    import math

    # 1. 验证 9.1 节：SGD vs Momentum (beta=0.5) 在 f(x,y) = x^2 + 25y^2 上的前两步
    x_sgd, y_sgd = 10.0, 1.0
    x_mom, y_mom, mx, my = 10.0, 1.0, 0.0, 0.0
    eta, beta = 0.035, 0.5

    print("=== 9.1 节手算核对：SGD vs Momentum ===")
    for step in [1, 2]:
        gx_s, gy_s = 2 * x_sgd, 50 * y_sgd
        x_sgd, y_sgd = x_sgd - eta * gx_s, y_sgd - eta * gy_s

        gx_m, gy_m = 2 * x_mom, 50 * y_mom
        mx, my = beta * mx + gx_m, beta * my + gy_m
        x_mom, y_mom = x_mom - eta * mx, y_mom - eta * my
        print(f"第 {step} 步 | SGD: ({x_sgd:.4f}, {y_sgd:.4f}) | Momentum: ({x_mom:.4f}, {y_mom:.4f})")

    # 2. 验证 9.2 节：“的”(g=10) 与 “熵”(g=0.001) 的偏差校正与 AdamW 解耦衰减
    for name, g in [("常用词'的'", 10.0), ("生僻词'熵'", 0.001)]:
        m1 = 0.1 * g
        v1 = 0.001 * (g ** 2)
        m_hat = m1 / (1 - 0.9)
        v_hat = v1 / (1 - 0.999)
        print(f"{name} | 未校正步幅: {m1/math.sqrt(v1):.3f} | 校正后步幅: {m_hat/math.sqrt(v_hat):.3f}")
        # eta=0.1, lambda=1.0, w=2.0：L2 拉力被分母除，AdamW 拉力在除法外面
        print(f"{name} | L2 拉回: {0.1 * 1.0 * 2.0 / math.sqrt(v_hat):.2f} | AdamW 拉回: {0.1 * 1.0 * 2.0:.2f}")


def chapter_10():
    """第 10 章　规模定律：模型多大、数据多少"""
    # 1. 验证 10.1 节：解 w_1 + w_2 + ... + w_N = 2 时，旋钮个数 N 越多，平方和越小
    print("=== 10.1 节核对：旋钮个数 N 与最小刻度平方和 ===")
    for N in [1, 2, 10, 100, 1000]:
        w_i = 2.0 / N
        sum_sq = N * (w_i ** 2)
        print(f"旋钮个数 N = {N:4d} | 每个旋钮刻度 w_i = {w_i:.4f} | 总平方和 = {sum_sq:.4f}")

    # 2. 验证 10.2 节：固定 N * D = 100，对比不同 (N, D) 分配下的罚分 1/sqrt(N) + 1/sqrt(D)
    print("\n=== 10.2 节核对：固定电费 N*D=100 时的 Chinchilla 最优分配 ===")
    for N in [4, 5, 10, 20, 25]:
        D = 100.0 / N
        loss = (N ** -0.5) + (D ** -0.5)
        tag = " <-- 大一求导算出的最低点！" if N == 10 else ""
        print(f"N = {N:2d}, D = {D:4.1f} | 罚分 = {loss:.4f}{tag}")


def chapter_11():
    """第 11 章　低秩微调：用一张显卡改造大模型"""
    # 1. 验证 11.2 节：4x1 竖条乘 1x4 横条变出 4x4 表格
    b = [1, 2, 1, 2]
    a = [1, 0, 2, 1]
    delta_W = [[bi * aj for aj in a] for bi in b]
    print("=== 11.2 节核对：b (4x1) 乘 a^T (1x4) 生成的 4x4 表格 ===")
    for row in delta_W:
        print(row)

    # 2. 验证 11.4 节：2x2 LoRA 分路计算 vs 合并后单次乘法零延迟等价性
    W0 = [[10, 0], [0, 10]]
    B1 = [1, 2]      # 2x1
    A1 = [1, 2]      # 1x2
    x  = [1, 1]

    # 方式一：训练时旁路计算 h = W0*x + B1*(A1*x)
    Ax = sum(A1[j] * x[j] for j in range(2))
    h_lora = [sum(W0[i][j]*x[j] for j in range(2)) + B1[i]*Ax for i in range(2)]

    # 方式二：上线前合并 W_merged = W0 + B1*A1，推理只做一次乘法
    W_merged = [[W0[i][j] + B1[i]*A1[j] for j in range(2)] for i in range(2)]
    h_merged = [sum(W_merged[i][j]*x[j] for j in range(2)) for i in range(2)]

    print(f"\n旁路计算输出: {h_lora} | 合并后单表输出: {h_merged} | 完全相等: {h_lora == h_merged}")


def chapter_12():
    """第 12 章　解码与对齐：让模型开口说话、听懂好恶"""
    import math

    # 1. 验证 12.2 节：打分 (4, 2, 0) 在不同温度 T 下的概率分布
    logits = [4.0, 2.0, 0.0]
    print("=== 12.2 节核对：温度 T 对打分 (4, 2, 0) 概率的影响 ===")
    for T in [0.5, 1.0, 2.0]:
        exps = [math.exp(z / T) for z in logits]
        Z = sum(exps)
        probs = [e / Z for e in exps]
        print(f"温度 T = {T:3.1f} | 概率分布: {[round(p, 4) for p in probs]}")

    # 2. 验证 12.2 节：Top-p (p=0.90) 核采样截断与重归一化
    words = [("好", 0.55), ("晴", 0.25), ("棒", 0.12), ("火锅", 0.05), ("挖掘机", 0.03)]
    cum_p, kept = 0.0, []
    for w, p in words:
        kept.append((w, p))
        cum_p += p
        if cum_p >= 0.90:
            break
    norm_kept = [(w, round(p / cum_p, 3)) for w, p in kept]
    print(f"\nTop-p (p=0.90) 保留词与重归一化概率: {norm_kept}")

    # 3. 验证 12.4 节：DPO 隐式奖励差与损失函数计算
    def dpo_loss(pw, pl, pw_ref=0.10, pl_ref=0.10, beta=1.0):
        rw = beta * math.log(pw / pw_ref)
        rl = beta * math.log(pl / pl_ref)
        delta_r = rw - rl
        return delta_r, math.log(1 + math.exp(-delta_r))

    print("\n=== 12.4 节核对：DPO 训练前后奖励差与 Loss 变化 ===")
    print("训练前 (pw=0.10, pl=0.10):", [round(x, 3) for x in dpo_loss(0.10, 0.10)])
    print("训练后 (pw=0.2718, pl=0.0368):", [round(x, 3) for x in dpo_loss(0.2718, 0.0368)])


def chapter_13():
    """第 13 章　扩散与流匹配：从噪声中生成图像"""
    import numpy as np

    # =========================================================================
    # 实验 1：验证第 13.1 节手算算例 (x0 = 10, alpha_bar = 0.64, eps = 2.0)
    # =========================================================================
    def verify_ddpm_hand_calc():
        x0 = 10.0
        # 两步走 (alpha_1 = alpha_2 = 0.9) 与一步跳 (alpha_bar_2 = 0.81) 的分布对比
        e1, e2, e = np.random.default_rng(0).standard_normal((3, 200000))
        two_steps = np.sqrt(0.9) * (np.sqrt(0.9) * x0 + np.sqrt(0.1) * e1) + np.sqrt(0.1) * e2
        one_jump = 0.9 * x0 + np.sqrt(0.19) * e
        print(f"[方差守恒] 两步走 std = {two_steps.std():.3f} | 一步跳 std = {one_jump.std():.3f} | sqrt(0.19) = {np.sqrt(0.19):.3f}")
        alpha_bar = 0.64
        eps = 2.0
        xt = np.sqrt(alpha_bar) * x0 + np.sqrt(1.0 - alpha_bar) * eps
        score_xt = -eps / np.sqrt(1.0 - alpha_bar)
        # 假设网络猜出的雪花为 eps_hat = 1.95
        eps_hat = 1.95
        x0_hat = (xt - np.sqrt(1.0 - alpha_bar) * eps_hat) / np.sqrt(alpha_bar)
        print(f"[DDPM 手算核对] 模糊图 xt = {xt:.2f} | 指路箭头 Score = {score_xt:.3f}")
        print(f"[DDPM 去噪还原] 猜雪花 eps_hat = {eps_hat:.2f} -> 还原原图 x0_hat = {x0_hat:.4f} (真值={x0})")

    # =========================================================================
    # 实验 2：对比流匹配 (Flow Matching) 直线滑梯 vs 弯曲路径的欧拉积分误差
    # =========================================================================
    def compare_curved_vs_straight_flow():
        eps = np.array([-2.0, 4.0])
        x1 = np.array([6.0, 0.0])
        # 流匹配直线速度 v_t = x1 - eps 恒为常数，哪怕只走 N=1 步欧拉法也是零截断误差！
        v_const = x1 - eps
        x1_euler_1step = eps + 1.0 * v_const
        print(f"[Flow Matching] 起点={eps}, 终点={x1}, 恒定速度={v_const}")
        print(f"[Flow Matching] 1 步欧拉滑梯直达结果 = {x1_euler_1step} (误差 = {np.linalg.norm(x1 - x1_euler_1step):.2e})")
        # 对照：DDPM 式弧线 x_t = cos(pi*t/2)*eps + sin(pi*t/2)*x1，每步都用当点的真实切线速度
        for N in [1, 4, 20]:
            x, dt = eps.copy(), 1.0 / N
            for k in range(N):
                t = k * dt
                x = x + dt * (np.pi / 2) * (np.cos(np.pi * t / 2) * x1 - np.sin(np.pi * t / 2) * eps)
            print(f"[弯曲弧线] {N:2d} 步欧拉终点 = {np.round(x, 3)} (误差 = {np.linalg.norm(x - x1):.3f})")

    if __name__ == "__main__":
        verify_ddpm_hand_calc()
        print("-" * 65)
        compare_curved_vs_straight_flow()


def chapter_14():
    """第 14 章　神经算子：学习从函数到函数的映射"""
    import numpy as np

    # =========================================================================
    # 实验 1：验证 DeepONet 分支网络 + 主干网络内积精确求解导数算子
    # =========================================================================
    def demo_deeponet_derivative():
        # 传感器固定在 x = [-1, 0, 1]，输入函数 a(x) = 3 + 4x + 5x^2
        sensors_a = np.array([4.0, 3.0, 12.0])
        W_branch = np.array([[-0.5, 0.0, 0.5],
                             [ 1.0,-2.0, 1.0]])
        b_vec = W_branch @ sensors_a  # 算一次拨弦力度 b = [4, 10]
        # 在任意连续查询坐标 y 上直接做内积
        for y in [-1.5, 0.0, 0.4, 2.0, 3.14]:
            t_vec = np.array([1.0, y])
            pred_dy = np.dot(b_vec, t_vec)
            true_dy = 4.0 + 10.0 * y
            print(f"[DeepONet] 查询坐标 y={y:+5.2f} -> 预测导数={pred_dy:+7.2f} | 真实导数={true_dy:+7.2f}")

    # =========================================================================
    # 实验 2：验证 FNO 在粗网格 (N=16) 与超高清网格 (N=128) 上零参数改动一致输出
    # =========================================================================
    def fno_1d_forward(x_grid, k_max=2, W_local=0.5):
        N = len(x_grid)
        # 输入波浪: v(x) = 2 + 3*cos(x) + 0.5*cos(6x)
        v = 2.0 + 3.0 * np.cos(x_grid) + 0.5 * np.cos(6.0 * x_grid)
        # 1. 快速傅里叶变换 (除以 N 归一化，使频率系数与网格点数 N 完全无关！)
        v_hat = np.fft.rfft(v) / N
        # 2. 只保留前 k_max 个低频 (m=0 常数项, m=1 基波 cos(x))，乘频域权重
        u_hat = np.zeros_like(v_hat)
        u_hat[0] = 2.5 * v_hat[0]  # 0号频率放大 2.5 倍
        u_hat[1] = 2.0 * v_hat[1]  # 1号频率放大 2.0 倍
        # 3. 逆傅里叶变换还原回空间网格 + 本地直连旁路 W * v(x)
        u_fourier = np.fft.irfft(u_hat * N, n=N)
        return u_fourier + W_local * v

    if __name__ == "__main__":
        demo_deeponet_derivative()
        print("-" * 65)
        grid_coarse = np.linspace(0, 2 * np.pi, 16, endpoint=False)
        grid_fine   = np.linspace(0, 2 * np.pi, 128, endpoint=False)
        u_coarse = fno_1d_forward(grid_coarse)
        u_fine   = fno_1d_forward(grid_fine)
        # 粗网格第 2 个点对应细网格第 16 个点 (同一个物理坐标 x = pi/4)
        print(f"[FNO 零样本超分] 粗网格(N=16) 在 x=pi/4 处输出 = {u_coarse[2]:.6f}")
        print(f"[FNO 零样本超分] 细网格(N=128)在 x=pi/4 处输出 = {u_fine[16]:.6f} (分毫不差！)")


def chapter_15():
    """第 15 章　不确定性：判断模型何时可信"""
    import numpy as np

    # =========================================================================
    # 实验 1：验证第 15.2 节温度校准手算算例 z = [10, 2], T = 4
    # =========================================================================
    def verify_temperature_scaling():
        z = np.array([10.0, 2.0])
        for T in [1.0, 4.0]:
            scaled_z = z / T
            probs = np.exp(scaled_z - np.max(scaled_z))
            probs /= np.sum(probs)
            print(f"[温度校准 T={T:.1f}] 缩放打分={scaled_z} -> 预测概率={np.round(probs, 4)} (最高分选项={np.argmax(probs)})")

    # =========================================================================
    # 实验 2：跑 20000 次独立模拟，检验 n=99 摸底考排名法对新病人的真实覆盖率！
    # =========================================================================
    def verify_conformal_coverage(n_calib=99, alpha=0.10, trials=20000):
        rng = np.random.default_rng(2026)
        covered_count = 0
        k_rank = int(np.ceil((n_calib + 1) * (1.0 - alpha)))  # k = 90
        for _ in range(trials):
            # 模拟一个任意奇怪分布下的惊讶罚分 (例如偏态指数分布，完全不需要是正态分布！)
            all_scores = rng.exponential(scale=0.3, size=n_calib + 1)
            calib_scores, new_score = all_scores[:n_calib], all_scores[n_calib]
            # 从小到大排序取第 k_rank 名 (Python 下标从 0 开始，故为 k_rank - 1)
            q_hat = np.sort(calib_scores)[k_rank - 1]
            if new_score <= q_hat:
                covered_count += 1
        emp_coverage = covered_count / trials
        theo_min = 1.0 - alpha
        print(f"[共形预测检验] 校准集人数 n={n_calib}, 阈值排名 k={k_rank}名, 目标保底={theo_min*100:.1f}%")
        print(f"[共形预测检验] {trials} 名新病人的实际命中率 = {emp_coverage*100:.2f}% (理论精确值 = {k_rank/(n_calib+1)*100:.1f}%)")

    if __name__ == "__main__":
        verify_temperature_scaling()
        print("-" * 65)
        verify_conformal_coverage()


def chapter_16():
    """第 16 章　测试时推理：多想几步换更好的答案"""
    import numpy as np

    # =========================================================================
    # 实验 1：验证第 16.1 节思维链“两步过河”的乘法账
    # =========================================================================
    def demo_cot_chain(p_direct=0.01, p_step=0.90):
        print("=== 思维链乘法账 ===")
        print(f"不打草稿直接猜: {p_direct*100:.0f}% | 两步草稿全对: {p_step**2*100:.0f}% | 20 步草稿全对: {p_step**20*100:.1f}%\n")

    # =========================================================================
    # 实验 2：验证 Best-of-N 抽卡公式 1 - (1 - p)^N (p = 0.20)
    # =========================================================================
    def demo_best_of_n(p=0.20):
        print(f"=== 单次解题成功率 p = {p*100:.1f}% 时的 Best-of-N 抽卡成绩单 ===")
        for N in [1, 2, 5, 10, 15, 20]:
            pass_at_n = 1.0 - ((1.0 - p) ** N)
            print(f"抽卡次数 N = {N:2d} -> 全部失败概率 = {(1-p)**N:.4f} | 至少对1次概率 Pass@N = {pass_at_n*100:6.2f}%")

    # =========================================================================
    # 实验 3：复现第 16.3 节 MCTS 的 UCT 选路与回传更新
    # =========================================================================
    def demo_mcts_uct_step():
        n_visits = np.array([6, 3, 1], dtype=float)
        q_values = np.array([0.75, 0.50, 0.60], dtype=float)
        c = 0.5
        N_total = np.sum(n_visits)
        uct_scores = q_values + c * np.sqrt(np.log(N_total) / n_visits)
        best_branch = int(np.argmax(uct_scores))
        print("\n=== MCTS 节点选路手算核对 (N=10, c=0.5) ===")
        for j in range(3):
            print(f"分支 {j+1}: 历史均值 Q={q_values[j]:.2f}, 访问 n={int(n_visits[j])} -> UCT总分 = {uct_scores[j]:.3f}")
        print(f"=> 本轮选中探路分支: 分支 {best_branch + 1} (UCT = {uct_scores[best_branch]:.3f})")

    def demo_mcts_uct_loop(rounds=5, c=0.5):
        n_visits = np.array([6, 3, 1], dtype=float)
        q_values = np.array([0.75, 0.50, 0.60], dtype=float)
        rollout = np.array([0.75, 0.50, 0.20])  # 假设每条分支再往下推演的得分 (分支 3 其实走不通)
        print(f"\n=== MCTS 连续 {rounds} 轮选路 + 回传记账 ===")
        for _ in range(rounds):
            N_total = np.sum(n_visits)
            uct = q_values + c * np.sqrt(np.log(N_total) / n_visits)
            j = int(np.argmax(uct))
            n_visits[j] += 1
            q_values[j] += (rollout[j] - q_values[j]) / n_visits[j]
            print(f"第 {int(N_total)+1} 次探路: UCT = {np.round(uct, 3)} -> 走分支 {j+1}, 得分 {rollout[j]:.2f}, 新均值 Q = {q_values[j]:.3f}")

    if __name__ == "__main__":
        demo_cot_chain()
        demo_best_of_n(p=0.20)
        demo_mcts_uct_step()
        demo_mcts_uct_loop()


def appendix_c_all_in_one():
    """附录 C：第四篇四合一实战脚本"""
    import numpy as np

    def run_all_part4_demos():
        print("=" * 72)
        print("【实验 1 (第 13 章)】DDPM 一步加噪还原 vs 流匹配 (Flow Matching) 直线滑梯")
        print("=" * 72)
        x0, alpha_bar, eps = 10.0, 0.64, 2.0
        xt = np.sqrt(alpha_bar) * x0 + np.sqrt(1 - alpha_bar) * eps
        x0_restored = (xt - np.sqrt(1 - alpha_bar) * 1.95) / np.sqrt(alpha_bar)
        # 流匹配: x_t = (1-t)*eps + t*x1（终点 x1 取同一个清晰像素 10.0），速度恒为 v = x1 - eps = 8.0
        v_flow = x0 - eps
        x1_flow = eps + 1.0 * v_flow
        print(f"  DDPM 一步模糊图 x_t = {xt:.2f} | 猜雪花 1.95 还原值 = {x0_restored:.4f} (真值={x0})")
        print(f"  流匹配恒定速度 v = {v_flow:.2f}  | 1 步欧拉滑梯终点 = {x1_flow:.4f} (零截断误差!)")

        print("\n" + "=" * 72)
        print("【实验 2 (第 14 章)】DeepONet 内积求导算子 & FNO 粗细网格零样本超分辨率")
        print("=" * 72)
        # DeepONet: a(x) = 3 + 4x + 5x^2 在 [-1, 0, 1] 读数为 [4, 3, 12]
        b_branch = np.array([[-0.5, 0.0, 0.5], [1.0, -2.0, 1.0]]) @ np.array([4.0, 3.0, 12.0])
        y_query = 0.4
        pred_deriv = np.dot(b_branch, np.array([1.0, y_query]))
        print(f"  DeepONet 分支力度 b = {b_branch} | 在 y={y_query} 处预测导数 = {pred_deriv:.2f} (真值={4+10*y_query:.2f})")

        # FNO: 对比 N=16 粗网格与 N=128 细网格在同一物理位置 x = pi/4 的输出
        def fno_eval(N):
            x = np.linspace(0, 2 * np.pi, N, endpoint=False)
            v = 2.0 + 3.0 * np.cos(x) + 0.5 * np.cos(6.0 * x)
            v_hat = np.fft.rfft(v) / N
            u_hat = np.zeros_like(v_hat)
            u_hat[0], u_hat[1] = 2.5 * v_hat[0], 2.0 * v_hat[1]
            return np.fft.irfft(u_hat * N, n=N) + 0.5 * v
        print(f"  FNO 粗网格(N=16) x=pi/4 输出 = {fno_eval(16)[2]:.6f} | 细网格(N=128) = {fno_eval(128)[16]:.6f}")

        print("\n" + "=" * 72)
        print("【实验 3 (第 15 章)】温度校准 (T=4) 与 n=99 摸底考共形预测 90% 保底验证")
        print("=" * 72)
        logits = np.array([10.0, 2.0])
        p_uncal = np.exp(logits) / np.sum(np.exp(logits))
        p_cal   = np.exp(logits / 4.0) / np.sum(np.exp(logits / 4.0))
        print(f"  打分 (10, 2): 校准前最大概率 = {p_uncal[0]*100:.2f}% (过度自信) -> 除以 T=4 后 = {p_cal[0]*100:.2f}%")
        rng = np.random.default_rng(42)
        hits = sum(
            (s := rng.exponential(0.3, 100))[-1] <= np.sort(s[:99])[89]
            for _ in range(2000)
        )
        print(f"  n=99 共形预测取第 90 名阈值: 2000 名新病人实际命中率 = {hits/2000*100:.2f}% (理论值 90%, 有抽样波动)")

        print("\n" + "=" * 72)
        print("【实验 4 (第 16 章)】Best-of-N 抽卡 (p=0.2) 与 MCTS 树搜索 UCT 选路")
        print("=" * 72)
        p_single, N_draws = 0.20, 10
        pass_10 = 1.0 - (1.0 - p_single) ** N_draws
        n_arr, q_arr = np.array([6.0, 3.0, 1.0]), np.array([0.75, 0.50, 0.60])
        uct = q_arr + 0.5 * np.sqrt(np.log(np.sum(n_arr)) / n_arr)
        print(f"  单次成功率 p=20% 连抽 N=10 次 -> Pass@10 = {pass_10*100:.2f}%")
        print(f"  MCTS 三分支 UCT 得分 = {np.round(uct, 3)} -> 自动选中探路: 分支 {np.argmax(uct)+1}")

    if __name__ == "__main__":
        run_all_part4_demos()


SECTIONS = [
    (chapter_01, '第 1 章　概率：大模型到底在算什么'),
    (chapter_02, '第 2 章　几何：把词变成高维空间里的向量'),
    (chapter_03, '第 3 章　逼近：用折线拼出任意函数'),
    (chapter_04, '第 4 章　核方法：超宽网络怎样学习'),
    (chapter_05, '第 5 章　注意力：让每个词回头查找上文'),
    (chapter_06, '第 6 章　位置编码：让模型分清词的先后'),
    (chapter_07, '第 7 章　深度：让百层网络稳定传递信号'),
    (chapter_08, '第 8 章　效率：让大模型又大又快'),
    (chapter_09, '第 9 章　优化器：怎样拧动几百亿个旋钮'),
    (chapter_10, '第 10 章　规模定律：模型多大、数据多少'),
    (chapter_11, '第 11 章　低秩微调：用一张显卡改造大模型'),
    (chapter_12, '第 12 章　解码与对齐：让模型开口说话、听懂好恶'),
    (chapter_13, '第 13 章　扩散与流匹配：从噪声中生成图像'),
    (chapter_14, '第 14 章　神经算子：学习从函数到函数的映射'),
    (chapter_15, '第 15 章　不确定性：判断模型何时可信'),
    (chapter_16, '第 16 章　测试时推理：多想几步换更好的答案'),
    (appendix_c_all_in_one, '附录 C：第四篇四合一实战脚本'),
]


def main(argv):
    picks = {int(a) for a in argv if a.isdigit()}
    for k, (func, label) in enumerate(SECTIONS, start=1):
        if picks and k not in picks:
            continue
        print("=" * 72)
        print(label)
        print("=" * 72)
        func()
        print()


if __name__ == "__main__":
    main(sys.argv[1:])
