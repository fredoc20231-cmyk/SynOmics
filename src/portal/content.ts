import { ARCHITECTURE_ABSTRACTION_LABEL, CONCEPTUAL_FLOW_CAPTION } from "./architecture";
import { CAPABILITY_BADGES } from "./capabilityBadges";
import { PRODUCT_IDENTITY } from "@ui/design/productModes";

export const PORTAL_KICKER = "SYNAPSE-Ω · Research Beta";

export const HERO = {
  identity: PRODUCT_IDENTITY.name,
  title: PRODUCT_IDENTITY.title,
  supporting: PRODUCT_IDENTITY.supporting,
  lede: PRODUCT_IDENTITY.expanded,
  institutional: PRODUCT_IDENTITY.institutional,
  positioning:
    "This is a research and educational system. It is designed to verify, challenge, and trace claims—not merely to generate them. It is not medical advice, not a licensed professional, and not a substitute for independent scientific judgment. It is not restricted only to scientific conversation.",
};

export const CTA = {
  open: { label: "Open SYNAPSE", href: "#/" },
  manual: { label: "Researcher Manual", href: "#/synapse/manual" },
  install: { label: "Install Locally", href: "#/synapse/install" },
  architecture: { label: "Explore Architecture", href: "#/synapse/architecture" },
};

export const ASK_FLOW_INTRO =
  "A question can move through a conceptual sequence from ASK to REPORT. The sequence below is a conceptual representation of scientific discipline in the product, not a map of proprietary internals.";

export const MODE_CARDS = [
  {
    id: "casual",
    name: "Casual",
    badge: CAPABILITY_BADGES.chat.badge,
    intent: "Fast, natural assistance for everyday questions, writing, coding and clear scientific explanations.",
    what: "A fully useful assistant for general knowledge, writing, email, coding, math, history, culture, food, travel, language, and scientific questions at conversational depth. Casual describes the user experience, not a lower trust level.",
    when: "Use when you want a fast, natural reply. Scientific questions are welcome here; Casual is not a limited or non-scientific chatbot.",
    example: "“Help me draft a professional thank-you email.” or “Explain homologous recombination.”",
    limitation:
      "Casual generation is still generation. A fluent answer is not automatically retrieved, cited, or supported. Casual does not grant execution authority. Basic controls depth, not truthfulness.",
  },
  {
    id: "science",
    name: "Science",
    badge: CAPABILITY_BADGES.science.badge,
    intent: "Structured scientific reasoning with stronger scientific context, evidence awareness, methodology and limitations.",
    what: "Asks for more structured technical reasoning and shows evidence states when the configured release actually retrieved or bound sources. Non-scientific questions are still answered normally.",
    when: "Use for mechanistic, methodological, or literature-grounded questions that should remain inspectable. A thank-you email in Science is still answered as an email—no error, no forced switch.",
    example: "“Explain homologous recombination at a mechanistic level, distinguishing model synthesis from retrieved sources.”",
    limitation:
      "Science mode cannot invent literature activity. If sources were not retrieved, the interface must not decorate the answer as if they were. The client does not reject ordinary questions as “not scientific.”",
  },
  {
    id: "deep-science",
    name: "Deep Science",
    badge: CAPABILITY_BADGES.deepScience.badge,
    intent: "Research-grade synthesis when the work warrants it—not an access restriction.",
    what: "Intended for deeper comparison of methods, limitations, alternative interpretations, and research gaps when the backend performs that work. Ordinary questions are answered naturally. The interface does not fabricate a research workflow from mode selection alone.",
    when: "Use when a short explanation is not enough and you need competing lines of evidence held in view. Writing a birthday message here is still a birthday message unless the backend actually ran a research workflow.",
    example: "“Critically review current neoantigen prediction approaches, including assumptions, validation, and failure modes.”",
    limitation:
      "Depth is not authority. Deep Science does not silently become Analyze or Governed Compute. Deep scientific presentation appears only when backend metadata indicates the workflow occurred.",
  },
  {
    id: "analyze",
    name: "Analyze",
    badge: CAPABILITY_BADGES.analyze.badge,
    intent: "Interpret and analyze data, documents, and research inputs you supply.",
    what: "A distinct mode for analysis of attached or project data. Discussing an analysis in Casual or Science is not Analyze.",
    when: "Use when you have data you are authorized to process and you want the workspace to treat the request as analysis of that data.",
    example: "“Using the attached cohort table, summarize missingness and do not infer causation from the descriptive statistics.”",
    limitation:
      "Conceptual/research support is currently available; execution capability depends on the configured SYNAPSE release and enabled governed tools. Uploading a file does not by itself authorize computation. Discussing analysis ≠ analyzing data.",
  },
  {
    id: "governed-compute",
    name: "Governed Compute",
    badge: CAPABILITY_BADGES.governedCompute.badge,
    intent: "Run authorized, bounded, reproducible computational workflows with provenance.",
    what: "Proposes a computation that can run only after verification and authorization in a deployment that actually enables that path. Selecting this mode does not automatically execute.",
    when: "Use when you need an inspectable computational result rather than an explanation of how one might be obtained.",
    example: "“Propose a bounded descriptive statistic on this authorized table; do not run anything until the action is authorized.”",
    limitation:
      "Conceptual/research support is currently available; execution capability depends on the configured SYNAPSE release and enabled governed tools. Authorization and execution remain backend-controlled. A successful local Chat install is not a compute certificate.",
  },
] as const;

