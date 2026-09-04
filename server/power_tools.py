#!/usr/bin/env python3
"""Statistical power & sample size (statsmodels/scipy) — one dispatch."""
import json
import math
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def task_sample_size_two_means(p):
    from statsmodels.stats.power import TTestIndPower

    d = p.get("effectSize")
    if d is None:
        _fail("effectSize (Cohen's d) is required")
    d = float(d)
    if d == 0:
        _fail("effectSize must be non-zero")
    alpha = float(p.get("alpha", 0.05))
    power = float(p.get("power", 0.8))
    ratio = float(p.get("ratio", 1))
    alternative = p.get("alternative", "two-sided")
    n = TTestIndPower().solve_power(
        effect_size=d, alpha=alpha, power=power, ratio=ratio, alternative=alternative
    )
    if n is None or not math.isfinite(n):
        _fail("solver failed to converge for the given parameters")
    return {
        "status": "success",
        "analysis": "sample_size_two_means",
        "nPerGroup": int(math.ceil(n)),
        "nPerGroupRaw": float(n),
        "effectSize": d,
        "alpha": alpha,
        "power": power,
        "ratio": ratio,
        "alternative": alternative,
    }


def task_power_two_means(p):
    from statsmodels.stats.power import TTestIndPower

    d = p.get("effectSize")
    n = p.get("nPerGroup")
    if d is None:
        _fail("effectSize (Cohen's d) is required")
    if n is None:
        _fail("nPerGroup is required")
    d = float(d)
    n = float(n)
    alpha = float(p.get("alpha", 0.05))
    ratio = float(p.get("ratio", 1))
    alternative = p.get("alternative", "two-sided")
    power = TTestIndPower().solve_power(
        effect_size=d, nobs1=n, alpha=alpha, ratio=ratio, alternative=alternative
    )
    if power is None or not math.isfinite(power):
        _fail("solver failed to compute power for the given parameters")
    return {
        "status": "success",
        "analysis": "power_two_means",
        "power": float(power),
        "effectSize": d,
        "nPerGroup": n,
        "alpha": alpha,
        "ratio": ratio,
        "alternative": alternative,
    }


def task_sample_size_two_proportions(p):
    from statsmodels.stats.power import NormalIndPower
    from statsmodels.stats.proportion import proportion_effectsize

    p1 = p.get("p1")
    p2 = p.get("p2")
    if p1 is None or p2 is None:
        _fail("p1 and p2 are required")
    p1 = float(p1)
    p2 = float(p2)
    if not (0 < p1 < 1 and 0 < p2 < 1):
        _fail("p1 and p2 must be in (0, 1)")
    if p1 == p2:
        _fail("p1 and p2 must differ")
    alpha = float(p.get("alpha", 0.05))
    power = float(p.get("power", 0.8))
    ratio = float(p.get("ratio", 1))
    alternative = p.get("alternative", "two-sided")
    h = proportion_effectsize(p1, p2)
    n = NormalIndPower().solve_power(
        effect_size=h, alpha=alpha, power=power, ratio=ratio, alternative=alternative
    )
    if n is None or not math.isfinite(n):
        _fail("solver failed to converge for the given parameters")
    return {
        "status": "success",
        "analysis": "sample_size_two_proportions",
        "nPerGroup": int(math.ceil(abs(n))),
        "nPerGroupRaw": float(abs(n)),
        "effectSizeH": float(h),
        "p1": p1,
        "p2": p2,
        "alpha": alpha,
        "power": power,
        "ratio": ratio,
        "alternative": alternative,
    }


def task_power_anova(p):
    from statsmodels.stats.power import FTestAnovaPower

    k = p.get("groups")
    f = p.get("effectSize")
    n = p.get("nPerGroup")
    if k is None:
        _fail("groups (k) is required")
    if f is None:
        _fail("effectSize (Cohen's f) is required")
    if n is None:
        _fail("nPerGroup is required")
    k = int(k)
    f = float(f)
    n = float(n)
    if k < 2:
        _fail("groups must be >= 2")
    alpha = float(p.get("alpha", 0.05))
    nobs = k * n
    power = FTestAnovaPower().solve_power(
        effect_size=f, nobs=nobs, alpha=alpha, k_groups=k
    )
    if power is None or not math.isfinite(power):
        _fail("solver failed to compute power for the given parameters")
    return {
        "status": "success",
        "analysis": "power_anova",
        "power": float(power),
        "groups": k,
        "effectSize": f,
        "nPerGroup": n,
        "nTotal": nobs,
        "alpha": alpha,
    }


def task_sample_size_correlation(p):
    from scipy import stats

    r = p.get("r")
    if r is None:
        _fail("r (Pearson correlation) is required")
    r = float(r)
    if not (-1 < r < 1):
        _fail("r must be in (-1, 1)")
    if r == 0:
        _fail("r must be non-zero")
    alpha = float(p.get("alpha", 0.05))
    power = float(p.get("power", 0.8))
    alternative = p.get("alternative", "two-sided")
    if alternative == "two-sided":
        z_alpha = stats.norm.ppf(1 - alpha / 2)
    elif alternative in ("larger", "smaller", "one-sided"):
        z_alpha = stats.norm.ppf(1 - alpha)
    else:
        _fail(f"Unknown alternative {alternative!r}")
    z_power = stats.norm.ppf(power)
    C = 0.5 * math.log((1 + r) / (1 - r))
    n = ((z_alpha + z_power) / C) ** 2 + 3
    if not math.isfinite(n):
        _fail("could not compute sample size for the given parameters")
    return {
        "status": "success",
        "analysis": "sample_size_correlation",
        "n": int(math.ceil(n)),
        "nRaw": float(n),
        "r": r,
        "alpha": alpha,
        "power": power,
        "alternative": alternative,
    }


TASKS = {
    "sample_size_two_means": task_sample_size_two_means,
    "power_two_means": task_power_two_means,
    "sample_size_two_proportions": task_sample_size_two_proportions,
    "power_anova": task_power_anova,
    "sample_size_correlation": task_sample_size_correlation,
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
        import statsmodels  # noqa: F401
    except Exception as e:
        _fail(f"power_tools requires statsmodels: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
