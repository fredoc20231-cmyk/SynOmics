import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ScientificInspector } from "@ui/components/ScientificInspector";
import type { AnswerPackageView, AssistantMessage, InspectorTab } from "@ui/types/message";

function clinicalMessage(): AssistantMessage {
  const answerPackage: AnswerPackageView = {
    schema_version: "synapse.answer.v1",
    answer_id: "answer-clinical",
    conversation_id: "conv-clinical",
    product_mode: "syn_science",
    output_policy: "SCIENCE_ANSWER",
    direct_answer: "The evidence remains context dependent.",
    answer_status: "UNCERTAIN",
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
    evidence_assessments: [
      {
        assessment_id: "cea-1",
        evidence_id: "ev-1",
        evidence_class: "INTERVENTIONAL",
        study_design: "RANDOMIZED_CONTROLLED_TRIAL",
        certainty: "MODERATE",
        certainty_reasons: ["Full risk-of-bias appraisal is incomplete."],
        retraction_status: "NOT_REPORTED",
        correction_status: "NOT_REPORTED",
        source_authority: "PUBLIC_BIBLIOGRAPHIC",
      },
    ],
    guideline_recommendations: [
      {
        guideline_id: "g-1",
        recommendation_id: "r-1",
        issuing_organization: "Public Society",
        recommendation_text: "Consider treatment for the stated population.",
        recommendation_strength: "NOT_REPORTED",
        evidence_strength: "NOT_REPORTED",
        canonical_uri: "https://example.org/guideline",
        superseded_by: [],
      },
    ],
    applicability_assessments: [
      {
        applicability_id: "app-1",
        evidence_id: "ev-1",
        state: "PARTIALLY_INDIRECT",
        reasons: ["Age range was not reported."],
      },
    ],
    clinical_conflicts: [
      {
        claim_id: "claim-1",
        supporting_evidence: ["ev-1"],
        contradicting_evidence: ["ev-2"],
        guideline_disagreement: [],
        regulatory_conflict: [],
        possible_explanations: ["population_difference"],
        unresolved: true,
      },
    ],
    trace: { trace_id: "trace-1", events: [] },
    epistemic_badge: "uncertain",
    temporal_freshness: "current",
  };
  return {
    id: "msg-clinical",
    conversationId: "conv-clinical",
    planeStage: "reconciliation",
    pipeline: {
      proposal: "complete",
      verification: "complete",
      authorization: "waiting",
      execution: "waiting",
      reconciliation: "complete",
    },
    scientific: {
      message_id: "msg-clinical",
      conversation_id: "conv-clinical",
      role: "assistant",
      status: "complete",
      blocks: [],
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

function renderTab(tab: InspectorTab): string {
  return renderToStaticMarkup(
    <ScientificInspector
      msg={clinicalMessage()}
      collapsed={false}
      tab={tab}
      focusId={null}
      onToggle={() => undefined}
      onTab={() => undefined}
    />,
  );
}

describe("clinical scientific inspector", () => {
  it("uses professional clinical tabs and hides enum jargon", () => {
    expect(renderTab("evidence-strength")).toContain("moderate");
    expect(renderTab("guidelines")).toContain("Recommendation strength: Not reported");
    expect(renderTab("applicability")).toContain("partially indirect");
    expect(renderTab("contradictions")).toContain("Evidence remains conflicting.");
    expect(renderTab("contradictions")).not.toContain("PARTIALLY_SUPPORTS");
  });
});
