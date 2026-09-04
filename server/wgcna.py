#!/usr/bin/env python3
"""Weighted gene co-expression network analysis (WGCNA-style, numpy/scipy).

Tasks: soft_threshold (pick beta by scale-free fit), coexpression_modules
(|corr|^beta adjacency -> hierarchical clustering -> modules),
module_eigengenes (PC1 per module). Input `expression`: samples x genes.
Reads JSON on stdin.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _expr(p):
    import numpy as np
    X = p.get("expression")
    if not isinstance(X, list):
        _fail("Provide `expression`: samples x genes matrix.")
    M = np.asarray(X, float)
    if M.ndim != 2 or M.shape[1] < 3:
        _fail("expression must be samples x genes with >=3 genes.")
    return M


def _corr(M):
    import numpy as np
    C = np.corrcoef(M, rowvar=False)
    return np.nan_to_num(C)


def task_soft_threshold(p):
    import numpy as np
    M = _expr(p)
    C = np.abs(_corr(M))
    powers = p.get("powers") or [1, 2, 4, 6, 8, 10, 12]
    results = []
    for beta in powers:
        A = C ** beta
        k = A.sum(axis=1) - 1  # connectivity (exclude self)
        k = k[k > 0]
        if len(k) < 3:
            results.append({"power": beta, "scaleFreeR2": None}); continue
        # scale-free fit: log10 p(k) vs log10 k
        hist, edges = np.histogram(k, bins=min(10, len(k)))
        centers = (edges[:-1] + edges[1:]) / 2
        mask = hist > 0
        if mask.sum() < 2:
            results.append({"power": beta, "scaleFreeR2": None}); continue
        lx = np.log10(centers[mask]); ly = np.log10(hist[mask] / hist.sum())
        r = np.corrcoef(lx, ly)[0, 1]
        results.append({"power": beta, "scaleFreeR2": round(float(r * r), 4), "meanConnectivity": round(float(k.mean()), 3)})
    valid = [r for r in results if r["scaleFreeR2"] is not None and r["scaleFreeR2"] >= 0.8]
    chosen = valid[0]["power"] if valid else max((r for r in results if r["scaleFreeR2"] is not None), key=lambda r: r["scaleFreeR2"], default={"power": 6})["power"]
    return {"status": "success", "analysis": "WGCNA soft-threshold selection", "fit": results, "chosenPower": chosen}


def task_coexpression_modules(p):
    import numpy as np
    from scipy.cluster.hierarchy import fcluster, linkage
    from scipy.spatial.distance import squareform
    M = _expr(p)
    beta = int(p.get("power", 6))
    C = np.abs(_corr(M))
    A = C ** beta
    # topological overlap-ish dissimilarity = 1 - adjacency
    D = 1 - A
    np.fill_diagonal(D, 0)
    D = (D + D.T) / 2
    condensed = squareform(D, checks=False)
    Z = linkage(condensed, method="average")
    n_modules = int(p.get("nModules", 3))
    labels = fcluster(Z, t=n_modules, criterion="maxclust")
    genes = p.get("geneNames") or [f"g{i}" for i in range(M.shape[1])]
    modules = {}
    for gi, lab in enumerate(labels):
        modules.setdefault(int(lab), []).append(genes[gi])
    return {"status": "success", "analysis": "WGCNA co-expression modules", "power": beta,
            "nModules": len(modules), "modules": {str(k): v for k, v in sorted(modules.items())}}


def task_module_eigengenes(p):
    from sklearn.decomposition import PCA
    M = _expr(p)
    assignments = p.get("moduleAssignments")
    genes = p.get("geneNames") or [f"g{i}" for i in range(M.shape[1])]
    if not isinstance(assignments, dict):
        _fail("module_eigengenes needs `moduleAssignments`: {module: [genes]}.")
    idx = {g: i for i, g in enumerate(genes)}
    out = {}
    for mod, glist in assignments.items():
        cols = [idx[g] for g in glist if g in idx]
        if len(cols) < 1:
            continue
        sub = M[:, cols]
        pc = PCA(n_components=1).fit(sub)
        eig = pc.transform(sub)[:, 0]
        out[str(mod)] = {"eigengene": [round(float(v), 6) for v in eig],
                         "varianceExplained": round(float(pc.explained_variance_ratio_[0]), 4)}
    return {"status": "success", "analysis": "WGCNA module eigengenes (PC1)", "moduleEigengenes": out}


TASKS = {"soft_threshold": task_soft_threshold, "coexpression_modules": task_coexpression_modules,
         "module_eigengenes": task_module_eigengenes}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    try:
        import numpy  # noqa: F401
    except Exception as e:
        _fail(f"wgcna requires numpy + scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
