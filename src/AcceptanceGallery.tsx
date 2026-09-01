import { EpistemicChatApp } from "@ui/components/EpistemicChatApp";
import { AssistantMessageView } from "@ui/components/AssistantMessageView";
import { ModelUnavailableCard } from "@ui/components/ModelUnavailableCard";
import { classifyModelReadiness } from "@ui/design/modelReadiness";
import { emptyAssistantMessage } from "@ui/sse";
import { LEGAL_PAGES } from "./legal/legalContent";
import { LegalFooter } from "./LegalFooter";
import type { AnswerPackageView } from "@ui/types/message";

const EVIDENCE_PACKAGE: AnswerPackageView = {
  schema_version: "synapse.answer.v1",
  answer_id: "gallery",
  conversation_id: "gallery",
  product_mode: "syn_science",
  output_policy: "SCIENCE_ANSWER",
  direct_answer: "Example answer used only for layout fixtures.",
  answer_status: "ANSWERED",
  claims: [],
  evidence: [
    {
      evidence_id: "ev_gallery",
      canonical_uri: "https://pubmed.ncbi.nlm.nih.gov/1/",
      persistent_identifier: "PMID:1",
      source_identity: "Backend-supplied example source",
      publisher: "Example Journal",
      publication_or_update_date: "2021",
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
      citation_id: "c1",
      claim_id: "claim_1",
      evidence_id: "ev_gallery",
      status: "VERIFIED_SUPPORT",
    },
  ],
  warnings: [],
  trace: { trace_id: "t", events: [] },
  epistemic_badge: "cited",
  temporal_freshness: "2026-01-01T00:00:00Z",
};

export function AcceptanceGallery({ onClose }: { onClose: () => void }) {
  const msg = emptyAssistantMessage("gallery");
  msg.text = EVIDENCE_PACKAGE.direct_answer;
  msg.scientific = {
    message_id: "gallery",
    conversation_id: "gallery",
    role: "assistant",
    status: "complete",
    blocks: [{ block_id: "b1", kind: "markdown", text: EVIDENCE_PACKAGE.direct_answer, claim_ids: [] }],
    claim_links: [],
    citation_links: [],
    artifact_refs: [],
    created_at: 0,
    answer_package: EVIDENCE_PACKAGE,
  };

  return (
    <div className="acceptance-gallery" data-testid="acceptance-gallery">
      <header className="legal-page-header">
        <div>
          <p className="legal-page-kicker">LAYOUT FIXTURE / NOT LIVE INTELLIGENCE</p>
          <h1>SYNAPSE product states</h1>
        </div>
        <button type="button" className="ghost-btn" onClick={onClose}>Close</button>
      </header>
      <p data-testid="layout-fixture-banner">These panels are LAYOUT FIXTURE / NOT LIVE INTELLIGENCE. They do not represent live product behavior.</p>
      <section data-gallery="casual"><h2>Casual</h2><EpistemicChatApp conversationId="gallery-casual" /></section>
      <section data-gallery="science"><h2>Science</h2><EpistemicChatApp conversationId="gallery-science" experienceMode="syn_science" sciencePreset="science_answer" /></section>
      <section data-gallery="deep"><h2>Deep Science</h2><EpistemicChatApp conversationId="gallery-deep" experienceMode="syn_science" sciencePreset="deep_research" /></section>
      <section data-gallery="analyze"><h2>Analyze</h2><EpistemicChatApp conversationId="gallery-analyze" experienceMode="syn_science" sciencePreset="analyze" /></section>
      <section data-gallery="compute"><h2>Governed Compute</h2><EpistemicChatApp conversationId="gallery-compute" experienceMode="syn_science" sciencePreset="governed_compute" /></section>
      <section data-gallery="unavailable">
        <h2>Model unavailable</h2>
        <ModelUnavailableCard view={classifyModelReadiness({ code: "MODEL_UNREACHABLE" })} onRetry={() => undefined} />
      </section>
      <section data-gallery="references">
        <h2>References expanded</h2>
        <AssistantMessageView msg={msg} workflow="science_answer" onResolve={() => undefined} onApproval={() => undefined} onFocus={() => undefined} onStop={() => undefined} />
      </section>
      <section data-gallery="legal" className="legal-page">
        <h2>Legal</h2>
        <p className="legal-page-kicker">{LEGAL_PAGES.terms.kicker}</p>
        <h1>{LEGAL_PAGES.terms.title}</h1>
        {LEGAL_PAGES.terms.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </section>
      <LegalFooter />
    </div>
  );
}
