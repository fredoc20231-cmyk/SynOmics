#!/usr/bin/env python3
"""Dimensionality reduction / matrix factorization (scikit-learn).

Tasks: mds, ica, nmf, factor_analysis, kernel_pca. Reads JSON on stdin.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _M(p):
    import numpy as np
    X = p.get("matrix") or p.get("X")
    if not isinstance(X, list):
        _fail("Provide `matrix` (samples x features).")
    M = np.asarray(X, float)
    if M.ndim != 2 or M.shape[0] < 2:
        _fail("`matrix` must be 2-D with >=2 rows.")
    return M


def _emb(M, model):
    e = model.fit_transform(M)
    return [[round(float(v), 6) for v in row] for row in e]


def task_mds(p):
    from sklearn.manifold import MDS
    M = _M(p)
    nc = int(p.get("nComponents", 2))
    return {"status": "success", "analysis": "MDS", "embedding": _emb(M, MDS(n_components=nc, random_state=0, normalized_stress="auto"))}


def task_ica(p):
    from sklearn.decomposition import FastICA
    M = _M(p)
    nc = int(p.get("nComponents", min(2, M.shape[1])))
    return {"status": "success", "analysis": "FastICA", "components": _emb(M, FastICA(n_components=nc, random_state=0, max_iter=1000))}


def task_nmf(p):
    import numpy as np
    from sklearn.decomposition import NMF
    M = _M(p)
    if np.any(M < 0):
        _fail("NMF requires a non-negative matrix.")
    nc = int(p.get("nComponents", min(2, M.shape[1])))
    model = NMF(n_components=nc, random_state=0, init="nndsvda", max_iter=500)
    W = model.fit_transform(M)
    return {"status": "success", "analysis": "NMF", "reconstructionErr": round(float(model.reconstruction_err_), 6),
            "W": [[round(float(v), 6) for v in row] for row in W]}


def task_factor_analysis(p):
    from sklearn.decomposition import FactorAnalysis
    M = _M(p)
    nc = int(p.get("nComponents", min(2, M.shape[1])))
    return {"status": "success", "analysis": "factor analysis", "factors": _emb(M, FactorAnalysis(n_components=nc, random_state=0))}


def task_kernel_pca(p):
    from sklearn.decomposition import KernelPCA
    M = _M(p)
    nc = int(p.get("nComponents", 2))
    kernel = p.get("kernel", "rbf")
    return {"status": "success", "analysis": f"kernel PCA ({kernel})", "embedding": _emb(M, KernelPCA(n_components=nc, kernel=kernel))}


TASKS = {"mds": task_mds, "ica": task_ica, "nmf": task_nmf, "factor_analysis": task_factor_analysis, "kernel_pca": task_kernel_pca}


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
        import sklearn  # noqa: F401
    except Exception as e:
        _fail(f"dimreduction_tools requires scikit-learn: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
