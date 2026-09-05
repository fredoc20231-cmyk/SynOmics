#!/usr/bin/env python3
"""Ground-truth smoke tests for server/systems_dynamics_tools.py.

Every expectation is derived analytically (mass balance, closed-form ODE steady
states, known limits) — no hardcoded guesses. Zero-hallucination: the module
must reproduce these exact analytic values by running real numpy/scipy code.
"""
import json
import math
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "systems_dynamics_tools.py")

try:
    import numpy  # noqa: F401
    import scipy  # noqa: F401
except Exception as e:  # pragma: no cover
    print(f"SKIP: numpy/scipy not available ({e}).")
    sys.exit(0)

passed = 0


def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


def run(payload):
    r = subprocess.run(
        [sys.executable, SCRIPT],
        input=json.dumps(payload).encode(),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    if r.returncode != 0:
        print(f"process error rc={r.returncode}: {r.stderr.decode()}")
    return json.loads(r.stdout.decode())


# ---------------------------------------------------------------------------
# 1. protein_dimerization_equilibrium
# ---------------------------------------------------------------------------
# 1a. Mass balance must hold exactly for an intermediate regime.
kd, total = 5.0, 20.0
res = run({"task": "protein_dimerization_equilibrium", "totalConcentration": total, "kd": kd})
check("dimer status success", res.get("status") == "success", res)
m = res["freeMonomer"]
d = res["dimerConcentration"]
check("dimer mass balance m + 2D = total (1e-6)", abs((m + 2 * d) - total) < 1e-6, (m, d, total))
# closed form cross-check: m = (-kd + sqrt(kd^2 + 8*kd*total))/4
m_expected = (-kd + math.sqrt(kd * kd + 8.0 * kd * total)) / 4.0
check("dimer free monomer matches closed form", abs(m - m_expected) < 1e-8, (m, m_expected))
check("dimer [D] = m^2/kd", abs(d - m * m / kd) < 1e-8, (d, m * m / kd))
check("dimer fractionDimerized = 2D/total", abs(res["fractionDimerized"] - 2 * d / total) < 1e-9, res)

# 1b. Strong-binding limit (kd << total): fraction dimerized -> ~1.
strong = run({"task": "protein_dimerization_equilibrium", "totalConcentration": 100.0, "kd": 1e-6})
check("dimer strong-binding status", strong.get("status") == "success", strong)
check("dimer strong-binding frac -> ~1", strong["fractionDimerized"] > 0.999, strong["fractionDimerized"])
check("dimer strong-binding mass balance", abs((strong["freeMonomer"] + 2 * strong["dimerConcentration"]) - 100.0) < 1e-6, strong)

# 1c. Weak-binding limit (kd >> total): fraction dimerized -> ~0.
weak = run({"task": "protein_dimerization_equilibrium", "totalConcentration": 1.0, "kd": 1e6})
check("dimer weak-binding status", weak.get("status") == "success", weak)
check("dimer weak-binding frac -> ~0", weak["fractionDimerized"] < 0.001, weak["fractionDimerized"])
check("dimer weak-binding mass balance", abs((weak["freeMonomer"] + 2 * weak["dimerConcentration"]) - 1.0) < 1e-6, weak)

# 1d. Titration mode returns arrays with per-point mass balance preserved.
titr = run({"task": "protein_dimerization_equilibrium", "totalConcentrations": [0.1, 1.0, 10.0, 100.0], "kd": 5.0})
check("dimer titration status", titr.get("status") == "success", titr)
check("dimer titration arrays length 4", len(titr["fractionDimerized"]) == 4, titr)
for i, T in enumerate([0.1, 1.0, 10.0, 100.0]):
    mb = titr["freeMonomer"][i] + 2 * titr["dimerConcentration"][i]
    check(f"dimer titration mass balance @T={T}", abs(mb - T) < 1e-6, (mb, T))
# fraction dimerized increases monotonically with total concentration
check("dimer titration frac increases with T",
      all(titr["fractionDimerized"][i] < titr["fractionDimerized"][i + 1] for i in range(3)),
      titr["fractionDimerized"])

# 1e. Missing required param -> honest error.
check("dimer missing kd -> error", run({"task": "protein_dimerization_equilibrium", "totalConcentration": 10.0}).get("status") == "error")
check("dimer missing total -> error", run({"task": "protein_dimerization_equilibrium", "kd": 5.0}).get("status") == "error")

# ---------------------------------------------------------------------------
# 2. simulate_gene_circuit_with_growth_feedback
#    dP/dt = k_tx - (k_deg + mu)*P  ->  P* = k_tx/(k_deg + mu)
# ---------------------------------------------------------------------------
gc = run({
    "task": "simulate_gene_circuit_with_growth_feedback",
    "k_transcription": 10.0, "k_degradation": 0.5, "growthRate": 0.5,
    "tMax": 50.0, "nPoints": 200,
})
check("gene-circuit status success", gc.get("status") == "success", gc)
check("gene-circuit steadyState = 10/1.0 = 10.0", abs(gc["steadyState"] - 10.0) < 1e-9, gc["steadyState"])
final = gc["protein"][-1]
check("gene-circuit final protein approaches 10.0 within 1%", abs(final - 10.0) < 0.1, final)
# starts at default initial 0 and rises monotonically toward the steady state
prot = gc["protein"]
check("gene-circuit starts at 0", abs(prot[0]) < 1e-9, prot[0])
check("gene-circuit monotonic increase", all(prot[i + 1] >= prot[i] - 1e-9 for i in range(len(prot) - 1)), prot[:5])
check("gene-circuit bounded by steady state", max(prot) <= 10.0 + 1e-6, max(prot))

# 2b. Missing required param -> honest error.
check("gene-circuit missing k_transcription -> error",
      run({"task": "simulate_gene_circuit_with_growth_feedback", "k_degradation": 0.5, "growthRate": 0.5}).get("status") == "error")

# ---------------------------------------------------------------------------
# 3. simulate_protein_signaling_network
#    dx_i/dt = k_i*u_i*(1-x_i) - kd_i*x_i ; u_0=stimulus, u_i=x_{i-1}
#    stage-0 fixed point x0* = k0*S/(k0*S + kd0)
# ---------------------------------------------------------------------------
S = 2.0
rates = [1.5, 1.0, 0.8]
deact = [0.5, 0.5, 0.5]
sig = run({
    "task": "simulate_protein_signaling_network",
    "stimulus": S, "rates": rates, "deactivationRates": deact,
    "tMax": 200.0, "nPoints": 400,
})
check("signaling status success", sig.get("status") == "success", sig)
check("signaling nStages = 3", sig["nStages"] == 3, sig)

# analytic cascade fixed point (recompute independently)
ss_expected = []
up = S
for i in range(3):
    denom = rates[i] * up + deact[i]
    xi = rates[i] * up / denom
    ss_expected.append(xi)
    up = xi

# stage-0 analytic form: k0*S/(k0*S+kd0)
x0_form = rates[0] * S / (rates[0] * S + deact[0])
check("signaling stage-0 analytic form", abs(ss_expected[0] - x0_form) < 1e-12, (ss_expected[0], x0_form))
check("signaling stage-0 steady state matches simulation",
      abs(sig["finalLevels"][0] - x0_form) < 1e-3, (sig["finalLevels"][0], x0_form))

# each stage: simulation reaches the analytic steady state, derivative ~0 at tMax
for i in range(3):
    check(f"signaling stage {i} reaches analytic steady state",
          abs(sig["finalLevels"][i] - ss_expected[i]) < 1e-3,
          (sig["finalLevels"][i], ss_expected[i]))
    traj = sig["trajectories"][i]
    t = sig["time"]
    deriv = (traj[-1] - traj[-2]) / (t[-1] - t[-2])
    check(f"signaling stage {i} derivative ~0 at tMax", abs(deriv) < 1e-4, deriv)

# downstream final level is strictly positive
check("signaling downstream level positive", sig["finalLevels"][-1] > 0.0, sig["finalLevels"])

# 3b. Missing required param -> honest error.
check("signaling missing stimulus -> error",
      run({"task": "simulate_protein_signaling_network", "nStages": 3}).get("status") == "error")

# ---------------------------------------------------------------------------
# 4. Unknown task -> honest error.
# ---------------------------------------------------------------------------
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")

print(f"\nALL {passed} SYSTEMS-DYNAMICS TESTS PASSED")
