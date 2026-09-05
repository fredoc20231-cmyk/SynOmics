#!/usr/bin/env python3
"""Ground-truth smoke tests for server/trajectory.py (numpy/scipy).

Both pseudotime estimators are validated against a KNOWN 1-D linear trajectory:
60 cells whose expression is a smooth monotonic function of a hidden time
parameter tau in [0,1]. A correct pseudotime must recover that true ordering, so
we assert |Spearman(returned pseudotime, true tau)| > 0.95. Every asserted number
is the real output of executing the engine on real data.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, os.pardir, "server", "trajectory.py")

try:
    import numpy as np
    from scipy.stats import spearmanr
except Exception as e:  # pragma: no cover
    print(f"SKIP: numpy/scipy not installed ({e})")
    sys.exit(0)


def run(payload):
    proc = subprocess.run(
        [sys.executable, ENGINE],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, f"nonzero exit: {proc.stderr}"
    return json.loads(proc.stdout)


passed = 0


def check(name, cond):
    global passed
    assert cond, f"FAILED: {name}"
    passed += 1
    print(f"  ok: {name}")


# ---------------------------------------------------------------------------
# Construct a clear 1-D linear trajectory: gene_j = tau * coef_j + small noise.
# Cells are SHUFFLED so the engine cannot exploit row order; the root is the
# cell with the smallest tau (one end of the trajectory).
# ---------------------------------------------------------------------------
rng = np.random.default_rng(0)
n_cells = 60
n_genes = 5
tau = np.linspace(0.0, 1.0, n_cells)          # hidden true time
coef = np.array([1.0, 2.0, 3.0, 4.0, 5.0])    # per-gene loadings
noise = rng.normal(0.0, 0.02, size=(n_cells, n_genes))
expr_ordered = tau[:, None] * coef[None, :] + noise

# Shuffle the cells.
perm = rng.permutation(n_cells)
expr = expr_ordered[perm]
tau_shuffled = tau[perm]
root_cell = int(np.argmin(tau_shuffled))       # cell with smallest tau

# ---------------------------------------------------------------- diffusion
r = run({"task": "diffusion_pseudotime", "expression": expr.tolist(),
         "rootCell": root_cell})
check("diffusion status success", r["status"] == "success")
check("diffusion pseudotime length", len(r["pseudotime"]) == n_cells)
pt_diff = np.asarray(r["pseudotime"], dtype=float)
check("diffusion pseudotime in [0,1]", pt_diff.min() >= 0.0 and pt_diff.max() <= 1.0)
rho_diff, _ = spearmanr(pt_diff, tau_shuffled)
check(f"diffusion recovers true order |rho|={abs(rho_diff):.4f} > 0.95",
      abs(rho_diff) > 0.95)

# ---------------------------------------------------------------- MST
r = run({"task": "mst_pseudotime", "expression": expr.tolist(),
         "rootCell": root_cell})
check("mst status success", r["status"] == "success")
check("mst pseudotime length", len(r["pseudotime"]) == n_cells)
pt_mst = np.asarray(r["pseudotime"], dtype=float)
check("mst pseudotime in [0,1]", pt_mst.min() >= 0.0 and pt_mst.max() <= 1.0)
check("mst root pseudotime == 0.0", pt_mst[root_cell] == 0.0)
rho_mst, _ = spearmanr(pt_mst, tau_shuffled)
check(f"mst recovers true order |rho|={abs(rho_mst):.4f} > 0.95",
      abs(rho_mst) > 0.95)

# ---------------------------------------------------------------- Unknown task
r = run({"task": "does_not_exist"})
check("unknown task -> error", r["status"] == "error")

print(f"ALL {passed} TRAJECTORY TESTS PASSED")
