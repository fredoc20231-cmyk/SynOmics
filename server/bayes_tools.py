#!/usr/bin/env python3
"""Bayesian inference (numpy/scipy) — one dispatch."""
import json
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def task_beta_binomial_update(p):
    """Beta(a,b) prior conjugate-updated by Binomial(successes/trials)."""
    from scipy import stats

    a = float(p.get("priorAlpha", 1))
    b = float(p.get("priorBeta", 1))
    if a <= 0 or b <= 0:
        _fail("priorAlpha and priorBeta must be > 0.")
    if "successes" not in p or "trials" not in p:
        _fail("beta_binomial_update requires 'successes' and 'trials'.")
    try:
        successes = int(p["successes"])
        trials = int(p["trials"])
    except (TypeError, ValueError):
        _fail("'successes' and 'trials' must be integers.")
    if trials < 0 or successes < 0 or successes > trials:
        _fail("Require 0 <= successes <= trials and trials >= 0.")

    post_a = a + successes
    post_b = b + (trials - successes)
    post_mean = post_a / (post_a + post_b)
    if post_a > 1 and post_b > 1:
        post_mode = (post_a - 1) / (post_a + post_b - 2)
    else:
        post_mode = None
    lo = float(stats.beta.ppf(0.025, post_a, post_b))
    hi = float(stats.beta.ppf(0.975, post_a, post_b))
    return {
        "status": "success",
        "analysis": "beta_binomial_update",
        "priorAlpha": a,
        "priorBeta": b,
        "successes": successes,
        "trials": trials,
        "posteriorAlpha": post_a,
        "posteriorBeta": post_b,
        "posteriorMean": post_mean,
        "posteriorMode": post_mode,
        "credibleInterval": [lo, hi],
        "credibleLevel": 0.95,
    }


def task_normal_normal_update(p):
    """Normal prior on the mean with KNOWN data variance (conjugate)."""
    import numpy as np
    from scipy import stats

    if "priorMean" not in p or "priorVar" not in p:
        _fail("normal_normal_update requires 'priorMean' and 'priorVar'.")
    prior_mean = float(p["priorMean"])
    prior_var = float(p["priorVar"])
    if prior_var <= 0:
        _fail("priorVar must be > 0.")

    if "data" in p and p["data"] is not None:
        data = np.asarray(p["data"], dtype=float)
        if data.size == 0:
            _fail("'data' array is empty.")
        n = int(data.size)
        data_mean = float(data.mean())
        # sigma^2 = known variance of a single observation
        if "sigma2" in p and p["sigma2"] is not None:
            sigma2 = float(p["sigma2"])
        elif "dataVar" in p and p["dataVar"] is not None:
            # dataVar interpreted as variance of a single obs when data given
            sigma2 = float(p["dataVar"])
        else:
            if data.size < 2:
                _fail("Need >=2 data points or explicit 'sigma2' for variance.")
            sigma2 = float(data.var(ddof=1))
    else:
        if "dataMean" not in p:
            _fail("normal_normal_update requires 'dataMean' (or a 'data' array).")
        data_mean = float(p["dataMean"])
        n = int(p.get("n", 1))
        if n <= 0:
            _fail("'n' must be a positive integer.")
        # sigma2 = variance of a single observation
        if "sigma2" in p and p["sigma2"] is not None:
            sigma2 = float(p["sigma2"])
        elif "dataVar" in p and p["dataVar"] is not None:
            # dataVar interpreted as sigma^2 (variance of one observation)
            sigma2 = float(p["dataVar"])
        else:
            _fail("Provide 'sigma2' (or 'dataVar') for known data variance.")
    if sigma2 <= 0:
        _fail("Data variance (sigma2) must be > 0.")

    prior_prec = 1.0 / prior_var
    data_prec = n / sigma2
    post_prec = prior_prec + data_prec
    post_var = 1.0 / post_prec
    post_mean = (prior_prec * prior_mean + data_prec * data_mean) / post_prec
    sd = post_var ** 0.5
    lo = float(stats.norm.ppf(0.025, loc=post_mean, scale=sd))
    hi = float(stats.norm.ppf(0.975, loc=post_mean, scale=sd))
    return {
        "status": "success",
        "analysis": "normal_normal_update",
        "priorMean": prior_mean,
        "priorVar": prior_var,
        "dataMean": data_mean,
        "sigma2": sigma2,
        "n": n,
        "posteriorMean": post_mean,
        "posteriorVar": post_var,
        "posteriorSD": sd,
        "credibleInterval": [lo, hi],
        "credibleLevel": 0.95,
    }


