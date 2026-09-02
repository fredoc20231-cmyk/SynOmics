#!/usr/bin/env python3
"""iDiscover Frontier 2 — The "Biological Git": cellular-state reversion via Optimal Transport.

Treats a diseased single-cell distribution as a "corrupted commit" and computes the
minimum-energy transport plan that maps it back onto a healthy reference distribution
(Waddington-OT / Schiebinger et al. 2019). The Wasserstein distance is the exact
"energy" of that revert; the barycentric projection of the transport coupling yields
the exact per-gene perturbations (the "git revert commits") that bridge the two states.

ZERO-BS grounding:
  * The transport plan is a rigorously solved optimization, not a heuristic. When the
    POT library is available we use its exact EMD (network simplex); otherwise we fall
    back to an entropic Sinkhorn solver implemented in numpy and flag the result
    `approximate: true`. If Sinkhorn fails to converge we return a strict, explicit
    error — never a random/heuristic fallback.
  * Reported gene names are EXACT column matches from the input — nothing is invented.
  * Requires numpy; without it, returns an honest 'unavailable' status.

Reads JSON on stdin, prints JSON on stdout.
Payload:
  { "sourceMatrix": [[...],[...]],   # diseased cells  (rows = cells, cols = genes)
    "targetMatrix": [[...],[...]],   # healthy cells   (same gene columns)
    "genes": ["G1","G2",...],        # gene names (len == n_cols); optional
    "topK": 5,                        # number of perturbation "commits" to report
    "reg": 0.05,                      # Sinkhorn entropic regularization (fallback only)
    "maxIter": 2000, "tol": 1e-9 }
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
        _fail(f"Optimal Transport requires numpy (not installed): {e}")

    try:
        src = np.asarray(payload.get("sourceMatrix"), dtype=float)
        tgt = np.asarray(payload.get("targetMatrix"), dtype=float)
    except Exception as e:
        _fail(f"Malformed matrices: {e}", status="error")

    if src.ndim != 2 or tgt.ndim != 2:
        _fail("sourceMatrix and targetMatrix must both be 2-D (cells x genes).", status="error")
    if src.shape[1] != tgt.shape[1]:
        _fail(f"Gene dimension mismatch: source has {src.shape[1]} genes, target has {tgt.shape[1]}.", status="error")
    if src.shape[0] < 1 or tgt.shape[0] < 1:
        _fail("Both distributions need at least one cell.", status="error")

    n_src, d = src.shape
    n_tgt = tgt.shape[0]

    genes = payload.get("genes")
    if genes is None:
        genes = [f"gene{i}" for i in range(d)]
    if len(genes) != d:
        _fail(f"`genes` length {len(genes)} != gene columns {d}.", status="error")

    top_k = int(payload.get("topK", 5))

    # Cost = squared Euclidean distance between every diseased cell and healthy cell
    # in gene-expression space. This is the ground metric for the 2-Wasserstein distance.
    # ||x-y||^2 = ||x||^2 + ||y||^2 - 2 x.y  (stable, vectorized)
    sq_src = np.sum(src ** 2, axis=1)[:, None]
    sq_tgt = np.sum(tgt ** 2, axis=1)[None, :]
    cost = sq_src + sq_tgt - 2.0 * src @ tgt.T
    cost = np.maximum(cost, 0.0)  # clip tiny negatives from float error

    # Uniform marginals over cells (empirical distributions).
    a = np.full(n_src, 1.0 / n_src)
    b = np.full(n_tgt, 1.0 / n_tgt)

    solver = None
    approximate = False
    plan = None

    # Prefer the exact EMD (network simplex) from POT when available.
    try:
        import ot as pot  # POT: Python Optimal Transport
        plan = pot.emd(a, b, cost, numItermax=1_000_000)
        solver = f"POT exact EMD (network simplex) v{getattr(pot, '__version__', '?')}"
    except Exception:
        # Entropic Sinkhorn fallback in pure numpy (Cuturi 2013).
        reg = float(payload.get("reg", 0.05))
        max_iter = int(payload.get("maxIter", 2000))
        tol = float(payload.get("tol", 1e-9))
        # Scale reg by the median cost so it is well-conditioned across datasets.
        med = float(np.median(cost[cost > 0])) if np.any(cost > 0) else 1.0
        reg_eff = reg * (med if med > 0 else 1.0)
        K = np.exp(-cost / reg_eff)
        if not np.all(np.isfinite(K)) or np.all(K == 0):
            _fail("Optimal Transport failed to converge. Distributions may be too disjoint.", status="error")
        u = np.ones(n_src)
        v = np.ones(n_tgt)
        converged = False
        for _ in range(max_iter):
            u_prev = u
            Kv = K @ v
            Kv[Kv == 0] = 1e-300
            u = a / Kv
            KTu = K.T @ u
            KTu[KTu == 0] = 1e-300
            v = b / KTu
            if not (np.all(np.isfinite(u)) and np.all(np.isfinite(v))):
                _fail("Optimal Transport failed to converge. Distributions may be too disjoint.", status="error")
            if np.max(np.abs(u - u_prev)) < tol:
                converged = True
                break
        if not converged:
            _fail("Optimal Transport failed to converge. Distributions may be too disjoint.", status="error")
        plan = u[:, None] * K * v[None, :]
        solver = f"entropic Sinkhorn (numpy, reg={reg})"
        approximate = True

    if plan is None or not np.all(np.isfinite(plan)):
        _fail("Optimal Transport failed to converge. Distributions may be too disjoint.", status="error")

    # 2-Wasserstein distance = sqrt(<plan, cost>).
    transport_cost = float(np.sum(plan * cost))
    wasserstein2 = float(np.sqrt(max(transport_cost, 0.0)))

    # Barycentric projection: where does each diseased cell need to move?
    #   mapped_i = sum_j plan[i,j] * target_j / sum_j plan[i,j]
    row_mass = plan.sum(axis=1, keepdims=True)
    row_mass[row_mass == 0] = 1e-300
    mapped = (plan @ tgt) / row_mass
    # Per-gene mean shift (diseased -> healthy). Positive => gene must be UP-regulated.
    delta = mapped - src
    mean_shift = delta.mean(axis=0)

    order = np.argsort(-np.abs(mean_shift))
    top_k = max(1, min(top_k, d))
    perturbations = []
    for rank, gi in enumerate(order[:top_k], start=1):
        shift = float(mean_shift[gi])
        perturbations.append({
            "rank": rank,
            "gene": genes[gi],
            "direction": "UP" if shift > 0 else "DOWN",
            "meanShift": round(shift, 6),
            "action": f"{'activate/up-regulate' if shift > 0 else 'knock-down/down-regulate'} {genes[gi]}",
        })

    print(json.dumps({
        "status": "success",
        "engine": "Waddington Optimal Transport (cellular-state reversion)",
        "solver": solver,
        "approximate": approximate,
        "wassersteinDistance": round(wasserstein2, 6),
        "transportCost": round(transport_cost, 6),
        "sourceCells": n_src,
        "targetCells": n_tgt,
        "genes": d,
        "revertCommits": perturbations,
        "note": (
            "wassersteinDistance is the exact minimum 'energy' to revert the diseased "
            "distribution to the healthy reference. revertCommits are the top per-gene "
            "perturbations from the barycentric projection of the transport plan; gene "
            "names are exact input columns. 'approximate' is true only for the Sinkhorn "
            "fallback (entropic regularization)."
        ),
    }))


if __name__ == "__main__":
    main()