export const THINKING_LEVELS_MANUAL = [
  {
    name: "Basic",
    also: "Faster",
    what: "Shallower reasoning and a shorter path to a usable reply.",
    when: "Everyday questions where speed matters more than exhaustive structure.",
    example: "A brief clarification of a term you already understand.",
    limitation: "Basic is not unverified truth. It does not disable Chat, and it does not reduce the need for evidence on consequential claims. Basic controls depth, not truthfulness.",
  },
  {
    name: "Medium",
    also: "Balanced",
    what: "Standard explanatory depth for professional scientific conversation.",
    when: "Most research questions that need organization without a full investigation.",
    example: "A structured explanation of a method with stated assumptions.",
    limitation: "Medium does not grant tools, data access, or execution. Thinking never changes authority.",
  },
  {
    name: "Advanced",
    also: "Deeper",
    what: "Deeper reasoning for complex or high-ambiguity questions.",
    when: "When the question has competing interpretations, hidden assumptions, or methodological traps.",
    example: "A careful comparison of study designs and what each can and cannot support.",
    limitation: "Advanced is not higher authority. It cannot unlock Analyze, Governed Compute, private data, or execution.",
  },
] as const;

export type ManualSection = {
  id: string;
  title: string;
  what: string;
  when: string;
  example: string;
  limitation: string;
  extra?: readonly string[];
};

