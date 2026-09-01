export const ARCHITECTURE_ABSTRACTION_LABEL =
  "Conceptual architecture — implementation details intentionally abstracted.";

export const ARCHITECTURE_LAYERS = [
  {
    id: "researcher-experience",
    name: "Researcher Experience",
    summary: "Conversation, modes, thinking depth, projects, and inspectable answers.",
  },
  {
    id: "scientific-intelligence",
    name: "Scientific Intelligence",
    summary: "Models propose explanations and candidate plans. Proposal is not authorization.",
  },
  {
    id: "evidence-intelligence",
    name: "Evidence Intelligence",
    summary: "Retrieval, citation, and support are distinct. A found source is not a supported claim.",
  },
  {
    id: "scientific-assurance",
    name: "Scientific Assurance",
    summary: "Checks whether a proposed action satisfies an explicit specification and scientific constraints.",
  },
  {
    id: "governed-capability",
    name: "Governed Capability",
    summary: "Tools and computations run only inside scoped, authorized capability boundaries.",
  },
  {
    id: "observation-reconciliation",
    name: "Observation & Reconciliation",
    summary: "Observed results are compared with what was authorized. A process exit is not a scientific conclusion.",
  },
] as const;

export const APPROVED_ARCHITECTURE_LABELS = ARCHITECTURE_LAYERS.map((layer) => layer.name);

export const CONCEPTUAL_FLOW_STEPS = [
  "ASK",
  "RETRIEVE",
  "CITE",
  "SUPPORT",
  "VERIFY",
  "AUTHORIZE",
  "EXECUTE",
  "RECONCILE",
  "REPORT",
] as const;

export const CONCEPTUAL_FLOW_CAPTION =
  "Conceptual representation of how a question can become a defensible conclusion. This is not a proprietary disclosure of internal algorithms, prompts, ranking formulas, or security topology.";

export const FORBIDDEN_INTERNAL_TERMS = [
  "neural_proposal",
  "epistemic_state",
  "formal_assurance",
  "runtime_governance",
  "MetacognitiveGovernor",
  "ProofArtifact",
  "CapabilityPermitV1",
  "CapabilityGateway",
  "IntelligenceModelRouter",
  "AuthorizationGrant",
  "CandidatePlan",
] as const;
