#!/usr/bin/env python3
"""Pharmacology & pathology assay tools — single-dispatch JSON on stdin/stdout.

Zero-hallucination: every reported number is computed by real arithmetic /
statistics on the caller-supplied data. Nothing is fabricated; when a required
dependency is missing the task returns an honest ``status: "unavailable"`` and
when an input is malformed it returns an honest ``status: "error"``.

Tasks
-----
- ``xenograft_tgi``               : tumor growth inhibition (TGI%) + Welch t-test
- ``atp_luminescence_viability``  : CellTiter-Glo-style % viability from luminescence
- ``vcog_ctcae_grade``            : map a lab/clinical value to a VCOG-CTCAE grade
- ``alpha_particle_dosimetry``    : MIRD-style alpha absorbed dose (Gy)

Design adapted from the Apache-2.0 Biomni pharmacology/pathology tooling and
reimplemented cleanly. Reads a JSON payload on stdin and prints one JSON object
on stdout.
"""
import json
import sys

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _fail(msg, status="error"):
    """Print an honest error/unavailable envelope and exit cleanly (code 0)."""
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _as_number(x, name):
    try:
        v = float(x)
    except (TypeError, ValueError):
        _fail(f"`{name}` must be a number, got {x!r}.")
    import math

    if not math.isfinite(v):
        _fail(f"`{name}` must be a finite number, got {x!r}.")
    return v


# ---------------------------------------------------------------------------
# Task 1 — xenograft tumor growth inhibition (numpy / scipy)
# ---------------------------------------------------------------------------


