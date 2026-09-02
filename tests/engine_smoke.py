#!/usr/bin/env python3
"""Deterministic, network-free smoke tests for the SynOmics compute engine.

Every assertion validates real computation (values checked against known
references where possible). Run: `python tests/engine_smoke.py`
"""
import importlib.util
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("eng", os.path.join(ROOT, "server", "synomics_engine.py"))
eng = importlib.util.module_from_spec(spec)
spec.loader.exec_module(eng)

passed = 0


def check(name, cond):
    global passed
    if not cond:
        print(f"FAIL: {name}")
        sys.exit(1)
    passed += 1
    print(f"ok: {name}")


# --- Statistics (validated against published tables) ---
check("student-t t=2.228,df=10 ~ 0.05", abs(eng.student_t_two_sided_p(2.228, 10) - 0.05) < 1e-3)
check("student-t t=3.169,df=10 ~ 0.01", abs(eng.student_t_two_sided_p(3.169, 10) - 0.01) < 1e-3)
bh = eng.benjamini_hochberg([0.001, 0.01, 0.02, 0.5])
check("BH monotone & bounded", bh[0] <= bh[1] <= bh[2] and all(0 <= x <= 1 for x in bh))
t, dfree, p, ma, mb = eng.welch_t_test([10, 11, 9, 10], [20, 21, 19, 20])
check("welch separates means", p < 1e-3 and ma == 10 and mb == 20)

# --- Alignment ---
al = eng.align_pairwise_sequences("MKTAYIAKQR", "MKTAYIAKQC", method="needleman_wunsch", seq_type="protein")
check("NW alignment 90% identity", abs(al["identityPct"] - 90.0) < 1e-6 and al["alignmentLength"] == 10)

# --- Differential expression ---
de = eng.run_differential_expression(
    {"A": [10, 11, 12, 50, 52, 55], "B": [100, 98, 101, 20, 22, 19]},
    ["control", "control", "control", "treated", "treated", "treated"],
)
check("DE flags significant genes", any(r["isSignificant"] for r in de))

# --- File ingestion parsers ---
fa = eng.ingest_file("x.fasta", ">a\nMKTAYIAKQR\n>b\nMKTAYIAKQC\n>c\nMKTAYIAKQQ\n")
check("fasta parsed 3 records", fa["status"] == "success" and fa["data"]["count"] == 3)
check("fasta suggests alignment+tree", {"align_sequences", "phylogenetic_tree"} <= {s["tool"] for s in fa["suggestedAnalyses"]})

fq = eng.ingest_file("r.fastq", "@r1\nACGTACGT\n+\nIIIIIIII\n@r2\nACGT\n+\n!!!!\n")
# 'I' = Phred 40 (33+40), '!' = Phred 0. Mean of read1 = 40, read2 = 0 -> overall mean 20.
check("fastq Phred+33 decode", fq["status"] == "success" and abs(fq["summary"]["meanPhredQuality"] - 20.0) < 1e-6)

vcf = eng.ingest_file("v.vcf", "##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n1\t100\trs1\tA\tG\t50\tPASS\t.\n1\t200\trs2\tAT\tA\t40\tPASS\t.\n2\t300\trs3\tC\tCGG\t30\tPASS\t.\n")
check("vcf counts + typing", vcf["status"] == "success" and vcf["summary"]["variants"] == 3 and vcf["summary"]["variantTypes"]["SNV"] == 1)

mat = eng.ingest_file("m.csv", "gene,c1,c2,t1,t2\nGENEA,10,11,50,52\nGENEB,100,98,20,22\n")
check("matrix -> counts by sample", mat["status"] == "success" and mat["data"]["counts"]["c1"] == [10.0, 100.0])

bad = eng.ingest_file("x.bin", "\x00\x01 not a known format")
check("unknown format -> honest unsupported", bad["status"] == "unsupported")

print(f"\nALL {passed} ENGINE SMOKE TESTS PASSED")
