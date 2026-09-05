#!/usr/bin/env python3
"""Ground-truth smoke tests for server/multiomics_integration.py.

BINDING: assertions verify correct numeric ground truth (recovery of known
structure), not merely that the process runs.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, os.pardir, "server", "multiomics_integration.py")

try:
    import numpy as np
    from sklearn.metrics import adjusted_rand_score
except Exception as e:  # pragma: no cover
    print(f"SKIP: numpy/scikit-learn not installed ({e})")
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


# --------------------------------------------------------------------------- #
# Task 1 — SNF: two views, 30 samples, 2 TRUE clusters (0-14 vs 15-29).
# View1 separates on features 0-4; View2 separates on DIFFERENT features (5-9).
# Ground truth: perfect recovery of the 2 groups (adjusted Rand index == 1.0).
# --------------------------------------------------------------------------- #
rng = np.random.default_rng(0)
n = 30
n_feat = 10
true_labels = np.array([0] * 15 + [1] * 15)

# View 1: discriminative features 0-4 (means far apart), features 5-9 pure noise.
view1 = rng.normal(0.0, 1.0, size=(n, n_feat))
view1[:15, 0:5] = rng.normal(0.0, 0.3, size=(15, 5))
view1[15:, 0:5] = rng.normal(5.0, 0.3, size=(15, 5))

# View 2: discriminative features 5-9 (DIFFERENT features), features 0-4 noise.
view2 = rng.normal(0.0, 1.0, size=(n, n_feat))
view2[:15, 5:10] = rng.normal(0.0, 0.3, size=(15, 5))
view2[15:, 5:10] = rng.normal(5.0, 0.3, size=(15, 5))

r = run({"task": "snf", "views": [view1.tolist(), view2.tolist()], "nClusters": 2})
check("snf status success", r["status"] == "success")
check("snf nSamples == 30", r["nSamples"] == 30)
check("snf nViews == 2", r["nViews"] == 2)

labels = np.array(r["clusterLabels"])
check("snf returns 30 labels", labels.shape[0] == 30)
check("snf found exactly 2 clusters", len(set(labels.tolist())) == 2)

ari = adjusted_rand_score(true_labels, labels)
check("snf adjusted Rand index == 1.0 (perfect recovery)", abs(ari - 1.0) < 1e-9)

# fused similarity is a symmetric 30x30 matrix
fused = np.array(r["fusedSimilarity"])
check("snf fused similarity 30x30", fused.shape == (30, 30))
check("snf fused similarity symmetric", np.allclose(fused, fused.T, atol=1e-6))

# --------------------------------------------------------------------------- #
# Task 2 — CCA: shared latent z drives X[:,0] and Y[:,0]=2z; rest is noise.
# Ground truth: first canonical correlation > 0.95.
# --------------------------------------------------------------------------- #
rng2 = np.random.default_rng(0)
nc = 50
z = rng2.standard_normal((nc, 1))
X = np.hstack([z + 0.01 * rng2.standard_normal((nc, 1)), rng2.standard_normal((nc, 3))])
Y = np.hstack([2 * z + 0.01 * rng2.standard_normal((nc, 1)), rng2.standard_normal((nc, 3))])

r = run({"task": "cca", "X": X.tolist(), "Y": Y.tolist(), "nComponents": 2})
check("cca status success", r["status"] == "success")
cors = r["canonicalCorrelations"]
check("cca returns per-component correlations", len(cors) == 2)
check("cca first canonical correlation > 0.95", cors[0] > 0.95)
check("cca correlations in [-1, 1]", all(-1.0 - 1e-9 <= c <= 1.0 + 1e-9 for c in cors))

# --------------------------------------------------------------------------- #
# Task 3 — joint NMF: non-negative views sharing a rank-3 latent W.
# Ground truth: reconstruction correlation (X vs WH) > 0.9; error finite.
# --------------------------------------------------------------------------- #
rng3 = np.random.default_rng(0)
nn = 40
k = 3
W_true = rng3.random((nn, k))
H1 = rng3.random((k, 6))
H2 = rng3.random((k, 8))
jv1 = W_true @ H1 + 0.01 * rng3.random((nn, 6))
jv2 = W_true @ H2 + 0.01 * rng3.random((nn, 8))
assert jv1.min() >= 0 and jv2.min() >= 0  # constructed non-negative

r = run({"task": "joint_nmf", "views": [jv1.tolist(), jv2.tolist()], "nComponents": 3})
check("joint_nmf status success", r["status"] == "success")
check("joint_nmf reconstruction error finite", np.isfinite(r["reconstructionError"]))
check("joint_nmf reconstruction correlation > 0.9", r["reconstructionCorrelation"] > 0.9)
check(
    "joint_nmf factor matrix W is samples x k",
    np.array(r["factorMatrixW"]).shape == (nn, k),
)
check(
    "joint_nmf factor matrix W non-negative",
    np.all(np.array(r["factorMatrixW"]) >= -1e-9),
)
check("joint_nmf variance explained finite", np.isfinite(r["varianceExplained"]))

# negative input -> shifted and noted, still succeeds
rneg = run({"task": "joint_nmf", "views": [[[1.0, -2.0], [0.5, 3.0]]], "nComponents": 1})
check("joint_nmf negatives handled (shifted)", rneg["status"] == "success" and rneg["shifted"])

# --------------------------------------------------------------------------- #
# Unknown task -> status "error"
# --------------------------------------------------------------------------- #
r = run({"task": "does_not_exist"})
check("unknown task -> error", r["status"] == "error")

print(f"ALL {passed} MULTIOMICS TESTS PASSED")