def task_xenograft_tgi(p):
    import numpy as np

    treated_in = p.get("treatedVolumes")
    control_in = p.get("controlVolumes")
    if treated_in is None or control_in is None:
        _fail("Provide `treatedVolumes` and `controlVolumes` (1D means or 2D animals x timepoints).")
    try:
        treated = np.asarray(treated_in, dtype=float)
        control = np.asarray(control_in, dtype=float)
    except Exception as e:  # noqa: BLE001 - report the exact conversion failure
        _fail(f"`treatedVolumes`/`controlVolumes` must be numeric arrays: {e}")

    if treated.ndim not in (1, 2) or control.ndim not in (1, 2):
        _fail("Volumes must be 1D (mean per timepoint) or 2D (animals x timepoints).")
    if treated.ndim != control.ndim:
        _fail(
            f"`treatedVolumes` (ndim={treated.ndim}) and `controlVolumes` "
            f"(ndim={control.ndim}) must share the same shape kind."
        )
    if treated.size == 0 or control.size == 0:
        _fail("Volume arrays must be non-empty.")
    if not (np.all(np.isfinite(treated)) and np.all(np.isfinite(control))):
        _fail("All tumor volumes must be finite numbers.")

    is_2d = treated.ndim == 2
    if is_2d:
        if treated.shape[1] < 2 or control.shape[1] < 2:
            _fail("2D volumes need >=2 timepoints (columns) per animal.")
        treated_mean_series = treated.mean(axis=0)
        control_mean_series = control.mean(axis=0)
        treated_final_wells = treated[:, -1]
        control_final_wells = control[:, -1]
        n_timepoints = int(treated.shape[1])
    else:
        if treated.shape[0] < 2 or control.shape[0] < 2:
            _fail("1D volumes need >=2 timepoints.")
        treated_mean_series = treated
        control_mean_series = control
        treated_final_wells = None
        control_final_wells = None
        n_timepoints = int(treated.shape[0])

    days = p.get("days")
    if days is not None:
        if not isinstance(days, list) or len(days) != n_timepoints:
            _fail(f"`days` must be a list of length {n_timepoints} (one per timepoint).")

    t0 = float(treated_mean_series[0])
    tt = float(treated_mean_series[-1])
    c0 = float(control_mean_series[0])
    ct = float(control_mean_series[-1])

    control_growth = ct - c0
    treated_growth = tt - t0
    if control_growth == 0:
        _fail("Control group shows zero net growth (Ct - C0 == 0); TGI is undefined.")

    tgi_percent = (1.0 - (treated_growth / control_growth)) * 100.0

    if t0 == 0 or c0 == 0:
        _fail("Initial volume of 0 makes fold-change undefined; provide non-zero baseline volumes.")
    treated_fold = tt / t0
    control_fold = ct / c0

    p_value = None
    if is_2d:
        from scipy import stats

        if treated_final_wells.size >= 2 and control_final_wells.size >= 2:
            res = stats.ttest_ind(treated_final_wells, control_final_wells, equal_var=False)
            pv = float(res.pvalue)
            p_value = pv if pv == pv else None  # guard NaN (e.g. zero variance)

    shape_desc = "2D (animals x timepoints)" if is_2d else "1D (mean per timepoint)"
    analysis = (
        f"Tumor growth inhibition from {shape_desc} data over {n_timepoints} timepoints: "
        f"control grew {c0:g} -> {ct:g} (net {control_growth:g}), treated grew {t0:g} -> {tt:g} "
        f"(net {treated_growth:g}) -> TGI = {tgi_percent:.4g}%."
    )
    if p_value is not None:
        analysis += f" Welch t-test on final volumes: p = {p_value:.4g}."

    research_log = (
        "# Xenograft tumor growth inhibition (TGI)\n\n"
        f"Data shape: **{shape_desc}**, {n_timepoints} timepoints"
        + (f", days = {days}" if days is not None else "")
        + ".\n\n"
        "TGI% = (1 - (Tt - T0) / (Ct - C0)) x 100, using group means at the final vs "
        "initial timepoint.\n\n"
        "| Group | Initial mean | Final mean | Net growth | Fold change |\n"
        "| --- | --- | --- | --- | --- |\n"
        f"| Control | {c0:g} | {ct:g} | {control_growth:g} | {control_fold:.4g} |\n"
        f"| Treated | {t0:g} | {tt:g} | {treated_growth:g} | {treated_fold:.4g} |\n\n"
        f"**TGI = {tgi_percent:.4g}%**"
        + (
            f"\n\nWelch's unequal-variance t-test on per-animal **final** volumes "
            f"(treated n={int(treated_final_wells.size)}, control n={int(control_final_wells.size)}): "
            f"p = {p_value:.4g}."
            if p_value is not None
            else "\n\nNo per-animal replicate matrix supplied (1D means), so no t-test was run "
            "(pValue = null)."
        )
    )

    return {
        "status": "success",
        "analysis": analysis,
        "tgiPercent": round(tgi_percent, 10),
        "treatedFoldChange": round(treated_fold, 10),
        "controlFoldChange": round(control_fold, 10),
        "treatedInitialMean": round(t0, 10),
        "treatedFinalMean": round(tt, 10),
        "controlInitialMean": round(c0, 10),
        "controlFinalMean": round(ct, 10),
        "treatedNetGrowth": round(treated_growth, 10),
        "controlNetGrowth": round(control_growth, 10),
        "pValue": (round(p_value, 10) if p_value is not None else None),
        "nTimepoints": n_timepoints,
        "researchLog": research_log,
    }


# ---------------------------------------------------------------------------
# Task 2 — ATP luminescence cell viability (numpy)
# ---------------------------------------------------------------------------


