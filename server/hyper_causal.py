#!/usr/bin/env python3
"""iDiscover Frontier 4 — Hyper-NOTEARS: hypergraph causal discovery + acyclicity gate.

Standard causal discovery (PCMCI / LiNGAM / NOTEARS) assumes pairwise edges
(gene A -> gene B). Biology is higher-order: proteins A and B must act *jointly*
to drive pathway C. This engine models the cell as a Directed Acyclic Hypergraph
(DAH) and discovers those multi-way causes, extending NOTEARS (Zheng et al. 2018)
with an exact acyclicity certificate on the induced node graph:

      h(W) = tr(exp(W ∘ W)) - d = 0   <=>   W is acyclic (a DAG).

Two modes (Zero-BS throughout — nothing is fabricated):

1. VERIFY  (payload has `adjacency`/`W`): a proposed/estimated d×d weighted
   directed adjacency (W[i][j] = strength of edge i -> j) is checked with the
   EXACT matrix-exponential acyclicity residual. If h(W) > epsilon the model
   contains a causal loop and is REJECTED with a strict error:
     "Hypergraph causal discovery failed: Acyclicity constraint violated or
      optimization did not converge. No heuristic fallback will be provided."
   No "close enough" graph is ever returned.

2. DISCOVER (payload has `data`/`series`): learn a DAH from observational data.
   * Candidate hyperedges = singletons {i} and pairs {i,j} (order <= maxOrder);
     a pair's activation is the standardized interaction term z_i * z_j — this is
     what lets the engine find joint causes that pairwise methods miss (e.g. Z is
     driven by X*Y while neither X nor Y alone linearly predicts Z).
   * A causal order is estimated by peeling the most-exogenous node (lowest
     interaction-aware R² given the others). Admissible hyperedges have every tail
     node preceding the head — this removes the descendant-feedback that otherwise
     manufactures spurious loops, and makes the induced graph acyclic by
     construction. Per-node weights are fit by continuous optimization
     (scipy `minimize`, L-BFGS-B) of least-squares + L1 sparsity.
   * The discovered structure is CERTIFIED with the exact h(M); a discovery whose
     certificate somehow exceeds epsilon is rejected with the same strict error.

   Note on identifiability: orienting edges / detecting loops from purely
   observational data is not identifiable in general (a 2-node Gaussian cycle is
   indistinguishable from a DAG). DISCOVER therefore returns a certified DAH; to
   test a hypothesized network for loops, use VERIFY. This is stated honestly
   rather than pretending to detect cycles from raw data.

Reads JSON on stdin, prints JSON on stdout. Requires numpy + scipy.
"""
import itertools
import json
import sys

ACYCLIC_ERROR = (
    "Hypergraph causal discovery failed: Acyclicity constraint violated or "
    "optimization did not converge. No heuristic fallback will be provided."
)


