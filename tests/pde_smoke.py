#!/usr/bin/env python3
"""Test reaction-diffusion PDE residual enforcement. Requires numpy.
Run: python tests/pde_smoke.py"""
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "pde_validate.py")
try:
    import numpy as np
except Exception as e:
    print(f"SKIP: numpy not available ({e}).")
    sys.exit(0)

passed = 0
def check(name, cond):
    global passed
    if not cond:
        print(f"FAIL: {name}"); sys.exit(1)
    passed += 1
    print(f"ok: {name}")

def run(payload):
    p = subprocess.run([sys.executable, SCRIPT], input=json.dumps(payload).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(p.stdout.decode())

D, dx, dt, nx, nt = 1.0, 0.1, 0.002, 50, 40
u = np.zeros((nt, nx))
x = np.linspace(0, (nx - 1) * dx, nx)
u[0] = np.exp(-((x - 2.5) ** 2) / 0.2)
alpha = D * dt / dx**2
for n in range(nt - 1):
    lap = np.zeros(nx); lap[1:-1] = u[n, 2:] - 2 * u[n, 1:-1] + u[n, :-2]
    u[n + 1] = u[n] + alpha * lap

r = run({"u": u.tolist(), "D": D, "dx": dx, "dt": dt, "threshold": 1e-4})
check("physical (discrete-scheme) field VALID", r["verdict"] == "PHYSICALLY_VALID")
check("physical field residual near zero", r["maxResidual"] < 1e-6)

rng = np.random.default_rng(0)
r2 = run({"u": rng.standard_normal((nt, nx)).tolist(), "D": D, "dx": dx, "dt": dt, "threshold": 1e-4})
check("random field PHYSICALLY_INVALID", r2["verdict"] == "PHYSICALLY_INVALID")
check("random field large residual", r2["maxResidual"] > 1.0)
print(f"\nALL {passed} PDE RESIDUAL TESTS PASSED")