export const MANUAL_SECTIONS: readonly ManualSection[] = [
  {
    id: "orientation",
    title: "1. What SYNAPSE-Ω is",
    what: "A science-first scientific-intelligence workspace that remains generally capable. Primary identity: SYNAPSE-Ω — Scientific Intelligence for Research, Biomedicine and Biotechnology. Built for science. Capable beyond it. Neural models propose; symbolic and procedural checks constrain; execution is authorized separately from language. Ordinary writing, coding, and everyday questions remain in scope.",
    when: "Read this first if you are deciding whether SYNAPSE is a chat tool, a literature assistant, an analysis environment, or a compute platform. It can be each of those only within the mode and deployment you actually have. It is not restricted only to scientific conversation.",
    example: "Asking a mechanistic question in Science, then later proposing a bounded computation in Governed Compute, without assuming the first step authorized the second.",
    limitation:
      "SYNAPSE is research and educational software. It is not medical advice, not a medical device, and not an autonomous doctor. Formal verification proves specification compliance, not correspondence with reality.",
  },
  {
    id: "architecture-manual",
    title: "2. Conceptual architecture",
    what: `Public conceptual layers: Researcher Experience → Scientific Intelligence → Evidence Intelligence → Scientific Assurance → Governed Capability → Observation & Reconciliation. ${ARCHITECTURE_ABSTRACTION_LABEL}`,
    when: "Use the Architecture Atlas when you need to explain to a collaborator why a fluent answer is not automatically an authorized result.",
    example: "A generated neoantigen explanation lives in Scientific Intelligence until Evidence Intelligence records retrieval/citation/support states.",
    limitation: CONCEPTUAL_FLOW_CAPTION,
  },
  {
    id: "principles-manual",
    title: "3. Why the architecture matters",
    what: "The product encodes distinctions that scientific work already requires: generation is not evidence; retrieval is not support; computation is not experiment; statistics are not causation; verification is not truth.",
    when: "Return here when an answer looks finished but the evidence or authority states are incomplete.",
    example: "A paper appears in a retrieved list. That does not mean a specific sentence is supported by a specific span.",
    limitation: "These principles describe product behavior. They are not a warranty that every answer is complete.",
  },
  {
    id: "timeline-manual",
    title: "4. From question to defensible conclusion",
    what: "An interactive conceptual timeline from asking, through generation and evidence, to authorization, execution when available, reconciliation, and reporting with limitations.",
    when: "Use it to brief a new researcher on what SYNAPSE will and will not silently do.",
    example: "A question about a cohort statistic should not become an executed analysis unless Analyze or Governed Compute is actually engaged and authorized.",
    limitation: "The timeline is pedagogical. It does not disclose internal control flow, prompts, or scoring.",
  },
  {
    id: "modes-manual",
    title: "5. Modes",
    what: "Five modes: Casual, Science, Deep Science, Analyze, and Governed Compute. Mode is a researcher choice. SYNAPSE does not change modes unless you choose one. Modes increase scientific and workflow capability without implying Casual is inferior. Casual describes user experience, not trust level.",
    when: "Pick Casual for fast everyday assistance including scientific explanations; Science or Deep Science for more structured scientific reasoning; Analyze for supplied data; Governed Compute for authorized computation. Domain is inferred. The client does not reject non-scientific questions.",
    example: "Talking through how one might analyze a CSV in Casual is discussion. Analyze is the mode that treats the request as analysis of provided data.",
    limitation:
      "Discussing analysis ≠ Analyze. Conceptual/research support currently available; execution capability depends on the configured SYNAPSE release and enabled governed tools.",
  },
  {
    id: "thinking-manual",
    title: "6. Thinking depth",
    what: "Basic, Medium, and Advanced (also labeled Faster, Balanced, and Deeper) change reasoning depth and organization.",
    when: "Raise depth when the question is ambiguous or high-stakes explanation; lower it when you need a short, usable reply.",
    example: "Advanced can produce a more careful limitations section. It still cannot authorize a tool.",
    limitation: "Thinking depth is not authority, not a truth score, and not a clinical certification.",
  },
  {
    id: "evidence-manual",
    title: "7. Evidence is not decoration",
    what: "RETRIEVED, CITED, and SUPPORTED are different states. Sources appear when they were actually obtained; support requires a claim-to-evidence relationship, not a bibliography aesthetic.",
    when: "Inspect evidence states before treating a scientific paragraph as grounded.",
    example: "A retrieved abstract can be relevant context without supporting the exact numerical claim in the answer.",
    limitation:
      "This manual does not describe a citation-validation algorithm. Absence of a support state is information, not a promise that unsupported text is false.",
  },
  {
    id: "uncertainty-manual",
    title: "8. Uncertainty and abstention",
    what: "Abstention is a first-class product behavior. When evidence, identifiability, authorization, or specification checks are insufficient, SYNAPSE should say what is missing rather than fabricate a result.",
    when: "Treat an abstention or uncertainty state as a successful scientific outcome, not as a crashed chat.",
    example: "A causal question without an identifiable design should remain unanswered as causation, even if a correlation could be described.",
    limitation: "Abstention does not prove that a hidden true answer exists elsewhere. It means this system will not invent one.",
  },
  {
    id: "projects-manual",
    title: "9. Projects",
    what: "Projects group conversations, files, and artifacts so a research effort stays navigable.",
    when: "Create a project when several chats and files belong to the same investigation.",
    example: "A neoantigen literature review project containing several Deep Science chats and attached notes.",
    limitation:
      "A project is organizational. It does not authorize computation, grant data rights, or bypass verification. Capability badge: Available.",
  },
  {
    id: "conversations-manual",
    title: "10. Conversation management",
    what: "The workspace lists chats with recency grouping (Today, Yesterday, Previous 7 days, Older), search, rename, delete, and move to project. Deletion removes a chat from ordinary workspace access; it is not a claim of immediate physical erasure of all audit or provenance records.",
    when: "Use search and recency groups to resume work. Use delete when a conversation should leave ordinary access.",
    example: "Rename a chat to the actual scientific question so later search is honest.",
    limitation:
      "Archive is organizational, not deletion. Archived conversations remain readable and reversible. While archived they are read-only: view messages, references, Properties, Unarchive, and Delete are allowed; send, attach, rename, change mode, execute, and mutate project state are not. SYNAPSE does not fake archive persistence in the browser or emulate Archive as a project. Capability badge: Available.",
  },
  {
    id: "voice-manual",
    title: "11. Voice",
    what: "If a given SYNAPSE release exposes dictation or read-aloud, those controls use the browser's speech recognition and speech synthesis APIs.",
    when: "Use voice only when the control is actually present in your client and your browser supports the Web Speech APIs.",
    example: "Read-aloud of an already-visible answer via the browser synthesizer, when that control exists.",
    limitation:
      "SYNAPSE does not claim a proprietary speech model. Browser speech may send audio to a platform provider according to the browser vendor. Availability is deployment dependent. Voice is not a clinical documentation system.",
  },
  {
    id: "playbooks-manual",
    title: "12. Biotech research playbooks",
    what: "Conceptual playbooks for literature-heavy biomedical questions: scoping a mechanism, comparing methods, stating limitations, and separating computation from experiment.",
    when: "Use as research-orientation guides, not as certified laboratory protocols.",
    example: "A neoantigen question asked first as explanation, then as methods critique, without fabricating ranking outputs.",
    limitation:
      "Conceptual/research support currently available; execution capability depends on the configured SYNAPSE release and enabled governed tools. Playbooks do not enable FastQC, docking, or other specialized workers unless those workers exist in the configured release.",
  },
  {
    id: "neoantigen-manual",
    title: "13. Worked example: neoantigen questions",
    what: "The same scientific topic behaves differently across modes. The example is conceptual. It does not include fabricated binding scores, patient results, or literature PMIDs.",
    when: "Use it to practice choosing a mode before asking a consequential immuno-oncology question.",
    example: "See the worked example on this page: Casual explains terms; Science asks for evidence states; Deep Science asks for contradictions; Analyze would require authorized data; Governed Compute would require an authorized bounded computation.",
    limitation: "No result in the example is an experimental observation. Do not treat the walkthrough as a validated neoantigen pipeline.",
  },
  {
    id: "install-manual",
    title: "14. Installation hub",
    what: "Research/developer installation of the Python package and the TypeScript frontend, plus an honest account of production-like Docker deployment.",
    when: "Use when you have been granted source access and want a local research copy. Do not use this as a public-production runbook.",
    example: "Create a Python 3.11 virtualenv, install extras, run the API, and use npm ci in frontend/ with the committed lockfile.",
    limitation:
      "`make dev` launches `./scripts/start-synapse.sh dev` as a research/developer start path. Installation success is not production certification. Native desktop/mobile apps are not a documented product path.",
  },
  {
    id: "prerequisites-manual",
    title: "15. Prerequisites and platforms",
    what: "Python 3.11, Node 22, npm, and Git. Docker is required for some governed and production-like deployments, not for every simple Chat install. Ollama is optional for local models.",
    when: "Check prerequisites before cloning. Treat unvalidated platforms as a community/developer path.",
    example: "A Linux workstation with Python 3.11 and Node 22 following the documented research install.",
    limitation:
      "This portal does not invent native Windows/macOS application support. Those environments may run the same Python/Node research path, but they are a community/developer path until independently validated.",
  },
  {
    id: "access-manual",
    title: "16. Access-controlled source",
    what: "The repository is access-controlled. Researchers with granted Git credentials may clone the configured URL.",
    when: "Clone only if you already have access. This page will not collect passwords.",
    example: "An invited collaborator clones with their existing GitHub authentication.",
    limitation: "This portal does not imply that a private research repository is publicly downloadable and does not offer a fabricated Request Access API.",
  },
  {
    id: "python-install-manual",
    title: "17. Research/developer Python installation",
    what: "Editable install of synapse-omega with biomed, causal, and dev extras into a Python 3.11 virtual environment.",
    when: "Use for local research and developer verification. Label it as a research/developer installation, not a certified appliance.",
    example: "python3.11 -m venv .venv followed by pip install -e \".[biomed,causal,dev]\".",
    limitation: "Passing unit tests is not biological validation. Heuristic model settings are development/test behavior, not a production intelligence claim.",
  },
  {
    id: "frontend-install-manual",
    title: "18. Frontend installation",
    what: "Node 22 + npm ci using the committed package-lock.json, then typecheck, test, and build.",
    when: "Use whenever you need a reproducible client. pnpm is not the release package-manager path.",
    example: "cd frontend && npm ci && npm run typecheck && npm test -- --run && npm run build.",
    limitation: "A successful build proves the client compiled. It does not prove the paired backend is scientifically correct.",
  },
  {
    id: "models-manual",
    title: "19. Local and hosted models",
    what: "Models are proposers. You may configure a hosted provider or a local runtime such as Ollama. This documentation uses placeholders only and never asks you to paste a live key into the portal.",
    when: "Configure a real model when you want representative conversational quality. Development may use a heuristic provider for UI testing.",
    example: "Point a local runtime at an approved model name in your private environment file. Do not commit secrets.",
    limitation:
      "A local model is not a privacy guarantee. Conversations and artifacts may still be stored by the SYNAPSE workspace according to deployment policy. SYNAPSE does not claim that conversations remain only on your machine unless that property is independently established for the specific deployment.",
  },
  {
    id: "run-manual",
    title: "20. Running SYNAPSE locally",
    what: "Start the authenticated API with uvicorn and, for the Vite research shell, npm run dev in frontend/. Production-like hosting uses the native Docker Compose file after secrets are replaced.",
    when: "Use the research path on a workstation; use Compose only when you intend the reference deployment profile.",
    example: "API on 127.0.0.1:3020 with the Vite proxy, or the production profile on port 8080 after replacing required secrets.",
    limitation:
      "`make dev` is the canonical local product launch (`./scripts/start-synapse.sh dev`). Explicit Python and npm commands remain valid. Docker is not required merely to open Chat against a local API. `make dev` is not production certification.",
  },
  {
    id: "verify-manual",
    title: "21. Developer verification",
    what: "User-safe indicators: live health, version metadata, frontend typecheck/tests/build. Optional deeper gates exist for contributors (mypy, ruff, pytest, plane-separation, secrets check).",
    when: "Run health/version after starting the API. Run frontend checks after changing the client.",
    example: "curl the live health endpoint, then open the researcher portal and confirm the Research Beta label.",
    limitation: "These indicators are software hygiene. They are not clinical validation and not a claim of 100% accuracy.",
  },
  {
    id: "deployment-manual",
    title: "22. Deployment levels",
    what: "Research workstation, isolated-process development, and container-task reference deployment are different levels. Each answers a different question about isolation and authority.",
    when: "Choose the lowest level that matches the work. Do not describe a laptop Chat install as a production compute environment.",
    example: "Exploring the portal and Casual chat on a workstation; governed compute only where that path is enabled.",
    limitation: "Installation success ≠ production certification. Public production still requires environment-specific operational controls.",
  },
  {
    id: "not-manual",
    title: "23. What SYNAPSE is not",
    what: "Not a licensed clinician, not an autonomous doctor, not a medical device, not a hallucination-free oracle, not a public app store, not a guaranteed private on-device vault, not restricted only to scientific conversation, and not a disclosure of proprietary internals.",
    when: "Read before demonstrating SYNAPSE to a scientific, clinical, or executive audience.",
    example: "If a stakeholder asks whether SYNAPSE is clinically certified, the accurate answer is no unless an independent certification exists for that deployment—which this research beta does not claim.",
    limitation: "Negative definitions are part of honest product language. They are not an insult to the software; they are the Specification Gap made readable.",
  },
  {
    id: "reliability-manual",
    title: "24. Reliability, proprietary technology, FAQ, and glossary",
    what: "Reliability language matches the legal pages: inspectable controls, no unprovable absolute claims. Proprietary implementation details are intentionally abstracted. FAQ and glossary use public conceptual terms.",
    when: "Use the FAQ when a collaborator asks whether conversations stay local, whether archive exists, or whether thinking depth is a trust score.",
    example: "“Does SYNAPSE guarantee scientific correctness?” — No. Review evidence, uncertainty, and verification state.",
    limitation:
      "Legal pages remain authoritative for intended use, deletion vs erasure, and intellectual property. This manual must stay consistent with them.",
  },
];

