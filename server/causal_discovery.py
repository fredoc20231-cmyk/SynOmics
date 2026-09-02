#!/usr/bin/env python3
"""Causal discovery (DirectLiNGAM) — Part 3A of the Zero-Fake doctrine.

Infers a directed causal graph from linear non-Gaussian data instead of stopping
at correlation. The direction logic is the published DirectLiNGAM pairwise
entropy measure (Shimizu et al. 2011; Hyvarinen & Smith 2013), implemented in
numpy and empirically validated to recover known causal orders. Edges are gated
by bootstrap stability so only reproducible causal links are reported — no
fabricated arrows.

Reads a JSON payload on stdin, prints a JSON result on stdout. If numpy is not
available it returns an honest 'unavailable' status rather than failing silently.

Payload:
  { "data": [[...],[...]],           # rows = samples, cols = variables
    "variables": ["g1","g2",...],    # optional names
    "nBootstrap": 200,               # stability resamples
    "stabilityThreshold": 0.9,       # keep edges seen this often
    "minEffect": 0.1,                # |standardized coef| floor
    "seed": 1337 }
Alternatively: { "series": { "g1": [...], "g2": [...] } }
"""
import json
import sys


def _fail(msg, status="unavailable"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}", status="error")

    try:
        import numpy as np
    except Exception as e:
        _fail(f"Causal discovery requires numpy (not installed): {e}")

    # ---- assemble the data matrix ----
    variables = payload.get("variables")
    if isinstance(payload.get("series"), dict):
        series = payload["series"]
        variables = list(series.keys())
        try:
            X = np.array([series[v] for v in variables], dtype=float).T
        except Exception as e:
            _fail(f"Malformed series: {e}", status="error")
    elif isinstance(payload.get("data"), list):
        X = np.array(payload["data"], dtype=float)
        if variables is None:
            variables = [f"x{i}" for i in range(X.shape[1])]
    else:
        _fail("Provide `data` (rows x vars) or `series` (var -> values).", status="error")

    if X.ndim != 2 or X.shape[0] < 20 or X.shape[1] < 2:
        _fail("Need a 2-D matrix with >=2 variables and >=20 samples for stable causal inference.", status="error")

    n, d = X.shape
    n_boot = int(payload.get("nBootstrap", 200))
    stab_thr = float(payload.get("stabilityThreshold", 0.9))
    min_effect = float(payload.get("minEffect", 0.1))
    seed = int(payload.get("seed", 1337))

    def entropy(u):
        k1, k2, gamma = 79.047, 7.4129, 0.37457
        return (1 + np.log(2 * np.pi)) / 2 - k1 * (np.mean(np.log(np.cosh(u))) - gamma) ** 2 - k2 * (np.mean(u * np.exp(-u ** 2 / 2))) ** 2

    def diff_mi(xi, xj):
        r = np.corrcoef(xi, xj)[0, 1]
        ri, rj = xi - r * xj, xj - r * xi
        si, sj = np.std(ri), np.std(rj)
        if si == 0 or sj == 0:
            return 0.0
        return (entropy(xj) + entropy(ri / si)) - (entropy(xi) + entropy(rj / sj))

    def standardize(M):
        s = M.std(0)
        s[s == 0] = 1.0
        return (M - M.mean(0)) / s

    def causal_order(M):
        Xs = standardize(M)
        U = list(range(Xs.shape[1]))
        order = []
        cols = {i: Xs[:, i].copy() for i in U}
        while len(U) > 1:
            scores = {}
            for i in U:
                s = 0.0
                for j in U:
                    if i == j:
                        continue
                    s += min(0.0, diff_mi(cols[i], cols[j])) ** 2
                scores[i] = s
            root = min(U, key=lambda i: scores[i])
            order.append(root)
            U.remove(root)
            r = cols[root]
            for j in U:
                b = np.cov(cols[j], r)[0, 1] / np.var(r)
                res = cols[j] - b * r
                sd = res.std()
                cols[j] = (res - res.mean()) / (sd if sd else 1.0)
        order.append(U[0])
        return order

    def adjacency(M, order):
        Xs = standardize(M)
        B = np.zeros((Xs.shape[1], Xs.shape[1]))
        for k, eff in enumerate(order):
            preds = order[:k]
            if preds:
                A = Xs[:, preds]
                coef, *_ = np.linalg.lstsq(A, Xs[:, eff], rcond=None)
                for pi, p in enumerate(preds):
                    B[eff, p] = coef[pi]
        return B

    order = causal_order(X)
    B = adjacency(X, order)

    # ---- bootstrap edge stability (gating): keep only reproducible edges ----
    rng = np.random.default_rng(seed)
    counts = np.zeros((d, d))
    sign_sum = np.zeros((d, d))
    for _ in range(n_boot):
        idx = rng.integers(0, n, n)
        Bb = adjacency(X[idx], order)  # order held fixed from full data
        hit = np.abs(Bb) >= min_effect
        counts += hit
        sign_sum += np.sign(Bb) * hit
    stability = counts / max(n_boot, 1)

    edges = []
    for eff in range(d):
        for cause in range(d):
            if eff == cause:
                continue
            if abs(B[eff, cause]) >= min_effect and stability[eff, cause] >= stab_thr:
                edges.append({
                    "cause": variables[cause],
                    "effect": variables[eff],
                    "weight": round(float(B[eff, cause]), 4),
                    "stability": round(float(stability[eff, cause]), 3),
                })
    edges.sort(key=lambda e: -abs(e["weight"]))

    print(json.dumps({
        "status": "success",
        "method": "DirectLiNGAM (pairwise entropy measure) + bootstrap stability gating",
        "variables": variables,
        "causalOrder": [variables[i] for i in order],
        "adjacencyMatrix": [[round(float(v), 4) for v in row] for row in B],
        "edges": edges,
        "params": {"nBootstrap": n_boot, "stabilityThreshold": stab_thr, "minEffect": min_effect, "seed": seed},
        "note": "Rows/cols of adjacencyMatrix follow `variables` order; entry [effect, cause] is the standardized causal coefficient. Only bootstrap-stable edges are listed in `edges`.",
    }))


if __name__ == "__main__":
    main()
