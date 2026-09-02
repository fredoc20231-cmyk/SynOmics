# Frontend / backend integration contract matrix

Cursor consumes these contracts. Codex owns the backend implementations.
Status values are only `AVAILABLE`, `PENDING_CODEX`, or `DEFERRED`. No invented backend support.

| Backend contract | Frontend consumer | Status | Fallback behavior | Test |
| --- | --- | --- | --- | --- |
| Structured 503 `{ detail: { code, state, message } }` on `/chat` | `parseFailedChatResponse` → `classifyModelReadiness` | AVAILABLE | Parse body first. Explicit `state` wins over `code`, then HTTP status, then message heuristics. HTTP 503 never overwrites a more specific state. | `frontend/src/modelReadiness.test.ts`, `frontend/src/chatContracts.test.ts` |
| Conversation readiness enum + aliases (`MODEL_*`, `ANSWER_*`) | `src/ui/design/modelReadiness.ts` | AVAILABLE | Alias-adapt Codex names. Preserve `backendCode` and `backendState`. | `frontend/src/modelReadiness.test.ts` |
| `/health/ready` conversation object `{ state, ready, provider, model, heuristic, ... }` | `getConversationReadiness`, admin Runtime identity | PENDING_CODEX | Consume `conversation` when present; otherwise derive unknown/not reported. Do not invent qualification. | `frontend/src/runtimeIdentity.test.ts` |
| `/version` `{ version, git_sha, frontend_sha, backend_sha, environment }` | `getVersion`, `parseRuntimeIdentity`, mismatch warning | PENDING_CODEX | Current main exposes `version` + `git_sha`. Extra SHA fields used when present. No mismatch claim without both SHAs. | `frontend/src/runtimeIdentity.test.ts` |
| `retry_last_user=true` on `/chat` | `buildRetryBody`, error/assistant Retry | PENDING_CODEX | Send `conversation_id` + `retry_last_user` + original content for schema compatibility. Do not create a user bubble, synthesize retry text, or re-attach files. | `frontend/src/retryContract.test.ts` |
| Resumable continue (`resume_correlation_id` / `continuation_id`) | `canContinueResponse`, `buildContinueBody` | PENDING_CODEX | Continue stays hidden unless backend proves resumable **and** supplies a continuation id. Never resend the user question. | `frontend/src/productTruth.test.tsx` |
| Effective mode on stream / answer package | `correlateModeState` | PENDING_CODEX | Compare selected / requested / persisted / effective / rendered. Unexpected disagreement → `MODE_STATE_DIVERGENCE`. Never silent-correct. | `frontend/src/chatContracts.test.ts` |
| Server-owned sources / citations | `sourceCardsFromAnswer` | AVAILABLE | Render only backend metadata. `retrieved` is not relabeled supporting unless citation status is `VERIFIED_SUPPORT`. Dedup only exact PMID/DOI/NCT/`evidence_id`. | `frontend/src/productTruth.test.tsx`, `frontend/src/integrationRelease.test.tsx` |
| Analyze recommendation (`escalation.required`, `recommended_next_action`) | `AssistantMessageView` optional CTA | AVAILABLE | Conceptual answers stay conversational. No hard Analyze gate. | `frontend/src/acceptanceMatrix.test.tsx` |
| Mode qualification / unavailable workflows | `ModeSelector.availability` | PENDING_CODEX | Disable a mode only when backend explicitly reports it unavailable. No client model-name scoring. | `frontend/src/integrationRelease.test.tsx` |
| Heuristic provider forbidden | `isHeuristicAssistantProse` | AVAILABLE | Never render as assistant prose. Classify `HEURISTIC_PROVIDER_FORBIDDEN` (or `MODEL_NOT_CONFIGURED` if that is the backend state). | `frontend/src/integrationRelease.test.tsx` |
| `/chat/cancel` | Stop control | AVAILABLE | Abort local stream, Ω disappears, ignore duplicate-cancel errors. Late tokens dropped. | `frontend/src/raceGuards.test.ts` |
| Attachment inspection vs analysis | composer + turn chips | AVAILABLE | Distinguish attached / parsed / inspected. Never claim image analyzed, PDF understood, or repo executed unless backend reports that capability. | presentation-only; no fake success |

## Cursor must not implement

- Backend admission / quality scoring
- Client-side model-name capability checks (`model.includes("3b")`)
- Word-count or citation-validity gates
- Fake live PASS when Codex contracts are missing