export const PLAYBOOKS = [
  {
    title: "Mechanistic literature scoping",
    body: "Start in Science or Deep Science. Ask for competing mechanisms and stated limitations. Do not treat a generated pathway diagram as experimental observation.",
    caveat:
      "Conceptual/research support currently available; execution capability depends on the configured SYNAPSE release and enabled governed tools.",
  },
  {
    title: "Methods comparison",
    body: "Ask Deep Science to compare assumptions, validation style, and failure modes. Keep RETRIEVED, CITED, and SUPPORTED distinct when sources appear.",
    caveat:
      "Conceptual/research support currently available; execution capability depends on the configured SYNAPSE release and enabled governed tools.",
  },
  {
    title: "Authorized data description",
    body: "If you have data you are allowed to process, switch to Analyze rather than describing the file in Casual and hoping the system “just runs it.”",
    caveat:
      "Conceptual/research support currently available; execution capability depends on the configured SYNAPSE release and enabled governed tools.",
  },
  {
    title: "Bounded computation",
    body: "Use Governed Compute only for a computation you can state as a bounded, inspectable action. A project folder does not authorize the run.",
    caveat:
      "Conceptual/research support currently available; execution capability depends on the configured SYNAPSE release and enabled governed tools.",
  },
] as const;

export const NEOANTIGEN_EXAMPLE = {
  title: "Worked example — asking about neoantigen prediction (conceptual)",
  intro:
    "The following is a mode-selection walkthrough. It contains no fabricated patient results, binding scores, rankings, or paper identifiers.",
  rows: [
    {
      mode: "Casual",
      ask: "What is a neoantigen, in plain language?",
      expect: "A generated explanation suitable for orientation. Treat it as generation until evidence states appear.",
    },
    {
      mode: "Science",
      ask: "What is known about limits of in silico neoantigen ranking, and which statements depend on retrieved sources?",
      expect: "A more structured scientific explanation. Sources, if present, remain in their actual evidence state.",
    },
    {
      mode: "Deep Science",
      ask: "Compare major conceptual families of neoantigen prediction, including contradictions and validation gaps.",
      expect: "Longer-horizon synthesis when the configured release performs it. Depth still does not authorize compute.",
    },
    {
      mode: "Analyze",
      ask: "Only if you have authorized data: describe this table without claiming causal immune outcome.",
      expect: "Analysis of provided data. Discussing that analysis in another mode is not Analyze.",
    },
    {
      mode: "Governed Compute",
      ask: "Only if compute is enabled: propose a bounded, authorized statistic—do not imply a wet-lab validation.",
      expect: "Computation if and only if verification and authorization succeed in that deployment.",
    },
  ],
} as const;

