#!/usr/bin/env python3
"""Ground-truth smoke tests for server/biosignal_tools.py.

Signals are constructed from KNOWN physiological parameters (clean synthetic
waveforms) and the recovered metrics must match the analytic ground truth.
Zero-hallucination: expectations are derived from the generating math, not
hardcoded guesses.
"""
import json
import math
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "biosignal_tools.py")

try:
    import numpy as np  # noqa: F401
except Exception as e:
    print(f"SKIP: numpy not available ({e}).")
    sys.exit(0)
try:
    import scipy  # noqa: F401
except Exception as e:
    print(f"SKIP: scipy not available ({e}).")
    sys.exit(0)

passed = 0


def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


def run(p):
    r = subprocess.run(
        [sys.executable, SCRIPT],
        input=json.dumps(p).encode(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return json.loads(r.stdout.decode())


# --------------------------------------------------------------------------- #
# 1. ABR P1 metrics: Gaussian bump centered at t = 2 ms, fs = 10000 Hz.
#    True dominant-peak latency = 2.0 ms.
# --------------------------------------------------------------------------- #
FS_ABR = 10000.0
CENTER_S = 2.0e-3
SIGMA_S = 0.2e-3
t_abr = [i / FS_ABR for i in range(0, 61)]  # 0..6 ms, dt = 0.1 ms
sig_abr = [math.exp(-((ti - CENTER_S) ** 2) / (2.0 * SIGMA_S ** 2)) for ti in t_abr]

res = run({"task": "abr_waveform_p1_metrics", "signal": sig_abr, "samplingRateHz": FS_ABR})
check("abr status success", res.get("status") == "success", res)
check("abr p1 latency ~ 2.0 ms", abs(res["p1LatencyMs"] - 2.0) < 0.2, res)
check("abr peakCount >= 1", res["peakCount"] >= 1, res)
check("abr peak latencies list present",
      isinstance(res["peakLatenciesMs"], list) and len(res["peakLatenciesMs"]) >= 1, res)
check("abr p1 amplitude positive", res["p1AmplitudeUv"] > 0, res)
check("abr researchLog markdown", isinstance(res.get("researchLog"), str) and res["researchLog"].startswith("#"), res)

# Missing samplingRate -> honest error.
res_no_fs = run({"task": "abr_waveform_p1_metrics", "signal": sig_abr})
check("abr missing samplingRate -> error", res_no_fs.get("status") == "error", res_no_fs)


# --------------------------------------------------------------------------- #
# 2. Calcium transient: 0 for t < 1 s, then peak, then EXACT exponential decay
#    A*exp(-(t-tpeak)/tau) with tau = 0.5 s.  True time-to-peak = 1.0 s.
# --------------------------------------------------------------------------- #
TPEAK = 1.0
TAU_TRUE = 0.5
A_TRUE = 5.0
DT_CA = 0.01
t_ca = [i * DT_CA for i in range(0, 301)]  # 0..3 s
sig_ca = [
    (0.0 if ti < TPEAK else A_TRUE * math.exp(-(ti - TPEAK) / TAU_TRUE))
    for ti in t_ca
]

res = run({"task": "calcium_transient_dynamics", "time": t_ca, "signal": sig_ca})
check("ca status success", res.get("status") == "success", res)
check("ca baseline ~ 0", abs(res["baseline"] - 0.0) < 1e-6, res)
check("ca peak amplitude ~ 5.0", abs(res["peakAmplitude"] - A_TRUE) < 1e-6, res)
check("ca time-to-peak ~ 1.0 s", abs(res["timeToPeakS"] - TPEAK) < DT_CA + 1e-9, res)
check("ca decay tau ~ 0.5 s (within 5%)",
      res["decayTauS"] is not None and abs(res["decayTauS"] - TAU_TRUE) < 0.05 * TAU_TRUE, res)
check("ca rSquared > 0.99", res["rSquared"] is not None and res["rSquared"] > 0.99, res)

# Mismatched lengths -> honest error.
res_mm = run({"task": "calcium_transient_dynamics", "time": [0, 1, 2, 3, 4], "signal": [0, 1, 2]})
check("ca mismatched lengths -> error", res_mm.get("status") == "error", res_mm)


# --------------------------------------------------------------------------- #
# 3. Hemodynamic: signal = 80 + 40*sin(2*pi*f*t), f = 1 Hz -> HR = 60 bpm,
#    fs = 250 Hz over 6 s.  True SBP = 120, DBP = 40, MAP = 40 + 80/3.
# --------------------------------------------------------------------------- #
FS_HD = 250.0
F_HD = 1.0  # 1 Hz -> 60 bpm
DUR_S = 6.0
n_hd = int(FS_HD * DUR_S)
t_hd = [i / FS_HD for i in range(n_hd)]
sig_hd = [80.0 + 40.0 * math.sin(2.0 * math.pi * F_HD * ti) for ti in t_hd]

res = run({"task": "hemodynamic_waveform", "signal": sig_hd, "samplingRateHz": FS_HD})
check("hd status success", res.get("status") == "success", res)
check("hd heart rate ~ 60 bpm (within 2)", abs(res["heartRateBpm"] - 60.0) < 2.0, res)
check("hd systolic ~ 120 (within 3)", abs(res["systolicPressure"] - 120.0) < 3.0, res)
check("hd diastolic ~ 40 (within 3)", abs(res["diastolicPressure"] - 40.0) < 3.0, res)
MAP_TRUE = 40.0 + (120.0 - 40.0) / 3.0
check("hd MAP == DBP + (SBP-DBP)/3", abs(res["meanArterialPressure"] - MAP_TRUE) < 3.0, res)
check("hd beatCount >= 5", res["beatCount"] >= 5, res)

# Missing samplingRate -> honest error.
res_no_fs = run({"task": "hemodynamic_waveform", "signal": sig_hd})
check("hd missing samplingRate -> error", res_no_fs.get("status") == "error", res_no_fs)


# --------------------------------------------------------------------------- #
# 4. Unknown task -> honest error.
# --------------------------------------------------------------------------- #
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")


print(f"\nALL {passed} BIOSIGNAL TESTS PASSED")
