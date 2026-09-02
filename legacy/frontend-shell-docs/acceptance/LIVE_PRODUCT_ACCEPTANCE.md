# Live product acceptance

This file records **live** SYNAPSE product behavior against a real configured backend.
Layout fixture screenshots are **not** live intelligence. See `frontend/acceptance/layout/`
and `/opt/cursor/artifacts/p12-layout/`.

Do not record passwords, API keys, cookies, conversation contents that are private, or patient data.
Prompts below are the public test prompts only.

## Verdict: LIVE ACCEPTANCE INVALID

See `frontend/acceptance/live/D1_GCP_PRIVATE_BETA.md` for the D1 closeout record tied to candidate SHA `609642a329e1b47c5cdaea39928194b0e2f8b9ab`.

Live GCP private-beta product acceptance was **NOT_RUN** (no staging URL or credentials). The reachable `127.0.0.1:3020` process remains heuristic with an empty `git_sha` and is not this candidate.

Layout fixture screenshots are **not** live intelligence. See `frontend/acceptance/layout/`
and `/opt/cursor/artifacts/p12-layout/`.

A process is listening on `127.0.0.1:3020` (`python3` pid 5606). Probed at assembly time:

- `/health/live` → `{"status":"ok"}`
- `/version` → `git_sha` **empty**
- `/health/ready` → `model.detail.heuristic: true`, empty provider/model names
- Docker Engine unavailable (`make dev` cannot start the Codex consolidation stack)
- `SYNAPSE_LIVE_EMAIL` / `SYNAPSE_LIVE_PASSWORD` unset
- Evidence providers disabled on the running process

This does **not** prove the integrated candidate SHA `ed9d8de560135d02d608952a1d1b1dffecaf1023`.
Heuristic runtime + empty SHA is not a live product PASS.

Candidate backend SHA: `` (empty on the reachable 3020 process)
Frontend SHA: `ed9d8de560135d02d608952a1d1b1dffecaf1023`
Provider / model: unset / heuristic
Heuristic: `true`
Timestamp: `2026-08-25T06:14:25.438Z`

| ID | Prompt | Selected mode | Thinking | Visible result | Sources | Error state | PASS/FAIL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | Explain homologous recombination. | Casual | Basic | not run |  | ACCEPTANCE_INVALID | ACCEPTANCE_INVALID |
| B | how to make a black hole | Casual | Basic | not run |  | ACCEPTANCE_INVALID | ACCEPTANCE_INVALID |
| C | Explain recursion simply. | Casual | Basic | not run |  | ACCEPTANCE_INVALID | ACCEPTANCE_INVALID |
| D | Write a short professional thank-you email to a collaborator. | Casual | Basic | not run |  | ACCEPTANCE_INVALID | ACCEPTANCE_INVALID |
| E | Explain why correlation does not prove causation. | Casual | Basic | not run |  | ACCEPTANCE_INVALID | ACCEPTANCE_INVALID |
| 17 | What herbal extracts have been studied for prostate cancer? | Casual | Basic | not run |  | ACCEPTANCE_INVALID | ACCEPTANCE_INVALID |
| 18a | Which of these has the strongest human evidence? | Casual | Basic | not run |  | ACCEPTANCE_INVALID | ACCEPTANCE_INVALID |
| 18b | Are any active clinical trials testing them? | Casual | Basic | not run |  | ACCEPTANCE_INVALID | ACCEPTANCE_INVALID |
| 19-casual | Describe neoantigen analysis. | Casual | Basic | not run |  | ACCEPTANCE_INVALID | ACCEPTANCE_INVALID |
| 19-science | Describe neoantigen analysis. | Science | Basic | not run |  | ACCEPTANCE_INVALID | ACCEPTANCE_INVALID |
| 19-deep | Describe neoantigen analysis. | Deep Science | Basic | not run |  | ACCEPTANCE_INVALID | ACCEPTANCE_INVALID |

Science (5) / Deep Science (3) / Analyze vs Governed Compute distinction prompts were not executed against a real non-heuristic model.

## Machine-updatable capture

Run `node frontend/acceptance/live/run-live-acceptance.mjs` when a real backend is reachable.
The script writes JSON under `frontend/acceptance/live/results/` and rewrites the table above.
It never marks PASS without retained visible output from the live model.

## Exact regressions

- **Black hole:** Casual + Thinking=Basic + `how to make a black hole`. PASS = ordinary assistant answer **or** truthful provider-unavailable card. If provider READY, ordinary answer is required. FAIL = heuristic prose, quality-gate-from-heuristic, Analyze recommendation, Deep Science requirement, empty successful response.
- **Homologous recombination:** do not regress the ordinary conversational path.
- **Mixed sequence:** homologous recombination → black hole → recursion → thank-you email → herbal extracts / prostate cancer. First four ordinary; fifth evidence-aware.

## ACCEPTANCE_INVALID

Live intelligence cannot be proven on this host: the reachable API is heuristic with an empty SHA, no live Chat credentials were provided, and Docker is unavailable for `make dev`. Frontend contract tests and `./scripts/check-all.sh` passed independently.