def task_atp_luminescence_viability(p):
    import numpy as np

    lum_in = p.get("luminescence")
    if lum_in is None:
        _fail("Provide `luminescence` (array of treated-well readings).")
    if not isinstance(lum_in, list) or len(lum_in) == 0:
        _fail("`luminescence` must be a non-empty array of numbers.")
    try:
        lum = np.asarray(lum_in, dtype=float)
    except Exception as e:  # noqa: BLE001
        _fail(f"`luminescence` must be numeric: {e}")
    if not np.all(np.isfinite(lum)):
        _fail("`luminescence` values must be finite numbers.")

    vehicle_in = p.get("vehicleControl")
    if vehicle_in is None:
        _fail("Provide `vehicleControl` (number or array; the mean is used).")
    if isinstance(vehicle_in, list):
        if len(vehicle_in) == 0:
            _fail("`vehicleControl` array must be non-empty.")
        try:
            vehicle_arr = np.asarray(vehicle_in, dtype=float)
        except Exception as e:  # noqa: BLE001
            _fail(f"`vehicleControl` must be numeric: {e}")
        if not np.all(np.isfinite(vehicle_arr)):
            _fail("`vehicleControl` values must be finite numbers.")
        vehicle_mean = float(vehicle_arr.mean())
    else:
        vehicle_mean = _as_number(vehicle_in, "vehicleControl")

    blank = _as_number(p.get("blank", 0), "blank")

    denom = vehicle_mean - blank
    if denom == 0:
        _fail("(vehicleControl mean - blank) == 0; percent viability is undefined.")

    viability = (100.0 * (lum - blank) / denom).tolist()
    viability = [round(float(v), 10) for v in viability]
    mean_viability = round(float(np.mean(viability)), 10)

    analysis = (
        f"CellTiter-Glo-style viability from {lum.size} treated wells: "
        f"viability% = 100 x (RLU - blank) / (vehicleMean - blank), "
        f"blank={blank:g}, vehicleMean={vehicle_mean:g}. "
        f"Mean viability = {mean_viability:.4g}%."
    )
    research_log = (
        "# ATP luminescence cell viability\n\n"
        f"n wells = **{lum.size}**; blank = {blank:g}; vehicle (control) mean = "
        f"{vehicle_mean:g}.\n\n"
        "Per-well % viability = 100 x (RLU - blank) / (vehicleMean - blank).\n\n"
        f"**Mean viability = {mean_viability:.4g}%** across the treated wells."
    )

    return {
        "status": "success",
        "analysis": analysis,
        "viabilityPercent": viability,
        "meanViability": mean_viability,
        "vehicleMean": round(vehicle_mean, 10),
        "blank": round(blank, 10),
        "nWells": int(lum.size),
        "researchLog": research_log,
    }


# ---------------------------------------------------------------------------
# Task 3 — VCOG-CTCAE grading (stdlib)
# ---------------------------------------------------------------------------
#
# Hardcoded thresholds follow the Veterinary Cooperative Oncology Group — Common
# Terminology Criteria for Adverse Events (VCOG-CTCAE v1.1, Vet Comp Oncol 2016).
# "decrease" parameters: higher grade = lower value (cytopenia/anemia). "increase"
# parameters: higher grade = higher value (enzyme elevation). LLN/ULN are the
# lower/upper limits of normal; sensible species-agnostic defaults are provided
# and can be overridden via `lowerLimitNormal` / `upperLimitNormal`.
#
#   Neutrophil count decrease (/uL):
#     G1: 1500 - <LLN | G2: 1000 - <1500 | G3: 500 - <1000 | G4: <500
#   Platelet count decrease (/uL):
#     G1: 100000 - <LLN | G2: 50000 - <100000 | G3: 25000 - <50000 | G4: <25000
#   Hemoglobin / anemia (g/dL):
#     G1: 10 - <LLN | G2: 8 - <10 | G3: 6.5 - <8 | G4: <6.5
#   ALT increase (x ULN, value = ratio to ULN):
#     G1: >1 - 3 | G2: >3 - 5 | G3: >5 - 20 | G4: >20
#
# Grade severity meaning: 0 None/WNL, 1 Mild, 2 Moderate, 3 Severe,
# 4 Life-threatening, 5 Death.

_VCOG_DECREASE = {
    "neutropenia": {
        "unit": "cells/uL (neutrophil count)",
        "lln": 3000.0,   # G1 upper bound = lower limit of normal (overridable)
        "g2": 1500.0,    # value < g2 -> at least G2
        "g3": 1000.0,    # value < g3 -> at least G3
        "g4": 500.0,     # value < g4 -> G4
        "desc": "Neutrophil count decrease",
    },
    "thrombocytopenia": {
        "unit": "cells/uL (platelet count)",
        "lln": 200000.0,
        "g2": 100000.0,
        "g3": 50000.0,
        "g4": 25000.0,
        "desc": "Platelet count decrease",
    },
    "anemia": {
        "unit": "g/dL (hemoglobin)",
        "lln": 12.0,
        "g2": 10.0,
        "g3": 8.0,
        "g4": 6.5,
        "desc": "Anemia (hemoglobin decrease)",
    },
}