export const WHAT_SYNAPSE_IS_NOT = [
  "Not medical advice, a diagnosis, a treatment recommendation, or a licensed professional.",
  "Not a medical device and not clinically certified or clinically validated in this research beta.",
  "Not an autonomous doctor or an unsupervised clinical actor.",
  "Not hallucination-free, 100% accurate, or guaranteed scientifically correct.",
  "Not a claim that formal verification equals scientific truth.",
  "Not restricted only to scientific conversation. Writing, coding, and everyday questions remain in scope.",
  "Not a public consumer download of a private research repository.",
  "Not a native desktop or mobile application catalog.",
  "Not a guarantee that conversations remain only on your device.",
  "Not a disclosure of system prompts, model-selection formulas, ranking weights, or security topology.",
] as const;

export const RELIABILITY_PHILOSOPHY = [
  "SYNAPSE is engineered with verification, provenance, and execution controls intended to make scientific workflows inspectable.",
  "Those controls prove compliance with an explicit software specification when a check runs—not correspondence with reality, completeness of the literature, or clinical validity.",
  "As uncertainty increases, SYNAPSE should verify, clarify, qualify, or abstain rather than invent certainty. It does not claim 100% accuracy, hallucination-free output, or guaranteed truth.",
  "The software may be unavailable, incomplete, or incorrect. Answers can omit relevant evidence, misread a source, or fail a quality gate.",
  "Do not treat generated text as an authoritative record. For consequential decisions, consult a qualified professional who can review original evidence.",
] as const;