def _fail(msg, status="unavailable"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _reject(h, eps, extra=None):
    out = {
        "status": "error",
        "engine": "Hyper-NOTEARS (hypergraph causal discovery)",
        "error": ACYCLIC_ERROR,
        "acyclicityResidual": None if h is None else round(float(h), 12),
        "epsilon": eps,
    }
    if extra:
        out.update(extra)
    print(json.dumps(out))
    sys.exit(0)


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}", status="error")

    try:
        import numpy as np
        from scipy.linalg import expm
        from scipy.optimize import minimize
    except Exception as e:
        _fail(f"Hyper-NOTEARS requires numpy + scipy (not installed): {e}")

    eps = float(payload.get("epsilon", 1e-5))

    def h_exact(M):
        W = M * M
        W = np.clip(W, 0.0, 50.0)  # guard expm overflow; real DAGs sit near 0
        val = float(np.trace(expm(W)) - M.shape[0])
        return val

    # ------------------------------------------------------------------ VERIFY
    adj = payload.get("adjacency", payload.get("W"))
    if adj is not None:
        try:
            W = np.array(adj, dtype=float)
        except Exception as e:
            _fail(f"Malformed adjacency: {e}", status="error")
        if W.ndim != 2 or W.shape[0] != W.shape[1]:
            _fail("adjacency must be a square d×d matrix (W[i][j] = edge i->j).", status="error")
        d = W.shape[0]
        variables = payload.get("variables") or [f"x{i}" for i in range(d)]
        if len(variables) != d:
            _fail(f"`variables` length {len(variables)} != adjacency dimension {d}.", status="error")
        h = h_exact(W)
        if not np.isfinite(h) or h > eps:
            _reject(h, eps, {"mode": "verify", "acyclic": False})
        edges = []
        for i in range(d):
            for j in range(d):
                if i != j and abs(W[i, j]) > 0:
                    edges.append({"cause": variables[i], "effect": variables[j], "weight": round(float(W[i, j]), 4)})
        print(json.dumps({
            "status": "success",
            "engine": "Hyper-NOTEARS (hypergraph causal discovery)",
            "mode": "verify",
            "acyclic": True,
            "acyclicityResidual": round(h, 12),
            "epsilon": eps,
            "variables": variables,
            "edges": edges,
            "note": "The proposed weighted adjacency is a certified DAG (tr(exp(W∘W))-d <= epsilon).",
        }))
        return

    # ----------------------------------------------------------------- DISCOVER
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
        _fail("Provide `adjacency`/`W` (verify) or `data`/`series` (discover).", status="error")

    if X.ndim != 2 or X.shape[0] < 20 or X.shape[1] < 2:
        _fail("Need a 2-D matrix with >=2 nodes and >=20 samples.", status="error")
    if len(variables) != X.shape[1]:
        _fail(f"`variables` length {len(variables)} != node columns {X.shape[1]}.", status="error")

    n, d = X.shape
    max_order = int(payload.get("maxOrder", 2))
    l1 = float(payload.get("l1", 0.02))
    edge_thr = float(payload.get("edgeThreshold", 0.3))

    def standardize(col):
        s = col.std()
        return (col - col.mean()) / (s if s > 1e-12 else 1.0)

    Z = np.column_stack([standardize(X[:, i]) for i in range(d)])

    def interaction(tail):
        f = np.ones(n)
        for i in tail:
            f = f * Z[:, i]
        return standardize(f) if len(tail) > 1 else Z[:, tail[0]]

    # ---- causal order: iteratively peel the most-exogenous node ----
    # exogeneity = lowest R^2 when predicted from the remaining nodes (with pairwise
    # interactions), i.e. the node least explained by the others is closest to a root.
    remaining = list(range(d))
    order = []
    while len(remaining) > 1:
        best, best_r2 = None, None
        for k in remaining:
            others = [j for j in remaining if j != k]
            feats = [Z[:, j] for j in others]
            for a, b in itertools.combinations(others, 2):
                feats.append(standardize(Z[:, a] * Z[:, b]))
            A = np.column_stack(feats)
            coef, *_ = np.linalg.lstsq(A, Z[:, k], rcond=None)
            r2 = 1.0 - float(np.var(Z[:, k] - A @ coef) / np.var(Z[:, k]))
            if best_r2 is None or r2 < best_r2:
                best_r2, best = r2, k
        order.append(best)
        remaining.remove(best)
    order.append(remaining[0])
    pos = {node: i for i, node in enumerate(order)}

    tails = [c for r in range(1, max_order + 1) for c in itertools.combinations(range(d), r)]

    # ---- per-node continuous optimization over admissible (order-respecting) hyperedges ----
    discovered = {}
    M = np.zeros((d, d))
    for k in range(d):
        adm = [t for t in tails if (k not in t) and all(pos[i] < pos[k] for i in t)]
        if not adm:
            continue
        A = np.column_stack([interaction(t) for t in adm])

        def obj(b, A=A, k=k):
            r = Z[:, k] - A @ b
            return 0.5 / n * float(np.sum(r * r)) + l1 * float(np.sum(np.sqrt(b * b + 1e-8)))

        res = minimize(obj, np.zeros(len(adm)), method="L-BFGS-B",
                       options={"maxiter": 500, "ftol": 1e-12})
        for t, w in zip(adm, res.x):
            if abs(w) >= edge_thr:
                discovered[(t, k)] = float(w)
                for i in t:
                    M[i, k] += w

    # ---- exact acyclicity certificate on the induced node graph ----
    h = h_exact(M)
    if not np.isfinite(h) or h > eps:
        _reject(h, eps, {"mode": "discover"})

    hyperedges = []
    for (t, k), w in sorted(discovered.items(), key=lambda kv: -abs(kv[1])):
        hyperedges.append({
            "tail": [variables[i] for i in t],
            "head": variables[k],
            "order": len(t),
            "strength": round(w, 4),
            "relation": f"[{', '.join(variables[i] for i in t)}] -> {variables[k]}",
        })

    print(json.dumps({
        "status": "success",
        "engine": "Hyper-NOTEARS (hypergraph causal discovery)",
        "mode": "discover",
        "method": "exogeneity-ordered, order-restricted hyperedge regression (scipy L-BFGS-B) + exact tr(exp(M∘M))-d certificate",
        "variables": variables,
        "causalOrder": [variables[i] for i in order],
        "nodes": d,
        "maxOrder": max_order,
        "acyclicityResidual": round(h, 12),
        "epsilon": eps,
        "hyperedges": hyperedges,
        "note": (
            "Each hyperedge is a discovered multi-way cause: the tail nodes jointly drive "
            "the head (pair tails use the standardized interaction term). The induced node "
            "graph is a certified DAG (tr(exp(M∘M))-d <= epsilon). Orienting edges from "
            "purely observational data is not identifiable in general; use VERIFY mode with "
            "an explicit adjacency to test a hypothesized network for loops."
        ),
    }))


if __name__ == "__main__":
    main()
