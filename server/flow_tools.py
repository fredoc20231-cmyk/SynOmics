#!/usr/bin/env python3
"""Flow cytometry analyses (numpy) — one dispatch.

Tasks: arcsinh_transform (biexponential-style), compensation (spillover matrix
inverse), gating_frequencies (threshold gates -> population %), channel_summary.
Reads JSON on stdin.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _events(p):
    import numpy as np
    ev = p.get("events")
    if not isinstance(ev, list) or not ev:
        _fail("Provide `events`: rows x channels matrix.")
    M = np.asarray(ev, float)
    if M.ndim != 2:
        _fail("events must be 2-D.")
    return M


def task_arcsinh_transform(p):
    import numpy as np
    M = _events(p)
    cofactor = float(p.get("cofactor", 150.0))
    T = np.arcsinh(M / cofactor)
    return {"status": "success", "analysis": "arcsinh transform", "cofactor": cofactor,
            "transformed": [[round(float(v), 6) for v in row] for row in T]}


def task_compensation(p):
    import numpy as np
    M = _events(p)
    spill = p.get("spillover")
    if not isinstance(spill, list):
        _fail("compensation needs a `spillover` matrix (channels x channels).")
    S = np.asarray(spill, float)
    if S.shape[0] != S.shape[1] or S.shape[1] != M.shape[1]:
        _fail("spillover must be square and match channel count.")
    try:
        comp = M @ np.linalg.inv(S)
    except np.linalg.LinAlgError:
        _fail("spillover matrix is singular; cannot compensate.")
    return {"status": "success", "analysis": "fluorescence compensation (spillover inverse)",
            "compensated": [[round(float(v), 6) for v in row] for row in comp]}


def task_gating_frequencies(p):
    import numpy as np
    M = _events(p)
    gates = p.get("gates")
    channels = p.get("channels") or [f"ch{i}" for i in range(M.shape[1])]
    if not isinstance(gates, list):
        _fail("gating_frequencies needs `gates`: [{channel, min?, max?}, ...] (AND-combined).")
    idx = {c: i for i, c in enumerate(channels)}
    mask = np.ones(M.shape[0], dtype=bool)
    for g in gates:
        ch = g.get("channel")
        if ch not in idx:
            _fail(f"gate channel {ch!r} not in channels.")
        col = M[:, idx[ch]]
        if "min" in g:
            mask &= col >= float(g["min"])
        if "max" in g:
            mask &= col <= float(g["max"])
    n_in = int(mask.sum())
    return {"status": "success", "analysis": "gating frequencies", "totalEvents": int(M.shape[0]),
            "eventsInGate": n_in, "frequencyPercent": round(100.0 * n_in / M.shape[0], 4)}


def task_channel_summary(p):
    import numpy as np
    M = _events(p)
    channels = p.get("channels") or [f"ch{i}" for i in range(M.shape[1])]
    out = {}
    for i, c in enumerate(channels):
        col = M[:, i]
        out[c] = {"median": round(float(np.median(col)), 4), "mean": round(float(col.mean()), 4),
                  "cv": round(float(col.std() / col.mean()), 4) if col.mean() else None,
                  "p95": round(float(np.percentile(col, 95)), 4)}
    return {"status": "success", "analysis": "channel summary", "nEvents": int(M.shape[0]), "channels": out}


TASKS = {"arcsinh_transform": task_arcsinh_transform, "compensation": task_compensation,
         "gating_frequencies": task_gating_frequencies, "channel_summary": task_channel_summary}


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
        _fail(f"flow_tools requires numpy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
