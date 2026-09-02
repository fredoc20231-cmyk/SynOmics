#!/usr/bin/env python3
"""Adversarial Swarm — APEX Part 3 (evolutionary falsification).

Instead of trusting a single test, run an ensemble of independent statistical
models of the two-group hypothesis (Welch t-test, Mann-Whitney U, and an exact
permutation test on the mean difference). Each per-gene hypothesis must survive
EVERY model at a strict FDR < 0.01. Each surviving gene is tagged with its exact
Swarm Survival Rate (fraction of models it passed).

Reads JSON on stdin, prints JSON. Honest 'unavailable' if scipy is missing.

Payload: {"counts": {gene:[per-sample]}, "conditions": [...],
          "fdr": 0.01, "nResamples": 1000, "seed": 1337}
"""
import json
import sys
import warnings

warnings.filterwarnings("ignore")


def _fail(msg, status="unavailable"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _bh(pvals):
    n = len(pvals)
    order = sorted(range(n), key=lambda i: pvals[i])
    q = [0.0] * n
    cummin = 1.0
    for rank in range(n - 1, -1, -1):
        i = order[rank]
        val = pvals[i] * n / (rank + 1)
        cummin = min(cummin, val)
        q[i] = min(1.0, cummin)
    return q


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}", status="error")

    try:
        from math import comb

        import numpy as np
        from scipy import stats as sp
    except Exception as e:
        _fail(f"Adversarial swarm requires numpy + scipy: {e}")

    counts = payload.get("counts") or payload.get("geneCounts") or {}
    conditions = payload.get("conditions", [])
    if not counts or not conditions:
        _fail("Provide `counts` (gene -> per-sample) and `conditions`.", status="error")
    fdr = float(payload.get("fdr", 0.01))
    n_resamples = int(payload.get("nResamples", 1000))
    seed = int(payload.get("seed", 1337))

    labels = np.array([str(c).strip().lower() for c in conditions])
    groups = list(dict.fromkeys(labels))
    if len(groups) != 2:
        _fail("Swarm falsification requires exactly two condition groups.", status="error")
    a_idx = np.where(labels == groups[0])[0]
    b_idx = np.where(labels == groups[1])[0]
    if len(a_idx) < 2 or len(b_idx) < 2:
        _fail("Each group needs >= 2 samples.", status="error")

    genes = list(counts.keys())
    mats = {g: np.log2(np.array(counts[g], dtype=float) + 1.0) for g in genes}

    # Use an EXACT permutation test when the sample space is small enough, so the
    # permutation p-value floor (1/n_permutations) is low enough to survive strict
    # FDR correction; otherwise fall back to the requested Monte-Carlo resamples.
    n_possible = comb(len(a_idx) + len(b_idx), len(a_idx))
    exact = n_possible <= 100000
    eff_resamples = n_possible if exact else n_resamples

    def mean_diff(x, y, axis=-1):
        return np.mean(x, axis=axis) - np.mean(y, axis=axis)

    p_welch, p_mwu, p_perm = [], [], []
    for g in genes:
        a = mats[g][a_idx]
        b = mats[g][b_idx]
        # Model 1: Welch t-test
        try:
            p_welch.append(float(sp.ttest_ind(a, b, equal_var=False).pvalue))
        except Exception:
            p_welch.append(1.0)
        # Model 2: Mann-Whitney U (rank-based, non-parametric)
        try:
            p_mwu.append(float(sp.mannwhitneyu(a, b, alternative="two-sided").pvalue))
        except Exception:
            p_mwu.append(1.0)
        # Model 3: exact permutation test on the mean difference
        try:
            res = sp.permutation_test((a, b), mean_diff, n_resamples=eff_resamples,
                                      alternative="two-sided", random_state=seed)
            p_perm.append(float(res.pvalue))
        except Exception:
            p_perm.append(1.0)

    models = {"welch_t": p_welch, "mann_whitney": p_mwu, "permutation": p_perm}
    q_by_model = {name: _bh(ps) for name, ps in models.items()}

    survivors = []
    for i, g in enumerate(genes):
        passes = {name: (q_by_model[name][i] < fdr) for name in models}
        n_pass = sum(passes.values())
        rate = round(n_pass / len(models), 4)
        if n_pass == len(models):  # survived EVERY model
            survivors.append({
                "gene": g,
                "swarmSurvivalRate": rate,
                "perModelFDR": {name: round(q_by_model[name][i], 6) for name in models},
            })
    survivors.sort(key=lambda s: max(s["perModelFDR"].values()))

    print(json.dumps({
        "status": "success",
        "method": "adversarial swarm: Welch t + Mann-Whitney U + permutation test, each gated at FDR",
        "models": list(models.keys()),
        "fdrThreshold": fdr,
        "permutation": {"exact": exact, "nPermutations": eff_resamples},
        "genesTested": len(genes),
        "survivorCount": len(survivors),
        "survivors": survivors,
        "note": f"Only genes significant under ALL {len(models)} models at FDR<{fdr} are reported; each is tagged with its swarm survival rate.",
        "seed": seed,
    }))


if __name__ == "__main__":
    main()
