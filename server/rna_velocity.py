#!/usr/bin/env python3
"""Single-cell RNA velocity (numpy/scipy) — one dispatch.

Real, deterministic velocity estimation from spliced/unspliced counts, adapted from
the steady-state / correlation-kernel methods popularized by La Manno et al. (2018),
scVelo (Bergen et al. 2020) and dynamo (Qiu et al. 2022). Implementation is original
and validated against synthetic ground truth (a known degradation rate gamma is
recovered). It runs on numpy/scipy alone — the deep vector-field / least-action-path
machinery of dynamo needs a larger stack and is NOT claimed here.

Tasks:
  velocity_estimate         — per-gene steady-state degradation rate gamma + RNA
                              velocity v = u - gamma*s (+ per-gene R^2 of the fit).
  velocity_stream_projection — project high-dim velocities onto a 2-D embedding via
                              the scVelo-style cosine-correlation transition kernel.
Reads JSON on stdin, prints JSON on stdout.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _matrix(p, key):
    """Accept {gene:[cells]} dict or a genes x cells list-of-lists. Returns (np.ndarray genes x cells, gene_names)."""
    import numpy as np
    m = p.get(key)
    if isinstance(m, dict):
        genes = list(m.keys())
        arr = np.asarray([m[g] for g in genes], float)
    elif isinstance(m, list):
        arr = np.asarray(m, float)
        genes = p.get("geneNames") or [f"gene{i}" for i in range(arr.shape[0])]
    else:
        _fail(f"`{key}` must be a {{gene:[cells]}} map or a genes x cells matrix.")
    if arr.ndim != 2:
        _fail(f"`{key}` must be 2-D (genes x cells).")
    return arr, genes


def task_velocity_estimate(p):
    import numpy as np
    U, genes = _matrix(p, "unspliced")
    S, _ = _matrix(p, "spliced")
    if U.shape != S.shape:
        _fail("unspliced and spliced must have identical shape (genes x cells).")
    mode = p.get("mode", "steady_state")   # 'steady_state' (extreme quantile) | 'deterministic' (all cells)
    q = float(p.get("quantile", 0.05))
    n_cells = U.shape[1]

    gammas, r2s, vel = {}, {}, {}
    for gi, g in enumerate(genes):
        s = S[gi]
        u = U[gi]
        if mode == "steady_state" and n_cells >= 10:
            # fit through-origin on cells with the highest spliced abundance (near steady state)
            k = max(3, int(np.ceil(q * n_cells)))
            idx = np.argsort(s)[-k:]
            ss, uu = s[idx], u[idx]
        else:
            ss, uu = s, u
        denom = float(np.dot(ss, ss))
        gamma = float(np.dot(ss, uu) / denom) if denom > 0 else 0.0
        # R^2 of u ~ gamma*s through the origin (on the fitting subset)
        pred = gamma * ss
        sstot = float(np.sum((uu - uu.mean()) ** 2))
        ssres = float(np.sum((uu - pred) ** 2))
        r2 = (1.0 - ssres / sstot) if sstot > 0 else 0.0
        gammas[g] = round(gamma, 6)
        r2s[g] = round(r2, 6)
        vel[g] = [round(float(x), 6) for x in (u - gamma * s)]

    ranked = sorted(genes, key=lambda g: -r2s[g])
    result = {
        "status": "success",
        "analysis": "RNA velocity (steady-state degradation rate + v = u - gamma*s)",
        "mode": mode,
        "nGenes": len(genes),
        "nCells": n_cells,
        "gamma": gammas,
        "rSquared": r2s,
        "velocity": vel,
        "topGenesByFit": ranked[: min(20, len(ranked))],
    }
    out = p.get("outputDir")
    if out:
        result["bundle"] = _bundle_estimate(out, p, S, U, genes, gammas, r2s, ranked)
    return result


def task_velocity_stream_projection(p):
    import numpy as np
    X, genes = _matrix(p, "expression")          # genes x cells (spliced/smoothed expression)
    V, _ = _matrix(p, "velocity")                # genes x cells (from velocity_estimate)
    if X.shape != V.shape:
        _fail("expression and velocity must have identical shape (genes x cells).")
    emb = p.get("embedding")
    if not isinstance(emb, list):
        _fail("velocity_stream_projection needs `embedding` (cells x 2).")
    E = np.asarray(emb, float)
    n = X.shape[1]
    if E.shape[0] != n or E.shape[1] < 2:
        _fail("`embedding` must be nCells x 2, aligned to cells.")
    k = int(p.get("nNeighbors", min(10, n - 1)))
    k = max(1, min(k, n - 1))
    sigma = float(p.get("sigma", 0.05))

    Xc = X.T   # cells x genes
    Vc = V.T
    # kNN in expression space (euclidean)
    arrows = []
    for i in range(n):
        d = np.sqrt(np.sum((Xc - Xc[i]) ** 2, axis=1))
        nn = np.argsort(d)[1:k + 1]
        vi = Vc[i]
        vn = np.linalg.norm(vi)
        corrs = np.zeros(len(nn))
        for jj, j in enumerate(nn):
            delta = Xc[j] - Xc[i]
            dn = np.linalg.norm(delta)
            corrs[jj] = float(np.dot(delta, vi) / (dn * vn)) if dn > 0 and vn > 0 else 0.0
        # softmax transition kernel; center by uniform to get net displacement
        w = np.exp(corrs / sigma)
        w = w / w.sum() if w.sum() > 0 else np.ones(len(nn)) / len(nn)
        arrow = np.zeros(2)
        for jj, j in enumerate(nn):
            de = E[j] - E[i]
            den = np.linalg.norm(de)
            if den > 0:
                arrow += (w[jj] - 1.0 / len(nn)) * (de / den)
        arrows.append([round(float(arrow[0]), 6), round(float(arrow[1]), 6)])

    result = {
        "status": "success",
        "analysis": "velocity embedding projection (cosine-correlation transition kernel)",
        "nCells": n,
        "nNeighbors": k,
        "embeddingVelocity": arrows,
    }
    out = p.get("outputDir")
    if out:
        result["bundle"] = _bundle_stream(out, p, E, arrows)
    return result


def _bundle_estimate(output_dir, p, S, U, genes, gammas, r2s, ranked):
    import matplotlib
    matplotlib.use("Agg")
    import os

    import matplotlib.pyplot as plt
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import numpy as np
    from outcome_bundle import PALETTE, apply_palette, build_bundle

    top = ranked[0]
    gi = genes.index(top)
    fig, ax = plt.subplots(figsize=(5, 4.5))
    ax.scatter(S[gi], U[gi], s=10, c=PALETTE["secondary"], alpha=0.6)
    xs = np.linspace(0, max(S[gi].max(), 1e-9), 50)
    ax.plot(xs, gammas[top] * xs, color=PALETTE["primary"], lw=2, label=f"gamma={gammas[top]}")
    ax.set_xlabel("spliced"); ax.set_ylabel("unspliced")
    ax.set_title(f"Phase portrait — {top} (R^2={r2s[top]})"); ax.legend()
    apply_palette(ax)
    table = [{"gene": g, "gamma": gammas[g], "rSquared": r2s[g]} for g in ranked]
    code = (
        "#!/usr/bin/env python3\nimport json, subprocess, sys\n"
        f"payload = {json.dumps({'task': 'velocity_estimate', 'unspliced': p.get('unspliced'), 'spliced': p.get('spliced'), 'mode': p.get('mode', 'steady_state')}, default=str)}\n"
        "r = subprocess.run([sys.executable, 'server/rna_velocity.py'], input=json.dumps(payload).encode(), capture_output=True)\n"
        "print(r.stdout.decode())\n"
    )
    manifest = build_bundle(
        output_dir, tool="velocity_estimate", title="RNA velocity — steady-state estimation",
        result={"gamma": gammas, "rSquared": r2s, "topGenesByFit": ranked[:20]},
        research_log=f"# RNA velocity\nEstimated steady-state degradation rate gamma for {len(genes)} genes; "
                     f"velocity v = u - gamma*s. Best-fit gene: {top} (R^2={r2s[top]}).",
        figures=[("phase_portrait", fig)], tables=[("velocity_genes", table)], code=code,
        methods="Per-gene steady-state degradation rate gamma fit through the origin (u ~ gamma*s) on "
                "high-spliced cells; RNA velocity computed as v = u - gamma*s. numpy only.",
        interpretation="Positive velocity indicates a gene being induced (unspliced exceeds steady state); "
                       "negative indicates repression. Confirm with an orthogonal method before biological claims.",
    )
    plt.close(fig)
    return manifest


def _bundle_stream(output_dir, p, E, arrows):
    import matplotlib
    matplotlib.use("Agg")
    import os

    import matplotlib.pyplot as plt
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from outcome_bundle import PALETTE, apply_palette, build_bundle

    fig, ax = plt.subplots(figsize=(5, 4.5))
    ax.scatter(E[:, 0], E[:, 1], s=14, c=PALETTE["secondary"])
    for i in range(len(arrows)):
        ax.arrow(E[i, 0], E[i, 1], arrows[i][0], arrows[i][1], head_width=0.03, color=PALETTE["primary"], length_includes_head=True)
    ax.set_xlabel("dim 1"); ax.set_ylabel("dim 2"); ax.set_title("Velocity stream projection")
    apply_palette(ax)
    table = [{"cell": i, "vx": arrows[i][0], "vy": arrows[i][1]} for i in range(len(arrows))]
    manifest = build_bundle(
        output_dir, tool="velocity_stream_projection", title="RNA velocity — embedding projection",
        result={"nCells": len(arrows)},
        research_log=f"# Velocity embedding projection\nProjected velocities of {len(arrows)} cells onto the 2-D embedding "
                     "using a cosine-correlation transition kernel.",
        figures=[("velocity_stream", fig)], tables=[("embedding_velocity", table)],
        methods="Per-cell transition probabilities to kNN from softmax(cosine(expr_neighbor-expr_cell, velocity)/sigma); "
                "embedding arrow = sum of uniform-centered transition weights times unit neighbor displacements.",
    )
    plt.close(fig)
    return manifest


TASKS = {"velocity_estimate": task_velocity_estimate, "velocity_stream_projection": task_velocity_stream_projection}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:  # noqa: BLE001
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    try:
        import numpy  # noqa: F401
    except Exception as e:  # noqa: BLE001
        _fail(f"rna_velocity requires numpy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
