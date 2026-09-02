# SynOmics Engine — Scientific Validation & Concordance Report

Generated: 2026-09-02T08:07:21.249260+00:00
Deterministic seed: 20240902
Reference stack: numpy 2.4.6, scipy 1.17.1, statsmodels 0.15.0
Python: 3.11.15

Each engine statistic is compared against a community gold-standard implementation across many randomized (seeded) inputs. A test passes when the maximum absolute difference is within the stated numerical tolerance.

| Statistic | Reference | Cases | Metric | Max abs Δ | Tolerance | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Welch t-test: t statistic | scipy.stats.ttest_ind(equal_var=False) | 200 | t | 7.105e-15 | 1.0e-09 | PASS ✅ |
| Welch t-test: degrees of freedom | scipy.stats.ttest_ind(equal_var=False) | 200 | df | 1.421e-14 | 1.0e-07 | PASS ✅ |
| Welch t-test: two-sided p-value | scipy.stats.ttest_ind(equal_var=False) | 200 | p | 1.574e-13 | 1.0e-10 | PASS ✅ |
| Student's t two-sided p | scipy.stats.t.sf | 300 | p | 9.210e-13 | 1.0e-10 | PASS ✅ |
| Benjamini-Hochberg FDR q-values | statsmodels multipletests(fdr_bh) | 100 | q | 1.110e-16 | 1.0e-12 | PASS ✅ |
| Hypergeometric enrichment tail | scipy.stats.hypergeom.sf | 200 | P | 2.338e-10 | 1.0e-09 | PASS ✅ |
| Jukes-Cantor distance (engine rounds to 4 dp) | closed-form -3/4 ln(1-4/3 p), rounded to 4 dp | 100 | d | 0.000e+00 | 1.0e-09 | PASS ✅ |

**Overall: ALL CONCORDANT ✅** (7/7 passed)

Reproduce: `pip install numpy scipy statsmodels && python tests/scientific_validation.py`

