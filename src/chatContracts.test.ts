import { describe, expect, it } from "vitest";
import {
  blackHoleRegression,
  buildContinueBody,
  buildRetryBody,
  classifyChatFailure,
  correlateModeState,
  extractBackendDetail,
  releaseBlockersFromAnswer,
  shouldAcceptSend,
  shouldApplyStreamEvent,
} from "@ui/design/chatContracts";

describe("chat contract consumption", () => {
  it("parses structured 503 detail before HTTP status", () => {
    const extracted = extractBackendDetail({
      detail: {
        code: "CONVERSATION_NOT_READY",
        state: "MODEL_NOT_CONFIGURED",
        message: "The conversation model is temporarily unavailable. Retry when Chat is ready.",
      },
    });
    expect(extracted.code).toBe("CONVERSATION_NOT_READY");
    expect(extracted.state).toBe("MODEL_NOT_CONFIGURED");
    const view = classifyChatFailure({
      status: 503,
      code: extracted.code,
      state: extracted.state,
      message: extracted.message || "",
      raw: null,
    });
    expect(view.state).toBe("MODEL_NOT_CONFIGURED");
    expect(view.backendCode).toBe("CONVERSATION_NOT_READY");
    expect(view.backendState).toBe("MODEL_NOT_CONFIGURED");
  });

  it("builds retry_last_user without synthesizing a new question", () => {
    const body = buildRetryBody({
      conversationId: "conv_1",
      originalUserContent: "how to make a black hole",
      iensureMode: false,
    });
    expect(body).toEqual({
      conversation_id: "conv_1",
      retry_last_user: true,
      iensure_mode: false,
      message: "how to make a black hole",
    });
    expect(body.message).not.toContain("Please retry");
    expect(Object.keys(body)).not.toContain("attachment_ids");
  });

  it("builds Continue from a resume identifier and never resends the user question", () => {
    const body = buildContinueBody({
      conversationId: "conv_1",
      resumeCorrelationId: "corr_9",
      iensureMode: true,
    });
    expect(body.resume_correlation_id).toBe("corr_9");
    expect(body.continue_until_done).toBe(true);
    expect(body.message).toBe("");
  });

  it("flags mode-state divergence without correcting it", () => {
    const result = correlateModeState({
      selected: "casual",
      requested: "casual",
      persisted: "casual",
      effective: "deep_research",
      rendered: "casual",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MODE_STATE_DIVERGENCE");
  });

  it("guards send, conversation-switch, and black-hole release blockers", () => {
    expect(shouldAcceptSend({ streaming: true, inFlight: false })).toBe(false);
    expect(shouldAcceptSend({ streaming: false, inFlight: false })).toBe(true);
    expect(shouldAcceptSend({ streaming: false, inFlight: false, sessionExpired: true })).toBe(false);
    expect(
      shouldApplyStreamEvent({
        boundConversationId: "A",
        activeConversationId: "B",
        generationId: "g1",
        activeGenerationId: "g1",
        aborted: false,
      }),
    ).toBe(false);
    expect(
      blackHoleRegression({
        providerReady: true,
        heuristic: false,
        qualityGateFromHeuristic: false,
        analyzeRecommended: false,
        deepScienceRequired: false,
        emptySuccessful: false,
        ordinaryAnswer: true,
        unavailableCard: false,
      }),
    ).toBe("PASS");
    expect(
      releaseBlockersFromAnswer({
        heuristicRendered: true,
        emptySuccessfulAnswer: false,
        wrongConversationResponse: false,
        duplicateRetryUserMessage: false,
        modeStateDivergence: false,
        referenceFabricated: false,
        retrievedRelabeledSupport: false,
        omegaStuck: false,
        casualBlockedByFrontend: false,
      }),
    ).toContain("heuristic prose rendered");
  });
});
