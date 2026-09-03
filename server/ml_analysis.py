#!/usr/bin/env python3
"""Machine-learning analyses (scikit-learn) — one dispatch, several real methods.

Tasks (payload.task):
  kmeans          : k-means clustering (+ silhouette score).
  hierarchical    : agglomerative clustering (+ silhouette).
  tsne            : t-SNE 2-D embedding.
  rf_importance   : Random-Forest feature importances (classification/regression).
  lasso_select    : LASSO (L1) feature selection via cross-validated LassoCV.
  logistic        : cross-validated logistic-regression classifier (accuracy, AUC).

Every value is computed by scikit-learn. Reads JSON on stdin; honest 'unavailable'
if scikit-learn is missing.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _matrix(p, key="X"):
    import numpy as np
    X = p.get(key) or p.get("matrix")
    if not isinstance(X, list):
        _fail(f"Provide `{key}` (2-D matrix).")
    M = np.asarray(X, float)
    if M.ndim != 2:
        _fail(f"`{key}` must be 2-D.")
    return M


def task_kmeans(p):
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score
    X = _matrix(p)
    k = int(p.get("k", 3))
    if k < 2 or k > X.shape[0]:
        _fail("k must be in [2, nSamples].")
    km = KMeans(n_clusters=k, n_init=10, random_state=0).fit(X)
    sil = float(silhouette_score(X, km.labels_)) if X.shape[0] > k else None
    return {"status": "success", "analysis": "k-means clustering", "k": k,
            "labels": [int(x) for x in km.labels_], "inertia": round(float(km.inertia_), 6),
            "silhouette": round(sil, 4) if sil is not None else None,
            "centers": [[round(float(v), 6) for v in c] for c in km.cluster_centers_]}


def task_hierarchical(p):
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.metrics import silhouette_score
    X = _matrix(p)
    k = int(p.get("k", 3))
    linkage = p.get("linkage", "ward")
    ac = AgglomerativeClustering(n_clusters=k, linkage=linkage).fit(X)
    sil = float(silhouette_score(X, ac.labels_)) if X.shape[0] > k else None
    return {"status": "success", "analysis": "agglomerative (hierarchical) clustering", "k": k,
            "linkage": linkage, "labels": [int(x) for x in ac.labels_],
            "silhouette": round(sil, 4) if sil is not None else None}


def task_tsne(p):
    from sklearn.manifold import TSNE
    X = _matrix(p)
    perp = float(p.get("perplexity", min(30.0, max(2.0, (X.shape[0] - 1) / 3.0))))
    emb = TSNE(n_components=2, perplexity=perp, random_state=0, init="pca").fit_transform(X)
    return {"status": "success", "analysis": "t-SNE (2-D)", "perplexity": perp,
            "embedding": [[round(float(v), 6) for v in row] for row in emb]}


def task_rf_importance(p):
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    X = _matrix(p)
    y = p.get("y")
    if y is None:
        _fail("rf_importance needs target `y`.")
    y = np.asarray(y)
    names = p.get("featureNames") or [f"f{i}" for i in range(X.shape[1])]
    classification = bool(p.get("classification", True))
    model = (RandomForestClassifier if classification else RandomForestRegressor)(n_estimators=300, random_state=0)
    model.fit(X, y)
    imp = model.feature_importances_
    ranked = sorted(zip(names, imp), key=lambda kv: -kv[1])
    return {"status": "success", "analysis": "Random-Forest feature importance",
            "mode": "classification" if classification else "regression",
            "importances": [{"feature": n, "importance": round(float(v), 6)} for n, v in ranked]}


def task_lasso_select(p):
    import numpy as np
    from sklearn.linear_model import LassoCV
    X = _matrix(p)
    y = p.get("y")
    if y is None:
        _fail("lasso_select needs target `y`.")
    y = np.asarray(y, float)
    names = p.get("featureNames") or [f"f{i}" for i in range(X.shape[1])]
    model = LassoCV(cv=min(5, X.shape[0]), random_state=0).fit(X, y)
    coefs = model.coef_
    selected = [{"feature": names[i], "coef": round(float(coefs[i]), 6)} for i in range(len(coefs)) if abs(coefs[i]) > 1e-8]
    selected.sort(key=lambda d: -abs(d["coef"]))
    return {"status": "success", "analysis": "LASSO (L1) feature selection",
            "alpha": round(float(model.alpha_), 6), "nSelected": len(selected),
            "selectedFeatures": selected}


def task_logistic(p):
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score, roc_auc_score
    from sklearn.model_selection import cross_val_predict
    X = _matrix(p)
    y = p.get("y")
    if y is None:
        _fail("logistic needs binary target `y`.")
    y = np.asarray(y)
    cv = min(5, int(np.bincount(y.astype(int)).min())) if set(np.unique(y)) <= {0, 1} else 3
    cv = max(2, cv)
    model = LogisticRegression(max_iter=1000)
    pred = cross_val_predict(model, X, y, cv=cv)
    proba = cross_val_predict(model, X, y, cv=cv, method="predict_proba")[:, 1]
    acc = float(accuracy_score(y, pred))
    try:
        auc = float(roc_auc_score(y, proba))
    except Exception:
        auc = None
    return {"status": "success", "analysis": "cross-validated logistic regression",
            "cvFolds": cv, "accuracy": round(acc, 4), "auc": round(auc, 4) if auc is not None else None}


TASKS = {"kmeans": task_kmeans, "hierarchical": task_hierarchical, "tsne": task_tsne,
         "rf_importance": task_rf_importance, "lasso_select": task_lasso_select, "logistic": task_logistic}


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
        import sklearn  # noqa: F401
    except Exception as e:
        _fail(f"ml_analysis requires scikit-learn: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
