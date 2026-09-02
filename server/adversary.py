#!/usr/bin/env python3
"""Enhanced adversary (Agent beta) — ML overfit + confounder falsification.

Complements the engine's permutation-null adversary with two additional,
data-grounded attacks the doctrine requires:

  1) Label-shuffle overfit check: fit a classifier to predict the group from the
     expression matrix and score it with sklearn.permutation_test_score. If the
     classifier cannot beat chance (permutation p > 0.05) the apparent group
     difference is overfit / noise -> AUTO-VETO.
  2) Hidden covariate / batch check: PCA the data and test whether top principal
     components track a supplied covariate (batch). A strong PC-covariate
     association flags a confounder.

Reads JSON on stdin, prints JSON. Honest 'unavailable' if scikit-learn absent.

Payload: {"counts": {gene:[per-sample]}, "conditions": [...],
          "covariates": {"batch":[...]}?, "nPermutations": 1000, "seed": 1337}
"""
import json
import sys
import warnings

warnings.filterwarnings("ignore")


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
        from sklearn.linear_model import LogisticRegression
        from sklearn.model_selection import permutation_test_score, StratifiedKFold
        from sklearn.decomposition import PCA
        from sklearn.preprocessing import StandardScaler
    except Exception as e:
        _fail(f"Enhanced adversary requires numpy + scikit-learn: {e}")

    counts = payload.get("counts") or payload.get("geneCounts") or {}
    conditions = payload.get("conditions", [])
    if not counts or not conditions:
        _fail("Provide `counts` (gene -> per-sample) and `conditions`.", status="error")

    genes = list(counts.keys())
    n_samples = len(conditions)
    try:
        # X: samples x genes, variance-stabilised.
        X = np.array([[np.log2(counts[g][i] + 1.0) for g in genes] for i in range(n_samples)], dtype=float)
    except Exception as e:
        _fail(f"Malformed counts vs conditions: {e}", status="error")

    y = np.array([str(c).strip().lower() for c in conditions])
    classes, y_idx = np.unique(y, return_inverse=True)
    if len(classes) < 2:
        _fail("Need at least two condition groups.", status="error")

    seed = int(payload.get("seed", 1337))
    n_perm = int(payload.get("nPermutations", 1000))
    Xs = StandardScaler().fit_transform(X)

    # --- Attack 1: classifier overfit / label-shuffle test ---
    min_class = int(np.min(np.bincount(y_idx)))
    n_splits = max(2, min(5, min_class))
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    clf = LogisticRegression(max_iter=2000)
    score, perm_scores, pvalue = permutation_test_score(
        clf, Xs, y_idx, scoring="accuracy", cv=cv, n_permutations=n_perm, random_state=seed, n_jobs=1)
    chance = 1.0 / len(classes)
    overfit_verdict = "VALIDATED" if pvalue <= 0.05 else "INVALIDATED"

    # --- Attack 2: hidden covariate / batch confounder check via PCA ---
    confounders = []
    covariates = payload.get("covariates") or {}
    if covariates:
        n_comp = min(5, Xs.shape[0] - 1, Xs.shape[1])
        pcs = PCA(n_components=n_comp, random_state=seed).fit_transform(Xs)
        for cov_name, cov_vals in covariates.items():
            cov = np.array(cov_vals)
            # numeric covariate -> pearson; categorical -> one-hot max |corr|
            try:
                cov_num = cov.astype(float)
                numeric = True
            except ValueError:
                numeric = False
            max_assoc = 0.0
            for k in range(pcs.shape[1]):
                pc = pcs[:, k]
                if numeric:
                    r = abs(np.corrcoef(pc, cov_num)[0, 1])
                else:
                    labs = np.unique(cov)
                    r = max(abs(np.corrcoef(pc, (cov == lb).astype(float))[0, 1]) for lb in labs)
                max_assoc = max(max_assoc, 0.0 if np.isnan(r) else r)
            confounders.append({
                "covariate": cov_name,
                "maxPCassociation": round(float(max_assoc), 3),
                "isConfounder": bool(max_assoc >= 0.7),
            })

    has_confounder = any(c["isConfounder"] for c in confounders)

    # --- Arbiter over the ML attacks ---
    if overfit_verdict == "INVALIDATED":
        verdict = "INVALIDATED"
        reason = f"A classifier cannot separate the groups above chance (permutation p={pvalue:.4g}); the signal is overfit / noise."
    elif has_confounder:
        verdict = "INCONCLUSIVE"
        reason = "Group signal is real but a principal component strongly tracks a supplied covariate (possible batch confounder)."
    else:
        verdict = "VALIDATED"
        reason = f"Groups are separable by a cross-validated classifier beyond chance (permutation p={pvalue:.4g})."

    print(json.dumps({
        "status": "success",
        "verdict": verdict,
        "veto": verdict == "INVALIDATED",
        "reason": reason,
        "overfitCheck": {
            "method": "sklearn.permutation_test_score (LogisticRegression, StratifiedKFold)",
            "cvAccuracy": round(float(score), 4),
            "chanceLevel": round(chance, 4),
            "permutationP": round(float(pvalue), 6),
            "nPermutations": n_perm,
            "verdict": overfit_verdict,
        },
        "confounderCheck": {
            "method": "PCA vs covariate association",
            "covariates": confounders,
            "confounderDetected": has_confounder,
        },
        "seed": seed,
    }))


if __name__ == "__main__":
    main()
