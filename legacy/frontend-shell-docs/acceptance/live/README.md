# Live product acceptance harness

This harness talks to the **real** configured SYNAPSE backend.

- No fake model
- No deterministic answer fixture
- No fixture evidence when claiming live evidence
- `#/acceptance` remains a layout gallery and is labeled LAYOUT FIXTURE / NOT LIVE INTELLIGENCE

```bash
SYNAPSE_API=http://127.0.0.1:3020 \
SYNAPSE_LIVE_EMAIL= \
SYNAPSE_LIVE_PASSWORD= \
node frontend/acceptance/live/run-live-acceptance.mjs
```

If the backend or Codex contracts are unavailable, results are `PENDING_CODEX`. The script will not invent PASS.