def task_poisson_gamma_update(p):
    """Gamma(shape,rate) prior conjugate-updated by Poisson counts."""
    import numpy as np
    from scipy import stats

    if "priorShape" not in p or "priorRate" not in p:
        _fail("poisson_gamma_update requires 'priorShape' and 'priorRate'.")
    shape = float(p["priorShape"])
    rate = float(p["priorRate"])
    if shape <= 0 or rate <= 0:
        _fail("priorShape and priorRate must be > 0.")

    if "counts" in p and p["counts"] is not None:
        counts = np.asarray(p["counts"], dtype=float)
        if counts.size == 0:
            _fail("'counts' array is empty.")
        if np.any(counts < 0):
            _fail("All counts must be non-negative.")
        sum_counts = float(counts.sum())
        n_obs = int(counts.size)
    elif "sumCounts" in p and "nObs" in p:
        sum_counts = float(p["sumCounts"])
        n_obs = int(p["nObs"])
        if sum_counts < 0 or n_obs <= 0:
            _fail("Require sumCounts >= 0 and nObs > 0.")
    else:
        _fail("Provide 'counts' list OR both 'sumCounts' and 'nObs'.")

    post_shape = shape + sum_counts
    post_rate = rate + n_obs
    post_mean = post_shape / post_rate
    lo = float(stats.gamma.ppf(0.025, post_shape, scale=1.0 / post_rate))
    hi = float(stats.gamma.ppf(0.975, post_shape, scale=1.0 / post_rate))
    return {
        "status": "success",
        "analysis": "poisson_gamma_update",
        "priorShape": shape,
        "priorRate": rate,
        "sumCounts": sum_counts,
        "nObs": n_obs,
        "posteriorShape": post_shape,
        "posteriorRate": post_rate,
        "posteriorMean": post_mean,
        "credibleInterval": [lo, hi],
        "credibleLevel": 0.95,
    }


def task_bayesian_ab_test(p):
    """Monte-Carlo comparison of two Beta posteriors from conversion data."""
    import numpy as np

    for k in ("successesA", "trialsA", "successesB", "trialsB"):
        if k not in p:
            _fail(f"bayesian_ab_test requires '{k}'.")
    try:
        sa = int(p["successesA"])
        ta = int(p["trialsA"])
        sb = int(p["successesB"])
        tb = int(p["trialsB"])
    except (TypeError, ValueError):
        _fail("successes/trials must be integers.")
    if min(sa, ta, sb, tb) < 0 or sa > ta or sb > tb:
        _fail("Require 0 <= successes <= trials for both arms.")

    a0 = float(p.get("priorAlpha", 1))
    b0 = float(p.get("priorBeta", 1))
    if a0 <= 0 or b0 <= 0:
        _fail("priorAlpha and priorBeta must be > 0.")
    n_samples = int(p.get("nSamples", 100000))
    if n_samples <= 0:
        _fail("'nSamples' must be positive.")
    seed = int(p.get("seed", 0))

    post_a_alpha = a0 + sa
    post_a_beta = b0 + (ta - sa)
    post_b_alpha = a0 + sb
    post_b_beta = b0 + (tb - sb)

    rng = np.random.default_rng(seed)
    draws_a = rng.beta(post_a_alpha, post_a_beta, size=n_samples)
    draws_b = rng.beta(post_b_alpha, post_b_beta, size=n_samples)
    prob_b_gt_a = float(np.mean(draws_b > draws_a))
    mean_a = post_a_alpha / (post_a_alpha + post_a_beta)
    mean_b = post_b_alpha / (post_b_alpha + post_b_beta)
    expected_uplift = float(np.mean(draws_b - draws_a))
    return {
        "status": "success",
        "analysis": "bayesian_ab_test",
        "posteriorA": [post_a_alpha, post_a_beta],
        "posteriorB": [post_b_alpha, post_b_beta],
        "probBGreaterA": prob_b_gt_a,
        "meanA": mean_a,
        "meanB": mean_b,
        "expectedUplift": expected_uplift,
        "nSamples": n_samples,
        "seed": seed,
    }


def task_bayes_factor_bic(p):
    """BIC-approximation Bayes factor for nested model comparison."""
    import math

    if "bic0" not in p or "bic1" not in p:
        _fail("bayes_factor_bic requires 'bic0' and 'bic1'.")
    try:
        bic0 = float(p["bic0"])
        bic1 = float(p["bic1"])
    except (TypeError, ValueError):
        _fail("'bic0' and 'bic1' must be numbers.")

    log_bf10 = (bic0 - bic1) / 2.0
    bf10 = math.exp(log_bf10)
    log10_bf = log_bf10 / math.log(10.0)

    # Jeffreys / Kass-Raftery scale on |log10 BF10| (direction-aware label)
    absl = abs(log10_bf)
    if absl < 0.5:
        strength = "anecdotal"
    elif absl < 1.0:
        strength = "substantial"
    elif absl < 2.0:
        strength = "strong"
    else:
        strength = "decisive"
    if absl < 0.5:
        category = "anecdotal"
    else:
        direction = "H1" if log10_bf > 0 else "H0"
        category = f"{strength} for {direction}"
    return {
        "status": "success",
        "analysis": "bayes_factor_bic",
        "bic0": bic0,
        "bic1": bic1,
        "bayesFactor10": bf10,
        "log10BF": log10_bf,
        "evidenceCategory": category,
    }


TASKS = {
    "beta_binomial_update": task_beta_binomial_update,
    "normal_normal_update": task_normal_normal_update,
    "poisson_gamma_update": task_poisson_gamma_update,
    "bayesian_ab_test": task_bayesian_ab_test,
    "bayes_factor_bic": task_bayes_factor_bic,
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
    except Exception as e:
        _fail(f"bayes_tools requires numpy/scipy: {e}", status="unavailable")
    print(json.dumps(TASKS[task](payload)))


if __name__ == "__main__":
    main()
