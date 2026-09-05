#!/usr/bin/env python3
"""Physiological biosignal analysis (numpy + scipy.signal) — one dispatch.

Tasks:
- abr_waveform_p1_metrics   : auditory brainstem response (ABR) peak metrics.
- calcium_transient_dynamics: Ca2+ transient baseline / peak / decay-tau fit.
- hemodynamic_waveform      : arterial pressure systolic/diastolic/MAP/HR.

Reads a JSON payload on stdin and writes a single JSON object on stdout.
Zero-hallucination: every reported number is produced by executing real
numpy / scipy code on the caller's real data — nothing is fabricated. When a
value cannot be computed the task returns an explicit honest error.

Design adapted from the Apache-2.0 Biomni physiology tools
(analyze_abr_waveform_p1_metrics, analyze_endolysosomal_calcium_dynamics,
analyze_hemodynamic_data); reimplemented cleanly and independently.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _arr(p, key):
    """Fetch a required 1-D numeric array from the payload as a numpy array."""
    import numpy as np

    v = p.get(key)
    if v is None:
        _fail(f"`{key}` is required.")
    try:
        a = np.asarray(v, dtype=float).ravel()
    except Exception as e:
        _fail(f"`{key}` must be numeric: {e}")
    if a.size == 0:
        _fail(f"`{key}` must be non-empty.")
    if not np.all(np.isfinite(a)):
        _fail(f"`{key}` must contain only finite numbers.")
    return a


def _sampling_rate(p):
    """Fetch and validate a required positive `samplingRateHz`."""
    fs = p.get("samplingRateHz")
    if fs is None:
        _fail("`samplingRateHz` is required.")
    try:
        fs = float(fs)
    except Exception as e:
        _fail(f"`samplingRateHz` must be numeric: {e}")
    if not (fs > 0):
        _fail("`samplingRateHz` must be a positive number.")
    return fs


def _rsquared(y, yhat):
    import numpy as np

    y = np.asarray(y, float)
    yhat = np.asarray(yhat, float)
    ss_res = float(np.sum((y - yhat) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    if ss_tot == 0.0:
        return 1.0 if ss_res == 0.0 else 0.0
    return 1.0 - ss_res / ss_tot


# --------------------------------------------------------------------------- #
# 1. Auditory brainstem response (ABR) — P1 peak metrics
# --------------------------------------------------------------------------- #
def abr_waveform_p1_metrics(p):
    import numpy as np
    from scipy.signal import find_peaks

    sig = _arr(p, "signal")
    fs = _sampling_rate(p)
    n = sig.shape[0]
    if n < 3:
        _fail("`signal` needs at least 3 samples to detect a peak.")

    peaks, _ = find_peaks(sig)
    if peaks.size == 0:
        _fail("no positive peaks detected in `signal`.")

    # Dominant (P1) peak = the local maximum with the largest amplitude.
    dom = int(peaks[int(np.argmax(sig[peaks]))])
    p1_latency_ms = dom / fs * 1000.0
    p1_value = float(sig[dom])

    # Following trough = first local minimum after P1 (else the post-peak min).
    troughs, _ = find_peaks(-sig)
    after = troughs[troughs > dom]
    if after.size > 0:
        trough_val = float(sig[int(after[0])])
    elif dom < n - 1:
        trough_val = float(sig[dom + 1:].min())
    else:
        trough_val = p1_value
    p1_amplitude_uv = p1_value - trough_val

    peak_latencies = [round(float(idx) / fs * 1000.0, 8) for idx in peaks]

    result = {
        "status": "success",
        "analysis": (
            f"ABR P1 metrics: dominant positive peak at {p1_latency_ms:.4g} ms "
            f"(amplitude {p1_amplitude_uv:.4g} uV, peak-to-following-trough), "
            f"{int(peaks.size)} peak(s) detected."
        ),
        "p1LatencyMs": round(p1_latency_ms, 8),
        "p1AmplitudeUv": round(p1_amplitude_uv, 8),
        "p1PeakValue": round(p1_value, 8),
        "peakCount": int(peaks.size),
        "peakLatenciesMs": peak_latencies,
        "samplingRateHz": fs,
        "nSamples": int(n),
    }
    result["researchLog"] = (
        "## ABR P1 waveform metrics\n\n"
        f"- sampling rate **{fs:g} Hz** over **{n}** samples\n"
        f"- peaks detected (scipy.signal.find_peaks): **{int(peaks.size)}**\n"
        f"- dominant P1 latency **{p1_latency_ms:.6g} ms**\n"
        f"- P1 amplitude (peak - following trough) **{p1_amplitude_uv:.6g} uV**\n"
        f"- all peak latencies (ms): {peak_latencies}\n"
    )
    return result


# --------------------------------------------------------------------------- #
# 2. Calcium transient dynamics
# --------------------------------------------------------------------------- #
def calcium_transient_dynamics(p):
    import numpy as np
    from scipy.optimize import curve_fit

    t = _arr(p, "time")
    sig = _arr(p, "signal")
    if t.shape != sig.shape:
        _fail("`time` and `signal` must have the same length.")
    if t.shape[0] < 5:
        _fail("calcium transient analysis needs at least 5 samples.")

    order = np.argsort(t)
    t = t[order]
    sig = sig[order]

    peak_idx = int(np.argmax(sig))
    t_peak = float(t[peak_idx])
    peak_val = float(sig[peak_idx])

    # Baseline: mean of the pre-peak samples (fall back to global min).
    if peak_idx > 0:
        baseline = float(np.mean(sig[:peak_idx]))
    else:
        baseline = float(sig.min())

    peak_amplitude = peak_val - baseline
    time_to_peak_s = t_peak - float(t[0])

    # Exponential decay fit on the post-peak segment: y = A*exp(-t'/tau) + C.
    decay_t = t[peak_idx:] - t_peak
    decay_y = sig[peak_idx:]
    decay_tau = None
    r2 = None
    fit_a = fit_c = None
    if decay_t.size >= 4:
        def _decay(tt, a, tau, c):
            return a * np.exp(-tt / tau) + c

        span = float(decay_t[-1])
        a0 = float(decay_y[0] - decay_y[-1])
        if a0 == 0.0:
            a0 = peak_amplitude if peak_amplitude != 0.0 else 1.0
        tau0 = span / 3.0 if span > 0 else 1.0
        c0 = float(decay_y[-1])
        try:
            popt, _ = curve_fit(
                _decay, decay_t, decay_y, p0=[a0, tau0, c0],
                bounds=([-np.inf, 1e-12, -np.inf], [np.inf, np.inf, np.inf]),
                maxfev=100000,
            )
            fit_a, decay_tau, fit_c = (float(v) for v in popt)
            r2 = _rsquared(decay_y, _decay(decay_t, *popt))
        except Exception:
            decay_tau = None
            r2 = None

    result = {
        "status": "success",
        "analysis": (
            f"Calcium transient: baseline {baseline:.4g}, peak amplitude "
            f"{peak_amplitude:.4g}, time-to-peak {time_to_peak_s:.4g} s, "
            + (f"decay tau {decay_tau:.4g} s (R^2={r2:.4g})."
               if decay_tau is not None else "decay fit unavailable.")
        ),
        "baseline": round(baseline, 8),
        "peakValue": round(peak_val, 8),
        "peakAmplitude": round(peak_amplitude, 8),
        "timeToPeakS": round(time_to_peak_s, 8),
        "decayTauS": (round(decay_tau, 8) if decay_tau is not None else None),
        "rSquared": (round(r2, 8) if r2 is not None else None),
        "decayA": (round(fit_a, 8) if fit_a is not None else None),
        "decayC": (round(fit_c, 8) if fit_c is not None else None),
        "nSamples": int(t.shape[0]),
    }
    result["researchLog"] = (
        "## Calcium transient dynamics\n\n"
        f"- samples: **{t.shape[0]}**\n"
        f"- baseline (pre-peak mean) **{baseline:.6g}**\n"
        f"- peak value **{peak_val:.6g}**, amplitude **{peak_amplitude:.6g}**\n"
        f"- time-to-peak **{time_to_peak_s:.6g} s**\n"
        + (f"- decay time constant **tau = {decay_tau:.6g} s** "
           f"(A*exp(-t/tau)+C fit, R^2 = {r2:.6g})\n"
           if decay_tau is not None else "- decay fit: unavailable\n")
    )
    return result


# --------------------------------------------------------------------------- #
# 3. Hemodynamic (arterial pressure) waveform metrics
# --------------------------------------------------------------------------- #
def hemodynamic_waveform(p):
    import numpy as np
    from scipy.signal import find_peaks

    sig = _arr(p, "signal")
    fs = _sampling_rate(p)
    n = sig.shape[0]
    if n < 3:
        _fail("`signal` needs at least 3 samples to detect beats.")

    peaks, _ = find_peaks(sig)
    if peaks.size < 2:
        _fail("could not detect at least 2 systolic beats in `signal`.")
    troughs, _ = find_peaks(-sig)

    systolic = float(np.mean(sig[peaks]))
    diastolic = float(np.mean(sig[troughs])) if troughs.size > 0 else float(sig.min())
    mean_arterial = diastolic + (systolic - diastolic) / 3.0

    intervals_s = np.diff(peaks) / fs
    mean_interval = float(np.mean(intervals_s))
    heart_rate_bpm = 60.0 / mean_interval if mean_interval > 0 else 0.0
    beat_count = int(peaks.size)

    result = {
        "status": "success",
        "analysis": (
            f"Hemodynamic waveform: SBP {systolic:.4g}, DBP {diastolic:.4g}, "
            f"MAP {mean_arterial:.4g}, HR {heart_rate_bpm:.4g} bpm over "
            f"{beat_count} detected beats."
        ),
        "systolicPressure": round(systolic, 8),
        "diastolicPressure": round(diastolic, 8),
        "meanArterialPressure": round(mean_arterial, 8),
        "heartRateBpm": round(heart_rate_bpm, 8),
        "beatCount": beat_count,
        "meanInterBeatIntervalS": round(mean_interval, 8),
        "samplingRateHz": fs,
        "nSamples": int(n),
    }
    result["researchLog"] = (
        "## Hemodynamic waveform analysis\n\n"
        f"- sampling rate **{fs:g} Hz** over **{n}** samples\n"
        f"- systolic peaks detected: **{beat_count}**, troughs: **{int(troughs.size)}**\n"
        f"- systolic pressure (mean of peaks) **{systolic:.6g}**\n"
        f"- diastolic pressure (mean of troughs) **{diastolic:.6g}**\n"
        f"- mean arterial pressure (DBP + (SBP-DBP)/3) **{mean_arterial:.6g}**\n"
        f"- mean inter-beat interval **{mean_interval:.6g} s** "
        f"-> heart rate **{heart_rate_bpm:.6g} bpm**\n"
    )
    return result


TASKS = {
    "abr_waveform_p1_metrics": abr_waveform_p1_metrics,
    "calcium_transient_dynamics": calcium_transient_dynamics,
    "hemodynamic_waveform": hemodynamic_waveform,
}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}")
    task = payload.get("task")
    if task not in TASKS:
        _fail(f"Unknown task {task!r}. Available: {', '.join(TASKS)}.")
    try:
        import numpy  # noqa: F401
        import scipy  # noqa: F401
    except Exception as e:
        _fail(f"biosignal_tools requires numpy+scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
