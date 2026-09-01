import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantMessageView } from "@ui/components/AssistantMessageView";
import { EpistemicChatApp } from "@ui/components/EpistemicChatApp";
import { GroundingStateCard } from "@ui/components/GroundingStateCard";
import { ModeSelector } from "@ui/components/ModeSelector";
import {
  groundingFromAssistant,
  isGroundingAdmissionCode,
  parseEntityGroundingState,
} from "@ui/design/entityGrounding";
import { extractMeasuredQualifications, modeAvailabilityFromBackend, qualificationBanner } from "@ui/design/modeQualification";
import { classifyModelReadiness } from "@ui/design/modelReadiness";
import { emptyAssistantMessage } from "@ui/sse";

describe("backend entity grounding consumption", () => {
  it("parses Codex P1.3 grounding states without inventing them", () => {
    expect(parseEntityGroundingState("GROUNDED")).toBe("GROUNDED");
    expect(parseEntityGroundingState("VERIFY_REQUIRED")).toBe("VERIFY_REQUIRED");
    expect(parseEntityGroundingState("AMBIGUOUS")).toBe("AMBIGUOUS");
    expect(parseEntityGroundingState("UNRESOLVED")).toBe("UNRESOLVED");
    expect(parseEntityGroundingState("cake")).toBeNull();
  });

  it("renders VERIFY_REQUIRED / AMBIGUOUS / UNRESOLVED as epistemic cards, not MODEL_UNREACHABLE", () => {
    for (const state of ["VERIFY_REQUIRED", "AMBIGUOUS", "UNRESOLVED"] as const) {
      const msg = emptyAssistantMessage("g1");
      msg.text = "I couldn't reliably identify that term well enough to give a factual answer.";
      msg.scientific = {
        message_id: "g1",
        conversation_id: "c",
        role: "assistant",
        status: "complete",
        blocks: [{ block_id: "b1", kind: "markdown", text: msg.text, claim_ids: [] }],
        claim_links: [],
        citation_links: [],
        artifact_refs: [],
        created_at: 1,
        model_metadata: {
          role: "conversation",
          provider: "not_invoked",
          model: "not_invoked",
          response_sha256: "",
          latency_ms: 0,
          fallback_status: "none",
          kernel_invoked: false,
          tools_invoked: false,
          grounding_state: state,
          entity_grounding_invoked: true,
        },
      };
      const markup = renderToStaticMarkup(
        <AssistantMessageView
          msg={msg}
          onResolve={() => undefined}
          onApproval={() => undefined}
          onFocus={() => undefined}
          onStop={() => undefined}
        />,
      );
      expect(markup).toContain(`data-grounding-state="${state}"`);
      expect(markup).not.toContain('data-testid="model-unavailable"');
      expect(markup).not.toContain("Chat is temporarily unavailable");
      expect(markup).not.toContain("MODEL_UNREACHABLE");
      expect(classifyModelReadiness({ code: state, message: msg.text }).state).not.toBe("MODEL_UNREACHABLE");
      expect(isGroundingAdmissionCode(state)).toBe(true);
    }
  });

  it("does not treat Arabic taro clarification as a red infra error", () => {
    const presentation = groundingFromAssistant({
      modelMetadata: {
        grounding_state: "AMBIGUOUS",
        language: "ar",
        entity_grounding_invoked: true,
      },
      text: "وجدت أكثر من معنى محتمل لهذا المصطلح",
    });
    expect(presentation?.state).toBe("AMBIGUOUS");
    const markup = renderToStaticMarkup(<GroundingStateCard presentation={presentation!} />);
    expect(markup).toContain('dir="auto"');
    expect(markup).not.toContain("model-unavailable");
  });
});

describe("backend qualification consumption", () => {
  it("does not disable modes when the backend has not reported qualifications", () => {
    expect(extractMeasuredQualifications({ status: "ok" })).toBeNull();
    const availability = modeAvailabilityFromBackend({ measuredQualifications: null, qualification: "NOT_MEASURED" });
    expect(availability.science_answer).toBeUndefined();
    expect(availability.casual).toBeUndefined();
    expect(qualificationBanner({ availability, qualification: "NOT_MEASURED" })).toMatch(/not been measured/i);
  });

  it("disables Science and Deep Science only from measured backend qualifications", () => {
    const availability = modeAvailabilityFromBackend({
      measuredQualifications: ["GENERAL_CHAT_QUALIFIED"],
      qualification: "QUALIFIED",
    });
    expect(availability.casual).toBeUndefined();
    expect(availability.science_answer?.available).toBe(false);
    expect(availability.deep_research?.available).toBe(false);
    const markup = renderToStaticMarkup(
      <ModeSelector variant="rail" value="casual" availability={availability} onChange={() => undefined} />,
    );
    expect(markup).toContain("Casual remains available");
    expect(markup).not.toContain("sciencePrompt");
  });

  it("shows a typed qualification card instead of MODEL_UNREACHABLE", () => {
    const msg = emptyAssistantMessage("q1");
    msg.text = "This scientific mode is not available for the configured model deployment.";
    msg.scientific = {
      message_id: "q1",
      conversation_id: "c",
      role: "assistant",
      status: "complete",
      blocks: [{ block_id: "b1", kind: "markdown", text: msg.text, claim_ids: [] }],
      claim_links: [],
      citation_links: [],
      artifact_refs: [],
      created_at: 1,
      response_label: "Model qualification required",
      model_metadata: {
        role: "conversation",
        provider: "ollama",
        model: "qwen2.5:0.5b",
        response_sha256: "",
        latency_ms: 0,
        fallback_status: "none",
        kernel_invoked: false,
        tools_invoked: false,
        model_qualification_state: "NOT_QUALIFIED",
        required_model_qualification: "SCIENCE_SYNTHESIS_QUALIFIED",
      },
    };
    const markup = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        workflow="science_answer"
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onStop={() => undefined}
      />,
    );
    expect(markup).toContain('data-testid="qualification-unavailable"');
    expect(markup).not.toContain('data-testid="model-unavailable"');
  });

  it("keeps Casual selectable when Science is unavailable", () => {
    const markup = renderToStaticMarkup(
      <EpistemicChatApp
        conversationId="c1"
        modeAvailability={{ science_answer: { available: false, reason: "Backend reports Science unavailable." } }}
      />,
    );
    expect(markup).toContain("qualification-mode-banner");
    expect(markup).toContain('data-mode="casual"');
  });
});

describe("RTL dir=auto", () => {
  it("applies dir=auto on composer and user text without whole-app RTL", () => {
    const markup = renderToStaticMarkup(<EpistemicChatApp conversationId="rtl" />);
    expect(markup).toContain('dir="auto"');
    expect(markup).not.toContain('dir="rtl"');
  });
});
