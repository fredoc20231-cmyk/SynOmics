import { useEffect, useState } from "react";
import {
  DEPRECATED_STARTUP_COMMANDS,
  DEPLOYMENT_LEVELS,
  DEV_HEALTH_CHECK_COMMANDS,
  FRONTEND_COMMANDS,
  FRONTEND_DEV_COMMAND,
  HEALTH_CHECK_COMMANDS,
  INSTALL_PREREQUISITES,
  LOCAL_API_COMMAND,
  LOCAL_API_NOTE,
  OPTIONAL_PREREQUISITES,
  PRODUCTION_COMPOSE_COMMAND,
  PYTHON_BOOTSTRAP_SCRIPT,
  PYTHON_CHECK_COMMANDS,
  PYTHON_VENV_COMMANDS,
  USER_SAFE_VERIFICATION,
} from "../docs/installGuide";
import { SYNAPSE_REPOSITORY_ACCESS_COPY, SYNAPSE_REPOSITORY_PUBLIC_CLONE, SYNAPSE_REPOSITORY_URL, repositoryCloneHint } from "./repoAccess";
import { CopyableBlock } from "./CopyableBlock";

const TABS = [
  { id: "research", label: "Research / developer" },
  { id: "frontend", label: "Frontend" },
  { id: "models", label: "Models" },
  { id: "deploy", label: "Deployment levels" },
] as const;

type InstallTab = (typeof TABS)[number]["id"];

export function InstallHub({ initialTab = "research" }: { initialTab?: InstallTab }) {
  const [tab, setTab] = useState<InstallTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  return (
    <section className="portal-install" id="synapse-install" aria-labelledby="synapse-install-title" data-testid="install-hub">
      <div id="synapse-local-models" className="portal-anchor" />
      <p className="portal-kicker">Installation Hub</p>
      <h2 id="synapse-install-title">Install locally</h2>
      <p className="portal-lede">
        Research/developer installation. <code>make dev</code> launches <code>./scripts/start-synapse.sh dev</code> as a research/developer start path, not production certification.
        Docker is not required for a simple Chat conversation against a local API.
      </p>
      <p className="portal-access">{SYNAPSE_REPOSITORY_ACCESS_COPY}</p>
      {SYNAPSE_REPOSITORY_PUBLIC_CLONE ? (
        <p>
          Public clone: <a href={SYNAPSE_REPOSITORY_URL}>{SYNAPSE_REPOSITORY_URL}</a>
        </p>
      ) : (
        <p data-testid="repo-access-controlled">
          Configured repository (access required): <code>{SYNAPSE_REPOSITORY_URL}</code>
        </p>
      )}
      <CopyableBlock label="Clone with granted access" code={repositoryCloneHint()} />

      <h3>Prerequisites</h3>
      <ul>
        {INSTALL_PREREQUISITES.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <ul>
        {OPTIONAL_PREREQUISITES.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        Unvalidated platforms, including native Windows or macOS application packaging, are a community/developer path. This
        hub does not invent a native installer.
      </p>

      <div className="portal-tabs" role="tablist" aria-label="Installation topics">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            id={`install-tab-${item.id}`}
            aria-controls={`install-panel-${item.id}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "research" && (
        <div role="tabpanel" id="install-panel-research" aria-labelledby="install-tab-research">
          <h3>Research/developer Python installation</h3>
          <CopyableBlock label="Python 3.11 virtual environment" code={PYTHON_VENV_COMMANDS} />
          <CopyableBlock label="Optional bootstrap script" code={PYTHON_BOOTSTRAP_SCRIPT} />
          <CopyableBlock
            label="Run the local API"
            code={LOCAL_API_COMMAND}
            caption={LOCAL_API_NOTE}
          />
          <CopyableBlock label="Contributor check script" code={PYTHON_CHECK_COMMANDS} />
          <p className="sr-only">{DEPRECATED_STARTUP_COMMANDS.join(" ")} are not canonical start commands.</p>
        </div>
      )}

      {tab === "frontend" && (
        <div role="tabpanel" id="install-panel-frontend" aria-labelledby="install-tab-frontend">
          <h3>Frontend — lockfile for reproducibility</h3>
          <CopyableBlock label="npm ci, typecheck, test, build" code={FRONTEND_COMMANDS} />
          <CopyableBlock
            label="Vite development shell"
            code={FRONTEND_DEV_COMMAND}
            caption="The development server proxies API paths to 127.0.0.1:3020. Use the committed package-lock.json. pnpm is not the release path."
          />
        </div>
      )}

      {tab === "models" && (
        <div role="tabpanel" id="install-panel-models" aria-labelledby="install-tab-models">
          <h3>Local and hosted models</h3>
          <p>
            Models propose; they do not authorize. Development may use a heuristic provider for interface testing. Representative
            conversation quality requires a configured real provider or local runtime.
          </p>
          <CopyableBlock
            label="Environment placeholders only — do not paste live secrets here"
            code={`# Private environment file — placeholders, not credentials
SYNAPSE_MODEL_PROVIDER=ollama
SYNAPSE_MODEL_BASE_URL=http://127.0.0.1:11434
SYNAPSE_MODEL_API_KEY=
SYNAPSE_MODEL_NAME=your-approved-local-model`}
            caption="A local runtime such as Ollama is optional. Local inference is not a privacy guarantee. Do not commit API keys."
          />
        </div>
      )}

      {tab === "deploy" && (
        <div role="tabpanel" id="install-panel-deploy" aria-labelledby="install-tab-deploy">
          <h3>Deployment levels</h3>
          <p>Installation success is not production certification.</p>
          <div className="portal-matrix">
            {DEPLOYMENT_LEVELS.map((row) => (
              <article key={row.level}>
                <h4>{row.level}</h4>
                <p>{row.meaning}</p>
                <p>{row.docker}</p>
                <p>{row.certification}</p>
              </article>
            ))}
          </div>
          <CopyableBlock
            label="Reference deployment (secrets replaced locally)"
            code={PRODUCTION_COMPOSE_COMMAND}
            caption="Docker is required for this class of deployment, not for every simple Chat install."
          />
          <CopyableBlock label="Production-like health" code={HEALTH_CHECK_COMMANDS} />
        </div>
      )}

      <h3>Developer verification — user-safe indicators</h3>
      <ul>
        {USER_SAFE_VERIFICATION.map((item) => (
          <li key={item.label}>
            <strong>{item.label}.</strong> {item.meaning} <code>{item.command}</code>
          </li>
        ))}
      </ul>
      <CopyableBlock label="Local API health" code={DEV_HEALTH_CHECK_COMMANDS} />
    </section>
  );
}
