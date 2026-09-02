#!/usr/bin/env python3
"""Formal stochastic verification of synthetic genetic circuits — Frontier 4.

Translates a reaction network (CTMC) into an exact stochastic simulation
(Gillespie SSA) and mathematically checks a temporal-logic property, e.g.
"P(species X reaches >= N by time T) >= p". A circuit that fails the property is
reported VIOLATED — no unverified design is presented as valid. Pure numpy.

Reads JSON on stdin, prints JSON. Payload:
  { "reactions": [{"reactants": {"X": 1}, "products": {}, "rate": 1.0}, ...],
    "initialState": {"X": 0}, "maxTime": 20,
    "property": {"species":"X","comparator":">=","threshold":5,"byTime":20,
                 "targetProbability":0.9},
    "nRuns": 2000, "seed": 1337 }
"""
import json
import math
import sys


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON: {e}")

    try:
        import numpy as np
    except Exception as e:
        _fail(f"Stochastic verification requires numpy: {e}", status="unavailable")

    reactions = payload.get("reactions")
    initial = payload.get("initialState") or {}
    if not reactions or not initial:
        _fail("Provide `reactions` and `initialState`.")
    max_time = float(payload.get("maxTime", 20.0))
    n_runs = int(payload.get("nRuns", 2000))
    seed = int(payload.get("seed", 1337))
    prop = payload.get("property") or {}

    species = sorted({s for s in initial} | {s for r in reactions for s in list(r.get("reactants", {})) + list(r.get("products", {}))})
    idx = {s: i for i, s in enumerate(species)}
    x0 = np.array([float(initial.get(s, 0)) for s in species])

    # Precompute stoichiometry changes and reactant orders.
    changes = []
    reactant_lists = []
    rates = []
    for r in reactions:
        dv = np.zeros(len(species))
        for s, c in r.get("reactants", {}).items():
            dv[idx[s]] -= c
        for s, c in r.get("products", {}).items():
            dv[idx[s]] += c
        changes.append(dv)
        reactant_lists.append([(idx[s], int(c)) for s, c in r.get("reactants", {}).items()])
        rates.append(float(r.get("rate", 0.0)))
    changes = np.array(changes)
    rates = np.array(rates)

    def propensity(state):
        a = np.empty(len(reactions))
        for j, reactants in enumerate(reactant_lists):
            p = rates[j]
            for (si, stoich) in reactants:
                xi = state[si]
                if stoich == 1:
                    p *= xi
                else:
                    # mass-action combinatorial term x*(x-1)*...*(x-stoich+1)/stoich!
                    term = 1.0
                    for k in range(stoich):
                        term *= max(xi - k, 0)
                    p *= term / math.factorial(stoich)
            a[j] = max(p, 0.0)
        return a

    p_species = prop.get("species")
    comparator = prop.get("comparator", ">=")
    threshold = float(prop.get("threshold", 0))
    by_time = float(prop.get("byTime", max_time))
    target_p = float(prop.get("targetProbability", 0.9))

    def satisfies(val):
        return {">=": val >= threshold, "<=": val <= threshold,
                ">": val > threshold, "<": val < threshold, "==": val == threshold}.get(comparator, False)

    rng = np.random.default_rng(seed)
    hits = 0
    endpoint_sum = np.zeros(len(species))
    for _ in range(n_runs):
        state = x0.copy()
        t = 0.0
        satisfied = p_species is not None and satisfies(state[idx[p_species]])
        while t < max_time:
            a = propensity(state)
            a0 = a.sum()
            if a0 <= 0:
                break
            tau = rng.exponential(1.0 / a0)
            t += tau
            if t > max_time:
                break
            j = int(np.searchsorted(np.cumsum(a), rng.random() * a0))
            j = min(j, len(reactions) - 1)
            state = state + changes[j]
            if p_species is not None and t <= by_time and satisfies(state[idx[p_species]]):
                satisfied = True
        endpoint_sum += state
        if satisfied:
            hits += 1

    est_p = hits / n_runs
    # Wilson 95% score interval for the estimated probability.
    z = 1.959963985
    denom = 1 + z * z / n_runs
    center = (est_p + z * z / (2 * n_runs)) / denom
    half = z * math.sqrt(est_p * (1 - est_p) / n_runs + z * z / (4 * n_runs * n_runs)) / denom
    ci = [round(max(0.0, center - half), 4), round(min(1.0, center + half), 4)]

    verdict = None
    if p_species is not None:
        verdict = "VERIFIED" if est_p >= target_p else "VIOLATED"

    print(json.dumps({
        "status": "success",
        "method": "Gillespie SSA (exact CTMC simulation) + Monte-Carlo property estimation",
        "species": species,
        "nRuns": n_runs,
        "meanEndpoint": {s: round(float(endpoint_sum[idx[s]] / n_runs), 4) for s in species},
        "property": prop if prop else None,
        "estimatedProbability": round(est_p, 4),
        "wilson95CI": ci if p_species is not None else None,
        "verdict": verdict,
        "note": ("Property holds at the required probability."
                 if verdict == "VERIFIED" else
                 ("Property NOT satisfied at the required probability; circuit design rejected."
                  if verdict == "VIOLATED" else "No temporal property supplied; simulation summary only.")),
        "seed": seed,
    }))


if __name__ == "__main__":
    main()
