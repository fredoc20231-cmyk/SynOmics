#!/usr/bin/env python3
"""Quality-control analyses (numpy) — one dispatch.

Tasks: fastq_quality (per-base Phred stats + GC from FASTQ text),
count_matrix_qc (library sizes, detected genes, mito %),
outlier_mad (median-absolute-deviation outlier detection).
Reads JSON on stdin.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def task_fastq_quality(p):
    import numpy as np
    text = p.get("fastq")
    if not isinstance(text, str) or "@" not in text:
        _fail("fastq_quality needs `fastq` text (4-line records).")
    lines = [ln for ln in text.splitlines() if ln != ""]
    seqs, quals = [], []
    for i in range(0, len(lines) - 3, 4):
        seqs.append(lines[i + 1])
        quals.append(lines[i + 3])
    if not seqs:
        _fail("No complete FASTQ records found.")
    maxlen = max(len(q) for q in quals)
    per_base = [[] for _ in range(maxlen)]
    for q in quals:
        for j, ch in enumerate(q):
            per_base[j].append(ord(ch) - 33)  # Phred+33
    mean_by_pos = [round(float(np.mean(col)), 3) if col else None for col in per_base]
    allq = [ord(c) - 33 for q in quals for c in q]
    gc = sum(s.count("G") + s.count("C") + s.count("g") + s.count("c") for s in seqs)
    total = sum(len(s) for s in seqs)
    return {"status": "success", "analysis": "FASTQ quality profile", "nReads": len(seqs),
            "meanQuality": round(float(np.mean(allq)), 3), "minQuality": int(min(allq)), "maxQuality": int(max(allq)),
            "meanPhredByPosition": mean_by_pos, "gcPercent": round(100.0 * gc / total, 3) if total else 0.0,
            "pctBasesQ30": round(100.0 * float(np.mean([1 if x >= 30 else 0 for x in allq])), 2)}


def task_count_matrix_qc(p):
    import numpy as np
    counts = p.get("counts")
    genes = p.get("genes")
    if not isinstance(counts, list):
        _fail("count_matrix_qc needs `counts` (cells x genes).")
    M = np.asarray(counts, float)
    if M.ndim != 2:
        _fail("`counts` must be 2-D (cells x genes).")
    lib = M.sum(axis=1)
    detected = (M > 0).sum(axis=1)
    mito_pct = None
    if isinstance(genes, list) and len(genes) == M.shape[1]:
        mt = np.array([1.0 if str(g).upper().startswith(("MT-", "MT.")) else 0.0 for g in genes])
        mito_counts = M @ mt
        mito_pct = [round(float(mc / ls * 100), 3) if ls > 0 else 0.0 for mc, ls in zip(mito_counts, lib)]
    return {"status": "success", "analysis": "count-matrix QC", "nCells": int(M.shape[0]), "nGenes": int(M.shape[1]),
            "librarySizes": [int(x) for x in lib], "genesDetectedPerCell": [int(x) for x in detected],
            "medianLibrarySize": float(np.median(lib)), "medianGenesPerCell": float(np.median(detected)),
            "mitoPercent": mito_pct}


def task_outlier_mad(p):
    import numpy as np
    x = p.get("x")
    if not isinstance(x, list) or len(x) < 3:
        _fail("outlier_mad needs `x` (>=3 values).")
    arr = np.asarray(x, float)
    med = float(np.median(arr))
    mad = float(np.median(np.abs(arr - med)))
    thr = float(p.get("threshold", 3.5))
    scale = 1.4826 * mad if mad > 0 else 1e-9
    z = (arr - med) / scale
    outliers = [{"index": i, "value": float(arr[i]), "modifiedZ": round(float(z[i]), 3)}
                for i in range(len(arr)) if abs(z[i]) > thr]
    return {"status": "success", "analysis": "MAD outlier detection", "median": med, "mad": round(mad, 4),
            "threshold": thr, "nOutliers": len(outliers), "outliers": outliers}


TASKS = {"fastq_quality": task_fastq_quality, "count_matrix_qc": task_count_matrix_qc, "outlier_mad": task_outlier_mad}


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
    except Exception as e:
        _fail(f"qc_tools requires numpy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
