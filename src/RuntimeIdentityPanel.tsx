import { useEffect, useState } from "react";
import {
  buildMismatchWarning,
  copyDiagnosticsBlock,
  frontendBuildSha,
  parseRuntimeIdentity,
  type RuntimeIdentity,
} from "@ui/design/runtimeIdentity";
import { getConversationReadiness, getVersion, type VersionView } from "./api";

export function RuntimeIdentityPanel({
  mode,
  thinking,
}: {
  mode?: string;
  thinking?: string;
}) {
  const [identity, setIdentity] = useState<RuntimeIdentity | null>(null);
  const [version, setVersion] = useState<VersionView | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([getVersion(), getConversationReadiness()]).then((results) => {
      if (cancelled) return;
      const versionValue = results[0].status === "fulfilled" ? results[0].value : null;
      const readyValue = results[1].status === "fulfilled" ? results[1].value : null;
      if (!versionValue && !readyValue) {
        setError("Runtime identity endpoints are not available.");
        return;
      }
      setVersion(versionValue);
      setIdentity(
        parseRuntimeIdentity({
          version: versionValue,
          conversation: readyValue?.readiness,
          health: readyValue?.health ?? null,
          frontendSha: frontendBuildSha(),
          apiBase: "/",
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const mismatch = identity ? buildMismatchWarning(identity, version) : null;

  const copy = async () => {
    if (!identity) return;
    const block = copyDiagnosticsBlock({ identity, mode, thinking });
    await navigator.clipboard?.writeText(block);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="runtime-identity" data-testid="runtime-identity" aria-labelledby="runtime-identity-title">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 id="runtime-identity-title" className="font-serif text-[16px]">Runtime identity</h3>
        <button type="button" className="ghost-btn" onClick={() => void copy()} disabled={!identity}>
          {copied ? "Copied" : "Copy diagnostics"}
        </button>
      </div>
      {error && <p className="auth-error">{error}</p>}
      {mismatch && (
        <p className="build-mismatch" role="status" data-testid="build-mismatch">
          {mismatch}
        </p>
      )}
      {identity && (
        <dl className="runtime-identity-grid">
          <div><dt>Frontend build SHA</dt><dd>{identity.frontendSha || "not reported"}</dd></div>
          <div><dt>Backend build SHA</dt><dd>{identity.backendSha || "not reported"}</dd></div>
          <div><dt>Backend version</dt><dd>{identity.backendVersion || "not reported"}</dd></div>
          <div><dt>Provider</dt><dd>{identity.provider || "not reported"}</dd></div>
          <div><dt>Model</dt><dd>{identity.model || "not reported"}</dd></div>
          <div><dt>Heuristic</dt><dd>{identity.heuristic === null ? "not reported" : String(identity.heuristic)}</dd></div>
          <div><dt>Transport</dt><dd>{identity.transport}</dd></div>
          <div><dt>Qualification</dt><dd>{identity.qualification}</dd></div>
          <div><dt>Conversation readiness</dt><dd>{identity.conversationReadiness}</dd></div>
          <div><dt>Environment</dt><dd>{identity.environment || "not reported"}</dd></div>
          <div><dt>API base</dt><dd>{identity.apiBase}</dd></div>
        </dl>
      )}
    </section>
  );
}
