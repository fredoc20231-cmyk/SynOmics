/**
 * Canonical researcher/developer install commands rendered by the portal.
 * Keep in lockstep with docs/RESEARCHER_MANUAL.md. `make dev` launches
 * `./scripts/start-synapse.sh dev` as a research/developer start path, not
 * production certification.
 */

export const RESEARCH_PYTHON_VERSION = "3.11";
export const RESEARCH_NODE_VERSION = "22";
export const RESEARCH_NPM_VERSION = "10.9.x";

export const PYTHON_CONSTRAINT = ">=3.11,<3.12";

export const INSTALL_PREREQUISITES = [
  "Python 3.11 (the package requires >=3.11,<3.12)",
  "Node.js 22 (frontend engines pin 22.14.x)",
  "npm 10.9.x with the committed frontend/package-lock.json",
  "Git",
] as const;

export const OPTIONAL_PREREQUISITES = [
  "Docker — required for some governed-compute and production-like deployments, not for a simple research Chat conversation against a local API",
  "Ollama or another approved local model runtime — required only when you want a local model instead of a hosted provider",
] as const;

export const PYTHON_VENV_COMMANDS = `python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[biomed,causal,dev]"`;

export const PYTHON_BOOTSTRAP_SCRIPT = `./scripts/bootstrap-dev.sh`;

export const PYTHON_CHECK_COMMANDS = `./scripts/check-all.sh`;

export const PYTHON_CHECK_GATES = `python -m mypy src/synapse --strict
python -m ruff check src/synapse tests
python -m pytest tests -q --cov=src/synapse
python scripts/check_plane_separation.py src/synapse
python scripts/check_secrets.py`;

export const FRONTEND_COMMANDS = `cd frontend
npm ci
npm run typecheck
npm test -- --run
npm run build`;

export const FRONTEND_DEV_COMMAND = `cd frontend
npm run dev`;

export const LOCAL_API_COMMAND = `source .venv/bin/activate
python -m uvicorn synapse.api.chat:app --host 127.0.0.1 --port 3020`;

export const LOCAL_API_NOTE =
  "The Vite frontend in development proxies /chat, /auth, /api, /health, and /version to 127.0.0.1:3020. `make dev` runs `./scripts/start-synapse.sh dev` (model runtime, model, backend, and built UI) as a research/developer start path, not production certification. Explicit uvicorn and npm commands remain valid. Docker is not required for a simple Chat conversation against a local API.";

export const PRODUCTION_COMPOSE_COMMAND = `cp .env.production.example .env
# Replace every required secret locally. Do not commit the populated file.
docker compose -f docker-compose.native.yml up --build -d`;

export const HEALTH_CHECK_COMMANDS = `curl -fsS http://127.0.0.1:8080/health/live
curl -fsS http://127.0.0.1:8080/health/ready
curl -fsS http://127.0.0.1:8080/version`;

export const DEV_HEALTH_CHECK_COMMANDS = `curl -fsS http://127.0.0.1:3020/health/live
curl -fsS http://127.0.0.1:3020/version`;

export const DEPRECATED_STARTUP_COMMANDS = [
  "make start",
  "make run",
  "pnpm install",
  "pnpm dev",
  "python -m synapse.ui",
  "python -m http.server",
] as const;

export const USER_SAFE_VERIFICATION = [
  {
    label: "API live",
    command: "curl -fsS http://127.0.0.1:3020/health/live",
    meaning: "The HTTP service is accepting requests. This is not production certification.",
  },
  {
    label: "Version metadata",
    command: "curl -fsS http://127.0.0.1:3020/version",
    meaning: "Reports software version metadata. It does not prove scientific correctness.",
  },
  {
    label: "Frontend typecheck",
    command: "npm run typecheck",
    meaning: "TypeScript compiled. UI typecheck is not a scientific validation.",
  },
  {
    label: "Frontend tests",
    command: "npm test -- --run",
    meaning: "Client contract tests passed. They do not certify a deployment.",
  },
] as const;

export const DEPLOYMENT_LEVELS = [
  {
    level: "Research / developer workstation",
    meaning: "Editable Python install and Vite frontend for local exploration.",
    docker: "Not required for simple Chat against a local API.",
    certification: "Installation success is not production certification.",
  },
  {
    level: "Isolated-process development",
    meaning: "Developer containment for governed-compute experiments.",
    docker: "Not the production execution boundary.",
    certification: "Not hostile-code isolation and not a release gate.",
  },
  {
    level: "Container-task / reference deployment",
    meaning: "Digest-pinned worker execution used by the production-like profile.",
    docker: "Required for this deployment class.",
    certification: "Still environment-specific. A green compose up is not a public-production certificate.",
  },
] as const;
