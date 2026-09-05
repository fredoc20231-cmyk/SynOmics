#!/usr/bin/env python3
"""Ground-truth smoke tests for server/pharmacology_assay_tools.py.

Every expectation is an independently derived numeric ground truth (not a value
copied back from the implementation). Zero-hallucination: the tests fail unless
the tool computes the mathematically correct answer.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "pharmacology_assay_tools.py")

try:
    import numpy  # noqa: F401
except Exception as e:  # noqa: BLE001
    print(f"SKIP: numpy not available ({e}).")
    sys.exit(0)
try:
    import scipy  # noqa: F401
except Exception as e:  # noqa: BLE001
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


def run(payload):
    r = subprocess.run(
        [sys.executable, SCRIPT],
        input=json.dumps(payload).encode(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return json.loads(r.stdout.decode())


# --- Task 1: xenograft_tgi -------------------------------------------------
# Ground truth: control 100 -> 300 (net +200), treated 100 -> 150 (net +50).
# TGI% = (1 - 50/200) * 100 = 75.0. Fold: treated 1.5, control 3.0.
res = run(
    {
        "task": "xenograft_tgi",
        "treatedVolumes": [100.0, 120.0, 150.0],
        "controlVolumes": [100.0, 200.0, 300.0],
        "days": [0, 7, 14],
    }
)
check("tgi 1D status success", res.get("status") == "success", res)
check("tgi 1D tgiPercent == 75.0", abs(res["tgiPercent"] - 75.0) < 1e-6, res)
check("tgi 1D treatedFoldChange == 1.5", abs(res["treatedFoldChange"] - 1.5) < 1e-6, res)
check("tgi 1D controlFoldChange == 3.0", abs(res["controlFoldChange"] - 3.0) < 1e-6, res)
check("tgi 1D pValue is null", res["pValue"] is None, res)
check("tgi 1D has researchLog", isinstance(res.get("researchLog"), str) and res["researchLog"], res)

# 2D: per-animal replicates whose column means match the 1D case above.
# Treated finals {140,150,160} mean 150; control finals {280,300,320} mean 300.
res2 = run(
    {
        "task": "xenograft_tgi",
        "treatedVolumes": [
            [100.0, 118.0, 140.0],
            [100.0, 120.0, 150.0],
            [100.0, 122.0, 160.0],
        ],
        "controlVolumes": [
            [100.0, 190.0, 280.0],
            [100.0, 200.0, 300.0],
            [100.0, 210.0, 320.0],
        ],
    }
)
check("tgi 2D status success", res2.get("status") == "success", res2)
check("tgi 2D tgiPercent == 75.0", abs(res2["tgiPercent"] - 75.0) < 1e-6, res2)
check("tgi 2D treatedFoldChange == 1.5", abs(res2["treatedFoldChange"] - 1.5) < 1e-6, res2)
check("tgi 2D controlFoldChange == 3.0", abs(res2["controlFoldChange"] - 3.0) < 1e-6, res2)
check(
    "tgi 2D pValue in [0,1]",
    isinstance(res2["pValue"], float) and 0.0 <= res2["pValue"] <= 1.0,
    res2,
)

# Missing inputs -> honest error.
check(
    "tgi missing controls -> error",
    run({"task": "xenograft_tgi", "treatedVolumes": [1, 2]}).get("status") == "error",
)
# Zero control growth -> undefined TGI -> error.
check(
    "tgi zero control growth -> error",
    run(
        {
            "task": "xenograft_tgi",
            "treatedVolumes": [100.0, 150.0],
            "controlVolumes": [100.0, 100.0],
        }
    ).get("status")
    == "error",
)

# --- Task 2: atp_luminescence_viability ------------------------------------
# Ground truth: lum=[50,100], vehicle=100, blank=0 -> [50.0, 100.0], mean 75.0.
via = run(
    {
        "task": "atp_luminescence_viability",
        "luminescence": [50.0, 100.0],
        "vehicleControl": 100.0,
        "blank": 0,
    }
)
check("viability status success", via.get("status") == "success", via)
check(
    "viability per-well == [50.0, 100.0]",
    [round(v, 6) for v in via["viabilityPercent"]] == [50.0, 100.0],
    via,
)
check("viability mean == 75.0", abs(via["meanViability"] - 75.0) < 1e-6, via)
check("viability has researchLog", isinstance(via.get("researchLog"), str) and via["researchLog"], via)

# Vehicle as an array (mean used): mean([80,120]) = 100 -> identical result.
via2 = run(
    {
        "task": "atp_luminescence_viability",
        "luminescence": [50.0, 100.0],
        "vehicleControl": [80.0, 120.0],
    }
)
check("viability vehicle-array mean == 75.0", abs(via2["meanViability"] - 75.0) < 1e-6, via2)

# blank shifts the scale: lum=[60], vehicle=110, blank=10 -> 100*(60-10)/(110-10)=50.
via3 = run(
    {
        "task": "atp_luminescence_viability",
        "luminescence": [60.0],
        "vehicleControl": 110.0,
        "blank": 10.0,
    }
)
check("viability blank-corrected == 50.0", abs(via3["meanViability"] - 50.0) < 1e-6, via3)

# Zero denominator -> honest error.
check(
    "viability zero denom -> error",
    run(
        {
            "task": "atp_luminescence_viability",
            "luminescence": [10.0],
            "vehicleControl": 5.0,
            "blank": 5.0,
        }
    ).get("status")
    == "error",
)

# --- Task 3: vcog_ctcae_grade ----------------------------------------------
# Ground truth (hardcoded VCOG-CTCAE v1.1 table):
#   neutropenia value 700 /uL -> 500 <= 700 < 1000 -> Grade 3.
g3 = run({"task": "vcog_ctcae_grade", "parameter": "neutropenia", "value": 700})
check("vcog neutropenia status success", g3.get("status") == "success", g3)
check("vcog neutropenia 700 -> grade 3", g3["grade"] == 3, g3)
check(
    "vcog grade 3 described as Severe",
    "Severe" in g3["gradeDescription"] and "3" in g3["gradeDescription"],
    g3,
)
check("vcog has researchLog", isinstance(g3.get("researchLog"), str) and g3["researchLog"], g3)

# neutropenia 300 /uL (<500) -> Grade 4.
g4 = run({"task": "vcog_ctcae_grade", "parameter": "neutropenia", "value": 300})
check("vcog neutropenia 300 -> grade 4", g4["grade"] == 4, g4)

# neutropenia 5000 /uL (>= LLN 3000) -> Grade 0.
g0 = run({"task": "vcog_ctcae_grade", "parameter": "neutropenia", "value": 5000})
check("vcog neutropenia 5000 -> grade 0", g0["grade"] == 0, g0)

# ALT increase 10x ULN -> >5 and <=20 -> Grade 3.
alt = run({"task": "vcog_ctcae_grade", "parameter": "alt_increase", "value": 10})
check("vcog ALT 10xULN -> grade 3", alt["grade"] == 3, alt)

# Unknown parameter -> honest error.
check(
    "vcog unknown parameter -> error",
    run({"task": "vcog_ctcae_grade", "parameter": "notaparam", "value": 1}).get("status") == "error",
)

# --- Task 4: alpha_particle_dosimetry --------------------------------------
# Ground truth: 1e9 * 5.0 * 1.602e-13 / 0.001 = 0.801 Gy.
dose = run(
    {
        "task": "alpha_particle_dosimetry",
        "cumulatedActivity_Bq_s": 1e9,
        "energyPerDecay_MeV": 5.0,
        "organMass_kg": 0.001,
        "absorbedFraction": 1.0,
    }
)
check("dosimetry status success", dose.get("status") == "success", dose)
check("dosimetry dose == 0.801 Gy", abs(dose["absorbedDoseGy"] - 0.801) < 1e-3, dose)
check("dosimetry has researchLog", isinstance(dose.get("researchLog"), str) and dose["researchLog"], dose)

# absorbedFraction default is 1.0 -> same answer without the field.
dose2 = run(
    {
        "task": "alpha_particle_dosimetry",
        "cumulatedActivity_Bq_s": 1e9,
        "energyPerDecay_MeV": 5.0,
        "organMass_kg": 0.001,
    }
)
check("dosimetry default AF=1 -> 0.801 Gy", abs(dose2["absorbedDoseGy"] - 0.801) < 1e-3, dose2)

# Half absorbed fraction -> half dose.
dose3 = run(
    {
        "task": "alpha_particle_dosimetry",
        "cumulatedActivity_Bq_s": 1e9,
        "energyPerDecay_MeV": 5.0,
        "organMass_kg": 0.001,
        "absorbedFraction": 0.5,
    }
)
check("dosimetry AF=0.5 -> 0.4005 Gy", abs(dose3["absorbedDoseGy"] - 0.4005) < 1e-3, dose3)

# Zero mass -> honest error.
check(
    "dosimetry zero mass -> error",
    run(
        {
            "task": "alpha_particle_dosimetry",
            "cumulatedActivity_Bq_s": 1e9,
            "energyPerDecay_MeV": 5.0,
            "organMass_kg": 0.0,
        }
    ).get("status")
    == "error",
)

# --- Unknown task -> honest error ------------------------------------------
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")

print(f"\nALL {passed} PHARMACOLOGY-ASSAY TESTS PASSED")
