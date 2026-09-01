import { useEffect, useState } from "react";
import { getVersion, type VersionView } from "../api";

export function VersionBadge({
  authenticated,
  isAdmin = false,
  isDeveloper = false,
}: {
  authenticated: boolean;
  isAdmin?: boolean;
  isDeveloper?: boolean;
}) {
  const [version, setVersion] = useState<VersionView | null>(null);
  const showSha = authenticated && (isAdmin || isDeveloper);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    void getVersion()
      .then((value) => {
        if (!cancelled) setVersion(value);
      })
      .catch(() => {
        if (!cancelled) setVersion(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const label = version?.version ? `Research Beta · ${version.version}` : "Research Beta";
  const sha = showSha ? version?.git_sha || version?.backend_sha || version?.frontend_sha : "";

  return (
    <p className="portal-version-badge" data-testid="portal-version-badge">
      <span>{authenticated && version ? label : "Research Beta"}</span>
      {sha ? <span className="portal-version-sha" data-testid="portal-version-sha">{sha}</span> : null}
    </p>
  );
}