export const PROPRIETARY_NOTICE =
  "SYNAPSE-O, including its proprietary code, algorithms, architecture, models of interaction, documentation, and associated intellectual property, is owned by Sheen Studios®. This researcher portal describes public conceptual behavior. Implementation details are intentionally abstracted. All rights not expressly granted are reserved.";

export const FAQ = [
  {
    q: "Is SYNAPSE a doctor?",
    a: "No. It is research and educational software. Outputs are not medical advice.",
  },
  {
    q: "Is SYNAPSE only for scientific questions?",
    a: "No. SYNAPSE is science-first, not science-only. Ordinary writing, coding, and everyday questions remain in scope in every mode. The client does not reject non-scientific requests.",
  },
  {
    q: "Does thinking depth make an answer true?",
    a: "No. Basic, Medium, and Advanced change depth, not authority and not scientific truth.",
  },
  {
    q: "If I discuss an analysis, is that Analyze mode?",
    a: "No. Discussing analysis is conversation. Analyze is a distinct mode for working with provided data.",
  },
  {
    q: "Does retrieving a paper mean the claim is supported?",
    a: "No. RETRIEVED ≠ CITED ≠ SUPPORTED. A found source is not automatically a supporting span for a specific sentence.",
  },
  {
    q: "Will conversations stay on my laptop?",
    a: "Not unless that property is independently established for your deployment. The workspace may store conversations, files, and operational records. SYNAPSE does not claim that conversations are never stored.",
  },
  {
    q: "Does deleting a chat physically erase every copy immediately?",
    a: "No. Deletion removes the conversation from ordinary workspace access. Audit, provenance, and compliance records may be retained according to policy and law. SYNAPSE does not claim immediate physical erasure of all systems, and it does not claim indefinite retention of every deleted record.",
  },
  {
    q: "Is Archive available?",
    a: "Yes. Archive is organizational state, not deletion. Clicking an archived conversation opens it as read-only. Unarchive restores ordinary workspace access.",
  },
  {
    q: "Does a project authorize compute?",
    a: "No. Projects are organizational context only.",
  },
  {
    q: "Can I download the private repository from this page?",
    a: "Only if you already have granted source access. This portal does not treat the research repository as a public download and does not collect credentials.",
  },
  {
    q: "Is there a make dev command?",
    a: "Yes. `make dev` runs `./scripts/start-synapse.sh dev` to start the local research product (model runtime, model, backend, and built UI). That is a research/developer start path, not production certification. Explicit Python and npm commands remain valid.",
  },
  {
    q: "Does a local model guarantee privacy?",
    a: "No. Local inference can reduce dependence on a hosted model provider. It does not by itself guarantee that prompts, logs, or workspace records stay private.",
  },
  {
    q: "Does passing health checks mean the science is certified?",
    a: "No. Installation success and live health are not production certification and not clinical validation.",
  },
] as const;

