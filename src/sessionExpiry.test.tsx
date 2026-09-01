import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { classifyModelReadiness } from "@ui/design/modelReadiness";
import { shouldAcceptSend } from "@ui/design/chatContracts";
import {
  SESSION_EXPIRED_USER_MESSAGE,
  classifyChatAuthFailure,
  planChatAuthFailure,
} from "@ui/design/sessionExpiry";
import { RequestErrorCard } from "@ui/components/EpistemicChatApp";
import { AssistantMessageView } from "@ui/components/AssistantMessageView";
import { emptyAssistantMessage } from "@ui/sse";
import { AuthGate } from "./App";
import { LegalPage } from "./legal/LegalPage";

describe("Chat 401 session expiry is not a model failure", () => {
  it("maps 401 UNAUTHENTICATED to session expiry without model Retry or a retry loop", () => {
    const kind = classifyChatAuthFailure({ status: 401, code: "UNAUTHENTICATED" });
    expect(kind).toBe("session_expired");
    const plan = planChatAuthFailure(kind);
    expect(plan.stopOmega).toBe(true);
    expect(plan.showModelRetry).toBe(false);
    expect(plan.showErrorCard).toBe(false);
    expect(plan.clearAuthenticatedSession).toBe(true);
    expect(plan.showSessionExpiredUi).toBe(true);
    expect(plan.autoRetry).toBe(false);
    expect(plan.leakDiagnostics).toBe(false);
    expect(plan.preserveComposerDraft).toBe(true);
    expect(plan.preserveCredentials).toBe(false);
    expect(shouldAcceptSend({ streaming: false, inFlight: false, sessionExpired: true })).toBe(false);

    const view = classifyModelReadiness({
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Authentication required. request_id=secret-trace",
    });
    expect(view.state).toBe("AUTH_EXPIRED");
    expect(view.retryable).toBe(false);
    const card = renderToStaticMarkup(
      <RequestErrorCard summary={view.message} technical="UNAUTHENTICATED request_id=secret-trace" readiness={view} onRetry={() => undefined} />,
    );
    expect(card).not.toContain(">Retry<");
    expect(card).not.toContain("secret-trace");
    expect(card).not.toContain("omega-working");

    const streaming = renderToStaticMarkup(
      <AssistantMessageView
        msg={emptyAssistantMessage("expiring")}
        streaming
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onRetry={() => undefined}
        onStop={() => undefined}
      />,
    );
    expect(streaming).toContain("omega-working");
    expect(plan.stopOmega).toBe(true);

    const expired = renderToStaticMarkup(
      <AuthGate
        mode="login"
        error=""
        setupMessage=""
        sessionExpired
        onToggle={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(expired).toContain('data-testid="session-expired"');
    expect(expired).toContain(SESSION_EXPIRED_USER_MESSAGE);
    expect(expired).toContain('data-testid="auth-gate"');
    expect(expired).not.toContain(">Retry<");
    expect(expired).not.toContain("omega-working");
    expect(expired).not.toContain("secret-trace");
    expect(expired).not.toContain('type="password">secret');
    expect(expired).toContain('type="password"');
  });

  it("keeps 403 pending or suspended distinct from 401 session expiry", () => {
    const pending = classifyChatAuthFailure({ status: 403, code: "FORBIDDEN" });
    expect(pending).toBe("account_forbidden");
    expect(pending).not.toBe("session_expired");
    const plan = planChatAuthFailure(pending);
    expect(plan.showSessionExpiredUi).toBe(false);
    expect(plan.clearAuthenticatedSession).toBe(false);
    expect(plan.showModelRetry).toBe(false);
    expect(plan.autoRetry).toBe(false);
    const view = classifyModelReadiness({ status: 403, code: "FORBIDDEN", message: "Access is pending administrator approval." });
    expect(view.state).toBe("AUTH_FORBIDDEN");
    expect(view.state).not.toBe("AUTH_EXPIRED");
    const card = renderToStaticMarkup(
      <RequestErrorCard summary={view.message} technical="FORBIDDEN" readiness={view} onRetry={() => undefined} />,
    );
    expect(card).toContain("Access is not authorized");
    expect(card).not.toContain(">Retry<");
    expect(card).not.toContain("Session expired");
    const expired = renderToStaticMarkup(
      <AuthGate
        mode="login"
        error=""
        setupMessage=""
        sessionExpired={false}
        onToggle={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(expired).not.toContain('data-testid="session-expired"');
    expect(expired).not.toContain(SESSION_EXPIRED_USER_MESSAGE);
  });
});

describe("deletion and retention legal truth", () => {
  it("states workspace removal without claiming immediate physical erasure or indefinite retention", () => {
    const markup = renderToStaticMarkup(<LegalPage page="privacy" onClose={() => undefined} />);
    expect(markup).toContain("Deletion and retention");
    expect(markup).toContain("removes it from normal workspace access");
    expect(markup).toContain("may be retained according to");
    expect(markup).toContain("does not claim that deleted content is always physically erased immediately");
    expect(markup).toContain("does not claim that every deleted record is retained indefinitely");
    expect(markup).not.toContain("permanently erased from all systems");
  });
});
