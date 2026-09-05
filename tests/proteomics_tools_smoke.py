#!/usr/bin/env python3
"""Proteomics tools gate — every result checked against known ground truth.

MaxLFQ recovers a KNOWN 2x sample ratio; median normalization equalizes sample
medians; quantile normalization makes all samples share one distribution; k-NN /
min / minprob imputation fill exactly the missing cells; Welch differential
abundance recovers a spiked up-regulated protein; TMT rollup recovers known
per-channel medians and normalizes channels."""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "proteomics_tools.py")

try:
    import numpy as np
except Exception as e:  # noqa: BLE001
    print(f"SKIP: numpy not available ({e}).")
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
    r = subprocess.run([sys.executable, SCRIPT], input=json.dumps(p).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        print("STDERR:", r.stderr.decode())
    return json.loads(r.stdout.decode())


# --------------------------------------------------------------------------- #
# Task 1 — MaxLFQ recovers a known 2x ratio between two samples.
# Protein P1: 3 peptides, sample1 = 2 * sample0 for every peptide.
# --------------------------------------------------------------------------- #
pep = {"P1": [[100.0, 200.0], [50.0, 100.0], [400.0, 800.0]]}
d = run({"task": "maxlfq_quantify", "peptides": pep, "sampleNames": ["s0", "s1"]})
check("maxlfq status success", d["status"] == "success", d)
lfq = d["proteins"]["P1"]["lfq"]
check("maxlfq both samples quantified", all(v is not None for v in lfq), lfq)
ratio = lfq[1] / lfq[0]
check("maxlfq recovers 2x ratio (s1/s0 ~ 2.0)", abs(ratio - 2.0) < 1e-6, ratio)
# Absolute scale anchored to summed raw intensity (100+50+400 + 200+100+800 = 1650).
check("maxlfq anchors to summed intensity", abs((lfq[0] + lfq[1]) - 1650.0) < 1e-3, lfq)
check("maxlfq reports nPeptides", d["proteins"]["P1"]["nPeptides"] == 3, d["proteins"]["P1"])

# 3-sample ladder 1:2:4 with 2 peptides each, one missing value tolerated.
pep3 = {"Q": [[10.0, 20.0, 40.0], [5.0, None, 20.0]]}
d3 = run({"task": "maxlfq_quantify", "peptides": pep3})
lfq3 = d3["proteins"]["Q"]["lfq"]
check("maxlfq 3-sample all quantified", all(v is not None for v in lfq3), lfq3)
check("maxlfq ladder ratio s1/s0 ~ 2", abs(lfq3[1] / lfq3[0] - 2.0) < 1e-6, lfq3)
check("maxlfq ladder ratio s2/s0 ~ 4", abs(lfq3[2] / lfq3[0] - 4.0) < 1e-6, lfq3)

# --------------------------------------------------------------------------- #
# Task 2 — normalization.
# --------------------------------------------------------------------------- #
# Median: sample1 is 10x sample0 -> after median-norm rows share the grand median.
mat = [[1.0, 2.0, 3.0, 4.0], [10.0, 20.0, 30.0, 40.0]]
dn = run({"task": "normalize_intensities", "matrix": mat, "method": "median"})
check("normalize status success", dn["status"] == "success", dn)
norm = np.array(dn["normalized"], float)
check("median-norm equalizes row medians",
      abs(np.median(norm[0]) - np.median(norm[1])) < 1e-6,
      (np.median(norm[0]), np.median(norm[1])))

# Quantile: two samples with same shape different values -> identical distributions.
matq = [[5.0, 2.0, 3.0, 4.0], [40.0, 10.0, 20.0, 30.0]]
dq = run({"task": "normalize_intensities", "matrix": matq, "method": "quantile"})
nq = np.array(dq["normalized"], float)
check("quantile-norm makes samples share one distribution",
      np.allclose(np.sort(nq[0]), np.sort(nq[1])), nq)

# --------------------------------------------------------------------------- #
# Task 3 — imputation fills exactly the missing cells.
# --------------------------------------------------------------------------- #
mm = [[10.0, 12.0, None], [11.0, 13.0, 9.0], [9.0, 11.0, 8.0], [10.5, 12.5, 8.5]]
di = run({"task": "impute_missing", "matrix": mm, "method": "knn", "k": 2})
check("impute status success", di["status"] == "success", di)
check("impute counts the 1 missing", di["nMissing"] == 1, di)
imp = di["imputed"]
check("impute filled the missing cell", imp[0][2] is not None, imp)
check("impute left observed cells unchanged", abs(imp[1][2] - 9.0) < 1e-9, imp)
check("knn fill is within observed range of the feature",
      8.0 <= imp[0][2] <= 9.0, imp[0][2])

# min imputation: missing -> column min * fraction.
dmin = run({"task": "impute_missing", "matrix": mm, "method": "min", "fraction": 0.5})
# column 2 observed min = 8.0 -> fill 4.0
check("min-impute fills column-min*fraction", abs(dmin["imputed"][0][2] - 4.0) < 1e-9,
      dmin["imputed"][0][2])

# minprob is reproducible with a seed.
a1 = run({"task": "impute_missing", "matrix": mm, "method": "minprob", "seed": 7})
a2 = run({"task": "impute_missing", "matrix": mm, "method": "minprob", "seed": 7})
check("minprob is seed-reproducible", a1["imputed"] == a2["imputed"])

# --------------------------------------------------------------------------- #
# Task 4 — differential abundance recovers a spiked up-regulated protein.
# UP: B roughly 4x A (log2FC ~ +2), tight; FLAT: same in both.
# --------------------------------------------------------------------------- #
ga = {"UP": [100.0, 105.0, 98.0, 102.0], "FLAT": [50.0, 52.0, 48.0, 51.0]}
gb = {"UP": [400.0, 410.0, 395.0, 405.0], "FLAT": [51.0, 49.0, 50.0, 52.0]}
dd = run({"task": "differential_abundance", "groupA": ga, "groupB": gb})
check("diff-abund status success", dd["status"] == "success", dd)
by = {r["protein"]: r for r in dd["results"]}
check("diff-abund UP log2FC ~ +2", abs(by["UP"]["log2FC"] - 2.0) < 0.1, by["UP"])
check("diff-abund UP is significant", by["UP"]["padj"] < 0.05, by["UP"])
check("diff-abund FLAT not significant", by["FLAT"]["padj"] >= 0.05, by["FLAT"])
check("diff-abund reports exactly 1 significant", dd["nSignificant"] == 1, dd)

# --------------------------------------------------------------------------- #
# Task 5 — TMT rollup recovers known per-channel medians + normalizes channels.
# Protein A: 3 PSMs, channel medians = [10, 20, 30]; Protein B: [10, 20, 30].
# --------------------------------------------------------------------------- #
psms = {
    "A": [[8.0, 18.0, 28.0], [10.0, 20.0, 30.0], [12.0, 22.0, 32.0]],
    "B": [[9.0, 19.0, 29.0], [10.0, 20.0, 30.0], [11.0, 21.0, 31.0]],
}
dt = run({"task": "tmt_protein_rollup", "psms": psms, "method": "median",
          "normalizeChannels": False})
check("tmt status success", dt["status"] == "success", dt)
ab = dt["proteins"]["A"]["abundance"]
check("tmt median rollup recovers [10,20,30]",
      abs(ab[0] - 10) < 1e-9 and abs(ab[1] - 20) < 1e-9 and abs(ab[2] - 30) < 1e-9, ab)
check("tmt reports nPSMs", dt["proteins"]["A"]["nPSMs"] == 3, dt["proteins"]["A"])

# With channel normalization the per-channel medians across proteins are equalized.
dtn = run({"task": "tmt_protein_rollup", "psms": psms, "method": "median",
           "normalizeChannels": True})
rolled = np.array([dtn["proteins"]["A"]["abundance"],
                   dtn["proteins"]["B"]["abundance"]], float)
col_med = np.median(rolled, axis=0)
check("tmt channel-norm equalizes channel medians",
      np.allclose(col_med, col_med[0]), col_med)

# --------------------------------------------------------------------------- #
# Error handling.
# --------------------------------------------------------------------------- #
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")
check("maxlfq needs >=2 samples",
      run({"task": "maxlfq_quantify", "peptides": {"P": [[1.0]]}}).get("status") == "error")
check("normalize rejects non-2D",
      run({"task": "normalize_intensities", "matrix": [1, 2, 3]}).get("status") == "error")
check("diff-abund needs shared proteins",
      run({"task": "differential_abundance", "groupA": {"X": [1, 2]},
           "groupB": {"Y": [1, 2]}}).get("status") == "error")
check("quantile rejects missing values",
      run({"task": "normalize_intensities", "matrix": [[1.0, None], [2.0, 3.0]],
           "method": "quantile", "treatZeroAsMissing": True}).get("status") == "error")

print(f"\nALL {passed} PROTEOMICS TESTS PASSED")
