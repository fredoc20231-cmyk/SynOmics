# Frontend acceptance

Two separate proof surfaces:

| Surface | Path | Meaning |
| --- | --- | --- |
| Layout fixtures | `frontend/acceptance/layout/` and `#/acceptance` | LAYOUT FIXTURE / NOT LIVE INTELLIGENCE |
| Live product | `frontend/acceptance/live/` and `LIVE_PRODUCT_ACCEPTANCE.md` | Real backend, real model, retained visible output |

Never call fixture screenshots "browser acceptance of intelligence".

Executable presentation checks: `frontend/src/acceptanceMatrix.test.tsx`.
Contract checks: `frontend/INTEGRATION_CONTRACT_MATRIX.md`.
