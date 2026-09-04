#!/usr/bin/env python3
"""Time-series / signal analyses (numpy/scipy/statsmodels) — one dispatch.

Tasks: autocorrelation, cross_correlation, changepoint_cusum, periodicity_fft,
lowess_trend. Reads JSON on stdin.
"""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def _series(p, key="x"):
    import numpy as np
    x = p.get(key)
    if not isinstance(x, list) or len(x) < 3:
        _fail(f"Provide `{key}` (>=3 values).")
    return np.asarray(x, float)


def task_autocorrelation(p):
    import numpy as np
    x = _series(p)
    x = x - x.mean()
    n = len(x)
    maxlag = int(p.get("maxLag", min(n - 1, 20)))
    var = np.dot(x, x)
    acf = [round(float(np.dot(x[: n - k], x[k:]) / var), 6) if var > 0 else 0.0 for k in range(maxlag + 1)]
    return {"status": "success", "analysis": "autocorrelation function", "maxLag": maxlag, "acf": acf}


def task_cross_correlation(p):
    import numpy as np
    x = _series(p, "x"); y = _series(p, "y")
    if len(x) != len(y):
        _fail("x and y must be equal length.")
    x = x - x.mean(); y = y - y.mean()
    maxlag = int(p.get("maxLag", min(len(x) - 1, 20)))
    denom = np.sqrt(np.dot(x, x) * np.dot(y, y))
    ccf = {}
    for k in range(-maxlag, maxlag + 1):
        if k >= 0:
            v = np.dot(x[: len(x) - k], y[k:])
        else:
            v = np.dot(x[-k:], y[: len(y) + k])
        ccf[k] = round(float(v / denom), 6) if denom > 0 else 0.0
    best = max(ccf, key=lambda kk: abs(ccf[kk]))
    return {"status": "success", "analysis": "cross-correlation", "ccf": ccf, "bestLag": int(best), "bestCorr": ccf[best]}


def task_changepoint_cusum(p):
    import numpy as np
    x = _series(p)
    mean = x.mean()
    cusum = np.cumsum(x - mean)
    idx = int(np.argmax(np.abs(cusum)))
    # bootstrap significance
    rng = np.random.default_rng(int(p.get("seed", 0)))
    s_diff = cusum.max() - cusum.min()
    count = 0
    B = int(p.get("nBootstrap", 500))
    for _ in range(B):
        perm = rng.permutation(x)
        c = np.cumsum(perm - mean)
        if (c.max() - c.min()) < s_diff:
            count += 1
    conf = count / B
    return {"status": "success", "analysis": "CUSUM change-point detection",
            "changePointIndex": idx, "confidence": round(conf, 4),
            "significant": bool(conf > 0.95)}


def task_periodicity_fft(p):
    import numpy as np
    x = _series(p)
    x = x - x.mean()
    n = len(x)
    fft = np.abs(np.fft.rfft(x))
    freqs = np.fft.rfftfreq(n, d=float(p.get("dt", 1.0)))
    if len(fft) > 1:
        k = int(np.argmax(fft[1:]) + 1)
        dom_freq = float(freqs[k])
        period = round(1.0 / dom_freq, 4) if dom_freq > 0 else None
    else:
        dom_freq, period = 0.0, None
    return {"status": "success", "analysis": "periodicity (FFT)", "dominantFrequency": round(dom_freq, 6),
            "dominantPeriod": period, "spectrum": [round(float(v), 4) for v in fft]}


def task_lowess_trend(p):
    import numpy as np
    from statsmodels.nonparametric.smoothers_lowess import lowess
    y = _series(p, "y")
    x = p.get("x")
    xa = np.asarray(x, float) if isinstance(x, list) and len(x) == len(y) else np.arange(len(y), dtype=float)
    frac = float(p.get("frac", 0.3))
    sm = lowess(y, xa, frac=frac, return_sorted=False)
    return {"status": "success", "analysis": "LOWESS trend", "frac": frac,
            "smoothed": [round(float(v), 6) for v in sm]}


def task_linear_detrend(p):
    import numpy as np
    y = _series(p, "y")
    x = p.get("x")
    xa = np.asarray(x, float) if isinstance(x, list) and len(x) == len(y) else np.arange(len(y), dtype=float)
    A = np.vstack([xa, np.ones_like(xa)]).T
    (slope, intercept), *_ = np.linalg.lstsq(A, y, rcond=None)
    trend = slope * xa + intercept
    resid = y - trend
    return {"status": "success", "analysis": "linear detrend (least squares)",
            "slope": round(float(slope), 6), "intercept": round(float(intercept), 6),
            "detrended": [round(float(v), 6) for v in resid]}


def task_moving_average(p):
    import numpy as np
    y = _series(p, "y")
    window = int(p.get("window", 3))
    if window < 1 or window > len(y):
        _fail("`window` must be between 1 and len(y).")
    kernel = np.ones(window) / window
    ma = np.convolve(y, kernel, mode="valid")
    return {"status": "success", "analysis": "simple moving average", "window": window,
            "movingAverage": [round(float(v), 6) for v in ma]}


TASKS = {"autocorrelation": task_autocorrelation, "cross_correlation": task_cross_correlation,
         "changepoint_cusum": task_changepoint_cusum, "periodicity_fft": task_periodicity_fft,
         "lowess_trend": task_lowess_trend, "linear_detrend": task_linear_detrend,
         "moving_average": task_moving_average}


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
    except Exception as e:
        _fail(f"timeseries_tools requires numpy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
