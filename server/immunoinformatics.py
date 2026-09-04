#!/usr/bin/env python3
"""Immune-repertoire analyses (numpy) — one dispatch.

Tasks: repertoire_diversity (Shannon/Simpson/clonality/richness),
vj_usage (V-J gene frequencies), cdr3_spectratype (CDR3 length dist),
repertoire_overlap (Morisita-Horn + Jaccard between two repertoires).
Reads JSON on stdin.
"""
import json
import math
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def task_repertoire_diversity(p):
    clones = p.get("clones")
    if not isinstance(clones, dict) or not clones:
        _fail("repertoire_diversity needs `clones`: {clonotype: count}.")
    counts = [float(v) for v in clones.values() if v > 0]
    total = sum(counts)
    freqs = [c / total for c in counts]
    shannon = -sum(f * math.log(f) for f in freqs)
    simpson = 1 - sum(f * f for f in freqs)
    richness = len(counts)
    clonality = 1 - (shannon / math.log(richness)) if richness > 1 else 0.0
    return {"status": "success", "analysis": "repertoire diversity", "richness": richness,
            "shannon": round(shannon, 4), "simpson": round(simpson, 4), "clonality": round(clonality, 4),
            "totalReads": int(total)}


def task_vj_usage(p):
    recs = p.get("rearrangements")
    if not isinstance(recs, list) or not recs:
        _fail("vj_usage needs `rearrangements`: [{v, j}, ...].")
    vc, jc, vjc = {}, {}, {}
    for r in recs:
        v = str(r.get("v", "NA")); j = str(r.get("j", "NA"))
        vc[v] = vc.get(v, 0) + 1
        jc[j] = jc.get(j, 0) + 1
        vjc[f"{v}|{j}"] = vjc.get(f"{v}|{j}", 0) + 1
    n = len(recs)
    return {"status": "success", "analysis": "V/J gene usage", "n": n,
            "vUsage": {k: round(v / n, 4) for k, v in sorted(vc.items(), key=lambda x: -x[1])},
            "jUsage": {k: round(v / n, 4) for k, v in sorted(jc.items(), key=lambda x: -x[1])},
            "topVJPairs": dict(sorted(vjc.items(), key=lambda x: -x[1])[:10])}


def task_cdr3_spectratype(p):
    seqs = p.get("cdr3")
    if not isinstance(seqs, list) or not seqs:
        _fail("cdr3_spectratype needs `cdr3`: list of CDR3 sequences.")
    dist = {}
    for s in seqs:
        L = len(str(s))
        dist[L] = dist.get(L, 0) + 1
    total = len(seqs)
    return {"status": "success", "analysis": "CDR3 spectratype (length distribution)",
            "n": total, "lengthCounts": dict(sorted(dist.items())),
            "lengthFrequency": {k: round(v / total, 4) for k, v in sorted(dist.items())}}


def task_repertoire_overlap(p):
    a = p.get("repertoireA"); b = p.get("repertoireB")
    if not (isinstance(a, dict) and isinstance(b, dict)):
        _fail("repertoire_overlap needs `repertoireA` and `repertoireB`: {clonotype: count}.")
    keys = set(a) | set(b)
    xa = {k: float(a.get(k, 0)) for k in keys}
    xb = {k: float(b.get(k, 0)) for k in keys}
    sa, sb = sum(xa.values()), sum(xb.values())
    num = 2 * sum(xa[k] * xb[k] for k in keys)
    den = (sum(v * v for v in xa.values()) / (sa * sa) + sum(v * v for v in xb.values()) / (sb * sb)) * sa * sb
    mh = num / den if den else 0.0
    inter = len(set(a) & set(b)); union = len(set(a) | set(b))
    return {"status": "success", "analysis": "repertoire overlap",
            "sharedClonotypes": inter, "jaccard": round(inter / union, 6) if union else 0.0,
            "morisitaHorn": round(float(mh), 6)}


TASKS = {"repertoire_diversity": task_repertoire_diversity, "vj_usage": task_vj_usage,
         "cdr3_spectratype": task_cdr3_spectratype, "repertoire_overlap": task_repertoire_overlap}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
