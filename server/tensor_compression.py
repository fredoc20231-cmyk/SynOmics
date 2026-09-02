#!/usr/bin/env python3
"""Tensor-Train (TT / Matrix-Product-State) compression — Part 3B.

An HONEST scope statement: this is a real, memory-efficient compression utility
for high-dimensional arrays, with the truncation error always measured and
reported. It is NOT a cellular "digital twin" simulator — no such simulation is
performed or claimed. Any result whose relative reconstruction error exceeds the
threshold is explicitly flagged "approximate".

Reads JSON on stdin, prints JSON on stdout. Returns honest 'unavailable' if the
numeric stack is missing.

Payload:
  { "tensor": <nested list, ndim>=2>,
    "rank": <int | [ranks]>,       # optional; if omitted, adaptively chosen
    "maxRelError": 1e-4 }          # target for adaptive rank selection
"""
import json
import sys


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
        import tensorly as tl
        from tensorly.decomposition import tensor_train
    except Exception as e:
        _fail(f"Tensor compression requires numpy + tensorly (not installed): {e}")

    if "tensor" not in payload:
        _fail("Provide `tensor` as a nested list.", status="error")
    try:
        X = np.array(payload["tensor"], dtype=float)
    except Exception as e:
        _fail(f"Could not parse tensor: {e}", status="error")
    if X.ndim < 2:
        _fail("Tensor must have at least 2 dimensions.", status="error")

    target = float(payload.get("maxRelError", 1e-4))
    norm = float(np.linalg.norm(X)) or 1.0
    nd = X.ndim

    def decompose(ranks):
        factors = tensor_train(X, rank=ranks)
        rec = tl.tt_to_tensor(factors)
        err = float(np.linalg.norm(rec - X)) / norm
        comp = int(sum(f.size for f in factors))
        return factors, err, comp

    chosen = None
    if payload.get("rank") is not None:
        r = payload["rank"]
        ranks = r if isinstance(r, list) else ([1] + [int(r)] * (nd - 1) + [1])
        factors, err, comp = decompose(ranks)
        chosen = ranks
    else:
        # Adaptively grow a uniform internal rank until the target error is met.
        max_r = int(min(X.shape))
        factors = err = comp = None
        for r in range(1, max_r + 1):
            ranks = [1] + [r] * (nd - 1) + [1]
            factors, err, comp = decompose(ranks)
            chosen = ranks
            if err <= target:
                break

    orig = int(X.size)
    print(json.dumps({
        "status": "success",
        "method": "Tensor-Train (MPS) decomposition via tensorly",
        "shape": list(X.shape),
        "ttRanks": [int(x) for x in chosen],
        "originalElements": orig,
        "compressedElements": comp,
        "compressionRatio": round(orig / comp, 3) if comp else None,
        "relativeError": err,
        "maxRelError": target,
        "approximate": bool(err > target),
        "note": ("Reconstruction within target tolerance." if err <= target
                 else f"APPROXIMATE: relative error {err:.3e} exceeds target {target:.1e}."),
    }))


if __name__ == "__main__":
    main()
