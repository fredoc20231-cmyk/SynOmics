#!/usr/bin/env python3
"""End-to-end tests for iDiscover Frontier 3 — federated ZKP biomarker discovery.

Validates: (1) a real cross-site survival signal is detected AND cryptographically
verified without sharing raw records; (2) a null biomarker is not called
significant; (3) the pooled log-rank matches an independent reference; (4) the
cryptographic layer is sound — a forged commitment/aggregate fails verification
("mathematically impossible to fake"); (5) honest errors on malformed input.

Pure-Python stdlib only. Run: `python tests/federated_zkp_smoke.py`
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "federated_zkp.py")
sys.path.insert(0, os.path.join(ROOT, "server"))

import federated_zkp as fz  # noqa: E402

passed = 0
def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


def run(payload):
    p = subprocess.run([sys.executable, SCRIPT], input=json.dumps(payload).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(p.stdout.decode())


def ref_site(dur, ev, grp):
    times = sorted(set(t for t, e in zip(dur, ev) if e == 1))
    O = E = V = 0.0
    for t in times:
        risk = [i for i in range(len(dur)) if dur[i] >= t]
        tied = [i for i in range(len(dur)) if dur[i] == t]
        d = sum(1 for i in tied if ev[i] == 1)
        if d == 0:
            continue
        n = len(risk); n1 = sum(1 for i in risk if grp[i] == 1)
        d1 = sum(1 for i in tied if ev[i] == 1 and grp[i] == 1)
        O += d1; E += d * n1 / n
        if n > 1:
            V += d * (n1 / n) * (1 - n1 / n) * (n - d) / (n - 1)
    return O - E, V


# Deterministic synthetic multi-site cohorts (fixtures only; never served to users).
def make_site(seed, n, gap):
    import random
    rnd = random.Random(seed)
    grp = [rnd.randint(0, 1) for _ in range(n)]
    dur = [round(rnd.expovariate(1.0 / (10 if g == 0 else max(1.0, 10 - gap))), 2) for g in grp]
    ev = [1] * n
    return {"durations": dur, "events": ev, "groups": grp}


# 1. Real signal across 3 sites -> significant AND cryptographically verified.
sites = [dict(name=f"S{i}", **make_site(i, 120, 5)) for i in range(3)]
res = run({"sites": sites, "alpha": 0.01})
check("status success", res.get("status") == "success", res)
check("crypto: all ZK proofs valid", res["crypto"]["allZkProofsValid"] is True, res["crypto"])
check("crypto: homomorphic aggregate verified", res["crypto"]["homomorphicAggregateVerified"] is True, res["crypto"])
check("verified aggregate", res["verified"] is True, res)
check("real signal is significant", res["biomarkerSignificant"] is True, res)
check("no raw records shared", all(s["rawRecordsShared"] is False for s in res["sites"]), res["sites"])

# 2. Pooled log-rank matches an independent reference implementation.
ref_oe = sum(ref_site(s["durations"], s["events"], s["groups"])[0] for s in sites)
ref_v = sum(ref_site(s["durations"], s["events"], s["groups"])[1] for s in sites)
check("pooled O-E matches reference", abs(res["pooledObservedMinusExpected"] - ref_oe) < 1e-4, (res["pooledObservedMinusExpected"], ref_oe))
check("pooled variance matches reference", abs(res["pooledVariance"] - ref_v) < 1e-4, (res["pooledVariance"], ref_v))

# 3. Null biomarker (no group difference) -> not significant.
nsites = [dict(name=f"N{i}", **make_site(100 + i, 120, 0)) for i in range(3)]
rnull = run({"sites": nsites, "alpha": 0.01})
check("null biomarker not significant", rnull["biomarkerSignificant"] is False, rnull)

# 4. Cryptographic soundness: a forged opening/aggregate MUST fail verification.
x, r = 424242, fz.secrets.randbelow(fz.Q)
C = fz._commit(x, r)
proof = fz._schnorr_prove(x, r, C)
check("honest Schnorr proof verifies", fz._schnorr_verify(C, proof) is True)
forged = dict(proof); forged["s1"] = (forged["s1"] + 1) % fz.Q
check("tampered Schnorr proof rejected", fz._schnorr_verify(C, forged) is False)
# Homomorphic aggregate cannot be opened to a wrong sum.
C2 = fz._commit(111, 222)
C_agg = (C * C2) % fz.P
check("true aggregate opens correctly", C_agg == fz._commit((x + 111) % fz.Q, (r + 222) % fz.Q))
check("forged aggregate value rejected", C_agg != fz._commit((x + 111 + 1) % fz.Q, (r + 222) % fz.Q))

# 5. Honest errors on malformed input.
bad = run({"sites": [dict(name="only", **make_site(1, 30, 2))]})
check("single site -> honest error", bad.get("status") == "error", bad)
bad2 = run({"sites": [{"name": "a", "durations": [1, 2], "events": [1], "groups": [0, 1]},
                      {"name": "b", "durations": [1, 2], "events": [1, 0], "groups": [0, 1]}]})
check("mismatched lengths -> honest error", bad2.get("status") == "error", bad2)

print(f"\nALL {passed} FEDERATED-ZKP TESTS PASSED")
