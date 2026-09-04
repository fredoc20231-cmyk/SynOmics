#!/usr/bin/env python3
"""RNA-seq pipeline gate.

Validates the flagship pipeline three ways:
  1. Downstream DE (`rnaseq_deseq`) recovers KNOWN spiked-in DE genes from a
     labeled NB count fixture (this fixture lives only here; it is NEVER served as
     a real finding) with high sensitivity and controlled false positives, and
     emits the full figure/table + report/document/article bundle.
  2. `rnaseq_tximport` sums transcripts to genes correctly.
  3. `rnaseq_upstream` returns an honest, executable PLAN with the exact tool flags
     and NEVER fabricates counts when the aligner binaries are absent.
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "server", "rnaseq_pipeline.py")

try:
    import matplotlib  # noqa: F401
    import numpy as np
    import statsmodels.api as sm  # noqa: F401
except Exception as e:  # noqa: BLE001
    print(f"SKIP: scientific stack not available ({e}).")
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
    r = subprocess.run([sys.executable, SCRIPT], input=json.dumps(payload).encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return json.loads(r.stdout.decode())


def nb_sample(rng, mean, alpha, size):
    """Negative binomial with mean and dispersion alpha (var = mean + alpha*mean^2)."""
    mean = max(mean, 1e-6)
    n = 1.0 / alpha
    pcol = n / (n + mean)
    return rng.negative_binomial(n, pcol, size=size)


# ---- labeled fixture: 300 genes × 8 samples (4 ctrl vs 4 treat), 40 spiked DE ----
rng = np.random.default_rng(0)
n_genes, n_per = 300, 4
n_de = 40
conditions = ["ctrl"] * n_per + ["treat"] * n_per
base_means = rng.lognormal(mean=4.0, sigma=1.0, size=n_genes) + 20  # decent depth
alpha = 0.1
is_de = np.zeros(n_genes, dtype=bool)
de_dir = np.zeros(n_genes)
is_de[:n_de] = True
de_dir[: n_de // 2] = 1.0    # up in treat
de_dir[n_de // 2 : n_de] = -1.0  # down in treat
fold = 4.0

counts = {}
truth_up, truth_down, truth_null = [], [], []
for g in range(n_genes):
    name = f"gene{g:03d}"
    ctrl_mean = base_means[g]
    if is_de[g]:
        treat_mean = ctrl_mean * (fold if de_dir[g] > 0 else 1.0 / fold)
        (truth_up if de_dir[g] > 0 else truth_down).append(name)
    else:
        treat_mean = ctrl_mean
        truth_null.append(name)
    ctrl = nb_sample(rng, ctrl_mean, alpha, n_per)
    trt = nb_sample(rng, treat_mean, alpha, n_per)
    counts[name] = [int(v) for v in list(ctrl) + list(trt)]

with tempfile.TemporaryDirectory() as d:
    out = os.path.join(d, "rnaseq")
    res = run({"task": "rnaseq_deseq", "counts": counts, "conditions": conditions,
               "reference": "ctrl", "alpha": 0.05, "outputDir": out, "outputFormat": "document"})
    check("deseq status success", res.get("status") == "success", res.get("error"))
    check("two-group design detected", res["groups"] == {"reference": "ctrl", "treatment": "treat"}, res.get("groups"))
    check("size factors geomean ~1", abs(np.exp(np.mean(np.log(list(res["sizeFactors"].values())))) - 1.0) < 1e-3)

    by_gene = {r["gene"]: r for r in res["results"]}
    # sensitivity: most spiked DE genes recovered at padj<0.05
    rec = [g for g in (truth_up + truth_down) if by_gene.get(g, {}).get("padj") is not None and by_gene[g]["padj"] < 0.05]
    sens = len(rec) / n_de
    check(f"DE sensitivity high ({sens:.2f})", sens >= 0.70, f"recovered {len(rec)}/{n_de}")
    # direction correct for recovered genes
    dir_ok = all((by_gene[g]["log2FoldChangeShrunk"] or 0) > 0 for g in truth_up if g in rec) and \
             all((by_gene[g]["log2FoldChangeShrunk"] or 0) < 0 for g in truth_down if g in rec)
    check("fold-change directions correct", dir_ok)
    # specificity: few null genes called significant (FDR control)
    fp = [g for g in truth_null if by_gene.get(g, {}).get("padj") is not None and by_gene[g]["padj"] < 0.05]
    fpr = len(fp) / len(truth_null)
    check(f"false-positive rate controlled ({fpr:.3f})", fpr <= 0.10, f"{len(fp)} FP / {len(truth_null)}")
    check("nSignificant matches up+down", res["nSignificant"] == res["nUp"] + res["nDown"])

    # bundle artifacts
    b = res["bundle"]
    figs = b["artifacts"]["figures"]
    for stem in ("pca", "ma_plot", "volcano", "dispersion", "pvalue_histogram",
                 "size_factors", "library_sizes", "sample_distance_heatmap", "top_genes_heatmap"):
        check(f"figure {stem}.png present", any(f.endswith(f"{stem}.png") for f in figs))
        check(f"figure {stem}.svg present", any(f.endswith(f"{stem}.svg") for f in figs))
    png0 = os.path.join(out, figs[0])
    check("figure png has PNG magic", open(png0, "rb").read(4) == b"\x89PNG")
    check("DE table csv present + populated",
          os.path.exists(os.path.join(out, "tables/differential_expression.csv")) and
          os.path.getsize(os.path.join(out, "tables/differential_expression.csv")) > 100)
    check("report.html present", os.path.exists(os.path.join(out, "report.html")))
    check("article.md present (document format)", os.path.exists(os.path.join(out, "article.md")))
    art_md = open(os.path.join(out, "article.md")).read()
    check("article carries Synapse attribution + Fadiel citation", "Synapse" in art_md and "Fadiel" in art_md)
    check("article.docx present (document format)", os.path.exists(os.path.join(out, "article.docx")))
    check("article.docx has DOCX (zip) magic", open(os.path.join(out, "article.docx"), "rb").read(2) == b"PK")
    check("MANIFEST checksums cover article.docx",
          any(k.endswith("article.docx") for k in b["sha256"]))

# ---- tximport ----
tx = run({"task": "rnaseq_tximport",
          "quant": {"s1": {"t1": {"counts": 10, "effLength": 1000}, "t2": {"counts": 5, "effLength": 500}},
                    "s2": {"t1": {"counts": 20, "effLength": 1000}, "t2": {"counts": 0, "effLength": 500}}},
          "tx2gene": {"t1": "geneA", "t2": "geneA", "t3": "geneB"}})
check("tximport sums transcripts to gene", tx["geneCounts"]["geneA"] == [15.0, 20.0], tx.get("geneCounts"))

# ---- upstream orchestrator: honest plan, exact flags, no fabricated counts ----
up = run({"task": "rnaseq_upstream", "readLength": 150, "longPlatform": "nanopore"})
check("upstream success", up.get("status") == "success")
check("sjdbOverhang = readLength-1", up["sjdbOverhang"] == 149)
cmds = " ".join(s["command"] for s in up["steps"])
check("STAR --sjdbOverhang 149 in plan", "--sjdbOverhang 149" in cmds)
check("minimap2 -ax splice in plan", "-ax splice" in cmds)
check("salmon --validateMappings --seqBias --gcBias in plan",
      "--validateMappings" in cmds and "--seqBias" in cmds and "--gcBias" in cmds)
check("fastp sliding window in plan", "--cut_window_size" in cmds)
check("no aligner binaries here -> steps unavailable", all(
    s["status"] == "unavailable" for s in up["steps"]))
check("toolchainReady false in sandbox", up["toolchainReady"] is False)
check("no fabricated counts in upstream result", "geneCounts" not in up and "results" not in up)

# ---- honest errors ----
check("unknown task -> error", run({"task": "nope"}).get("status") == "error")
check("single-group design -> error",
      run({"task": "rnaseq_deseq", "counts": {"g1": [1, 2, 3, 4]}, "conditions": ["a", "a", "a", "a"]}).get("status") == "error")

print(f"\nALL {passed} RNASEQ PIPELINE TESTS PASSED")
