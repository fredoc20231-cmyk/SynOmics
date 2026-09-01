import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantMessageView } from "@ui/components/AssistantMessageView";
import type { AnswerPackageView, AssistantMessage } from "@ui/types/message";

function packageBase(overrides: Partial<AnswerPackageView> = {}): AnswerPackageView {
  return {
    schema_version: "synapse.answer.v1",
    answer_id: "answer_trust",
    conversation_id: "conv_trust",
    product_mode: "syn_science",
    output_policy: "SCIENCE_ANSWER",
    direct_answer: "PARP inhibitors are established targeted therapies in selected ovarian cancers.",
    answer_status: "ANSWERED",
    claims: [
      {
        claim_id: "claim_1",
        text: "PARP inhibitors are established targeted therapies in selected ovarian cancers.",
        claim_type: "fact",
        epistemic_status: "SUPPORTED",
        support_level: "moderate",
        evidence_ids: ["ev_1"],
        execution_reference_ids: [],
        allowed_language: "qualified",
      },
    ],
    evidence: [
      {
        evidence_id: "ev_1",
        canonical_uri: "https://pubmed.ncbi.nlm.nih.gov/1/",
        persistent_identifier: "PMID:1",
        source_identity: "Evidence record one",
        retrieval_date: "2026-08-20T20:00:00Z",
        source_quality: "high",
        conflict_status: "none",
      },
      {
        evidence_id: "ev_2",
        canonical_uri: "https://pubmed.ncbi.nlm.nih.gov/2/",
        persistent_identifier: "PMID:2",
        source_identity: "Evidence record two",
        retrieval_date: "2026-08-20T20:00:00Z",
        source_quality: "moderate",
        conflict_status: "none",
      },
    ],
    execution_provenance: [],
    figures: [],
    tables: [],
    assumptions: [],
    limitations: [
      {
        limitation_id: "limit_1",
        text: "Snapshot, not a systematic review.",
        affected_claim_ids: ["claim_1"],
      },
    ],
    recommendations: [],
    citations: [
      {
        citation_id: "cite_1",
        claim_id: "claim_1",
        evidence_id: "ev_1",
        status: "VERIFIED_SUPPORT",
        exact_source_span: "Source span",
      },
    ],
    warnings: [],
    trace: { trace_id: "trace_1", events: [] },
    epistemic_badge: "cited",
    temporal_freshness: "2026-08-20T20:00:00Z",
    integrity: {
      answer_status: "ANSWERED",
      answer_type: "Evidence-grounded answer",
      answer_integrity_type: "CITED_SYNTHESIS",
      evidence_count: 2,
      verified_claim_count: 1,
      unresolved_claim_count: 0,
      contradiction_count: 0,
      retrieval_timestamp: "2026-08-20T20:00:00Z",
      freshness_status: "current",
      execution_status: null,
      execution_id: null,
      receipt_id: null,
      artifact_count: 0,
      model_provider: "native",
      model_name: "synapse-test",
      limitations: ["Snapshot, not a systematic review."],
      recommended_next_action: "Inspect the cited evidence if this decision is high stakes.",
    },
    ...overrides,
  };
}

function message(answerPackage: AnswerPackageView): AssistantMessage {
  return {
    id: "msg_trust",
    conversationId: "conv_trust",
    planeStage: "reconciliation",
    pipeline: {
      proposal: "complete",
      verification: "complete",
      authorization: "complete",
      execution: "waiting",
      reconciliation: "complete",
    },
    text: answerPackage.direct_answer,
    scientific: {
      message_id: "msg_trust",
      conversation_id: "conv_trust",
      role: "assistant",
      status: "complete",
      blocks: [
        {
          block_id: "block_1",
          kind: "markdown",
          text: answerPackage.direct_answer,
          claim_ids: ["claim_1"],
        },
      ],
      claim_links: [],
      citation_links: [],
      artifact_refs: [],
      created_at: 0,
      answer_package: answerPackage,
    },
    claims: [],
    evidence: [],
    contradictions: [],
    artifactRefs: [],
    events: [],
    timestamp: 0,
  };
}

