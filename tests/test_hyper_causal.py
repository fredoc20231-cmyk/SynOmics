#!/usr/bin/env python3
"""End-to-end tests for iDiscover Frontier 4 — Hyper-NOTEARS hypergraph causal discovery.

Test 1 (ground truth): synthetic data where X and Y JOINTLY cause Z (Z = X*Y), but
neither X nor Y alone linearly predicts Z. Assert the engine discovers the
higher-order hyperedge [X, Y] -> Z (which pairwise methods cannot represent) and
certifies the induced graph acyclic.

Test 2 (acyclicity enforcement): feed a proposed adjacency containing a causal loop
(A -> B -> C -> A). Assert the engine returns the strict "Acyclicity constraint
violated" error via the exact tr(exp(W∘W))-d gate and does NOT hallucinate a DAG.

Test 3 (sanity): an acyclic adjacency verifies as a certified DAG.

Requires numpy + scipy. Runnable directly (`python tests/test_hyper_causal.py`) or
under pytest (the `test_*` functions below).
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "hyper_causal.py")

try:
    import numpy as np
except Exception as e:  # pragma: no cover
    print(f"SKIP: numpy not available ({e}).")
    sys.exit(0)

try:
    import scipy  # noqa: F401
except Exception as e:  # pragma: no cover
    print(f"SKIP: scipy not available ({e}).")
    sys.exit(0)


def run(payload):
    p = subprocess.run([sys.executable, SCRIPT], input=json.dumps(payload).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(p.stdout.decode())


def _ground_truth_result():
    rng = np.random.default_rng(0)
    n = 800
    x = rng.normal(0, 1, n)
    y = rng.normal(0, 1, n)
    z = 1.5 * (x * y) + 0.1 * rng.normal(0, 1, n)  # joint (interaction) cause
    data = np.column_stack([x, y, z]).tolist()
    return run({"data": data, "variables": ["X", "Y", "Z"], "epsilon": 1e-5})


def _cyclic_verify_result():
    # Proposed regulatory network with a loop A -> B -> C -> A.
    W = [[0.0, 0.8, 0.0],
         [0.0, 0.0, 0.8],
         [0.8, 0.0, 0.0]]
    return run({"adjacency": W, "variables": ["A", "B", "C"], "epsilon": 1e-5})


def _acyclic_verify_result():
    # Feed-forward network A -> B -> C, A -> C (strictly acyclic).
    W = [[0.0, 0.7, 0.5],
         [0.0, 0.0, 0.6],
         [0.0, 0.0, 0.0]]
    return run({"adjacency": W, "variables": ["A", "B", "C"], "epsilon": 1e-5})


def test_ground_truth_joint_cause():
    res = _ground_truth_result()
    assert res.get("status") == "success", res
    edges = {(tuple(sorted(h["tail"])), h["head"]) for h in res["hyperedges"]}
    assert (("X", "Y"), "Z") in edges, f"joint cause [X,Y]->Z not discovered: {res['hyperedges']}"
    # No spurious singleton X->Z or Y->Z should dominate the joint edge.
    assert (("X",), "Z") not in edges and (("Y",), "Z") not in edges, res["hyperedges"]
    # Induced graph is a certified DAG.
    assert res["acyclicityResidual"] <= res["epsilon"], res


def test_acyclicity_enforcement_rejects_loop():
    res = _cyclic_verify_result()
    assert res.get("status") == "error", res
    assert "Acyclicity constraint violated" in res.get("error", ""), res
    assert res["acyclicityResidual"] > res["epsilon"], res


def test_acyclic_adjacency_verifies():
    res = _acyclic_verify_result()
    assert res.get("status") == "success" and res.get("acyclic") is True, res
    assert res["acyclicityResidual"] <= res["epsilon"], res


def _main():
    passed = 0

    def check(name, cond, ctx=None):
        nonlocal passed
        if not cond:
            print(f"FAIL: {name}\n  {ctx}")
            sys.exit(1)
        passed += 1
        print(f"ok: {name}")

    gt = _ground_truth_result()
    check("ground-truth discover status success", gt.get("status") == "success", gt)
    edges = {(tuple(sorted(h["tail"])), h["head"]) for h in gt["hyperedges"]}
    check("discovers higher-order [X,Y] -> Z", (("X", "Y"), "Z") in edges, gt["hyperedges"])
    check("no spurious singleton X->Z / Y->Z", (("X",), "Z") not in edges and (("Y",), "Z") not in edges, gt["hyperedges"])
    check("induced graph certified acyclic", gt["acyclicityResidual"] <= gt["epsilon"], gt)
    strengths = [h["strength"] for h in gt["hyperedges"] if tuple(sorted(h["tail"])) == ("X", "Y") and h["head"] == "Z"]
    check("joint-cause strength is substantial", strengths and abs(strengths[0]) > 0.5, gt["hyperedges"])
    print(f"  -> discovered: {gt['hyperedges']}  (h={gt['acyclicityResidual']})")

    cyc = _cyclic_verify_result()
    check("cyclic adjacency -> strict error", cyc.get("status") == "error", cyc)
    check("strict acyclicity-violated message", "Acyclicity constraint violated" in cyc.get("error", ""), cyc)
    check("cyclic h exceeds epsilon", cyc["acyclicityResidual"] > cyc["epsilon"], cyc)
    print(f"  -> loop rejected: h={cyc['acyclicityResidual']} > eps={cyc['epsilon']}")

    acy = _acyclic_verify_result()
    check("acyclic adjacency verifies as DAG", acy.get("status") == "success" and acy.get("acyclic") is True, acy)
    check("acyclic h within epsilon", acy["acyclicityResidual"] <= acy["epsilon"], acy)

    # malformed input -> honest error
    bad = run({"adjacency": [[0, 1, 0], [0, 0, 1]]})
    check("non-square adjacency -> honest error", bad.get("status") == "error", bad)

    print(f"\nALL {passed} HYPER-NOTEARS TESTS PASSED")


if __name__ == "__main__":
    _main()
