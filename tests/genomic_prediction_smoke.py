#!/usr/bin/env python3
"""Tests for genomic prediction (GBLUP / ridge). Run:

    python tests/genomic_prediction_smoke.py

Ground truth is simulated with a fixed seed and asserted against REAL computed
values (zero hallucination): a genotype-driven phenotype must be recovered with
high accuracy, a pure-noise phenotype must NOT be (no manufactured signal).
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "genomic_prediction.py")

try:
    import matplotlib  # noqa: F401
    import numpy as np  # noqa: F401
    import sklearn  # noqa: F401
except Exception as e:
    print(f"SKIP: numpy/scikit-learn/matplotlib not available ({e}).")
    sys.exit(0)

import numpy as np  # noqa: E402

passed = 0


def check(name, cond, ctx=None):
    global passed
    if not cond:
        print(f"FAIL: {name}\n  {ctx}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


def run(p):
    r = subprocess.run([sys.executable, SCRIPT], input=json.dumps(p).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if not r.stdout.strip():
        raise AssertionError(f"no stdout; stderr={r.stderr.decode()}")
    return json.loads(r.stdout.decode())


# --- Simulate a genotype-driven phenotype (fixed seed) ---------------------- #
rng = np.random.default_rng(42)
n, m = 200, 50
G = rng.integers(0, 3, size=(n, m)).astype(float)            # 0/1/2 dosages
true_effects = rng.normal(0, 1, size=m)                       # TRUE marker effects
Gc = G - G.mean(axis=0)
signal = Gc @ true_effects
noise = rng.normal(0, signal.std() * 0.3, size=n)            # small gaussian noise
y_signal = (signal + noise).tolist()
genos = G.tolist()

# 1. Signal is recovered with high accuracy (CV, out-of-fold) ---------------- #
res = run({"task": "gblup", "genotypes": genos, "phenotypes": y_signal})
check("signal: status success", res.get("status") == "success", res)
check("signal: nIndividuals/nMarkers correct",
      res["nIndividuals"] == n and res["nMarkers"] == m, res)
check("signal: markerEffects length == m", len(res["markerEffects"]) == m, len(res["markerEffects"]))
check("signal: predictedBreedingValues length == n",
      len(res["predictedBreedingValues"]) == n, len(res["predictedBreedingValues"]))
check(f"signal: accuracy (r={res['accuracy']}) > 0.8", res["accuracy"] > 0.8, res["accuracy"])
check(f"signal: rSquared ({res['rSquared']}) > 0.6", res["rSquared"] > 0.6, res["rSquared"])
sig_acc, sig_r2 = res["accuracy"], res["rSquared"]

# 2. Pure-noise phenotype -> held-out/CV accuracy near 0 (no hallucination) -- #
rng2 = np.random.default_rng(7)
y_noise = rng2.normal(0, 1, size=n).tolist()
res_n = run({"task": "gblup", "genotypes": genos, "phenotypes": y_noise})
check("noise: status success", res_n.get("status") == "success", res_n)
check(f"noise: |accuracy| ({res_n['accuracy']}) < 0.5",
      abs(res_n["accuracy"]) < 0.5, res_n["accuracy"])
noise_acc = res_n["accuracy"]

# 3. Held-out testIndices path also recovers signal -------------------------- #
test_idx = list(range(0, 40))
res_t = run({"task": "gblup", "genotypes": genos, "phenotypes": y_signal,
             "testIndices": test_idx})
check("holdout: evaluation label == holdout", res_t["evaluation"] == "holdout", res_t["evaluation"])
check(f"holdout: accuracy ({res_t['accuracy']}) > 0.8", res_t["accuracy"] > 0.8, res_t["accuracy"])

# 4. Mismatched lengths -> honest error -------------------------------------- #
bad = run({"task": "gblup", "genotypes": genos, "phenotypes": y_signal[:-5]})
check("mismatched lengths -> error", bad.get("status") == "error", bad)

# 5. Unknown task -> honest error -------------------------------------------- #
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")

# 6. Outcome bundle ---------------------------------------------------------- #
import tempfile  # noqa: E402

with tempfile.TemporaryDirectory() as td:
    rb = run({"task": "gblup", "genotypes": genos, "phenotypes": y_signal,
              "outputDir": td})
    check("bundle: status success", rb.get("status") == "success", rb)
    man = rb.get("bundle")
    check("bundle: manifest present", isinstance(man, dict), man)

    def _find(exts):
        hits = []
        for root, _dirs, files in os.walk(td):
            for f in files:
                if f.endswith(exts):
                    hits.append(os.path.join(root, f))
        return hits

    pngs = _find(".png")
    svgs = _find(".svg")
    csvs = _find(".csv")
    check("bundle: figure .png exists", len(pngs) >= 1, pngs)
    check("bundle: figure .svg exists", len(svgs) >= 1, svgs)
    with open(pngs[0], "rb") as fh:
        check("bundle: png has PNG magic", fh.read(4) == b"\x89PNG", pngs[0])
    check("bundle: table .csv exists", len(csvs) >= 1, csvs)
    with open(csvs[0], "rb") as fh:
        check("bundle: csv non-empty", len(fh.read()) > 0, csvs[0])
    code_p = os.path.join(td, "code", "analysis.py")
    check("bundle: code/analysis.py non-empty",
          os.path.exists(code_p) and os.path.getsize(code_p) > 0, code_p)
    for report in ("report.html", "report.md"):
        rp = os.path.join(td, report)
        check(f"bundle: {report} non-empty",
              os.path.exists(rp) and os.path.getsize(rp) > 0, rp)

print(f"\nsignal accuracy={sig_acc}, rSquared={sig_r2}; noise accuracy={noise_acc}")
print(f"\nALL {passed} GBLUP TESTS PASSED")