function render(answerPackage: AnswerPackageView, msgOverride: Partial<AssistantMessage> = {}): string {
  const msg = { ...message(answerPackage), ...msgOverride };
  return renderToStaticMarkup(
    <AssistantMessageView
      msg={msg}
      onResolve={() => undefined}
      onApproval={() => undefined}
      onFocus={() => undefined}
      onFeedback={() => undefined}
      onStop={() => undefined}
    />,
  );
}

describe("trust-first answer presentation", () => {
  it("renders a cited answer with a compact integrity card and friendly status copy", () => {
    const markup = render(packageBase());
    expect(markup).toContain("Answer integrity");
    expect(markup).toContain("Evidence-grounded answer");
    expect(markup).toContain("Evidence-checked synthesis");
    expect(markup).toContain("2 sources checked");
    expect(markup).toContain("Snapshot, not a systematic review.");
    expect(markup).not.toContain("VERIFIED_SUPPORT");
    expect(markup).not.toContain(">SUPPORTED<");
  });

  it("uses a quiet message action row without workflow clutter", () => {
    const markup = render(packageBase());
    expect(markup).not.toContain("omega-working");
    expect(markup).toContain("Helpful answer");
    expect(markup).toContain("Not helpful answer");
    expect(markup).toContain("Copy answer");
    expect(markup).not.toContain(">Retry<");
    expect(markup).not.toContain("Continue analysis");
    expect(markup).not.toContain("Feedback saved");
  });

  it("shows a single spinning omega only while the answer is being found", () => {
    const msg = message(packageBase());
    const markup = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        streaming
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onStop={() => undefined}
      />,
    );

    expect(markup).toContain("SYNAPSE is thinking");
    expect(markup).toContain("omega-working");
    expect(markup).toContain(">Ω<");
    expect(markup).not.toContain("α");
  });

  it("shows only event-justified operational labels", () => {
    const msg = message(packageBase());
    msg.events.push({ type: "evidence.retrieved", payload: {} });
    const markup = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        streaming
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onStop={() => undefined}
      />,
    );

    expect(markup).toContain("Checking sources");
    expect(markup).not.toContain("Running governed computation");
  });

  it("keeps ordinary Syn-Chat conversation free of unnecessary integrity chrome", () => {
    const pkg = packageBase({
      product_mode: "syn_chat",
      output_policy: "CONVERSATION",
      direct_answer: "Hi! How can I help?",
      claims: [],
      evidence: [],
      citations: [],
      limitations: [],
      temporal_freshness: "unavailable",
      integrity: {
        answer_status: "ANSWERED",
        answer_type: "Direct answer",
        answer_integrity_type: "MODEL_ONLY",
        evidence_count: 0,
        verified_claim_count: 0,
        unresolved_claim_count: 0,
        contradiction_count: 0,
        retrieval_timestamp: null,
        freshness_status: "No live retrieval",
        execution_status: null,
        execution_id: null,
        receipt_id: null,
        artifact_count: 0,
        model_provider: "native",
        model_name: "synapse-test",
        limitations: [],
        recommended_next_action: null,
      },
    });
    const markup = render(pkg);
    expect(markup).toContain("Hi! How can I help?");
    expect(markup).not.toContain("Answer integrity");
  });

  it("offers an explicit source-verification action for uncited science answers", () => {
    const pkg = packageBase({
      product_mode: "syn_chat",
      output_policy: "SCIENCE_ANSWER",
      evidence: [],
      citations: [],
      integrity: {
        ...packageBase().integrity!,
        answer_type: "Direct answer",
        answer_integrity_type: "MODEL_ONLY",
        evidence_count: 0,
        verified_claim_count: 0,
        unresolved_claim_count: 1,
        retrieval_timestamp: null,
      },
    });
    const msg = message(pkg);
    msg.scientific!.model_metadata = {
      role: "conversation",
      provider: "ollama",
      model: "qwen2.5",
      response_sha256: "a".repeat(64),
      latency_ms: 25,
      fallback_status: "none",
      kernel_invoked: false,
      tools_invoked: false,
      scientific_brief: true,
      public_evidence_retrieved: false,
    };
    const markup = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onVerifySources={() => undefined}
        onStop={() => undefined}
      />,
    );

    expect(markup).toContain("Search current literature");
    expect(markup).toContain("Model synthesis · Sources not retrieved");
  });

  it("shows uncertainty constructively without exposing raw epistemic jargon", () => {
    const pkg = packageBase({
      answer_status: "UNCERTAIN",
      claims: [
        {
          claim_id: "claim_1",
          text: "The available comparison is insufficient for a reliable causal conclusion.",
          claim_type: "scientific_interpretation",
          epistemic_status: "UNKNOWN",
          support_level: "none",
          evidence_ids: [],
          execution_reference_ids: [],
          allowed_language: "qualified",
        },
      ],
      integrity: {
        answer_status: "UNCERTAIN",
        answer_type: "Direct answer",
        answer_integrity_type: "UNCERTAIN",
        evidence_count: 2,
        verified_claim_count: 0,
        unresolved_claim_count: 1,
        contradiction_count: 0,
        retrieval_timestamp: "2026-08-20T20:00:00Z",
        freshness_status: "current",
        execution_status: null,
        execution_id: null,
        receipt_id: null,
        artifact_count: 0,
        model_provider: "native",
        model_name: "synapse-test",
        limitations: ["An independently validated comparison group is missing."],
        recommended_next_action: "Provide the comparison group or sample metadata.",
      },
    });
    const markup = render(pkg);
    expect(markup).toContain("Uncertain");
    expect(markup).toContain("An independently validated comparison group is missing.");
    expect(markup).toContain("Next: Provide the comparison group or sample metadata.");
    expect(markup).not.toContain(">UNKNOWN<");
  });

  it("separates verified computation from model prose", () => {
    const pkg = packageBase({
      output_policy: "GOVERNED_COMPUTE",
      execution_provenance: [
        {
          execution_reference_id: "eref_1",
          execution_id: "exec_1",
          receipt_id: "receipt_1",
          plan_hash: "a".repeat(64),
          code_hash: "b".repeat(64),
          worker_image_digest: `python@sha256:${"c".repeat(64)}`,
          artifact_refs: ["artifact_1", "artifact_2"],
          reconciliation_status: "VERIFIED",
          observed_at: "2026-08-20T20:00:00Z",
        },
      ],
      integrity: {
        answer_status: "ANSWERED",
        answer_type: "Analysis result",
        answer_integrity_type: "COMPUTED",
        evidence_count: 0,
        verified_claim_count: 1,
        unresolved_claim_count: 0,
        contradiction_count: 0,
        retrieval_timestamp: null,
        freshness_status: "Execution completed today",
        execution_status: "postcondition_verified",
        execution_id: "exec_1",
        receipt_id: "receipt_1",
        artifact_count: 2,
        model_provider: "native",
        model_name: "synapse-test",
        limitations: [],
        recommended_next_action: "Inspect the replayable receipt if needed.",
      },
    });
    const markup = render(pkg, {
      receipt: {
        receiptId: "receipt_1",
        status: "postcondition_verified",
        postconditionConsistent: true,
        sandboxInvoked: true,
        lineage: ["proposed", "authorized", "executing", "postcondition_verified"],
        auditTrail: [],
        proofArtifactId: "proof_1",
      },
    });
    expect(markup).toContain("Analysis result");
    expect(markup).toContain("Computed and verified");
    expect(markup).toContain("Postconditions passed");
    expect(markup).toContain("View execution trace");
  });

  it("omits empty Sources & reliability sections", () => {
    const pkg = packageBase({
      claims: [{
        claim_id: "claim_empty",
        text: "   ",
        claim_type: "fact",
        epistemic_status: "UNKNOWN",
        support_level: "none",
        evidence_ids: [],
        execution_reference_ids: [],
        allowed_language: "qualified",
      }],
      evidence: [{
        evidence_id: "ev_empty",
        canonical_uri: "",
        persistent_identifier: "",
        source_identity: "",
        retrieval_date: "",
        source_quality: "unknown",
        conflict_status: "unknown",
      }],
      citations: [],
      assumptions: [],
      limitations: [],
      warnings: [],
      execution_provenance: [],
    });
    const markup = render(pkg);
    expect(markup).not.toContain('class="answer-basis"');
    expect(markup).not.toContain("Why this answer");
  });
});
