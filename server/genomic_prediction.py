#!/usr/bin/env python3
"""Genomic prediction — one dispatch, real ridge/GBLUP breeding-value estimation.

Tasks (payload.task):
  gblup   Genomic Best Linear Unbiased Prediction of breeding values.

Method (documented, zero hallucination — every number is computed by scikit-learn
/ numpy on the real inputs, nothing is fabricated):

  We fit a marker-effects ridge regression, which is mathematically equivalent to
  GBLUP: y = mu + Z*u + e where marker effects u are shrunk by an L2 (ridge)
  penalty. Genotypes are mean-centered per marker (column) so the intercept
  captures the population mean; ``sklearn.linear_model.Ridge`` then estimates the
  marker effects. The predicted breeding value of an individual is the sum of its
  centered marker dosages weighted by the estimated effects (Ridge.predict on the
  centered genotypes). This ridge-on-markers formulation gives predictions
  identical to GBLUP via the genomic relationship matrix G = Z Z' / k, so we pick
  the marker-effects route (fewer moving parts, directly interpretable effects).

Ridge penalty (``lambdaReg``):
  If the caller supplies ``lambdaReg`` it is used directly as the Ridge alpha.
  Otherwise the default is alpha = number of markers (m). This is a standard,
  scale-aware GBLUP-style shrinkage: with mean-centered 0/1/2 dosages the per-
  marker variance is O(1), so alpha ~ m balances the summed marker-effect penalty
  against the residual sum of squares (equivalently a ridge lambda that assumes
  the genetic signal is spread across all m markers). Documented and logged.

Evaluation convention (``testIndices``):
  * If ``testIndices`` is provided, the model is trained on the complementary
    ("train") individuals only, breeding values are predicted for ALL
    individuals, and accuracy/rSquared are computed on the held-out test subset
    ("holdout" evaluation).
  * If ``testIndices`` is omitted, we use 5-fold cross-validation: each
    individual's predicted breeding value is its out-of-fold prediction (so no
    individual is scored by a model that saw it), and accuracy/rSquared are
    computed across all out-of-fold predictions ("cv_5fold" evaluation). This is
    honest about generalisation and, critically, returns ~0 accuracy for a pure-
    noise phenotype instead of an over-fit in-sample illusion.

  ``markerEffects`` are always reported from a model fit on ALL individuals
  (the deliverable effect estimates), independent of the evaluation split.

Reads JSON on stdin, prints JSON on stdout, single dispatch. When the payload
carries an ``outputDir`` a full Biomni-style outcome bundle (figures/tables/code/
report) is also written and its manifest returned; that path needs matplotlib and
returns an honest 'unavailable' if it is missing.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _pearson(a, b):
    """Pearson r via numpy; returns 0.0 if either vector is constant."""
    import numpy as np
    a = np.asarray(a, float)
    b = np.asarray(b, float)
    if a.std() == 0 or b.std() == 0:
        return 0.0
    return float(np.corrcoef(a, b)[0, 1])


def _r2(observed, predicted):
    """Coefficient of determination R^2 = 1 - SS_res/SS_tot (sklearn r2_score)."""
    from sklearn.metrics import r2_score
    return float(r2_score(observed, predicted))


def gblup(p):
    import numpy as np
    from sklearn.linear_model import Ridge
    from sklearn.model_selection import KFold

    G_in = p.get("genotypes")
    y_in = p.get("phenotypes")
    if not isinstance(G_in, list) or not G_in:
        _fail("Provide `genotypes` (2-D array: individuals x markers).")
    if not isinstance(y_in, list) or not y_in:
        _fail("Provide `phenotypes` (array, length = n individuals).")

    try:
        G = np.asarray(G_in, dtype=float)
    except Exception as e:
        _fail(f"`genotypes` is not a numeric 2-D array: {e}")
    if G.ndim != 2:
        _fail("`genotypes` must be a 2-D array (individuals x markers).")
    y = np.asarray(y_in, dtype=float)
    if y.ndim != 1:
        _fail("`phenotypes` must be a 1-D array.")

    n, m = G.shape
    if y.shape[0] != n:
        _fail(
            f"genotypes/phenotypes length mismatch: {n} individuals but "
            f"{y.shape[0]} phenotypes."
        )
    if n < 3:
        _fail("Need at least 3 individuals to fit and evaluate GBLUP.")

    # Ridge penalty (documented heuristic default = number of markers).
    if p.get("lambdaReg") is not None:
        try:
            alpha = float(p["lambdaReg"])
        except Exception:
            _fail("`lambdaReg` must be a number.")
        if alpha <= 0:
            _fail("`lambdaReg` must be positive.")
        lambda_source = "user"
    else:
        alpha = float(m)
        lambda_source = "default(m markers)"

    # --- Marker effects: model fit on ALL individuals (the deliverable) ---
    mu_all = G.mean(axis=0)
    Gc_all = G - mu_all
    full_model = Ridge(alpha=alpha).fit(Gc_all, y)
    marker_effects = full_model.coef_.astype(float)

    # --- Evaluation ---
    test_indices = p.get("testIndices")
    predicted = np.zeros(n, dtype=float)

    if test_indices is not None:
        if not isinstance(test_indices, list) or not test_indices:
            _fail("`testIndices` must be a non-empty list of integers.")
        try:
            test_idx = np.asarray([int(i) for i in test_indices], dtype=int)
        except Exception:
            _fail("`testIndices` must be integers.")
        if test_idx.min() < 0 or test_idx.max() >= n:
            _fail("`testIndices` out of range for the number of individuals.")
        test_idx = np.unique(test_idx)
        train_mask = np.ones(n, dtype=bool)
        train_mask[test_idx] = False
        if train_mask.sum() < 2:
            _fail("Too few training individuals after removing testIndices.")
        # Fit on train only; center by train means; predict ALL individuals.
        mu_tr = G[train_mask].mean(axis=0)
        model = Ridge(alpha=alpha).fit(G[train_mask] - mu_tr, y[train_mask])
        predicted = model.predict(G - mu_tr)
        eval_obs = y[test_idx]
        eval_pred = predicted[test_idx]
        eval_scope = "holdout"
        eval_desc = f"held-out test set of {test_idx.size} individual(s)"
    else:
        # 5-fold cross-validation out-of-fold predictions.
        n_splits = min(5, n)
        kf = KFold(n_splits=n_splits, shuffle=True, random_state=0)
        for tr, te in kf.split(Gc_all):
            mu_tr = G[tr].mean(axis=0)
            model = Ridge(alpha=alpha).fit(G[tr] - mu_tr, y[tr])
            predicted[te] = model.predict(G[te] - mu_tr)
        eval_obs = y
        eval_pred = predicted
        eval_scope = f"cv_{n_splits}fold"
        eval_desc = f"{n_splits}-fold cross-validation (out-of-fold predictions)"

    accuracy = _pearson(eval_pred, eval_obs)
    r_squared = _r2(eval_obs, eval_pred)

    research_log = "\n".join([
        "# GBLUP — genomic prediction of breeding values",
        "",
        f"- Individuals (n): **{n}**",
        f"- Markers (m): **{m}**",
        "- Model: **marker-effects ridge regression (GBLUP-equivalent)**, "
        "genotypes mean-centered per marker",
        f"- Ridge penalty (alpha/lambda): **{alpha:g}** ({lambda_source})",
        f"- Evaluation: **{eval_scope}** — {eval_desc}",
        f"- Prediction accuracy (Pearson r, predicted vs observed): **{accuracy:.4f}**",
        f"- R^2 (coefficient of determination) on evaluation set: **{r_squared:.4f}**",
        "",
        "Predicted breeding values are the centered marker dosages weighted by the "
        "ridge-estimated marker effects. Marker effects are reported from a model "
        "fit on all individuals; accuracy/R^2 are from the evaluation split above "
        "so they reflect out-of-sample generalisation, not in-sample overfit.",
    ])

    result = {
        "status": "success",
        "analysis": "GBLUP / ridge-regression genomic prediction of breeding values",
        "markerEffects": [round(float(v), 8) for v in marker_effects],
        "predictedBreedingValues": [round(float(v), 8) for v in predicted],
        "observedPhenotypes": [round(float(v), 8) for v in y],
        "accuracy": round(accuracy, 6),
        "rSquared": round(r_squared, 6),
        "nIndividuals": n,
        "nMarkers": m,
        "lambdaReg": alpha,
        "lambdaSource": lambda_source,
        "evaluation": eval_scope,
        "researchLog": research_log,
    }

    out_dir = p.get("outputDir")
    if out_dir:
        _plt = _require_plotting()

        def make_fig():
            obs = np.asarray(eval_obs, float)
            pred = np.asarray(eval_pred, float)
            fig, ax = _plt.subplots(figsize=(6, 6))
            ax.scatter(obs, pred, color="#00B4D8", s=28, alpha=0.75,
                       edgecolor="#0A192F", linewidth=0.4, label="individuals")
            lo = float(min(obs.min(), pred.min()))
            hi = float(max(obs.max(), pred.max()))
            ax.plot([lo, hi], [lo, hi], color="#0A192F", linewidth=1.2,
                    linestyle="--", label="identity (y = x)")
            # Regression line of predicted on observed.
            if obs.std() > 0:
                b1, b0 = np.polyfit(obs, pred, 1)
                xs = np.array([lo, hi])
                ax.plot(xs, b0 + b1 * xs, color="#00B4D8", linewidth=1.4,
                        label="regression fit")
            ax.set_xlabel("Observed phenotype")
            ax.set_ylabel("Predicted breeding value")
            ax.set_title(f"GBLUP predicted vs observed (r = {accuracy:.3f})")
            ax.legend(frameon=False, fontsize=8)
            _apply_palette(ax)
            return fig

        if test_indices is not None:
            table_idx = list(np.unique(np.asarray([int(i) for i in test_indices])))
        else:
            table_idx = list(range(n))
        table = [
            {
                "individual": int(i),
                "observed": round(float(y[i]), 6),
                "predicted": round(float(predicted[i]), 6),
                "residual": round(float(y[i] - predicted[i]), 6),
            }
            for i in table_idx
        ]

        code = _reproducer(G, y, alpha, test_indices)
        result["bundle"] = _build(
            out_dir,
            tool="gblup",
            title="GBLUP Genomic Prediction of Breeding Values",
            result={k: v for k, v in result.items() if k != "researchLog"},
            research_log=research_log,
            figures=[("gblup_predicted_vs_observed", make_fig())],
            tables=[("gblup_predictions", table)],
            code=code,
            methods=(
                "Genotype dosages (0/1/2) were mean-centered per marker and marker "
                "effects estimated by ridge regression (sklearn.linear_model.Ridge, "
                f"alpha={alpha:g}, {lambda_source}), which is mathematically "
                "equivalent to GBLUP via the genomic relationship matrix. Predicted "
                "breeding values are centered dosages weighted by the estimated "
                f"effects. Accuracy was evaluated by {eval_desc}: Pearson correlation "
                "and the coefficient of determination (R^2) between predicted and "
                "observed values."
            ),
            interpretation=(
                f"Prediction accuracy on the {eval_scope} evaluation was r={accuracy:.3f} "
                f"(R^2={r_squared:.3f}). Higher r indicates the marker panel carries "
                "genomic signal predictive of the phenotype; an accuracy near zero on "
                "held-out data indicates no learnable genotype-phenotype relationship "
                "(the model does not manufacture signal that is not present)."
            ),
        )
    return result


# --------------------------------------------------------------------------- #
# Bundle plumbing (deps imported lazily; honest 'unavailable' on failure)
# --------------------------------------------------------------------------- #
def _require_plotting():
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception as e:  # pragma: no cover - environment dependent
        _fail(f"gblup outcome bundle requires matplotlib: {e}", status="unavailable")
    return plt


def _apply_palette(ax):
    from outcome_bundle import apply_palette
    return apply_palette(ax)


def _build(output_dir, **kwargs):
    from outcome_bundle import build_bundle
    manifest = build_bundle(output_dir, **kwargs)
    import matplotlib.pyplot as plt
    plt.close("all")
    return manifest


def _reproducer(G, y, alpha, test_indices):
    import numpy as np
    genos = np.asarray(G, float).tolist()
    phenos = np.asarray(y, float).tolist()
    return f'''#!/usr/bin/env python3
"""Standalone reproducer for the GBLUP genomic prediction above.