export const GLOSSARY = [
  { term: "Abstention", definition: "A deliberate refusal to produce a stronger conclusion when evidence, identifiability, or authorization is insufficient." },
  { term: "Authorization", definition: "The act of granting scoped execution authority. Distinct from proposing, verifying, or reporting." },
  { term: "Citation", definition: "A displayed pointer to a source. Citation is not the same as retrieval and not the same as support." },
  { term: "Evidence state", definition: "A labeled relationship such as retrieved, cited, or supported. States must not be collapsed for aesthetics." },
  { term: "Generation", definition: "Model-authored language. Useful, fallible, and not automatically evidence." },
  { term: "Governed capability", definition: "A tool or computation that may run only inside authorized bounds." },
  { term: "Identifiability", definition: "Whether a causal question can be answered from the stated assumptions and observed variables. Missing identifiability is a reason to abstain from causal language." },
  { term: "Observation", definition: "What was actually produced by an authorized computation or recorded from a source—not what a model predicted." },
  { term: "Project", definition: "Organizational grouping of chats and files. Not an authorization token." },
  { term: "Reconciliation", definition: "Comparison of authorized intent with observed computational results." },
  { term: "Research Beta", definition: "The current public documentation label for this release line: controlled research use, not public-production certification." },
  { term: "Specification Gap", definition: "The distinction between satisfying a software specification and being true of the world." },
  { term: "Support", definition: "A recorded relationship in which a specific claim is backed by specific evidence. Stricter than retrieval or citation." },
  { term: "Thinking depth", definition: "Explanatory thoroughness (Basic / Medium / Advanced). Not a permission level." },
] as const;

export const RESOURCES = [
  { label: "Architecture Atlas", href: "#/synapse/architecture", description: "Public conceptual layers." },
  { label: "Researcher Manual", href: "#/synapse/manual", description: "Modes, evidence, install, limitations." },
  { label: "Install locally", href: "#/synapse/install", description: "Research/developer installation hub." },
  { label: "Modes", href: "#/synapse/modes", description: "Casual through Governed Compute." },
  { label: "Evidence discipline", href: "#/synapse/evidence", description: "Retrieved, cited, supported." },
  { label: "Local models", href: "#/synapse/local-models", description: "Hosted vs local proposers." },
  { label: "Projects", href: "#/synapse/projects", description: "Organizational context only." },
  { label: "Voice", href: "#/synapse/voice", description: "Browser speech disclosure." },
  { label: "Troubleshooting", href: "#/synapse/troubleshooting", description: "Honest recovery steps." },
  { label: "Research & educational use", href: "#/legal/research", description: "Intended-use legal page." },
  { label: "Terms", href: "#/legal/terms", description: "Disclaimer and reliability language." },
  { label: "Privacy", href: "#/legal/privacy", description: "Storage, deletion, and retention." },
] as const;

