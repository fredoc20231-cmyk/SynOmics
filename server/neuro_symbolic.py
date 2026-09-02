#!/usr/bin/env python3
"""Neuro-symbolic grounding — information-theoretic edge extraction (Tier 1) and
a Z3-backed formal pathway proof (Tier 2), per the Grounded Zero-BS doctrine.

- Tier 1 uses partial correlation (sparse inverse covariance, GraphicalLassoCV) —
  NOT a neural network — to distinguish direct from indirect associations.
- Tier 2 uses the Z3 SMT solver to formally decide pathway activation and emit a
  satisfying model (proof). If Z3 returns UNSAT the pathway is not activated, and
  that cannot be overridden.

Reads JSON on stdin with a `task` field; prints JSON. Honest 'unavailable' when a
required library is missing — never fabricated output.

Tasks:
  {"task":"edge_extraction","data":[[...]],"variables":[...],"threshold":0.1}
  {"task":"z3_pathway","foldChanges":{...},"threshold":1.0,"pathways":[{id,name,rule}]}
"""
import json
import sys
import warnings

warnings.filterwarnings("ignore")  # keep stdout pure JSON; convergence notes -> ignored


def _fail(msg, status="unavailable"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def edge_extraction(payload):
    try:
        import numpy as np
        from sklearn.covariance import GraphicalLassoCV
    except Exception as e:
        _fail(f"Edge extraction requires numpy + scikit-learn: {e}")

    if not isinstance(payload.get("data"), list):
        _fail("Provide `data` as rows x variables.", status="error")
    X = np.array(payload["data"], dtype=float)
    if X.ndim != 2 or X.shape[0] < X.shape[1] + 2 or X.shape[1] < 2:
        _fail("Need a 2-D matrix with more samples than variables (>= vars+2) and >=2 variables.", status="error")
    variables = payload.get("variables") or [f"x{i}" for i in range(X.shape[1])]
    threshold = float(payload.get("threshold", 0.1))

    Xs = (X - X.mean(0)) / (X.std(0) + 1e-12)
    try:
        model = GraphicalLassoCV().fit(Xs)
        prec = model.precision_
    except Exception as e:
        _fail(f"GraphicalLassoCV failed to converge: {e}", status="error")

    d = prec.shape[0]
    pcorr = np.zeros((d, d))
    for i in range(d):
        for j in range(d):
            if i == j:
                pcorr[i, j] = 1.0
            else:
                denom = (prec[i, i] * prec[j, j]) ** 0.5
                pcorr[i, j] = -prec[i, j] / denom if denom > 0 else 0.0

    edges = []
    for i in range(d):
        for j in range(i + 1, d):
            if abs(pcorr[i, j]) >= threshold:
                edges.append({"a": variables[i], "b": variables[j], "partialCorr": round(float(pcorr[i, j]), 4)})
    edges.sort(key=lambda e: -abs(e["partialCorr"]))

    print(json.dumps({
        "status": "success",
        "method": "partial correlation via sparse inverse covariance (GraphicalLassoCV)",
        "variables": variables,
        "partialCorrelationMatrix": [[round(float(v), 4) for v in row] for row in pcorr],
        "edges": edges,
        "threshold": threshold,
        "note": "Partial correlation controls for all other variables, separating direct from indirect associations.",
    }))


def _to_z3(rule, bvars, z3):
    if not isinstance(rule, dict):
        return z3.BoolVal(False)
    if "const" in rule:
        return z3.BoolVal(bool(rule["const"]))
    if "gene" in rule:
        key = (rule["gene"], str(rule.get("state", "up")).lower())
        if key not in bvars:
            bvars[key] = z3.Bool(f"{rule['gene']}_is_{key[1]}")
        return bvars[key]
    op = str(rule.get("op", "")).upper()
    if op == "NOT":
        return z3.Not(_to_z3(rule.get("arg", {}), bvars, z3))
    if op == "AND":
        return z3.And(*[_to_z3(a, bvars, z3) for a in rule.get("args", [])])
    if op == "OR":
        return z3.Or(*[_to_z3(a, bvars, z3) for a in rule.get("args", [])])
    return z3.BoolVal(False)


def z3_pathway(payload):
    try:
        import z3
    except Exception as e:
        _fail(f"Formal pathway proof requires z3-solver: {e}")

    threshold = float(payload.get("threshold", 1.0))
    if isinstance(payload.get("geneStates"), dict):
        states = {g: str(s).lower() for g, s in payload["geneStates"].items()}
    else:
        states = {}
        for g, fc in (payload.get("foldChanges") or {}).items():
            try:
                v = float(fc)
            except (TypeError, ValueError):
                continue
            states[g] = "up" if v >= threshold else ("down" if v <= -threshold else "neutral")

    pathways = payload.get("pathways") or []
    if not pathways:
        _fail("No pathway rules provided.", status="error")

    results = []
    for pw in pathways:
        rule = pw.get("rule")
        bvars = {}
        expr = _to_z3(rule, bvars, z3) if rule is not None else z3.BoolVal(False)
        solver = z3.Solver()
        # Pin every referenced literal to the observed data state (facts).
        for (gene, want), var in bvars.items():
            observed = states.get(gene, "missing")
            solver.add(var == (observed == want))
        solver.add(expr)  # assert the pathway is active
        check = solver.check()
        activated = (str(check) == "sat")
        model = solver.model() if activated else None
        model_str = None
        if model is not None:
            model_str = {str(d): str(model[d]) for d in model.decls()}
        results.append({
            "id": pw.get("id"),
            "name": pw.get("name"),
            "z3Result": str(check).upper(),  # SAT / UNSAT
            "status": "SATISFIABLE" if activated else "UNSATISFIABLE",
            "activated": activated,
            "model": model_str,
            "proof": f"Z3 {str(check).upper()}: pathway {'activated' if activated else 'NOT activated'} under the observed gene states.",
        })

    print(json.dumps({
        "status": "success",
        "method": "Z3 SMT formal pathway verification (Tier 2)",
        "solver": "z3",
        "threshold": threshold,
        "geneStates": states,
        "pathways": results,
        "activatedCount": sum(1 for r in results if r["activated"]),
    }))


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}", status="error")
    task = payload.get("task")
    if task == "edge_extraction":
        edge_extraction(payload)
    elif task == "z3_pathway":
        z3_pathway(payload)
    else:
        _fail("Unknown task. Use 'edge_extraction' or 'z3_pathway'.", status="error")


if __name__ == "__main__":
    main()
