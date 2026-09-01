import { useEffect, useRef } from "react";
import { useFocusTrap } from "./a11y";
import { LEGAL_PAGES, type LegalPageId } from "./legal/legalContent";

export type WorkspaceInfoPage =
  | "about"
  | "faqs"
  | "join"
  | "research"
  | "disclaimer"
  | "privacy"
  | "terms"
  | "ip"
  | "capabilities";

const PAGE_TITLES: Record<WorkspaceInfoPage, string> = {
  about: "About SYNAPSE",
  faqs: "Frequently asked questions",
  join: "Join the team",
  research: "Research & Educational Use",
  disclaimer: "Terms / Disclaimer",
  privacy: "Privacy",
  terms: "Terms / Disclaimer",
  ip: "Intellectual Property",
  capabilities: "Capability Catalog",
};

function legalId(page: WorkspaceInfoPage): LegalPageId | null {
  if (page === "research") return "research";
  if (page === "disclaimer" || page === "terms") return "terms";
  if (page === "privacy") return "privacy";
  if (page === "ip") return "ip";
  return null;
}

function PageContent({ page }: { page: WorkspaceInfoPage }) {
  const legal = legalId(page);
  if (legal) {
    return (
      <>
        {LEGAL_PAGES[legal].sections.map((section) => (
          <section key={section.heading}>
            <h3>{section.heading}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </>
    );
  }
  if (page === "about") {
    return (
      <>
        <p>SYNAPSE-Ω is an academic scientific intelligence workspace for conversation, evidence review, research synthesis, analysis, and reproducible computation.</p>
        <p>Its scientific workflows keep sources, assumptions, approvals, and computational lineage visible instead of silently presenting uncertain work as fact.</p>
      </>
    );
  }
  if (page === "capabilities") {
    return (
      <div className="capability-catalog-copy">
        <p className="workspace-info-lead">
          A read-only view of the capability contract. Catalog visibility describes what SYNAPSE can propose or request; it never grants authority and never proves that an operation ran successfully.
        </p>
        <section>
          <h3>Inspection &amp; synthesis</h3>
          <p>Read-only and reasoning capabilities may inspect supplied context, structure evidence, formulate analysis plans, compare methods, and prepare verification requests without crossing into privileged execution.</p>
        </section>
        <section>
          <h3>Governed computation</h3>
          <p>Executable capabilities are separate. A computation must match an admitted capability scope, satisfy policy and verification requirements, receive explicit authorization, run inside the designated executor, and return a receipt before an outcome can be reconciled as observed.</p>
        </section>
        <section>
          <h3>Versioned manifest identity</h3>
          <p>Production capability records are intended to be immutable and version-aware so an analysis can identify which contract, tool scope, validation requirements, and execution boundary applied. This interface does not invent unavailable manifest records; it exposes the contract conservatively until server-provided catalog records are available to render.</p>
        </section>
        <section>
          <h3>Authority boundary</h3>
          <ul>
            <li>Listed capability ≠ authorization.</li>
            <li>Authorization ≠ successful execution.</li>
            <li>Execution ≠ scientifically validated interpretation.</li>
            <li>Every promotion requires its own evidence and provenance.</li>
          </ul>
        </section>
      </div>
    );
  }
  if (page === "faqs") {
    return (
      <dl className="workspace-info-faqs">
        <dt>Which mode should I use?</dt>
        <dd>Casual is fast everyday assistance. Synthesis is the core academic science mode. Deep Cortex performs deeper multi-source research. Synthetic Mapping interprets supplied data, documents, and research inputs. Governed Compute is the explicit lane for authorized reproducible execution. SYNAPSE does not silently promote a plan into execution.</dd>
        <dt>What do Basic, Medium, and Advanced change?</dt>
        <dd>They change thinking depth (Basic, Medium, and Advanced — also labeled Faster, Balanced, and Deeper). They do not change selected mode, tools, verification requirements, or execution authority. Advanced is not higher authority, and Basic is not unverified truth.</dd>
        <dt>Does SYNAPSE guarantee that an answer is correct?</dt>
        <dd>No. Predictions and syntheses remain bounded by available evidence. Review cited evidence, uncertainty, and verification state before acting, and consult a qualified professional for consequential decisions.</dd>
      </dl>
    );
  }
  return (
    <>
      <p>Help shape SYNAPSE by proposing improvements, requesting new functions, or describing a workflow the platform should support.</p>
      <a className="workspace-info-primary-link" href="https://github.com/fredoc20231-cmyk/SYNAPSE/issues/new/choose" target="_blank" rel="noreferrer">
        Submit a community request
      </a>
    </>
  );
}

export function WorkspaceInfoDialog({ page, onClose }: { page: WorkspaceInfoPage; onClose: () => void }) {
  const ref = useRef<HTMLElement | null>(null);
  useFocusTrap(ref, true, onClose);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const title = PAGE_TITLES[page];
  return (
    <div className="workspace-info-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={ref} className="workspace-info-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-info-title" tabIndex={-1}>
        <div className="workspace-info-heading">
          <div>
            <span className="workspace-info-kicker">SYNAPSE-Ω™</span>
            <h2 id="workspace-info-title">{title}</h2>
          </div>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose}>×</button>
        </div>
        <div className="workspace-info-content"><PageContent page={page} /></div>
      </section>
    </div>
  );
}