export const TROUBLESHOOTING = [
  {
    title: "The API does not respond",
    body: "Confirm the research/developer uvicorn process is listening on the port you are calling. curl the live health endpoint. A failed health check means the process is down or mis-bound—not that science has failed.",
  },
  {
    title: "The frontend cannot reach the API",
    body: "In Vite development, the client proxies selected paths to 127.0.0.1:3020. Start both the API and npm run dev, or serve the built client from the deployment that actually hosts the API.",
  },
  {
    title: "npm ci fails",
    body: "Use Node 22 and the committed frontend/package-lock.json. pnpm is not the release path.",
  },
  {
    title: "I expected Archive",
    body: "Archive is available as organizational state. Open an archived conversation to view it read-only, then Unarchive to restore send and mutation. SYNAPSE does not fake archive persistence in the browser.",
  },
  {
    title: "I expected a native installer",
    body: "Native platform applications are not a documented product path. Use the research/developer Python and Node path, labeled community/developer on unvalidated platforms.",
  },
  {
    title: "make dev",
    body: "`make dev` launches `./scripts/start-synapse.sh dev`. It is a research/developer start path. Installation success is not production certification.",
  },
] as const;

export const LOCAL_VS_HOSTED = {
  title: "Local and hosted intelligence (conceptual)",
  caption: "Conceptual diagram. No sensitive networking, private endpoints, or security topology is shown.",
  hosted: "A hosted model provider receives prompts from the configured SYNAPSE deployment. Workspace storage, if enabled, is still a property of that deployment—not of the model vendor alone.",
  local: "A local runtime such as Ollama can serve as the proposer on a machine you control. Logs, workspace records, browser speech, and backups can still leave that machine depending on configuration. Local is not a privacy proof.",
  neither: "In both pictures the model proposes. Evidence, assurance, authorization, execution, and reconciliation remain separate conceptual layers.",
};

export function manualSearchCorpus(): ReadonlyArray<{ id: string; title: string; text: string }> {
  return MANUAL_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    text: [section.title, section.what, section.when, section.example, section.limitation, ...(section.extra ?? [])].join("\n"),
  }));
}

export function searchManual(query: string): Array<{ id: string; title: string; snippet: string }> {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const hits: Array<{ id: string; title: string; snippet: string }> = [];
  for (const entry of manualSearchCorpus()) {
    const lower = entry.text.toLowerCase();
    const index = lower.indexOf(needle);
    if (index === -1) continue;
    const start = Math.max(0, index - 48);
    const snippet = entry.text.slice(start, start + 140).replace(/\s+/g, " ").trim();
    hits.push({ id: entry.id, title: entry.title, snippet });
  }
  return hits;
}

export function portalCopyBlob(): string {
  const parts = [
    HERO.identity,
    HERO.title,
    HERO.supporting,
    HERO.lede,
    HERO.institutional,
    HERO.positioning,
    ASK_FLOW_INTRO,
    ARCHITECTURE_ABSTRACTION_LABEL,
    PROPRIETARY_NOTICE,
    ...MODE_CARDS.flatMap((mode) => [mode.name, mode.what, mode.when, mode.example, mode.limitation]),
    ...THINKING_LEVELS_MANUAL.flatMap((level) => [level.what, level.limitation]),
    ...MANUAL_SECTIONS.flatMap((section) => [section.title, section.what, section.when, section.example, section.limitation]),
    ...PLAYBOOKS.flatMap((item) => [item.title, item.body, item.caveat]),
    NEOANTIGEN_EXAMPLE.intro,
    ...WHAT_SYNAPSE_IS_NOT,
    ...RELIABILITY_PHILOSOPHY,
    ...FAQ.flatMap((item) => [item.q, item.a]),
    ...GLOSSARY.map((item) => `${item.term} ${item.definition}`),
    ...TROUBLESHOOTING.flatMap((item) => [item.title, item.body]),
    LOCAL_VS_HOSTED.caption,
    LOCAL_VS_HOSTED.local,
  ];
  return parts.join("\n");
}
