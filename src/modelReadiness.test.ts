import { describe, expect, it } from "vitest";
import { classifyModelReadiness, isHeuristicAssistantProse, readinessFamily } from "@ui/design/modelReadiness";
import { extractBackendDetail } from "@ui/design/chatContracts";

describe("model readiness UX mapping", () => {
  it("maps known backend codes onto typed product states", () => {
    expect(classifyModelReadiness({ code: "MODEL_PROVIDER_UNAVAILABLE" }).state).toBe("MODEL_UNREACHABLE");
    expect(classifyModelReadiness({ code: "EMPTY_MODEL_RESPONSE" }).state).toBe("COMPLETION_FAILED");
    expect(classifyModelReadiness({ code: "ANSWER_COMPILER_REJECTED" }).state).toBe("ANSWER_INTEGRITY_REJECTED");
    expect(classifyModelReadiness({ code: "ANSWER_USEFULNESS_REJECTED" }).state).toBe("ANSWER_DRAFT_REJECTED");
    expect(classifyModelReadiness({ code: "MODEL_FAILED_QUALITY_GATE" }).state).toBe("MODEL_NOT_QUALITY_QUALIFIED");
    expect(classifyModelReadiness({ code: "MODEL_STARTING" }).title).toContain("starting");
    expect(classifyModelReadiness({ code: "MODEL_NOT_CONFIGURED" }).retryable).toBe(false);
  });

  it("prefers explicit backend state over HTTP 503", () => {
    const view = classifyModelReadiness({
      status: 503,
      code: "CONVERSATION_NOT_READY",
      state: "MODEL_NOT_CONFIGURED",
      message: "The conversation model is temporarily unavailable.",
    });
    expect(view.state).toBe("MODEL_NOT_CONFIGURED");
    expect(view.backendCode).toBe("CONVERSATION_NOT_READY");
    expect(view.backendState).toBe("MODEL_NOT_CONFIGURED");
    expect(view.state).not.toBe("MODEL_UNREACHABLE");
  });

  it("does not treat qualification failures as withheld drafts", () => {
    const qualified = classifyModelReadiness({ code: "MODEL_FAILED_QUALITY_GATE" });
    expect(readinessFamily(qualified.state)).toBe("qualification");
    expect(qualified.title).toContain("not qualified");
    expect(qualified.message).not.toContain("This draft was not released");
    const rejected = classifyModelReadiness({ code: "ANSWER_COMPILER_REJECTED" });
    expect(readinessFamily(rejected.state)).toBe("answer_rejection");
    expect(rejected.message).toContain("Retry the request");
  });

  it("classifies heuristic prose as a forbidden provider, not a quality gate", () => {
    expect(classifyModelReadiness({ message: "synapse-heuristic-v1 development fallback" }).state).toBe(
      "HEURISTIC_PROVIDER_FORBIDDEN",
    );
    expect(isHeuristicAssistantProse("SYNAPSE used synapse-heuristic-v1 as a development fallback.")).toBe(true);
    expect(classifyModelReadiness({ message: "Failed to fetch" }).state).toBe("MODEL_UNREACHABLE");
    const extracted = extractBackendDetail({
      detail: { code: "CONVERSATION_NOT_READY", state: "MODEL_DOWNLOADING", message: "warming" },
    });
    expect(extracted.state).toBe("MODEL_DOWNLOADING");
  });

  it("does not treat auth, validation, or rate-limit HTTP statuses as model failure", () => {
    const unauthorized = classifyModelReadiness({ status: 401, message: "Authentication required." });
    expect(unauthorized.state).toBe("AUTH_EXPIRED");
    expect(unauthorized.retryable).toBe(false);
    expect(unauthorized.state).not.toBe("MODEL_UNREACHABLE");
    const forbidden = classifyModelReadiness({ status: 403, message: "Account was not approved." });
    expect(forbidden.state).toBe("AUTH_FORBIDDEN");
    expect(forbidden.retryable).toBe(false);
    expect(forbidden.state).not.toBe("AUTH_EXPIRED");
    expect(forbidden.title).toContain("not authorized");
    const limited = classifyModelReadiness({ status: 429, message: "Too many requests" });
    expect(limited.state).toBe("RATE_LIMITED");
    expect(limited.retryable).toBe(true);
    expect(readinessFamily(limited.state)).toBe("request");
    expect(classifyModelReadiness({ status: 409, message: "Retry is stale" }).state).toBe("REQUEST_REJECTED");
    expect(classifyModelReadiness({ status: 422, message: "Invalid body" }).state).toBe("REQUEST_REJECTED");
    expect(classifyModelReadiness({ status: 413, message: "Payload too large" }).state).toBe("PAYLOAD_TOO_LARGE");
    expect(classifyModelReadiness({ status: 500, message: "Internal error" }).state).toBe("SERVICE_ERROR");
    expect(classifyModelReadiness({ status: 500, message: "Internal error" }).state).not.toBe("MODEL_UNREACHABLE");
  });
});
