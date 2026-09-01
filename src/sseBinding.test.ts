import { describe, expect, it } from "vitest";
import { applyKernelEvents, parseProof, parseReceipt } from "@ui/sse";

describe("kernel SSE binding", () => {
  it("does not invent a proof artifact when artifactId is empty", () => {
    expect(parseProof({ artifactId: "", decision: "UNKNOWN", satisfiability: "unknown" })).toBeUndefined();
    expect(parseReceipt({ receiptId: "", status: "simulated" })).toBeUndefined();
  });

  it("binds canonical envelope events to claims, proof, abstention, and receipt IDs", () => {
    const msg = applyKernelEvents("msg_1", [
      { type: "conversation.started", event_id: "evt_1", correlation_id: "c1", seq: 0, payload: {} },
      {
        type: "claim.created",
        event_id: "evt_2",
        correlation_id: "c1",
        seq: 1,
        payload: { claim_ids: ["claim-1"], subjects: ["Statin"] },
      },
      {
        type: "proof.created",
        event_id: "evt_3",
        object_id: "proof-abc",
        payload: { artifactId: "proof-abc", decision: "REJECTED", satisfiability: "unsat" },
      },
      {
        type: "causal.verdict",
        payload: { status: "not_identified", criterion: "none", reason: "No SCM provided." },
      },
      {
        type: "governor.decision",
        payload: {
          decision: "ABSTAIN",
          reason: "I can estimate the association, but I can't establish the causal effect yet.",
          violations: ["identifiability"],
          resolution_actions: [
            {
              action_id: "act_c1_scm",
              action_type: "provide_scm",
              label: "Provide a structural causal model",
              description: "Submit edges",
              source_event_id: "evt_3",
              correlation_id: "c1",
              parameters_schema: { provided_scm: "edges" },
            },
          ],
          receipt: {
            receiptId: "rcpt-1",
            status: "abstained",
            postconditionConsistent: false,
            sandboxInvoked: false,
            lineage: ["proposed", "abstained"],
            auditTrail: ["ABSTAINED"],
            proofArtifactId: "proof-abc",
          },
        },
      },
    ]);

    expect(msg.planeStage).toBe("authorization");
    expect(msg.pipeline.authorization).toBe("abstained");
    expect(msg.claims[0]?.claim_id).toBe("claim-1");
    expect(msg.proof?.artifactId).toBe("proof-abc");
    expect(msg.causal?.status).toBe("not_identified");
    expect(msg.decision).toBe("ABSTAIN");
    expect(msg.abstention?.resolutionActions[0]?.action_id).toBe("act_c1_scm");
    expect(msg.receipt?.receiptId).toBe("rcpt-1");
  });

  it("binds approval request IDs without fabricating execution", () => {
    const msg = applyKernelEvents("msg_2", [
      {
        type: "approval.requested",
        payload: {
          requestId: "req_123",
          riskTier: "critical",
          description: "Irreversible export",
          irreversible: true,
          status: "pending",
        },
      },
    ]);
    expect(msg.approval?.requestId).toBe("req_123");
    expect(msg.pipeline.authorization).toBe("awaiting_approval");
    expect(msg.receipt).toBeUndefined();
  });
});
