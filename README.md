# SynOmics production frontend

The production frontend is a Vite/React conversation shell over the FastAPI HTTP/SSE API.

SynOmics is science-first scientific intelligence for research, biomedicine and biotechnology — Built for science. Capable beyond it. General chat is a capability. Science is the identity.

## Product surfaces

- **Casual** — Fast, natural assistance for everyday questions, writing, coding and clear scientific explanations. Not a limited or non-scientific chatbot.
- **Science** — Structured scientific reasoning with evidence awareness, methodology, and limitations. Ordinary questions are still answered normally.
- **Deep Science** — Research-grade synthesis when the backend performs it. Ordinary questions stay ordinary; the UI does not invent research activity from mode selection.
- **Analyze** — Interpret and analyze supplied data, documents, or research inputs. Discussing analysis is not analyzing data.
- **Governed Compute** — Authorized, bounded, reproducible execution with provenance. Selecting the mode does not automatically execute.
- Persistent left workspace rail with New Chat, search, projects, and conversation management.
- Legal pages: Research & Educational Use, Terms / Disclaimer, Privacy, Intellectual Property.
- Progressive scientific inspection remains behind disclosure. Ordinary Casual answers prioritize the prose.

Chat thinking depth (Basic / Medium / Advanced) changes presentation depth only. It cannot unlock tools, data access, approvals, or execution. The client never classifies scientific intent and never rejects non-scientific requests. Frontend displays backend truth.

## Supported toolchain

Release CI uses **Node 22, npm, and the committed `package-lock.json`**.

```bash
cd frontend
npm ci
npm run typecheck
npm test -- --run
npm run build
```

Layout fixtures (not live intelligence): open `#/acceptance`.
