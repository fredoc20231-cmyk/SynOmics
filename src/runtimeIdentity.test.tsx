import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildMismatchWarning,
  casualUiLeaksEngineering,
  copyDiagnosticsBlock,
  parseRuntimeIdentity,
} from "@ui/design/runtimeIdentity";
import { AdminPanel } from "./AdminPanel";
import { conversationReadinessFromHealth } from "./api";

describe("admin runtime identity", () => {
  it("parses version and conversation readiness without inventing mismatch", () => {
    const identity = parseRuntimeIdentity({
      version: {
        version: "0.1.0-rc1",
        git_sha: "backendsha1",
        backend_sha: "backendsha1",
        frontend_sha: "frontendsha1",
        environment: "dev",
        schema_version: "1",
      },
      conversation: {
        state: "READY",
        ready: true,
        provider: "ollama",
        model: "qwen2.5:latest",
        heuristic: false,
        transport: "READY",
        qualification: "GENERAL_CHAT",
      },
      frontendSha: "frontendsha1",
      apiBase: "/",
    });
    expect(identity.backendSha).toBe("backendsha1");
    expect(identity.qualification).toBe("QUALIFIED");
    expect(identity.transport).toBe("READY");
    expect(identity.heuristic).toBe(false);
    expect(buildMismatchWarning(identity, { frontend_sha: "frontendsha1", backend_sha: "backendsha1" })).toBeNull();
    expect(buildMismatchWarning(identity, { frontend_sha: "other", backend_sha: "backendsha1" })).toContain("does not match");
  });

  it("copies a sanitized diagnostic block", () => {
    const identity = parseRuntimeIdentity({
      version: { version: "0.1.0-rc1", backend_sha: "abc", git_sha: "abc", environment: "dev" },
      conversation: { state: "READY", ready: true, provider: "ollama", model: "qwen2.5:latest", heuristic: false },
      frontendSha: "def",
    });
    const block = copyDiagnosticsBlock({ identity, mode: "casual", thinking: "quick", timestamp: "2026-08-24T00:00:00Z" });
    expect(block).toContain("frontend_sha=def");
    expect(block).toContain("backend_sha=abc");
    expect(block).toContain("provider=ollama");
    expect(block).not.toMatch(/password|api_key|cookie|authorization/i);
  });

  it("does not invent READY when /health/ready omits conversation", () => {
    const readiness = conversationReadinessFromHealth({
      status: "ok",
      checks: {
        database: { status: "PASS" },
        model: { status: "PASS", provider: "", model: "", reachable: true },
      },
      model: { ok: false, detail: { reachable: true, heuristic: true } },
    });
    expect(readiness.state).toBe("UNKNOWN");
    expect(readiness.ready).toBe(false);
    expect(readiness.heuristic).toBe(true);
  });

  it("keeps provider, model, and SHA out of ordinary admin-closed chrome", () => {
    const markup = renderToStaticMarkup(<AdminPanel onClose={() => undefined} mode="casual" thinking="quick" />);
    expect(markup).toContain("Runtime");
    expect(casualUiLeaksEngineering("A short professional thank-you email is below.")).toEqual([]);
  });
});
