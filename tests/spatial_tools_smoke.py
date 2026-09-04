#!/usr/bin/env python3
"""Smoke test for server/spatial_tools.py — asserts CORRECT numeric ground truth.

SKIP-guards a missing numpy. Ground-truth expectations were derived from
independent closed-form / scratch numpy calculations (see the constructions
below) so the asserted numbers are known-correct, not merely "code runs".
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, "..", "server", "spatial_tools.py")

_passed = 0


def check(name, cond, ctx=""):
    global _passed
    if cond:
        _passed += 1
        print(f"  ok: {name}")
    else:
        print(f"FAIL: {name} :: {ctx}")
        sys.exit(1)


def run(payload):
    proc = subprocess.run(
        [sys.executable, ENGINE],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print("engine crashed:", proc.stderr)
        sys.exit(1)
    return json.loads(proc.stdout.strip())


def row_standardize(A):
    import numpy as np

    A = np.asarray(A, dtype=float)
    rs = A.sum(axis=1, keepdims=True)
    rs[rs == 0] = 1.0
    return (A / rs).tolist()


def path_weights(n):
    """Binary symmetric adjacency for a 1-D path 0-1-2-...-(n-1)."""
    import numpy as np

    W = np.zeros((n, n))
    for i in range(n - 1):
        W[i, i + 1] = 1.0
        W[i + 1, i] = 1.0
    return W.tolist()


def cycle_weights(n):
    """Binary symmetric adjacency for a cycle (each node has 2 neighbors)."""
    import numpy as np

    W = np.zeros((n, n))
    for i in range(n):
        W[i, (i + 1) % n] = 1.0
        W[i, (i - 1) % n] = 1.0
    return W.tolist()


def main():
    try:
        import numpy  # noqa: F401
    except Exception:
        print("SKIP: numpy not available")
        return

    import numpy as np

    # ------------------------------------------------------------------
    # 1. Moran's I
    #    (a) Two disconnected 3-cliques, row-standardized. Values +1 on
    #        clique A, -1 on clique B. Every node's neighbor-average equals
    #        its own value  =>  Moran's I is EXACTLY +1.
    # ------------------------------------------------------------------
    Wp = np.zeros((6, 6))
    for grp in ([0, 1, 2], [3, 4, 5]):
        for i in grp:
            for j in grp:
                if i != j:
                    Wp[i, j] = 1.0
    Wp_rs = row_standardize(Wp)
    vals_pos = [1.0, 1.0, 1.0, -1.0, -1.0, -1.0]
    r = run({"task": "morans_i", "values": vals_pos, "weights": Wp_rs})
    check("morans_i status", r.get("status") == "success", r)
    check("morans_i == +1 (two cliques)", abs(r["moransI"] - 1.0) < 1e-9, r)
    check("morans_i expectedI == -1/(n-1)", abs(r["expectedI"] - (-0.2)) < 1e-12, r)
    check("morans_i zScore positive", r.get("zScore", 0) > 0, r)

    #    (b) Alternating +1/-1 on a 6-cycle, row-standardized. Every node's
    #        neighbors are both opposite sign  =>  Moran's I is EXACTLY -1.
    Wc_rs = row_standardize(cycle_weights(6))
    vals_alt = [1.0, -1.0, 1.0, -1.0, 1.0, -1.0]
    r = run({"task": "morans_i", "values": vals_alt, "weights": Wc_rs})
    check("morans_i == -1 (checkerboard cycle)", abs(r["moransI"] - (-1.0)) < 1e-9, r)
    check("morans_i zScore negative", r.get("zScore", 0) < 0, r)

    # ------------------------------------------------------------------
    # 2. Geary's C
    #    (a) Smooth gradient 1..6 on a path, binary weights.
    #        Closed form: C = (5 * 10) / (2 * 10 * 17.5) = 1/7 ≈ 0.142857.
    # ------------------------------------------------------------------
    r = run(
        {"task": "gearys_c", "values": [1, 2, 3, 4, 5, 6], "weights": path_weights(6)}
    )
    check("gearys_c status", r.get("status") == "success", r)
    check("gearys_c gradient == 1/7", abs(r["gearysC"] - (1.0 / 7.0)) < 1e-9, r)
    check("gearys_c gradient near 0 (<0.2)", r["gearysC"] < 0.2, r)

    #    (b) Anti-correlated alternating pattern on a 6-cycle, binary weights.
    #        Closed form: C = (5 * 48) / (2 * 12 * 6) = 5/3 ≈ 1.6667 (> 1).
    r = run(
        {
            "task": "gearys_c",
            "values": [1, -1, 1, -1, 1, -1],
            "weights": cycle_weights(6),
        }
    )
    check("gearys_c anti == 5/3", abs(r["gearysC"] - (5.0 / 3.0)) < 1e-9, r)
    check("gearys_c anti > 1", r["gearysC"] > 1.0, r)

    # ------------------------------------------------------------------
    # 3. Getis-Ord General G
    #    Values [1,2,3,4] on a path, binary weights.
    #    num = 2+2+6+6+12+12 = 40 ; den = (sum)^2 - sum(sq) = 100 - 30 = 70.
    #    G = 40/70 ; expectedG = S0/(n(n-1)) = 6/12 = 0.5.
    # ------------------------------------------------------------------
    r = run(
        {
            "task": "getis_ord_general_g",
            "values": [1, 2, 3, 4],
            "weights": path_weights(4),
        }
    )
    check("general_g status", r.get("status") == "success", r)
    check("general_g == 40/70", abs(r["generalG"] - (40.0 / 70.0)) < 1e-9, r)
    check("general_g expectedG == 0.5", abs(r["expectedG"] - 0.5) < 1e-12, r)

    #    negative-value guard
    r = run(
        {
            "task": "getis_ord_general_g",
            "values": [1, -2, 3],
            "weights": path_weights(3),
        }
    )
    check("general_g rejects negatives", r.get("status") == "error", r)

    # ------------------------------------------------------------------
    # 4. Ripley's K / L: clustered vs regular with SAME point count.
    #    Clustered: 9 pts in a 0.5x0.5 corner (all pairwise dist < 2).
    #    Regular:   3x3 grid spacing 10 (nearest neighbor 10 > 2).
    #    Study area = 100, radius = 2.
    #    Clustered: all 72 ordered pairs within r => K = 100/72*72 = 100.
    #    Regular:   no pairs within r => K = 0.
    #    => L_clustered (=sqrt(100/pi)) >> L_regular (=0).
    # ------------------------------------------------------------------
    rng = np.random.default_rng(0)
    clustered = rng.uniform(0, 0.5, size=(9, 2)).tolist()
    grid = [[i * 10.0, j * 10.0] for i in range(3) for j in range(3)]
    rc = run(
        {"task": "ripleys_k", "points": clustered, "radii": [2.0], "area": 100.0}
    )
    rg = run({"task": "ripleys_k", "points": grid, "radii": [2.0], "area": 100.0})
    check("ripleys_k status", rc.get("status") == "success", rc)
    check("ripleys_k clustered K == area (100)", abs(rc["kValues"][0] - 100.0) < 1e-9, rc)
    check(
        "ripleys_k clustered L == sqrt(100/pi)",
        abs(rc["lValues"][0] - np.sqrt(100.0 / np.pi)) < 1e-9,
        rc,
    )
    check("ripleys_k regular K == 0", abs(rg["kValues"][0] - 0.0) < 1e-12, rg)
    check(
        "ripleys_k clustered L > regular L (clustering signal)",
        rc["lValues"][0] > rg["lValues"][0],
        (rc, rg),
    )

    # ------------------------------------------------------------------
    # 5. Moran permutation test.
    #    (a) Strong autocorrelation: smooth gradient 0..11 on a path
    #        (I ≈ 0.818)  => p == 0.001, significant.
    #    (b) Random pattern (fixed values, seed 42) on the same path
    #        => p == 0.407, NOT significant.
    # ------------------------------------------------------------------
    grad = list(range(12))
    r = run(
        {
            "task": "moran_permutation_test",
            "values": grad,
            "weights": path_weights(12),
            "seed": 0,
        }
    )
    check("perm status", r.get("status") == "success", r)
    check("perm strong observedI ~0.818", abs(r["observedI"] - 0.8181818181818181) < 1e-9, r)
    check("perm strong p < 0.05", r["pValue"] < 0.05, r)
    check("perm strong significant True", r["significant"] is True, r)

    rand_vals = [
        0.304717,
        -1.039984,
        0.750451,
        0.940565,
        -1.951035,
        -1.30218,
        0.12784,
        -0.316243,
        -0.016801,
        -0.853044,
        0.879398,
        0.777792,
    ]
    r = run(
        {
            "task": "moran_permutation_test",
            "values": rand_vals,
            "weights": path_weights(12),
            "seed": 0,
        }
    )
    check("perm random p >= 0.05", r["pValue"] >= 0.05, r)
    check("perm random not significant", r["significant"] is False, r)

    # ------------------------------------------------------------------
    # 6. Unknown task => status "error"
    # ------------------------------------------------------------------
    r = run({"task": "does_not_exist"})
    check("unknown task -> error", r.get("status") == "error", r)

    print(f"ALL {_passed} SPATIAL TESTS PASSED")


if __name__ == "__main__":
    main()
