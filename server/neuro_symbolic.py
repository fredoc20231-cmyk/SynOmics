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


def _states_from_layer(layer, threshold):
    """Map a layer's {gene: fold-change|state} to discrete up/down/neutral."""
    out = {}
    for g, v in (layer or {}).items():
        if isinstance(v, str):
            out[g] = v.lower()
            continue
        try:
            fv = float(v)
        except (TypeError, ValueError):
            continue
        out[g] = "up" if fv >= threshold else ("down" if fv <= -threshold else "neutral")
    return out


def z3_multiomic(payload):
    """Reconcile multi-omic layers with Z3: flag LOGICAL_CONFLICT where layers
    contradict (e.g. transcript up but protein down) and halt pathway activation
    for the affected genes instead of silently averaging over the contradiction."""
    try:
        import z3
    except Exception as e:
        _fail(f"Multi-omic reconciliation requires z3-solver: {e}")

    threshold = float(payload.get("threshold", 1.0))
    layers = payload.get("layers") or {}
    if len(layers) < 2:
        _fail("Provide at least two omics `layers` (e.g. transcriptomics, proteomics).", status="error")

    layer_states = {name: _states_from_layer(layer, threshold) for name, layer in layers.items()}
    all_genes = sorted({g for st in layer_states.values() for g in st})

    solver = z3.Solver()
    up = {}
    down = {}
    conflicts = []
    per_gene = {}
    for g in all_genes:
        present = {ln: st[g] for ln, st in layer_states.items() if g in st}
        per_gene[g] = present
        if len(present) < 2:
            continue
        # Z3 booleans per (gene) aggregate direction, pinned to each layer's fact,
        # with the consistency axiom NOT(up AND down).
        gi = g.replace(" ", "_")
        u = z3.Bool(f"{gi}_up"); d = z3.Bool(f"{gi}_down")
        up[g], down[g] = u, d
        any_up = any(s == "up" for s in present.values())
        any_down = any(s == "down" for s in present.values())
        solver.push()
        solver.add(u == any_up, d == any_down)
        solver.add(z3.Not(z3.And(u, d)))  # a gene cannot be both up and down
        if solver.check() == z3.unsat:
            conflicts.append({"gene": g, "layers": present, "type": "up_vs_down"})
        solver.pop()

    status_flag = "LOGICAL_CONFLICT" if conflicts else "CONSISTENT"
    conflict_genes = {c["gene"] for c in conflicts}

    result = {
        "status": "success",
        "consistency": status_flag,
        "method": "Z3 multi-omic consistency axiom (NOT(up AND down) per gene)",
        "layers": list(layers.keys()),
        "conflicts": conflicts,
        "genesReconciled": len(all_genes),
        "perGeneStates": per_gene,
    }

    # Pathway evaluation is HALTED for conflicted genes (doctrine: do not ignore
    # multi-omic contradictions). Consistent genes still evaluate.
    pathways = payload.get("pathways") or []
    if pathways:
        consensus = {}
        for g, present in per_gene.items():
            if g in conflict_genes:
                continue
            vals = list(present.values())
            consensus[g] = vals[0] if len(set(vals)) == 1 else ("up" if "up" in vals else ("down" if "down" in vals else "neutral"))
        pw_out = []
        for pw in pathways:
            rule = pw.get("rule")
            bvars = {}
            expr = _to_z3(rule, bvars, z3) if rule is not None else z3.BoolVal(False)
            uses_conflict = any(gene in conflict_genes for (gene, _st) in bvars)
            if uses_conflict:
                pw_out.append({"id": pw.get("id"), "name": pw.get("name"),
                               "status": "HALTED", "reason": "Pathway depends on a gene with an unresolved multi-omic conflict."})
                continue
            s2 = z3.Solver()
            for (gene, want), var in bvars.items():
                s2.add(var == (consensus.get(gene, "missing") == want))
            s2.add(expr)
            activated = (s2.check() == z3.sat)
            pw_out.append({"id": pw.get("id"), "name": pw.get("name"),
                           "status": "SATISFIABLE" if activated else "UNSATISFIABLE", "activated": activated})
        result["pathways"] = pw_out

    print(json.dumps(result))


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
    elif task == "multiomic_consistency":
        z3_multiomic(payload)
    else:
        _fail("Unknown task. Use 'edge_extraction', 'z3_pathway', or 'multiomic_consistency'.", status="error")


if __name__ == "__main__":
    main()
