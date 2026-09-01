# Backend contract request (frontend-owned)

Codex owns backend intelligence, classification, evidence, model readiness, and persistence.
The product/UX track implemented frontend support only. These contracts are still required.

## Model readiness enum

Frontend now maps the following typed states:

- `MODEL_NOT_CONFIGURED`
- `MODEL_STARTING`
- `MODEL_DOWNLOADING`
- `MODEL_UNREACHABLE`
- `COMPLETION_FAILED`
- `STREAMING_FAILED`
- `MODEL_FAILED_QUALITY_GATE`
- `READY`

Existing stream error codes already understood:

- `MODEL_PROVIDER_UNAVAILABLE` → `MODEL_UNREACHABLE`
- `EMPTY_MODEL_RESPONSE` → `COMPLETION_FAILED`
- `ANSWER_COMPILER_REJECTED` → `MODEL_FAILED_QUALITY_GATE`

Please emit `error.payload.code` using the typed names above (or keep the existing aliases). Do not send heuristic drafts as assistant prose.

## Legal acceptance persistence

The frontend shows Research & Educational Use, Terms / Disclaimer, Privacy, and Intellectual Property.
There is no existing API for storing legal acceptance. If product requires a durable acceptance record, add:

`POST /api/legal/acceptance { document_id, version, accepted: true }`
`GET /api/legal/acceptance`

Do not claim conversations are never stored.

## Deep Science structured sections

Frontend renders limitations, conflicts, evidence tables, and TOC only from backend metadata / Markdown headings.
If Deep Science should expose research gaps or methodological comparisons as first-class sections, add structured arrays on the answer package. Do not ask the client to regex scientific meaning.

## Continue / resume

Frontend shows Continue only when `finish_reason` is truncated/paused/length or an explicit `answer.truncated` / `stream.paused` event is present.
A durable resume contract (`continue_until_done` on the original turn without a new user message) should be confirmed by Codex.

## Analyze recommendation

Frontend treats `integrity.recommended_next_action` containing "analyze", or `escalation.required` with `suggested_preset=analyze`, as an optional CTA after an answer. Please keep sending a conceptual answer plus that structured recommendation instead of a hard gate.

## Conversation rename / move

`PATCH` conversation title and project attach/detach already exist on this main SHA and are used by the frontend. No additional rename/move endpoints are requested.

## Mode payload

UI selection maps to `{ product_mode, science_preset }` on `PATCH /api/conversations/:id/mode` and the same fields on `/chat`. The client does not classify scientific intent.