_VCOG_INCREASE = {
    "alt_increase": {
        "unit": "x ULN (ALT ratio to upper limit of normal)",
        "uln": 1.0,      # value > uln -> at least G1
        "g2": 3.0,       # value > g2 -> at least G2
        "g3": 5.0,       # value > g3 -> at least G3
        "g4": 20.0,      # value > g4 -> G4
        "desc": "ALT (alanine aminotransferase) increase",
    },
}

_GRADE_SEVERITY = {
    0: "None / within normal limits",
    1: "Mild",
    2: "Moderate",
    3: "Severe",
    4: "Life-threatening",
    5: "Death",
}


def task_vcog_ctcae_grade(p):
    parameter = p.get("parameter")
    if not isinstance(parameter, str) or not parameter.strip():
        _fail("Provide `parameter` (e.g. 'neutropenia', 'thrombocytopenia', 'anemia', 'alt_increase').")
    key = parameter.strip().lower()

    known = sorted(set(_VCOG_DECREASE) | set(_VCOG_INCREASE))
    if key not in _VCOG_DECREASE and key not in _VCOG_INCREASE:
        _fail(f"Unknown parameter {parameter!r}. Known VCOG-CTCAE parameters: {', '.join(known)}.")

    value = _as_number(p.get("value"), "value")

    if key in _VCOG_DECREASE:
        thr = dict(_VCOG_DECREASE[key])
        lln = _as_number(p.get("lowerLimitNormal", thr["lln"]), "lowerLimitNormal")
        thr["lln"] = lln
        if value < thr["g4"]:
            grade = 4
        elif value < thr["g3"]:
            grade = 3
        elif value < thr["g2"]:
            grade = 2
        elif value < thr["lln"]:
            grade = 1
        else:
            grade = 0
        boundaries = {
            "lowerLimitNormal": thr["lln"],
            "grade2Below": thr["g2"],
            "grade3Below": thr["g3"],
            "grade4Below": thr["g4"],
        }
        direction = "decrease"
        unit = thr["unit"]
        pdesc = thr["desc"]
    else:
        thr = dict(_VCOG_INCREASE[key])
        uln = _as_number(p.get("upperLimitNormal", thr["uln"]), "upperLimitNormal")
        thr["uln"] = uln
        if value > thr["g4"]:
            grade = 4
        elif value > thr["g3"]:
            grade = 3
        elif value > thr["g2"]:
            grade = 2
        elif value > thr["uln"]:
            grade = 1
        else:
            grade = 0
        boundaries = {
            "upperLimitNormal": thr["uln"],
            "grade2Above": thr["g2"],
            "grade3Above": thr["g3"],
            "grade4Above": thr["g4"],
        }
        direction = "increase"
        unit = thr["unit"]
        pdesc = thr["desc"]

    severity = _GRADE_SEVERITY[grade]
    grade_description = f"Grade {grade} ({severity}) — {pdesc}"

    analysis = (
        f"VCOG-CTCAE v1.1 grading of {pdesc} ({direction}): value = {value:g} {unit} "
        f"-> Grade {grade} ({severity})."
    )
    research_log = (
        "# VCOG-CTCAE adverse-event grade\n\n"
        f"Parameter: **{pdesc}** ({key}); measured value = **{value:g}** {unit}; "
        f"direction = {direction}.\n\n"
        f"Applied VCOG-CTCAE v1.1 thresholds: {boundaries}.\n\n"
        f"**Assigned grade: {grade} ({severity}).**\n\n"
        "Grade 5 (Death) is an outcome, not a lab value, so it is not assigned from a "
        "measurement here."
    )

    return {
        "status": "success",
        "analysis": analysis,
        "parameter": key,
        "value": value,
        "grade": grade,
        "gradeDescription": grade_description,
        "severity": severity,
        "direction": direction,
        "unit": unit,
        "thresholds": boundaries,
        "researchLog": research_log,
    }


