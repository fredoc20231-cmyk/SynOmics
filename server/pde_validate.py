#!/usr/bin/env python3
"""Reaction-diffusion PDE residual enforcement — Final Frontier 2.

The physics-validity gate for spatial-omics models: given a spatiotemporal field
u(x, t), compute the residual of the governing 1-D reaction-diffusion PDE
    du/dt = D * d2u/dx2 + f(u)
via finite differences. A field/model whose maximum residual does not fall below
a strict threshold is REJECTED as "Physically Invalid" — no field that violates
the governing physics is accepted.

Honest scope: training a Physics-Informed Neural Network (PINN) to PRODUCE such a
field needs a GPU/torch and is not run here; this module implements the
deterministic residual ENFORCEMENT that is the PINN's actual acceptance
criterion, and it runs exactly. Pure numpy.

Reads JSON on stdin, prints JSON. Payload:
  { "u": [[...], ...],           # shape [n_t, n_x]
    "D": 1.0, "dx": 0.1, "dt": 0.001,
    "reaction": {"type": "linear", "rate": 0.0} | {"type":"none"},
    "threshold": 1e-4 }
"""
import json
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
        _fail(f"PDE residual enforcement requires numpy: {e}", status="unavailable")

    u = payload.get("u")
    if not u:
        _fail("Provide the field `u` as a 2-D array [n_t, n_x].")
    U = np.asarray(u, dtype=float)
    if U.ndim != 2 or U.shape[0] < 2 or U.shape[1] < 3:
        _fail("Field must be 2-D with >=2 time steps and >=3 spatial points.")
    D = float(payload.get("D", 1.0))
    dx = float(payload.get("dx", 0.1))
    dt = float(payload.get("dt", 0.001))
    threshold = float(payload.get("threshold", 1e-4))
    reaction = payload.get("reaction") or {"type": "none"}

    n_t, n_x = U.shape
    # u_t (forward difference in time), u_xx (central difference in space), interior points.
    u_t = (U[1:, 1:-1] - U[:-1, 1:-1]) / dt
    u_xx = (U[:-1, 2:] - 2 * U[:-1, 1:-1] + U[:-1, :-2]) / (dx * dx)

    if reaction.get("type") == "linear":
        f = float(reaction.get("rate", 0.0)) * U[:-1, 1:-1]
    elif reaction.get("type") == "logistic":
        r = float(reaction.get("rate", 0.0)); K = float(reaction.get("carryingCapacity", 1.0))
        uu = U[:-1, 1:-1]
        f = r * uu * (1.0 - uu / K)
    else:
        f = 0.0

    residual = u_t - D * u_xx - f
    max_res = float(np.max(np.abs(residual)))
    mean_res = float(np.mean(np.abs(residual)))
    # Dimensionless relative residual against the diffusion-term scale.
    scale = float(np.max(np.abs(D * u_xx))) or 1.0
    rel_res = max_res / scale

    valid = max_res < threshold
    print(json.dumps({
        "status": "success",
        "method": "finite-difference reaction-diffusion PDE residual (du/dt - D u_xx - f(u))",
        "gridShape": [n_t, n_x],
        "maxResidual": max_res,
        "meanResidual": mean_res,
        "relativeResidual": rel_res,
        "threshold": threshold,
        "verdict": "PHYSICALLY_VALID" if valid else "PHYSICALLY_INVALID",
        "note": ("Field satisfies the governing reaction-diffusion PDE within tolerance."
                 if valid else
                 f"Max residual {max_res:.3e} exceeds threshold {threshold:.1e}; field rejected as physically invalid."),
    }))


if __name__ == "__main__":
    main()
