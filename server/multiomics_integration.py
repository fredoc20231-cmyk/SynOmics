#!/usr/bin/env python3
"""Multi-omics integration — one dispatch, real numpy/scipy/scikit-learn compute.

Zero hallucination: every returned number is computed by executing the documented
algorithm on the caller's real data. Nothing is fabricated; missing dependencies
or malformed inputs return an explicit honest error/unavailable status.

Tasks (payload.task -> function):
  snf         Similarity Network Fusion (Wang et al., Nat. Methods 2014).
  cca         Canonical Correlation Analysis (sklearn.cross_decomposition.CCA).
  joint_nmf   Integrative (joint) Non-negative Matrix Factorization across views.

Shared contract:
  * Reads a JSON payload on stdin, writes a single JSON object on stdout.
  * _fail(msg, status) prints {"status": status, "error": msg} and exits 0.
  * Success payloads carry {"status":"success","analysis":<str>, ...,
    "researchLog":<markdown str>}.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _views(p, key="views", min_views=1, require_nonneg=False):
    """Parse `views`: a list of 2-D sample x feature matrices sharing the rows."""
    import numpy as np
    raw = p.get(key)
    if not isinstance(raw, list) or len(raw) < min_views:
        _fail(f"Provide `{key}` as a list of >= {min_views} sample x feature matrices.")
    mats = []
    for i, v in enumerate(raw):
        try:
            arr = np.asarray(v, dtype=float)
        except Exception as e:
            _fail(f"View {i} is not a numeric 2-D array: {e}")
        if arr.ndim != 2 or arr.size == 0:
            _fail(f"View {i} must be a non-empty 2-D array (samples x features).")
        if not np.all(np.isfinite(arr)):
            _fail(f"View {i} contains non-finite values.")
        mats.append(arr)
    n = mats[0].shape[0]
    for i, arr in enumerate(mats):
        if arr.shape[0] != n:
            _fail(
                f"All views must share the same samples (rows): view 0 has {n} "
                f"rows but view {i} has {arr.shape[0]}."
            )
    if n < 2:
        _fail("Need at least 2 samples (rows) to integrate views.")
    if require_nonneg:
        return mats  # non-negativity handled by the caller (shift/clip + note)
    return mats


def _matrix(p, key):
    import numpy as np
    m = p.get(key)
    if m is None:
        _fail(f"Missing required parameter {key!r}.")
    try:
        arr = np.asarray(m, dtype=float)
    except Exception as e:
        _fail(f"{key} must be a numeric 2-D array: {e}")
    if arr.ndim != 2 or arr.size == 0:
        _fail(f"{key} must be a non-empty 2-D array (rows x columns).")
    if not np.all(np.isfinite(arr)):
        _fail(f"{key} contains non-finite values.")
    return arr


def _pearson(a, b):
    """Pearson r via numpy; 0.0 if either vector is constant."""
    import numpy as np
    a = np.asarray(a, float).ravel()
    b = np.asarray(b, float).ravel()
    if a.std() == 0 or b.std() == 0:
        return 0.0
    return float(np.corrcoef(a, b)[0, 1])


# --------------------------------------------------------------------------- #
# Task 1 — Similarity Network Fusion (Wang et al. 2014)
# --------------------------------------------------------------------------- #
def snf(p):
    """Similarity Network Fusion across views, then spectral clustering."""
    import numpy as np
    from sklearn.cluster import SpectralClustering

    mats = _views(p, min_views=2)
    n = mats[0].shape[0]

    if p.get("nClusters") is None:
        _fail("Provide `nClusters` (number of clusters for spectral clustering).")
    try:
        n_clusters = int(p["nClusters"])
    except Exception:
        _fail("`nClusters` must be an integer.")
    if n_clusters < 2 or n_clusters > n:
        _fail(f"`nClusters` must be in [2, nSamples={n}].")

    K = int(p.get("K", min(20, n // 2)))
    K = max(1, min(K, n - 1))
    t = int(p.get("t", 20))
    if t < 1:
        _fail("`t` (iterations) must be >= 1.")
    mu = float(p.get("mu", 0.5))
    if mu <= 0:
        _fail("`mu` must be > 0.")

    eps0 = 1e-10

    def affinity(x):
        """Scaled-exponential affinity (Wang et al. eq. 1) from Euclidean distance."""
        diff = x[:, None, :] - x[None, :, :]
        d = np.sqrt(np.sum(diff ** 2, axis=2))
        d = (d + d.T) / 2.0
        sorted_d = np.sort(d, axis=1)  # ascending; column 0 is the self-distance (0)
        knn_mean = sorted_d[:, 1:K + 1].mean(axis=1)  # mean dist to K nearest nbrs
        # local scale eps(i,j) = (mean_i + mean_j + d(i,j)) / 3
        scale = (knn_mean[:, None] + knn_mean[None, :] + d) / 3.0 + eps0
        w = np.exp(-(d ** 2) / (mu * scale))
        return (w + w.T) / 2.0

    def normalize_full(w):
        """Full transition matrix: off-diag row-normalized to 0.5, diagonal = 0.5."""
        wc = w.copy()
        np.fill_diagonal(wc, 0.0)
        row = wc.sum(axis=1)
        row[row == 0] = 1.0
        pmat = wc / (2.0 * row[:, None])
        np.fill_diagonal(pmat, 0.5)
        return pmat

    def knn_kernel(w):
        """Sparse KNN kernel S: keep the K strongest affinities per row, row-normalize."""
        s = np.zeros_like(w)
        idx = np.argsort(-w, axis=1)[:, :K]
        rows = np.arange(w.shape[0])[:, None]
        s[rows, idx] = w[rows, idx]
        row = s.sum(axis=1)
        row[row == 0] = 1.0
        return s / row[:, None]

    m = len(mats)
    w0 = [affinity(x) for x in mats]
    P = [normalize_full(w) for w in w0]
    P = [(pi + pi.T) / 2.0 for pi in P]
    S = [knn_kernel(w) for w in w0]

    for _ in range(t):
        p_next = []
        for v in range(m):
            sum_other = np.zeros((n, n))
            for w in range(m):
                if w != v:
                    sum_other += P[w]
            sum_other /= (m - 1)
            pv = S[v] @ sum_other @ S[v].T
            p_next.append(pv)
        P = [normalize_full(pv) for pv in p_next]
        P = [(pi + pi.T) / 2.0 for pi in P]

    fused = sum(P) / m
    fused = (fused + fused.T) / 2.0

    sc = SpectralClustering(
        n_clusters=n_clusters,
        affinity="precomputed",
        random_state=0,
        assign_labels="discretize",
    )
    labels = sc.fit_predict(fused).astype(int)

    research_log = "\n".join([
        "# Similarity Network Fusion (SNF, Wang et al. 2014)",
        "",
        f"- Samples (n): **{n}**",
        f"- Views fused (m): **{m}** with feature counts {[a.shape[1] for a in mats]}",
        f"- Neighbors (K): **{K}**; iterations (t): **{t}**; mu: **{mu:g}**",
        f"- Clusters requested (spectral, precomputed affinity): **{n_clusters}**",
        "",
        "Per view we build a scaled-exponential affinity from pairwise Euclidean "
        "distances (local self-tuning scale = mean of the two points' K-nearest "
        "distances plus their mutual distance, over 3), a full row-normalized "
        "transition matrix P, and a sparse KNN kernel S. We iterate "
        "P^(v) <- S^(v) . (mean_{w!=v} P^(w)) . (S^(v))^T with renormalization, "
        "then average the diffused views into the fused similarity W and spectral-"
        "cluster it. Every value is computed from the input matrices; nothing is "
        "fabricated.",
    ])

    return {
        "status": "success",
        "analysis": "Similarity Network Fusion + spectral clustering of the fused network",
        "nSamples": n,
        "nViews": m,
        "featureCounts": [int(a.shape[1]) for a in mats],
        "K": K,
        "t": t,
        "mu": mu,
        "nClusters": n_clusters,
        "fusedSimilarity": np.round(fused, 6).tolist(),
        "clusterLabels": labels.tolist(),
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 2 — Canonical Correlation Analysis
# --------------------------------------------------------------------------- #
def cca(p):
    """Canonical correlations between two views X (n x p) and Y (n x q)."""
    import numpy as np
    from sklearn.cross_decomposition import CCA

    x = _matrix(p, "X")
    y = _matrix(p, "Y")
    if x.shape[0] != y.shape[0]:
        _fail(
            f"X and Y must share samples (rows): X has {x.shape[0]} rows, "
            f"Y has {y.shape[0]} rows."
        )
    n = x.shape[0]
    max_comp = min(x.shape[1], y.shape[1], n - 1)
    if max_comp < 1:
        _fail("Need at least 1 feature per view and >= 2 samples for CCA.")

    if p.get("nComponents") is None:
        n_comp = min(2, max_comp)
    else:
        try:
            n_comp = int(p["nComponents"])
        except Exception:
            _fail("`nComponents` must be an integer.")
        if n_comp < 1:
            _fail("`nComponents` must be >= 1.")
        if n_comp > max_comp:
            _fail(
                f"`nComponents`={n_comp} exceeds the maximum "
                f"min(pX, pY, nSamples-1)={max_comp}."
            )

    model = CCA(n_components=n_comp, max_iter=1000)
    x_c, y_c = model.fit_transform(x, y)
    x_c = np.asarray(x_c).reshape(n, n_comp)
    y_c = np.asarray(y_c).reshape(n, n_comp)

    corrs = [round(_pearson(x_c[:, i], y_c[:, i]), 6) for i in range(n_comp)]

    research_log = "\n".join([
        "# Canonical Correlation Analysis (CCA)",
        "",
        f"- Samples (n): **{n}**",
        f"- X features: **{x.shape[1]}**; Y features: **{y.shape[1]}**",
        f"- Components extracted: **{n_comp}** (max min(pX,pY,n-1) = {max_comp})",
        f"- Canonical correlations (Pearson r of paired scores): **{corrs}**",
        "",
        "sklearn.cross_decomposition.CCA finds paired linear projections of X and Y "
        "with maximal correlation; each reported value is the Pearson correlation "
        "between the transformed X and Y scores for that component, computed on the "
        "real inputs.",
    ])

    return {
        "status": "success",
        "analysis": "Canonical Correlation Analysis between two omics views",
        "nSamples": n,
        "nFeaturesX": int(x.shape[1]),
        "nFeaturesY": int(y.shape[1]),
        "nComponents": n_comp,
        "canonicalCorrelations": corrs,
        "researchLog": research_log,
    }


# --------------------------------------------------------------------------- #
# Task 3 — Integrative (joint) NMF
# --------------------------------------------------------------------------- #
def joint_nmf(p):
    """Joint NMF over feature-concatenated non-negative views."""
    import numpy as np
    from sklearn.decomposition import NMF

    mats = _views(p, min_views=1, require_nonneg=True)
    n = mats[0].shape[0]
    concat = np.concatenate(mats, axis=1)

    shifted = False
    shift_amount = 0.0
    min_val = float(concat.min())
    if min_val < 0:
        shift_amount = -min_val
        concat = concat + shift_amount
        shifted = True

    if p.get("nComponents") is None:
        n_comp = 2
    else:
        try:
            n_comp = int(p["nComponents"])
        except Exception:
            _fail("`nComponents` must be an integer.")
    if n_comp < 1:
        _fail("`nComponents` must be >= 1.")
    if n_comp > min(concat.shape):
        _fail(
            f"`nComponents`={n_comp} exceeds min(nSamples, totalFeatures)="
            f"{min(concat.shape)}."
        )

    model = NMF(n_components=n_comp, init="nndsvda", random_state=0, max_iter=1000)
    W = model.fit_transform(concat)
    H = model.components_
    recon = W @ H

    recon_error = float(model.reconstruction_err_)
    recon_corr = _pearson(concat, recon)

    ss_res = float(np.sum((concat - recon) ** 2))
    ss_tot = float(np.sum((concat - concat.mean()) ** 2))
    variance_explained = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    note = None
    if shifted:
        note = (
            "Input contained negative values; the concatenated matrix was shifted "
            f"by +{shift_amount:g} (global minimum) so all entries are non-negative "
            "before NMF. Relative structure is preserved."
        )

    research_log = "\n".join([
        "# Integrative (joint) NMF across omics views",
        "",
        f"- Samples (n): **{n}**",
        f"- Views: **{len(mats)}** with feature counts {[a.shape[1] for a in mats]}; "
        f"concatenated features: **{concat.shape[1]}**",
        f"- Factors (nComponents / rank k): **{n_comp}**",
        f"- Frobenius reconstruction error ||X - WH||_F: **{recon_error:.6g}**",
        f"- Reconstruction correlation (X vs WH, Pearson r): **{recon_corr:.6f}**",
        f"- Variance explained (1 - SS_res/SS_tot): **{variance_explained:.6f}**",
        (f"- Note: {note}" if note else "- Inputs were non-negative; no shift applied."),
        "",
        "Views are concatenated along features and factored with a shared sample "
        "loading matrix W (samples x k) via sklearn.decomposition.NMF "
        "(deterministic nndsvda init, random_state=0). W, H, and every reported "
        "metric are computed from the real data.",
    ])

    result = {
        "status": "success",
        "analysis": "Integrative non-negative matrix factorization across omics views",
        "nSamples": n,
        "nViews": len(mats),
        "featureCounts": [int(a.shape[1]) for a in mats],
        "nConcatenatedFeatures": int(concat.shape[1]),
        "nComponents": n_comp,
        "reconstructionError": round(recon_error, 8),
        "reconstructionCorrelation": round(recon_corr, 6),
        "varianceExplained": round(float(variance_explained), 6),
        "factorMatrixW": np.round(W, 8).tolist(),
        "shifted": shifted,
        "researchLog": research_log,
    }
    if note:
        result["note"] = note
    return result


# --------------------------------------------------------------------------- #
# Dispatch
# --------------------------------------------------------------------------- #
TASKS = {
    "snf": snf,
    "cca": cca,
    "joint_nmf": joint_nmf,
}


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
        import sklearn  # noqa: F401
    except Exception as e:
        _fail(
            f"multiomics_integration requires numpy + scikit-learn: {e}",
            status="unavailable",
        )
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