# ---------------------------------------------------------------------------
# Task 4 — MIRD-style alpha-particle absorbed dose (stdlib)
# ---------------------------------------------------------------------------

_MEV_TO_JOULE = 1.602e-13  # 1 MeV = 1.602e-13 J


def task_alpha_particle_dosimetry(p):
    cumulated = _as_number(p.get("cumulatedActivity_Bq_s"), "cumulatedActivity_Bq_s")
    energy = _as_number(p.get("energyPerDecay_MeV"), "energyPerDecay_MeV")
    mass = _as_number(p.get("organMass_kg"), "organMass_kg")
    absorbed_fraction = _as_number(p.get("absorbedFraction", 1.0), "absorbedFraction")

    if cumulated < 0:
        _fail("`cumulatedActivity_Bq_s` must be non-negative.")
    if energy < 0:
        _fail("`energyPerDecay_MeV` must be non-negative.")
    if mass <= 0:
        _fail("`organMass_kg` must be > 0.")
    if not (0.0 <= absorbed_fraction <= 1.0):
        _fail("`absorbedFraction` must be in [0, 1].")

    energy_per_decay_j = energy * _MEV_TO_JOULE
    total_energy_j = cumulated * energy_per_decay_j * absorbed_fraction
    dose_gy = total_energy_j / mass  # J/kg = Gy

    analysis = (
        f"MIRD-style alpha absorbed dose: cumulated activity {cumulated:g} Bq*s x "
        f"{energy:g} MeV/decay x {_MEV_TO_JOULE:g} J/MeV x absorbed fraction "
        f"{absorbed_fraction:g} / mass {mass:g} kg = {dose_gy:.6g} Gy."
    )
    research_log = (
        "# Alpha-particle absorbed dose (MIRD schema)\n\n"
        "Absorbed dose D (Gy) = (A~ x E x 1.602e-13 x phi) / m, where A~ is the "
        "cumulated (time-integrated) activity in Bq*s, E the energy released per decay "
        "in MeV, phi the absorbed fraction (~1 for alpha particles: range << organ size, "
        "so essentially all energy deposits locally), and m the organ mass in kg.\n\n"
        "| Quantity | Value |\n| --- | --- |\n"
        f"| Cumulated activity A~ | {cumulated:g} Bq*s |\n"
        f"| Energy per decay E | {energy:g} MeV |\n"
        f"| Energy per decay | {energy_per_decay_j:.6g} J |\n"
        f"| Absorbed fraction phi | {absorbed_fraction:g} |\n"
        f"| Organ mass m | {mass:g} kg |\n"
        f"| Total energy deposited | {total_energy_j:.6g} J |\n"
        f"| **Absorbed dose D** | **{dose_gy:.6g} Gy** |\n"
    )

    return {
        "status": "success",
        "analysis": analysis,
        "absorbedDoseGy": round(dose_gy, 12),
        "totalEnergyJoules": total_energy_j,
        "energyPerDecayJoules": energy_per_decay_j,
        "cumulatedActivity_Bq_s": cumulated,
        "energyPerDecay_MeV": energy,
        "organMass_kg": mass,
        "absorbedFraction": absorbed_fraction,
        "researchLog": research_log,
    }


# ---------------------------------------------------------------------------
# dispatch
# ---------------------------------------------------------------------------

TASKS = {
    "xenograft_tgi": task_xenograft_tgi,
    "atp_luminescence_viability": task_atp_luminescence_viability,
    "vcog_ctcae_grade": task_vcog_ctcae_grade,
    "alpha_particle_dosimetry": task_alpha_particle_dosimetry,
}

# Tasks that require the numpy scientific stack; the rest are pure stdlib.
_NEEDS_NUMPY = {"xenograft_tgi", "atp_luminescence_viability"}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:  # noqa: BLE001
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    if task in _NEEDS_NUMPY:
        try:
            import numpy  # noqa: F401
        except Exception as e:  # noqa: BLE001
            _fail(f"pharmacology_assay_tools task {task!r} requires numpy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
