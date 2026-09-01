import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantMessageView, canContinueResponse, isResumableResponse } from "@ui/components/AssistantMessageView";
import { SourceCards, sourceCardsFromAnswer } from "@ui/components/SourceCards";
import { emptyAssistantMessage } from "@ui/sse";
import { RequestErrorCard } from "@ui/components/EpistemicChatApp";
import type { AnswerPackageView } from "@ui/types/message";

function packageWithEvidence(): AnswerPackageView {
  return {
    schema_version: "synapse.answer.v1",
    answer_id: "answer_truth",
    conversation_id: "conv_truth",
    product_mode: "syn_chat",
    output_policy: "CONVERSATION",
    direct_answer: "Homologous recombination repairs double-strand breaks.",
    answer_status: "ANSWERED",
    claims: [],
    evidence: [
      {
        evidence_id: "ev_backend",
        canonical_uri: "https://pubmed.ncbi.nlm.nih.gov/1/",
        persistent_identifier: "PMID:1",
        source_identity: "A backend-supplied source",
        publisher: "Nature",
        publication_or_update_date: "2020",
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
    citations: [
      {
        citation_id: "cite_1",
        claim_id: "claim_1",
        evidence_id: "ev_backend",
        status: "SOURCE_FOUND_SPAN_UNVERIFIED",
      },
    ],
    warnings: [],
    trace: { trace_id: "trace_1", events: [] },
    epistemic_badge: "cited",
    temporal_freshness: "2026-08-20T20:00:00Z",
  };
}

describe("product truth regression", () => {
  it("never converts retrieved sources into supporting evidence client-side", () => {
    const sources = sourceCardsFromAnswer(packageWithEvidence());
    expect(sources).toHaveLength(1);
    expect(sources[0]?.role).toBe("retrieved");
    const markup = renderToStaticMarkup(<SourceCards sources={sources} defaultOpen />);
    expect(markup).toContain("Retrieved/context source");
    expect(markup).not.toContain("Supporting evidence");
    expect(markup).not.toContain("PMID:99999999");
  });

  it("does not invent references, evidence counts, verification, or computation", () => {
    const msg = emptyAssistantMessage("msg_plain");
    msg.text = "A short professional thank-you email is below.";
    const markup = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        workflow="casual"
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onStop={() => undefined}
      />,
    );
    expect(markup).not.toContain("Sources");
    expect(markup).not.toContain("verified");
    expect(markup).not.toContain("contradiction analysis");
    expect(markup).not.toContain("execution receipt");
    expect(markup).not.toContain("Continue");
    expect(markup).not.toContain("omega-working");
    expect(markup).not.toContain("Research gaps");
    expect(markup).not.toContain("Evidence tables");
    expect(markup).not.toContain("Methodological comparisons");
  });

  it("renders evidence tables and research gaps only from backend metadata", () => {
    const pkg = packageWithEvidence();
    pkg.output_policy = "DEEP_RESEARCH";
    pkg.tables = [
      {
        title: "Study comparison",
        headers: ["Study", "Design"],
        rows: [["Backend row", "RCT"]],
      },
    ];
    pkg.research_gaps = [{ gap_id: "g1", text: "Long-term follow-up is not reported." }];
    pkg.methodological_comparisons = [{ comparison_id: "m1", text: "Assay platforms were not harmonized." }];
    const msg = emptyAssistantMessage("msg_deep");
    msg.scientific = {
      message_id: "msg_deep",
      conversation_id: "conv",
      role: "assistant",
      status: "complete",
      blocks: [{ block_id: "b1", kind: "markdown", text: "Deep answer", claim_ids: [] }],
      claim_links: [],
      citation_links: [],
      artifact_refs: [],
      created_at: 0,
      answer_package: pkg,
    };
    const markup = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        workflow="deep_research"
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onStop={() => undefined}
      />,
    );
    expect(markup).toContain("Study comparison");
    expect(markup).toContain("Backend row");
    expect(markup).toContain("Long-term follow-up is not reported.");
    expect(markup).toContain("Assay platforms were not harmonized.");
    expect(markup).not.toContain("PMID:99999999");
  });

  it("shows Continue only when backend proves resumable and supplies a continuation id", () => {
    const complete = emptyAssistantMessage("msg_done");
    complete.text = "Done.";
    complete.scientific = {
      message_id: "msg_done",
      conversation_id: "conv",
      role: "assistant",
      status: "complete",
      blocks: [],
      claim_links: [],
      citation_links: [],
      artifact_refs: [],
      created_at: 0,
      model_metadata: {
        role: "conversation",
        provider: "test",
        model: "test",
        response_sha256: "a".repeat(64),
        latency_ms: 1,
        fallback_status: "none",
        finish_reason: "stop",
        kernel_invoked: false,
        tools_invoked: false,
      },
    };
    expect(isResumableResponse(complete)).toBe(false);

    const truncated = emptyAssistantMessage("msg_trunc");
    truncated.scientific = complete.scientific;
    truncated.scientific.model_metadata = { ...complete.scientific.model_metadata!, finish_reason: "length" };
    expect(isResumableResponse(truncated)).toBe(true);
    expect(canContinueResponse(truncated)).toBe(false);
    const hidden = renderToStaticMarkup(
      <AssistantMessageView
        msg={truncated}
        workflow="casual"
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onContinue={() => undefined}
        onStop={() => undefined}
      />,
    );
    expect(hidden).not.toContain("Continue");

    truncated.events = [{
      type: "stream.paused",
      correlation_id: "corr_resume_1",
      payload: { resume_correlation_id: "corr_resume_1" },
    }];
    expect(canContinueResponse(truncated)).toBe(true);
    const markup = renderToStaticMarkup(
      <AssistantMessageView
        msg={truncated}
        workflow="casual"
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onContinue={() => undefined}
        onStop={() => undefined}
      />,
    );
    expect(markup).toContain("Continue");
  });

  it("never renders heuristic output as assistant prose", () => {
    const markup = renderToStaticMarkup(
      <RequestErrorCard
        summary="The conversational model is becoming ready."
        technical="synapse-heuristic-v1 development fallback"
        onRetry={() => undefined}
      />,
    );
    expect(markup).not.toContain("assistant-turn");
    expect(markup).toContain("No answer was substituted.");
    expect(markup).not.toContain("development fallback</p>");
  });
});
