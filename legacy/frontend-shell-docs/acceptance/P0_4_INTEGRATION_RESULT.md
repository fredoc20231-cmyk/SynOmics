# P0.4 integration result

Read-only integration verification against Codex v2. This file is evidence only.
P0.3 findings against old PR #18 remain historical and are not updated here.

Timestamp (UTC): `2026-08-24T16:04:30Z`

## Heads

| Item | Value |
| --- | --- |
| Cursor client-fix branch | `cursor/synapse-final-client-fixes-p0` |
| Cursor client-fix head | `f516122b0ebde8288f4dd8acd05726d210a60c1f` |
| Base SHA (PR #19 head) | `d7423bd83d0ebb2a5566618f6c3456a66f61a19c` |
| Stacked PR base | `cursor/synapse-integration-hardening-p0` |
| Codex v2 branch | `codex/functional-chat-integration-v2` |
| Codex v2 head | **not present** |
| Integrated local candidate SHA | **not created** (Codex v2 missing) |

`git ls-remote --heads origin codex/functional-chat-integration-v2` returned empty after Part A push.

## Runtime identification (required before Chat acceptance)

**RUNTIME IDENTIFIED: NO** — no Codex v2 candidate. Existing host process is documented so it is not mistaken for the candidate.

| Probe | Observed |
| --- | --- |
| Process | PID `5606` `python3 -m uvicorn synapse.api.chat:app --host 0.0.0.0 --port 3020` |
| CWD | `/workspace` (this checkout; not a Codex v2 worktree) |
| Port | `3020` |
| Image | host Python 3.12, not a Codex v2 image |
| `/version` | `{"version":"0.1.0-rc1","git_sha":"","build_date":"","environment":"development","schema_version":"1.0"}` |
| Backend SHA | empty |
| Frontend SHA | empty |
| Provider | empty |
| Model | empty |
| Heuristic | `true` (`/health/ready` model detail) |
| Transport ready | `/health/live` ok, `/health/ready` status ok, but conversation model is heuristic and not a Codex v2 candidate |

Required for Chat acceptance: non-empty backend SHA, non-empty frontend SHA, expected candidate SHA(s), real provider/model, heuristic=false, transport ready.

Because those are missing: **ACCEPTANCE_INVALID** — not FAIL, not PASS.

This `:3020` uvicorn is the prior heuristic host runtime. It was not treated as the Codex v2 candidate. No second unmarked uvicorn was started. No throwaway integration worktree was created.

## Verdict

**ACCEPTANCE_INVALID**

Codex v2 (`codex/functional-chat-integration-v2`) was not on origin after Part A. Live Chat acceptance was not executed. No live PASS was invented.

## Exact prompts (not executed live)

Casual + Basic:

1. Explain homologous recombination.
2. how to make a black hole
3. Explain recursion simply.
4. Write a professional thank-you email.
5. Explain correlation versus causation.

Consequential science:

6. What herbal extracts have been studied for prostate cancer?
7. Which of these has the strongest human evidence?
8. Are any active clinical trials testing them?

Mode differentiation (fresh conversation each):

9. Describe neoantigen analysis. — Casual
10. Describe neoantigen analysis. — Science
11. Describe neoantigen analysis. — Deep Science

Analysis distinction:

12. Explain survival analysis.
13. Analyze this attached dataset. (CSV)

Failure / product-truth probes (not executed): model down; model recovery + Retry; network interruption; Stop; conversation A→B during streaming; auth expiry; rate limit.

## Actual outputs

None. Live Chat was not run against an identified Codex v2 runtime.

## Status board

| Item | Result |
| --- | --- |
| ORDINARY CHAT | ACCEPTANCE_INVALID |
| BLACK HOLE | ACCEPTANCE_INVALID |
| HOMOLOGOUS RECOMBINATION | ACCEPTANCE_INVALID |
| RETRY | ACCEPTANCE_INVALID (live). Part A unit tests prove: completed answer has no Retry; model/provider failure has Retry; rejected draft has Retry when retryable. |
| AUTH EXPIRY | ACCEPTANCE_INVALID (live). Part A unit tests prove Chat 401 → session-expired UI, no model Retry, Ω stop planned, no retry loop; 403 remains distinct. |
| PROSTATE EVIDENCE | ACCEPTANCE_INVALID |
| CONTEXTUAL FOLLOWUP | ACCEPTANCE_INVALID |
| CASUAL/SCIENCE/DEEP SCIENCE | ACCEPTANCE_INVALID |
| ANALYSIS DISTINCTION | ACCEPTANCE_INVALID |
| STOP | ACCEPTANCE_INVALID |
| CONVERSATION RACE | ACCEPTANCE_INVALID |
| REFERENCES | ACCEPTANCE_INVALID |
| SECURITY | ACCEPTANCE_INVALID |
| ACCESSIBILITY | ACCEPTANCE_INVALID |
| MOBILE | ACCEPTANCE_INVALID |

## Blockers

1. Remote branch `codex/functional-chat-integration-v2` does not exist yet.
2. Host `:3020` reports empty SHAs, empty provider/model, and `heuristic: true`.
3. ManagePullRequest is missing in this session; stacked draft PR for `cursor/synapse-final-client-fixes-p0` onto `cursor/synapse-integration-hardening-p0` was not created here.

## Part A (client fixes) — independent of live acceptance

- Branch: `cursor/synapse-final-client-fixes-p0`
- Head: `f516122b0ebde8288f4dd8acd05726d210a60c1f`
- Base: `d7423bd83d0ebb2a5566618f6c3456a66f61a19c`
- BACKEND PYTHON MODIFIED: NONE
- `npm run typecheck`: PASS
- `npm test -- --run`: PASS (85 tests)
- `npm run build`: PASS
- `npm audit --audit-level=high`: 0 vulnerabilities

A1/A2/A3 are covered by `frontend/src/retryContract.test.tsx` and `frontend/src/sessionExpiry.test.tsx` even while Part B is ACCEPTANCE_INVALID.
