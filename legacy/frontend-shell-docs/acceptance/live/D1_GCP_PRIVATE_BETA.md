# D1 GCP Private Beta / product acceptance

Tied to candidate SHA `609642a329e1b47c5cdaea39928194b0e2f8b9ab` on `cursor/synapse-main-integration-v1` (PR #28).

Codex grounding + private-beta engineering closeout tree: `b5db206691d0e975a09bb857cac8777bf80e9101`.
Codex did not post the literal strings `CODEX CLOSEOUT COMPLETE` or `FINAL SHA =` on PR #28. D1 treated `b5db206` as the closeout payload after origin stopped moving, then applied UI-only consumption on top.

Layout fixture screenshots are **not** live intelligence.

## Verdict: LIVE ACCEPTANCE INVALID

Live GCP private-beta acceptance was **NOT_RUN**. Reasons:

- No `SYNAPSE_TARGET_URL` / Cloud Run / GCP staging URL in environment or repository runbook (docs use `https://staging.example.invalid`).
- No GCP credentials, `SYNAPSE_LIVE_EMAIL` / `SYNAPSE_LIVE_PASSWORD`, or `SYNAPSE_EXPECTED_SHA`.
- `scripts/gcp-private-beta-smoke.sh` was not executed against a real project.

C17: staging frontend SHA and backend SHA were **not observed** on an identified GCP runtime. Missing runtime SHAs ⇒ live acceptance is invalid.

A local process on `127.0.0.1:3020` is heuristic with **empty** `git_sha` and is not this candidate.

Release language remains **Private Research Beta**. Not clinically validated, not production certified, not guaranteed accurate, not hallucination-free.

## Identity

| Field | Value |
| --- | --- |
| Branch | `cursor/synapse-main-integration-v1` |
| PR | https://github.com/fredoc20231-cmyk/synapse/pull/28 |
| D1 UX HEAD | `609642a329e1b47c5cdaea39928194b0e2f8b9ab` |
| Codex grounding/release SHA | `b5db206691d0e975a09bb857cac8777bf80e9101` |
| GCP staging URL | not identified |
| Staging frontend SHA | missing |
| Staging backend SHA | missing |
| Provider / model | not proven live |
| Heuristic | local `:3020` heuristic=`true` |
| Qualification | not measured live |
| Grounding live | NOT_RUN |
| Timestamp (UTC) | 2026-08-26T02:34:00Z |

## Local gates (this HEAD)

| Gate | Result |
| --- | --- |
| frontend npm ci | PASS |
| typecheck | PASS |
| frontend tests | PASS (138) |
| production build | PASS |
| npm audit (high) | PASS (0 high) |
| ./scripts/check-all.sh | PASS (backend 654 passed, 8 skipped) |

## Live matrix

| ID | Prompt / check | Mode | Result |
| --- | --- | --- | --- |
| C4 taro Arabic `طريقة عمل القلقاس المصري` | Casual | NOT_RUN — no GCP staging |
| C5 RTL `dir=auto` (not whole-app RTL) | UI contract tests | PASS (unit); live GCP NOT_RUN |
| C6 science-first not science-only | UI contract tests | PASS (unit); live GCP NOT_RUN |
| C7 homologous recombination Casual | Casual | NOT_RUN |
| C8 homologous recombination Science | Science | NOT_RUN |
| C9 homologous recombination Deep Science | Deep Science | NOT_RUN |
| C10 Casual ordinary (black hole / email / recursion) | Casual | NOT_RUN |
| C11 Science | Science | NOT_RUN |
| C12 Deep Science | Deep Science | NOT_RUN |
| C13 Analyze | Analyze | NOT_RUN |
| C14 Governed Compute (select ≠ execute) | Compute | NOT_RUN |
| C15 Archive on real DB | Archive | NOT_RUN |
| C16 Auth | Auth | NOT_RUN |
| C17 runtime identity SHAs | Identity | FAIL / INVALID — staging SHAs missing |
| C18 menus / voice | Voice | NOT_RUN live; unit coverage exists |
| C19 references / citation integrity | Evidence | NOT_RUN live |
| C20 error recovery | Errors | NOT_RUN live |
| C21 XSS / mobile / a11y / portal `#/synapse` | Shell | NOT_RUN live; portal hash routing present in client |

## Release qualification

**BLOCKED** for live private-beta promotion. Local software gates passed. Live GCP identity, non-heuristic model, and measured Science/Deep qualifications were not observed.