Every input is embedded below; run with numpy + scikit-learn installed.
"""
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.model_selection import KFold
from sklearn.metrics import r2_score

GENOTYPES = {genos!r}
PHENOTYPES = {phenos!r}
ALPHA = {alpha!r}
TEST_INDICES = {test_indices!r}


def pearson(a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    if a.std() == 0 or b.std() == 0:
        return 0.0
    return float(np.corrcoef(a, b)[0, 1])


def main():
    G = np.asarray(GENOTYPES, float)
    y = np.asarray(PHENOTYPES, float)
    n, m = G.shape
    predicted = np.zeros(n)
    if TEST_INDICES is not None:
        test = np.unique(np.asarray([int(i) for i in TEST_INDICES], dtype=int))
        mask = np.ones(n, bool); mask[test] = False
        mu = G[mask].mean(0)
        model = Ridge(alpha=ALPHA).fit(G[mask] - mu, y[mask])
        predicted = model.predict(G - mu)
        obs, pred = y[test], predicted[test]
    else:
        kf = KFold(n_splits=min(5, n), shuffle=True, random_state=0)
        for tr, te in kf.split(G):
            mu = G[tr].mean(0)
            predicted[te] = Ridge(alpha=ALPHA).fit(G[tr] - mu, y[tr]).predict(G[te] - mu)
        obs, pred = y, predicted
    print("accuracy (Pearson r):", round(pearson(pred, obs), 4))
    print("R^2:", round(float(r2_score(obs, pred)), 4))


if __name__ == "__main__":
    main()
'''


# --------------------------------------------------------------------------- #
# Dispatch
# --------------------------------------------------------------------------- #
TASKS = {
    "gblup": gblup,
}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    try:
        import numpy  # noqa: F401
        import sklearn  # noqa: F401
    except Exception as e:
        _fail(f"gblup requires numpy + scikit-learn: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
