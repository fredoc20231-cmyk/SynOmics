#!/usr/bin/env python3
"""Minimum Message Length (MML) model selection — Final Frontier 3.

Selects the most parsimonious model by minimizing the two-part message length
L = L(model) + L(data | model), i.e. algorithmic complexity of the model plus
the encoded residual. A model with a marginally lower p-value is NOT chosen if
its complexity is unjustified. Pure numpy.

Concrete task: choose the polynomial order that best explains (x, y). Each
candidate is fit by least squares; message length is computed in nats.

Reads JSON on stdin, prints JSON. Payload:
  { "x": [...], "y": [...], "maxDegree": 6 }  OR
  { "candidates": [{"name","paramsCount","negLogLik","n"}] }  # generic form
"""
import json
import math
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON: {e}")

    try:
        import numpy as np
    except Exception as e:
        _fail(f"MML requires numpy: {e}", status="unavailable")

    # Generic mode: caller supplies each model's fit statistics directly.
    if isinstance(payload.get("candidates"), list):
        cands = payload["candidates"]
        scored = []
        for c in cands:
            k = int(c["paramsCount"])
            n = int(c["n"])
            nll = float(c["negLogLik"])  # L(data|model) in nats
            model_len = 0.5 * k * math.log(max(n, 2))  # BIC-consistent MML parameter cost
            scored.append({"name": c.get("name"), "paramsCount": k,
                           "dataLengthNats": round(nll, 4),
                           "modelLengthNats": round(model_len, 4),
                           "totalMessageLengthNats": round(nll + model_len, 4)})
        scored.sort(key=lambda s: s["totalMessageLengthNats"])
        print(json.dumps({"status": "success", "method": "two-part MML message length",
                          "selected": scored[0]["name"], "ranking": scored}))
        return

    # Polynomial-order mode.
    x = payload.get("x")
    y = payload.get("y")
    if not x or not y or len(x) != len(y):
        _fail("Provide equal-length `x` and `y`, or a `candidates` list.")
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    n = len(x)
    max_deg = int(payload.get("maxDegree", min(6, n - 2)))
    max_deg = max(0, min(max_deg, n - 2))

    results = []
    for d in range(max_deg + 1):
        k = d + 1                     # polynomial coefficients
        coef = np.polyfit(x, y, d)
        resid = y - np.polyval(coef, x)
        rss = float(np.sum(resid ** 2))
        sigma2 = max(rss / n, 1e-12)  # MLE noise variance
        # Gaussian negative log-likelihood at the MLE (nats):
        nll = 0.5 * n * (math.log(2 * math.pi * sigma2) + 1.0)
        # Two-part model cost: encode k parameters (+ noise scale) at ~0.5 ln(n) nats each.
        model_len = 0.5 * (k + 1) * math.log(n)
        total = nll + model_len
        results.append({"degree": d, "params": k, "rss": round(rss, 6),
                        "dataLengthNats": round(nll, 4),
                        "modelLengthNats": round(model_len, 4),
                        "totalMessageLengthNats": round(total, 4)})

    best = min(results, key=lambda r: r["totalMessageLengthNats"])
    print(json.dumps({
        "status": "success",
        "method": "two-part MML: Gaussian NLL (data) + parameter-precision cost (model)",
        "selectedDegree": best["degree"],
        "note": "Lowest total message length wins; extra parameters are only justified if they shorten the encoded residual by more than their own cost.",
        "ranking": results,
    }))


if __name__ == "__main__":
    main()
