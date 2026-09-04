#!/usr/bin/env python3
"""Ground-truth smoke tests for server/chrono_tools.py (cosinor_analysis).

Data are generated from KNOWN cosinor parameters (no noise) and the fitted
parameters must be recovered exactly. Zero-hallucination: expectations are
derived analytically, not hardcoded guesses.
"""
import json
import math
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "chrono_tools.py")

try:
    import numpy  # noqa: F401
except Exception as e:
    print(f"SKIP: numpy/matplotlib not available ({e}).")
    sys.exit(0)
try:
    import matplotlib  # noqa: F401
except Exception as e:
    print(f"SKIP: numpy/matplotlib not available ({e}).")
    sys.exit(0)

passed = 0


def check(n, c, ctx=None):
    global passed
    if not c:
        print(f"FAIL: {n}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {n}")


def run(p):
    r = subprocess.run(
        [sys.executable, SCRIPT],
        input=json.dumps(p).encode(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return json.loads(r.stdout.decode())


# --- Ground truth: y = MESOR + A*cos(2*pi*t/P - phi0), known params, no noise ---
MESOR_TRUE = 10.0
AMP_TRUE = 5.0
PERIOD = 24.0
PHI0 = math.pi / 3.0  # acrophase in the cos(wt - phi0) generating form

t = [i * 0.5 for i in range(0, 97)]  # 0..48 step 0.5
w = 2.0 * math.pi / PERIOD
y = [MESOR_TRUE + AMP_TRUE * math.cos(w * ti - PHI0) for ti in t]

# Expand cos(wt - phi0) = cos(wt)cos(phi0) + sin(wt)sin(phi0):
beta_true = AMP_TRUE * math.cos(PHI0)
gamma_true = AMP_TRUE * math.sin(PHI0)
# Expected acrophase using the tool's own convention: atan2(-gamma, beta).
acro_expected = math.atan2(-gamma_true, beta_true)
acro_hours_expected = (-acro_expected * PERIOD / (2.0 * math.pi)) % PERIOD

res = run({"task": "cosinor_analysis", "time": t, "values": y, "period": PERIOD})
check("status success", res.get("status") == "success", res)
check("recover MESOR ~ 10.0", abs(res["mesor"] - MESOR_TRUE) < 1e-6, res)
check("recover amplitude ~ 5.0", abs(res["amplitude"] - AMP_TRUE) < 1e-6, res)
check("recover rSquared ~ 1.0", abs(res["rSquared"] - 1.0) < 1e-9, res)
# Acrophase compared via cos/sin (wrap-safe) against the analytically expected value.
check(
    "recover acrophase (rad) via cos/sin",
    abs(math.cos(res["acrophaseRadians"]) - math.cos(acro_expected)) < 1e-6
    and abs(math.sin(res["acrophaseRadians"]) - math.sin(acro_expected)) < 1e-6,
    (res.get("acrophaseRadians"), acro_expected),
)
# Peak time (acrophase hours) is unambiguous: the true peak of cos(wt-phi0) is at
# t = phi0 * P / (2*pi) = 4.0 h.
check(
    "recover acrophase hours == expected (peak at 4.0 h)",
    abs(res["acrophaseHours"] - acro_hours_expected) < 1e-6
    and abs(acro_hours_expected - 4.0) < 1e-9,
    (res.get("acrophaseHours"), acro_hours_expected),
)
check("recover beta", abs(res["beta"] - beta_true) < 1e-6, res)
check("recover gamma", abs(res["gamma"] - gamma_true) < 1e-6, res)
check("n reported", res["n"] == len(t), res)

# --- Mismatched lengths -> honest error ---
mm = run({"task": "cosinor_analysis", "time": [0, 1, 2, 3], "values": [1, 2, 3]})
check("mismatched lengths -> error", mm.get("status") == "error", mm)

# --- Unknown task -> honest error ---
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")

# --- Bundle: outputDir produces a full outcome manifest ---
with tempfile.TemporaryDirectory() as d:
    out = os.path.join(d, "cosinor_out")
    rb = run({"task": "cosinor_analysis", "time": t, "values": y, "period": PERIOD, "outputDir": out})
    check("bundle status success", rb.get("status") == "success", rb)
    man = rb.get("bundle")
    check("manifest present", isinstance(man, dict) and "artifacts" in man, man)

    def _find(ext_or_name):
        for group in man["artifacts"].values():
            for rel in group:
                if rel.endswith(ext_or_name):
                    return os.path.join(out, rel)
        return None

    png = _find(".png")
    svg = _find(".svg")
    csv = _find(".csv")
    code = _find(os.path.join("code", "analysis.py"))
    html = _find("report.html")
    md = _find("report.md")

    check("figure png exists", png and os.path.getsize(png) > 0, png)
    with open(png, "rb") as fh:
        check("png magic bytes", fh.read(4) == b"\x89PNG", png)
    check("figure svg exists+nonempty", svg and os.path.getsize(svg) > 0, svg)
    check("table csv exists+nonempty", csv and os.path.getsize(csv) > 0, csv)
    check("code analysis.py exists+nonempty", code and os.path.getsize(code) > 0, code)
    check("report.html exists+nonempty", html and os.path.getsize(html) > 0, html)
    check("report.md exists+nonempty", md and os.path.getsize(md) > 0, md)

print(f"\nALL {passed} CHRONO TESTS PASSED")
