import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EpistemicChatApp, RequestErrorCard } from "@ui/components/EpistemicChatApp";
import { ModeSelector } from "@ui/components/ModeSelector";
import { SourceCards, sourceCardsFromAnswer } from "@ui/components/SourceCards";
import { classifyModelReadiness, isHeuristicAssistantProse, isHeuristicProvider } from "@ui/design/modelReadiness";
import { correlateModeState } from "@ui/design/chatContracts";
import type { AnswerPackageView } from "@ui/types/message";

describe("integration release blockers", () => {
  it("never renders heuristic prose as an assistant turn", () => {
    const text = "SYNAPSE used synapse-heuristic-v1 as a development fallback.";
    expect(isHeuristicAssistantProse(text)).toBe(true);
    const view = classifyModelReadiness({ heuristicProse: true, message: text });
    expect(view.state).toBe("HEURISTIC_PROVIDER_FORBIDDEN");
    const markup = renderToStaticMarkup(
      <RequestErrorCard summary={view.message} technical={text} readiness={view} onRetry={() => undefined} />,
    );
    expect(markup).not.toContain("assistant-turn");
    expect(markup).not.toContain("MODEL_FAILED_QUALITY_GATE");
    expect(markup).toContain("Chat model is not configured");
    expect(
      isHeuristicProvider({
        text: "Homologous recombination is a high-fidelity pathway for repairing DNA double-strand breaks.",
        provider: "heuristic",
        model: "synapse-heuristic-v1",
        fallbackStatus: "development_heuristic",
      }),
    ).toBe(true);
    expect(
      isHeuristicProvider({
        text: "Homologous recombination is a high-fidelity pathway for repairing DNA double-strand breaks.",
        provider: "ollama",
        model: "qwen2.5:latest",
        fallbackStatus: "none",
      }),
    ).toBe(false);
  });

  it("does not fabricate references or relabel retrieved context as support", () => {
    const pkg: AnswerPackageView = {
      schema_version: "synapse.answer.v1",
      answer_id: "a",
      conversation_id: "c",
      product_mode: "syn_chat",
      output_policy: "CONVERSATION",
      direct_answer: "See PMID:99999999 in the prose.",
      answer_status: "ANSWERED",
      claims: [],
      evidence: [
        {
          evidence_id: "ev1",
          canonical_uri: "https://pubmed.ncbi.nlm.nih.gov/1/",
          persistent_identifier: "PMID:1",
          source_identity: "Backend source",
          source_quality: "high",
          conflict_status: "none",
        },
        {
          evidence_id: "ev1-dup",
          canonical_uri: "https://pubmed.ncbi.nlm.nih.gov/1/",
          persistent_identifier: "PMID:1",
          source_identity: "Duplicate PMID",
          source_quality: "high",
          conflict_status: "none",
        },
      ],
      execution_provenance: [],
      figures: [],
      tables: [],
      assumptions: [],
      limitations: [],
      recommendations: [],
      citations: [],
      warnings: [],
      trace: { trace_id: "t", events: [] },
      epistemic_badge: "cited",
      temporal_freshness: "unavailable",
    };
    const sources = sourceCardsFromAnswer(pkg);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.role).toBe("retrieved");
    const markup = renderToStaticMarkup(<SourceCards sources={sources} defaultOpen />);
    expect(markup).toContain("Retrieved/context source");
    expect(markup).not.toContain("Supporting evidence");
    expect(markup).not.toContain("PMID:99999999");
  });

  it("locks mode changes while streaming and does not block Casual from frontend scoring", () => {
    const locked = renderToStaticMarkup(
      <EpistemicChatApp conversationId="race" experienceMode="syn_chat" modeChanging />,
    );
    expect(locked).toContain('data-mode="casual"');
    const selector = renderToStaticMarkup(<ModeSelector value="casual" disabled onChange={() => undefined} />);
    expect(selector).toContain("disabled");
    const available = renderToStaticMarkup(
      <ModeSelector
        variant="rail"
        value="casual"
        availability={{ deep_research: { available: false, reason: "Backend reports Deep Science unavailable." } }}
        onChange={() => undefined}
      />,
    );
    expect(available).toContain("Backend reports Deep Science unavailable.");
    expect(available).not.toContain("3b");
  });

  it("reports MODE_STATE_DIVERGENCE instead of silently correcting", () => {
    const result = correlateModeState({
      selected: "casual",
      requested: "deep_research",
      persisted: "casual",
      effective: "deep_research",
      rendered: "casual",
    });
    expect(result.ok).toBe(false);
  });
});
