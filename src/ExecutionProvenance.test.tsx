import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ScientificInspector } from "@ui/components/ScientificInspector";
import type { AssistantMessage } from "@ui/types/message";

function message(): AssistantMessage {
  return {
    id: "msg_provenance",
    conversationId: "conv_provenance",
    planeStage: "reconciliation",
    pipeline: {
      proposal: "complete",
      verification: "complete",
      authorization: "complete",
      execution: "complete",
      reconciliation: "complete",
    },
    text: "Observed mean=7.",
    scientific: {
      message_id: "msg_provenance",
      conversation_id: "conv_provenance",
      role: "assistant",
      status: "complete",
      blocks: [],
      claim_links: [],
      literature_evidence: [
        {
          evidence_id: "ev_pubmed",
          persistent_identifier: "PMID:12345678",
          title: "A real literature source",
          uri: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
        },
      ],
      execution_provenance: [
        {
          execution_id: "exec_verified_123",
          receipt_id: "receipt_verified_123",
          plan_hash: "a".repeat(64),
          worker_image_digest: `python:3.11@sha256:${"b".repeat(64)}`,
          code_hash: "c".repeat(64),
          artifact_refs: [`sha256:${"d".repeat(64)}`],
          observed_at: "2026-08-19T00:00:00Z",
          verification_status: "VERIFIED",
        },
      ],
      citation_links: [],
      artifact_refs: [],
      created_at: 0,
    },
    claims: [],
    evidence: [],
    contradictions: [],
    receipt: {
      receiptId: "receipt_verified_123",
      status: "postcondition_verified",
      postconditionConsistent: true,
      sandboxInvoked: true,
      lineage: ["proposed", "authorized", "executing", "postcondition_verified"],
      auditTrail: [],
      proofArtifactId: "proof_verified_123",
    },
    artifactRefs: [],
    events: [],
    timestamp: 0,
  };
}

describe("execution provenance presentation", () => {
  it("renders computation receipts as Execution Provenance, not literature evidence", () => {
    const provenance = renderToStaticMarkup(
      <ScientificInspector
        msg={message()}
        collapsed={false}
        tab="provenance"
        focusId={null}
        onToggle={() => undefined}
        onTab={() => undefined}
      />,
    );
    expect(provenance).toContain("Execution Provenance");
    expect(provenance).toContain('aria-label="Execution Provenance"');
    expect(provenance).toContain('data-provenance-kind="execution"');
    expect(provenance).toContain("exec_verified_123");
    expect(provenance).toContain("receipt_verified_123");
    expect(provenance).toContain("VERIFIED");
    expect(provenance).not.toContain("PMID:12345678");
    expect(provenance).not.toContain("pubmed.ncbi.nlm.nih.gov");
  });

  it("renders literature evidence without execution receipt identifiers", () => {
    const evidence = renderToStaticMarkup(
      <ScientificInspector
        msg={message()}
        collapsed={false}
        tab="evidence"
        focusId={null}
        onToggle={() => undefined}
        onTab={() => undefined}
      />,
    );
    expect(evidence).toContain('data-provenance-kind="literature-evidence"');
    expect(evidence).toContain("PMID:12345678");
    expect(evidence).toContain("pubmed.ncbi.nlm.nih.gov");
    expect(evidence).not.toContain("exec_verified_123");
    expect(evidence).not.toContain("receipt_verified_123");
  });
});
