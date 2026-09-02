import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EpistemicChatApp } from "@ui/components/EpistemicChatApp";
import { AssistantMessageView } from "@ui/components/AssistantMessageView";
import { ModeSelector } from "@ui/components/ModeSelector";
import { ModelUnavailableCard } from "@ui/components/ModelUnavailableCard";
import { SourceCards, sourceCardsFromAnswer } from "@ui/components/SourceCards";
import { classifyModelReadiness } from "@ui/design/modelReadiness";
import {
  persistedModeFromWorkflow,
  workflowById,
  workflowFromPersistedMode,
} from "@ui/design/productModes";
import { emptyAssistantMessage } from "@ui/sse";
import { LegalFooter } from "./LegalFooter";
import { WorkspaceInfoDialog } from "./WorkspaceInfoDialog";
import { LegalPage } from "./legal/LegalPage";

/** Frontend acceptance matrix. Live model intelligence is release-qualified separately. */
describe("frontend acceptance matrix", () => {
  it("A. Casual empty state remains a first-class general assistant", () => {
    const markup = renderToStaticMarkup(<EpistemicChatApp conversationId="a" experienceMode="syn_chat" />);
    expect(markup).toContain("What are you working on?");
    expect(markup).toContain("Summarize evidence linking BRCA1 deficiency to PARP inhibitor sensitivity.");
    expect(markup).toContain("Help me improve the academic clarity of this paragraph");
    expect(markup).toContain('data-mode="casual"');
  });

  it("B. Synthesis has its own academic science empty state without refusing ordinary prompts", () => {
    const markup = renderToStaticMarkup(
      <EpistemicChatApp conversationId="b" experienceMode="syn_science" sciencePreset="science_answer" />,
    );
    expect(markup).toContain("Synthesize science with academic rigor.");
    expect(markup).toContain("Synthesis");
    expect(markup).toContain(workflowById("science_answer").starters[0].example);
    expect(markup).toContain('data-mode="science_answer"');
    expect(markup).not.toContain("not a scientific question");
  });

  it("C. Deep Cortex advertises evidence-audited research rather than generic chat", () => {
    const markup = renderToStaticMarkup(
      <EpistemicChatApp conversationId="c" experienceMode="syn_science" sciencePreset="deep_research" />,
    );
    expect(markup).toContain("Commission a research-grade evidence investigation.");
    expect(markup).toContain("Deep Cortex");
    expect(markup).toContain(workflowById("deep_research").starters[0].example);
    expect(markup).toContain('data-mode="deep_research"');
    expect(markup).toContain("mode-deep_research");
    expect(markup).not.toContain("Investigate in depth.");
  });

  it("D. Mode switch Casual → Deep Cortex preserves the conversation surface", () => {
    const items = [{ role: "user" as const, id: "u1", content: "Describe neoantigen analysis." }];
    const casual = renderToStaticMarkup(
      <EpistemicChatApp conversationId="d" restoredItems={items} experienceMode="syn_chat" />,
    );
    const deep = renderToStaticMarkup(
      <EpistemicChatApp
        conversationId="d"
        restoredItems={items}
        experienceMode="syn_science"
        sciencePreset="deep_research"
      />,
    );
    expect(casual).toContain("Describe neoantigen analysis.");
    expect(deep).toContain("Describe neoantigen analysis.");
    expect(persistedModeFromWorkflow("deep_research").science_preset).toBe("deep_research");
    expect(workflowFromPersistedMode("syn_science", "deep_research")).toBe("deep_research");
  });

  it("E. Conceptual analysis remains conversational with an optional Synthetic Mapping CTA", () => {
    const msg = emptyAssistantMessage("e");
    msg.text = "Survival analysis estimates time-to-event outcomes.";
    msg.scientific = {
      message_id: "e",
      conversation_id: "conv",
      role: "assistant",
      status: "complete",
      blocks: [{ block_id: "b1", kind: "markdown", text: msg.text, claim_ids: [] }],
      claim_links: [],
      citation_links: [],
      artifact_refs: [],
      created_at: 0,
      answer_package: {
        schema_version: "synapse.answer.v1",
        answer_id: "e",
        conversation_id: "conv",
        product_mode: "syn_chat",
        output_policy: "CONVERSATION",
        direct_answer: msg.text,
        answer_status: "ANSWERED",
        claims: [],
        evidence: [],
        execution_provenance: [],
        figures: [],
        tables: [],
        assumptions: [],
        limitations: [],
        recommendations: [],
        citations: [],
        warnings: [],
        trace: { trace_id: "t", events: [] },
        epistemic_badge: "model",
        temporal_freshness: "unavailable",
        integrity: {
          answer_status: "ANSWERED",
          answer_type: "Direct answer",
          answer_integrity_type: "MODEL_ONLY",
          evidence_count: 0,
          verified_claim_count: 0,
          unresolved_claim_count: 0,
          contradiction_count: 0,
          freshness_status: "unavailable",
          artifact_count: 0,
          limitations: [],
          recommended_next_action: "Analyze your attached dataset if you want computed results.",
        },
      },
    };
    const markup = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        workflow="casual"
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onEscalation={() => undefined}
        onStop={() => undefined}
      />,
    );
    expect(markup).toContain("Survival analysis estimates time-to-event outcomes.");
    expect(markup).toContain("Open Synthetic Mapping");
    expect(markup).not.toContain("This requires Analyze.");
  });

  it("F. Actual data request keeps Synthetic Mapping honest", () => {
    const markup = renderToStaticMarkup(
      <EpistemicChatApp conversationId="f" experienceMode="syn_science" sciencePreset="analyze" />,
    );
    expect(markup).toContain("Synthetic Mapping");
    expect(markup).toContain("Interpret and analyze data, documents, or research inputs you supply.");
    expect(markup).toContain("Discussing an analysis is not the same as analyzing data.");
    expect(markup).toContain("Dataset required for computed results");
    expect(markup).not.toContain("Analysis complete");
  });

  it("G. General chat empty state stays a first-class Casual product", () => {
    const markup = renderToStaticMarkup(<EpistemicChatApp conversationId="g" experienceMode="syn_chat" />);
    expect(markup).toContain("Help me improve the academic clarity of this paragraph");
    expect(markup).not.toContain("Syn-Chat");
    expect(markup).not.toContain("kernel");
  });

  it("H. Model unavailable uses typed readiness UX", () => {
    const view = classifyModelReadiness({ code: "MODEL_UNREACHABLE" });
    const markup = renderToStaticMarkup(<ModelUnavailableCard view={view} onRetry={() => undefined} />);
    expect(markup).toContain("Chat is temporarily unavailable");
    expect(markup).toContain("Retry");
    expect(markup).toContain('data-testid="model-unavailable"');
  });

  it("I. Retry is absent on completed answers and remains on failed retryable turns", () => {
    const msg = emptyAssistantMessage("i");
    msg.text = "Answer";
    const completed = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        workflow="casual"
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onRetry={() => undefined}
        onStop={() => undefined}
      />,
    );
    expect(completed).not.toContain(">Retry<");
    expect(completed).not.toContain("user-turn");
    const failure = classifyModelReadiness({ code: "COMPLETION_FAILED" });
    const failed = renderToStaticMarkup(
      <ModelUnavailableCard view={failure} onRetry={() => undefined} />,
    );
    expect(failed).toContain(">Retry<");
  });

  it("J. Stop is the only generation control while Ω is active, and Ω is absent when idle", () => {
    const msg = emptyAssistantMessage("j");
    const active = renderToStaticMarkup(
      <AssistantMessageView msg={msg} streaming onResolve={() => undefined} onApproval={() => undefined} onFocus={() => undefined} onStop={() => undefined} />,
    );
    const idle = renderToStaticMarkup(
      <AssistantMessageView msg={msg} streaming={false} onResolve={() => undefined} onApproval={() => undefined} onFocus={() => undefined} onStop={() => undefined} />,
    );
    expect(active).toContain("omega-working");
    expect(active).toContain(">Stop<");
    expect(active).toContain(">Ω<");
    expect(idle).not.toContain("omega-working");
  });

  it("K/L. Conversation and project surfaces keep mode selector state from persisted mode", () => {
    expect(workflowFromPersistedMode("syn_science", "analyze")).toBe("analyze");
    const markup = renderToStaticMarkup(<ModeSelector value="analyze" onChange={() => undefined} variant="rail" />);
    expect(markup).toContain('data-testid="mode-analyze"');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain("Synthetic Mapping");
  });

  it("M. Legal, footer, and mode selector remain present for mobile-oriented markup", () => {
    const footer = renderToStaticMarkup(<LegalFooter />);
    const legal = renderToStaticMarkup(<LegalPage page="terms" onClose={() => undefined} />);
    const info = renderToStaticMarkup(<WorkspaceInfoDialog page="research" onClose={() => undefined} />);
    expect(footer).toContain("SynOmics™");
    expect(footer).toContain("Not medical advice");
    expect(legal).toContain("No professional advice");
    expect(info).toContain("Research &amp; Educational Use");
    const sources = sourceCardsFromAnswer({
      schema_version: "v1",
      answer_id: "a",
      conversation_id: "c",
      product_mode: "syn_science",
      output_policy: "SCIENCE_ANSWER",
      direct_answer: "",
      answer_status: "ANSWERED",
      claims: [],
      evidence: [
        {
          evidence_id: "ev1",
          canonical_uri: "https://example.org/paper",
          persistent_identifier: "DOI:10.1/x",
          source_identity: "Example paper",
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
    });
    expect(renderToStaticMarkup(<SourceCards sources={sources} defaultOpen />)).toContain("Open source");
    expect(legal).toContain('aria-label="Legal documents"');
    expect(legal).toContain("#/legal/privacy");
    expect(legal).toContain("#/legal/ip");
    expect(legal).toContain('role="dialog"');
  });

  it("composer mode selector is a keyboard listbox with discoverable descriptions", () => {
    const markup = renderToStaticMarkup(<ModeSelector value="casual" onChange={() => undefined} />);
    expect(markup).toContain('aria-haspopup="listbox"');
    expect(markup).toContain('aria-label="Execution mode"');
    expect(markup).toContain("Fast, natural everyday assistance");
  });
});
