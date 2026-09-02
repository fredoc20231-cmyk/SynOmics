#!/usr/bin/env python3
"""Self-optimizing compilation — APEX Part 4 (hardware metabolism).

When a numeric hot loop is slow, transpile it to C via Cython, compile at runtime,
run the compiled binary, and log the measured speedup. Correctness is asserted
against the pure-Python reference BEFORE any speedup is reported — a wrong
compiled result is never presented as a win. Honest 'unavailable' if the Cython
toolchain (Cython + a C compiler) is absent.

Reads JSON on stdin, prints JSON. Payload:
  { "kernel": "sum_sq_pairwise", "n": 2000, "seed": 1337,
    "thresholdSeconds": 60, "auditLog": "<path>"? }
"""
import datetime
import json
import os
import sys
import time

KERNELS = {"sum_sq_pairwise"}


def _out(obj):
    print(json.dumps(obj))
    sys.exit(0)


def _py_sum_sq_pairwise(x):
    n = len(x)
    total = 0.0
    for i in range(n):
        xi = x[i]
        for j in range(i + 1, n):
            d = xi - x[j]
            total += d * d
    return total


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _out({"status": "error", "error": f"Invalid JSON: {e}"})

    kernel = payload.get("kernel", "sum_sq_pairwise")
    if kernel not in KERNELS:
        _out({"status": "error", "error": f"Unknown kernel '{kernel}'. Available: {sorted(KERNELS)}."})
    n = int(payload.get("n", 2000))
    seed = int(payload.get("seed", 1337))
    threshold = float(payload.get("thresholdSeconds", 60))

    try:
        import numpy as np
    except Exception as e:
        _out({"status": "unavailable", "error": f"numpy required: {e}"})

    rng = np.random.default_rng(seed)
    arr = rng.standard_normal(n).astype(np.float64)

    # --- pure-Python reference (timed) ---
    t0 = time.perf_counter()
    py_result = _py_sum_sq_pairwise(arr.tolist())
    py_secs = time.perf_counter() - t0

    # --- attempt Cython compilation + execution ---
    here = os.path.dirname(os.path.abspath(__file__))
    try:
        import pyximport
        pyximport.install(setup_args={"include_dirs": [np.get_include()]}, language_level=3)
        sys.path.insert(0, here)
        from kernels import fast_kernel  # compiled on first import (needs a C compiler)
    except Exception as e:
        _out({
            "status": "unavailable",
            "error": f"Cython toolchain unavailable ({e}).",
            "kernel": kernel, "n": n,
            "pythonSeconds": round(py_secs, 6),
            "note": "Pure-Python timing succeeded; compiled acceleration requires Cython + a C compiler.",
        })

    t1 = time.perf_counter()
    cy_result = fast_kernel.sum_sq_pairwise(arr)
    cy_secs = time.perf_counter() - t1

    # --- correctness guard (Zero-BS): compiled must match the reference ---
    rel_err = abs(cy_result - py_result) / (abs(py_result) + 1e-12)
    results_match = rel_err < 1e-9
    speedup = round(py_secs / cy_secs, 2) if cy_secs > 0 else None

    record = {
        "status": "success" if results_match else "error",
        "kernel": kernel,
        "n": n,
        "pythonSeconds": round(py_secs, 6),
        "cythonSeconds": round(cy_secs, 6),
        "speedupFactor": speedup,
        "resultsMatch": results_match,
        "relError": rel_err,
        "exceededThreshold": py_secs > threshold,
        "compiler": "cython->C",
        "note": ("Compiled result matches the pure-Python reference."
                 if results_match else "Compiled result DIVERGED from reference; speedup rejected."),
    }

    # Append a compilation record to the audit log (doctrine Part 6).
    audit_path = payload.get("auditLog") or os.environ.get("SYNOMICS_AUDIT_LOG")
    if audit_path and results_match:
        try:
            with open(audit_path, "a") as fh:
                fh.write(json.dumps({
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "event": "cython_compilation",
                    "kernel": kernel, "n": n, "speedupFactor": speedup,
                    "cythonVersion": __import__("Cython").__version__,
                }) + "\n")
            record["auditLogged"] = True
        except Exception:
            record["auditLogged"] = False

    _out(record)


if __name__ == "__main__":
    main()
