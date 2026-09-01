export const PRINCIPLES = [
  {
    id: "generation-evidence",
    title: "GENERATION ≠ EVIDENCE",
    body: "A fluent explanation is a generated artifact. It is not evidence that a claim is supported, computed, or observed.",
  },
  {
    id: "retrieved-cited-supported",
    title: "RETRIEVED ≠ CITED ≠ SUPPORTED",
    body: "Finding a source, displaying a citation, and establishing that a specific claim is supported by a specific passage are three different states. SYNAPSE must not collapse them.",
  },
  {
    id: "computed-observed",
    title: "COMPUTED ≠ EXPERIMENTALLY OBSERVED",
    body: "A governed computation produces an observed computational result. It is not a wet-lab measurement and not an experimental confirmation in the world.",
  },
  {
    id: "statistical-causal",
    title: "STATISTICALLY DERIVED ≠ CAUSAL TRUTH",
    body: "Association, ranking, and model estimates are not causal conclusions. Causal language requires an identifiable causal question, not a correlation slogan.",
  },
  {
    id: "verified-true",
    title: "FORMALLY VERIFIED ≠ SCIENTIFICALLY TRUE",
    body: "Formal checks prove compliance with an explicit software specification. They do not prove biological truth, completeness of the literature, or clinical validity.",
  },
  {
    id: "propose-reconcile",
    title: "PROPOSE ≠ VERIFY ≠ AUTHORIZE ≠ EXECUTE ≠ RECONCILE",
    body: "Each verb is a different authority. A proposal cannot execute. A verification cannot invent evidence. An authorization cannot rewrite what was observed.",
  },
] as const;

export const TIMELINE_STAGES = [
  {
    id: "question",
    title: "Ask a question",
    summary: "State the scientific or everyday question in ordinary language.",
    detail:
      "The researcher remains responsible for the question, the data they are authorized to use, and the decision that follows. SYNAPSE does not silently expand the question into an authorized computation.",
  },
  {
    id: "mode",
    title: "Choose a mode and thinking depth",
    summary: "Mode selects the kind of work. Thinking depth selects explanatory depth, not authority.",
    detail:
      "Casual, Science, Deep Science, Analyze, and Governed Compute are different products of attention. Basic, Medium, and Advanced change how thoroughly the answer is developed—not whether tools, private data, or execution are allowed.",
  },
  {
    id: "generation",
    title: "Generate a candidate answer",
    summary: "A model may propose language, structure, and next questions.",
    detail:
      "Generation is useful and fallible. A generated paragraph is not automatically retrieved, cited, supported, verified, or executed. Discussing an analysis is still generation until Analyze or Governed Compute is actually used.",
  },
  {
    id: "evidence",
    title: "Ground claims in evidence states",
    summary: "Retrieval, citation, and support are recorded as distinct states when they occur.",
    detail:
      "A retrieved record can appear without supporting a particular sentence. A citation can appear without a verified supporting span. Unsupported material remains visible as unsupported rather than being dressed as proof.",
  },
  {
    id: "assurance",
    title: "Check the specification",
    summary: "Consequential actions can be checked against explicit constraints.",
    detail:
      "Assurance asks whether a proposed action satisfies the stated software and scientific constraints. A passing check is not a claim that the world agrees. A failing or incomplete check is a reason to stop or abstain.",
  },
  {
    id: "authorization",
    title: "Authorize—or refuse",
    summary: "Execution authority is granted only for the scoped action, or it is withheld.",
    detail:
      "Authorization is not implied by a confident paragraph, a project folder, or a thinking-depth setting. If the action is irreversible, out of scope, or under-specified, SYNAPSE should refuse or ask for review rather than improvise.",
  },
  {
    id: "execution",
    title: "Execute only the authorized work",
    summary: "When execution exists in the configured release, it runs inside governed capability.",
    detail:
      "Conceptual or research support may be available even when execution is not. Execution capability depends on the configured SYNAPSE release and enabled governed tools. A local chat install does not by itself enable production compute.",
  },
  {
    id: "reconcile",
    title: "Reconcile what was observed",
    summary: "Observed outputs are compared with what was authorized to run.",
    detail:
      "A process finishing is not the same as a verified scientific result. Missing artifacts, mismatched outputs, or incomplete records keep the conclusion from being promoted as observed success.",
  },
  {
    id: "report",
    title: "Report with limitations",
    summary: "The answer should show what is known, what is assumed, and what remains open.",
    detail:
      "Abstention is a valid product behavior. Uncertainty, conflicting evidence, and missing identifiability are part of the report—not defects to hide so the conversation looks finished.",
  },
] as const;
