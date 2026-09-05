#!/usr/bin/env python3
"""Single-cell trajectory pseudotime (numpy/scipy) — one dispatch.

Real, deterministic pseudotime ordering of cells from an expression matrix.
Two complementary, well-established estimators are implemented; every reported
number is produced by executing real linear-algebra / graph code on the caller's
real data — nothing is fabricated.

Tasks:
  diffusion_pseudotime — diffusion-map pseudotime in the spirit of Haghverdi
                         et al. (2016, DPT) and Coifman & Lafon (2006, diffusion
                         maps): a Gaussian affinity is row-normalized into a
                         Markov transition matrix, eigendecomposed, and cells are
                         embedded in eigenvalue-scaled diffusion-component space;
                         pseudotime is the Euclidean distance from the root cell.
  mst_pseudotime       — minimum-spanning-tree pseudotime (the backbone shared by
                         Monocle/TSCAN-style methods): an MST is built over a
                         Euclidean (kNN or complete) cell graph and pseudotime is
                         the shortest-path distance along the tree from the root.

Reads a JSON payload on stdin, writes a single JSON object on stdout.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _expression(p):
    """Fetch and validate the cells x genes expression matrix as a numpy array."""
    import numpy as np
    m = p.get("expression")
    if m is None:
        _fail("`expression` is required (a cells x genes list-of-lists).")
    try:
        x = np.asarray(m, dtype=float)
    except Exception as e:  # noqa: BLE001
        _fail(f"`expression` must be a numeric 2-D array: {e}")
    if x.ndim != 2:
        _fail("`expression` must be 2-D (cells x genes).")
    if x.shape[0] < 3:
        _fail("`expression` needs at least 3 cells to order a trajectory.")
    if not np.all(np.isfinite(x)):
        _fail("`expression` contains non-finite values.")
    return x


def _root(p, n):
    root = int(p.get("rootCell", 0))
    if root < 0 or root >= n:
        _fail(f"rootCell {root} is out of range for {n} cells.")
    return root


def _minmax(v):
    """Min-max normalize a 1-D array to [0,1]; all-equal -> zeros."""
    import numpy as np
    v = np.asarray(v, dtype=float)
    lo = float(v.min())
    hi = float(v.max())
    if hi - lo <= 0.0:
        return np.zeros_like(v)
    return (v - lo) / (hi - lo)


def diffusion_pseudotime(p):
    """Diffusion-map pseudotime (Haghverdi/Coifman).

    Gaussian affinity from pairwise Euclidean distance -> row-normalized Markov
    transition matrix -> eigendecomposition -> eigenvalue-scaled diffusion
    embedding (excluding the trivial 1st component) -> pseudotime = Euclidean
    distance from the root cell in that space, min-max normalized to [0,1].
    """
    import numpy as np
    from scipy.spatial.distance import pdist, squareform
    x = _expression(p)
    n = x.shape[0]
    root = _root(p, n)

    # Pairwise Euclidean distance between cells.
    dist = squareform(pdist(x, metric="euclidean"))

    # Gaussian kernel bandwidth: default = median of the (off-diagonal) pairwise
    # distances, the standard self-tuning choice.
    sigma = p.get("sigma")
    if sigma is None:
        off = dist[np.triu_indices(n, k=1)]
        sigma = float(np.median(off))
        if sigma <= 0.0:
            positive = off[off > 0]
            sigma = float(positive.min()) if positive.size else 1.0
    else:
        sigma = float(sigma)
        if sigma <= 0.0:
            _fail("sigma must be positive.")

    # Gaussian affinity (self-affinity on the diagonal = 1).
    aff = np.exp(-(dist ** 2) / (2.0 * sigma ** 2))

    # Row-normalize into a Markov transition matrix P = D^{-1} W. P has real
    # eigenvalues because it is similar to the symmetric S = D^{-1/2} W D^{-1/2};
    # eigendecompose S (numerically stable, real spectrum) and recover P's right
    # eigenvectors as psi = D^{-1/2} phi. Eigenvalues are identical.
    deg = aff.sum(axis=1)
    if np.any(deg <= 0):
        _fail("Degenerate affinity graph (isolated cell); increase sigma.")
    q = 1.0 / np.sqrt(deg)
    sym = aff * q[:, None] * q[None, :]
    sym = (sym + sym.T) / 2.0
    evals, evecs = np.linalg.eigh(sym)          # ascending
    order = np.argsort(evals)[::-1]             # descending
    evals = evals[order]
    evecs = evecs[:, order]
    psi = evecs * q[:, None]                    # right eigenvectors of P

    # Diffusion embedding: exclude the trivial 1st (eigenvalue ~1, constant
    # eigenvector); scale each remaining component by its eigenvalue.
    n_comps = int(p.get("nComps", 10))
    if n_comps < 1:
        _fail("nComps must be >= 1.")
    n_comps = min(n_comps, n - 1)
    comp_idx = np.arange(1, 1 + n_comps)
    embedding = psi[:, comp_idx] * evals[comp_idx][None, :]

    # Pseudotime = Euclidean distance from the root cell in diffusion space.
    diff = embedding - embedding[root]
    raw = np.sqrt(np.sum(diff ** 2, axis=1))
    pseudotime = _minmax(raw)

    used_evals = [float(v) for v in evals[comp_idx]]
    research_log = (
        "# Diffusion pseudotime\n\n"
        f"- Cells: **{n}**, genes: **{x.shape[1]}**\n"
        f"- Root cell: **{root}**\n"
        f"- Gaussian bandwidth sigma: **{sigma:.6g}** "
        f"({'median pairwise distance' if p.get('sigma') is None else 'user-supplied'})\n"
        f"- Diffusion components used (trivial 1st excluded): **{n_comps}**\n"
        f"- Top used eigenvalues: {', '.join(f'{v:.4g}' for v in used_evals[:5])}\n\n"
        "Method: Gaussian affinity -> row-normalized Markov transition matrix -> "
        "eigendecomposition -> eigenvalue-scaled diffusion embedding; pseudotime is "
        "the Euclidean distance from the root cell, min-max normalized to [0,1]."
    )
    return {
        "status": "success",
        "analysis": "diffusion-map pseudotime (Haghverdi/Coifman)",
        "nCells": n,
        "nGenes": int(x.shape[1]),
        "rootCell": root,
        "sigma": sigma,
        "nComps": n_comps,
        "eigenvalues": used_evals,
        "pseudotime": [float(v) for v in pseudotime],
        "researchLog": research_log,
    }


def mst_pseudotime(p):
    """Minimum-spanning-tree pseudotime.

    Build a Euclidean cell graph (complete, or kNN if `nNeighbors` is given),
    compute its MST, and set pseudotime = shortest-path distance along the tree
    from the root cell, min-max normalized. The root's pseudotime is exactly 0.0.
    """
    import numpy as np
    from scipy.sparse.csgraph import minimum_spanning_tree, shortest_path
    from scipy.spatial.distance import pdist, squareform
    x = _expression(p)
    n = x.shape[0]
    root = _root(p, n)

    dist = squareform(pdist(x, metric="euclidean"))

    n_neighbors = p.get("nNeighbors")
    if n_neighbors is None:
        graph = dist.copy()
        np.fill_diagonal(graph, 0.0)
        graph_kind = "complete"
        k_used = n - 1
    else:
        k = int(n_neighbors)
        if k < 1:
            _fail("nNeighbors must be >= 1.")
        k = min(k, n - 1)
        graph = np.zeros((n, n), dtype=float)
        for i in range(n):
            nn = np.argsort(dist[i])[1:k + 1]   # exclude self
            for j in nn:
                w = dist[i, j]
                # symmetrize (mutual-or edges) so the MST sees an undirected graph
                graph[i, j] = w
                graph[j, i] = w
        graph_kind = "knn"
        k_used = k

    mst = minimum_spanning_tree(graph)          # scipy sparse (upper-triangular)
    # Shortest path along the (undirected) tree from the root.
    dist_from_root = shortest_path(mst, method="D", directed=False, indices=root)

    if not np.all(np.isfinite(dist_from_root)):
        _fail(
            "MST is disconnected (some cells unreachable from the root); "
            "use a complete graph or increase nNeighbors.",
            status="error",
        )

    pseudotime = _minmax(dist_from_root)

    research_log = (
        "# MST pseudotime\n\n"
        f"- Cells: **{n}**, genes: **{x.shape[1]}**\n"
        f"- Root cell: **{root}** (pseudotime fixed at 0.0)\n"
        f"- Graph: **{graph_kind}** (k={k_used})\n"
        f"- MST edges: **{int(mst.nnz)}**\n\n"
        "Method: Euclidean cell graph -> minimum spanning tree "
        "(scipy.sparse.csgraph) -> shortest-path distance along the tree from the "
        "root, min-max normalized to [0,1]."
    )
    return {
        "status": "success",
        "analysis": "minimum-spanning-tree pseudotime",
        "nCells": n,
        "nGenes": int(x.shape[1]),
        "rootCell": root,
        "graph": graph_kind,
        "nNeighbors": k_used,
        "mstEdges": int(mst.nnz),
        "pseudotime": [float(v) for v in pseudotime],
        "researchLog": research_log,
    }


TASKS = {
    "diffusion_pseudotime": diffusion_pseudotime,
    "mst_pseudotime": mst_pseudotime,
}


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
        _fail(f"trajectory requires numpy/scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
