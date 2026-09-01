import { useEffect, useMemo, useState } from "react";
import { LegalFooter } from "../LegalFooter";
import { ArchitectureAtlas } from "./ArchitectureAtlas";
import { CAPABILITY_BADGES } from "./capabilityBadges";
import {
  ASK_FLOW_INTRO,
  CTA,
  FAQ,
  GLOSSARY,
  HERO,
  LOCAL_VS_HOSTED,
  MANUAL_SECTIONS,
  MODE_CARDS,
  NEOANTIGEN_EXAMPLE,
  PLAYBOOKS,
  PORTAL_KICKER,
  PROPRIETARY_NOTICE,
  RELIABILITY_PHILOSOPHY,
  RESOURCES,
  THINKING_LEVELS_MANUAL,
  TROUBLESHOOTING,
  WHAT_SYNAPSE_IS_NOT,
  searchManual,
} from "./content";
import { InstallHub } from "./InstallHub";
import { PRINCIPLES, TIMELINE_STAGES } from "./principles";
import { PORTAL_SECTION_IDS, portalHash, type PortalSection } from "./routes";
import { VersionBadge } from "./VersionBadge";
import { SynapseWordmark } from "./Wordmark";

const NAV: Array<{ section: PortalSection; label: string }> = [
  { section: "architecture", label: "Architecture" },
  { section: "manual", label: "Manual" },
  { section: "modes", label: "Modes" },
  { section: "evidence", label: "Evidence" },
  { section: "install", label: "Install" },
];

export function ResearcherPortal({
  section,
  authenticated,
  isAdmin = false,
  isDeveloper = false,
}: {
  section: PortalSection;
  authenticated: boolean;
  isAdmin?: boolean;
  isDeveloper?: boolean;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>(TIMELINE_STAGES[0]?.id ?? null);
  const [expandedMode, setExpandedMode] = useState<string | null>(MODE_CARDS[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const hits = useMemo(() => searchManual(query), [query]);
  const installTab = section === "local-models" ? "models" : "research";

  useEffect(() => {
    document.title = section === "home" ? "SYNAPSE-Ω · Researcher Portal" : `SYNAPSE-Ω · ${section}`;
    const node = document.getElementById(PORTAL_SECTION_IDS[section]);
    node?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    return () => {
      document.title = "SYNAPSE-Ω";
    };
  }, [section]);

  return (
    <div className="researcher-portal" data-testid="researcher-portal" data-section={section}>
      <a className="portal-skip" href="#synapse-main">
        Skip to content
      </a>
      <header className="portal-topbar">
        <SynapseWordmark href="#/synapse" />
        <button
          type="button"
          className="portal-nav-toggle"
          aria-expanded={navOpen}
          aria-controls="portal-primary-nav"
          onClick={() => setNavOpen((open) => !open)}
        >
          Menu
        </button>
        <nav id="portal-primary-nav" className={navOpen ? "is-open" : undefined} aria-label="Researcher portal">
          {NAV.map((item) => (
            <a
              key={item.section}
              href={portalHash(item.section)}
              aria-current={section === item.section ? "page" : undefined}
              onClick={() => setNavOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <a className="black-btn portal-open-cta" href={CTA.open.href} data-testid="open-synapse-cta">
          {CTA.open.label}
        </a>
      </header>

      <main id="synapse-main" className="portal-main" tabIndex={-1}>
        <section className="portal-hero" id={PORTAL_SECTION_IDS.home}>
          <p className="portal-kicker">{PORTAL_KICKER}</p>
          <VersionBadge authenticated={authenticated} isAdmin={isAdmin} isDeveloper={isDeveloper} />
          <h1>{HERO.title}</h1>
          <p className="portal-supporting">{HERO.supporting}</p>
          <p className="portal-lede">{HERO.lede}</p>
          <p>{HERO.positioning}</p>
          <p className="portal-institutional">{HERO.institutional}</p>
          <div className="portal-cta-row">
            <a className="black-btn" href={CTA.open.href}>
              {CTA.open.label}
            </a>
            <a className="ghost-btn" href={CTA.manual.href}>
              {CTA.manual.label}
            </a>
            <a className="ghost-btn" href={CTA.install.href} data-testid="install-locally-cta">
              {CTA.install.label}
            </a>
            <a className="ghost-btn" href={CTA.architecture.href}>
              {CTA.architecture.label}
            </a>
          </div>
        </section>

        <section className="portal-section" aria-labelledby="ask-flow-title">
          <h2 id="ask-flow-title">From ASK to REPORT</h2>
          <p>{ASK_FLOW_INTRO}</p>
          <ArchitectureAtlas />
        </section>

        <section className="portal-section" id={PORTAL_SECTION_IDS.architecture} aria-labelledby="principles-title">
          <h2 id="principles-title">Why the architecture matters</h2>
          <div className="portal-principle-grid">
            {PRINCIPLES.map((principle) => (
              <article key={principle.id}>
                <h3>{principle.title}</h3>
                <p>{principle.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="portal-section" aria-labelledby="timeline-title">
          <h2 id="timeline-title">From question to defensible conclusion</h2>
          <p>Stages expand on request. This is a conceptual walkthrough, not an implementation disclosure.</p>
          <ol className="portal-timeline">
            {TIMELINE_STAGES.map((stage) => {
              const open = expandedStage === stage.id;
              return (
                <li key={stage.id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`timeline-${stage.id}`}
                    onClick={() => setExpandedStage(open ? null : stage.id)}
                  >
                    <strong>{stage.title}</strong>
                    <span>{stage.summary}</span>
                  </button>
                  {open ? (
                    <p id={`timeline-${stage.id}`}>{stage.detail}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="portal-section" id={PORTAL_SECTION_IDS.modes} aria-labelledby="modes-title">
          <h2 id="modes-title">Five modes</h2>
          <p>
            Discussing an analysis is not Analyze. Thinking depth is not authority. Selecting Governed Compute does not
            automatically execute. Execution, where it exists, depends on the configured SYNAPSE release and enabled
            governed tools. Casual describes experience, not a lower trust level.
          </p>
          <div className="portal-mode-grid">
            {MODE_CARDS.map((mode) => {
              const open = expandedMode === mode.id;
              return (
                <article key={mode.id} className={open ? "is-open" : undefined}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpandedMode(open ? null : mode.id)}
                  >
                    <span className="portal-badge">{mode.badge}</span>
                    <h3>{mode.name}</h3>
                    <p>{mode.intent}</p>
                  </button>
                  {open ? (
                    <dl>
                      <dt>What it does</dt>
                      <dd>{mode.what}</dd>
                      <dt>When to use</dt>
                      <dd>{mode.when}</dd>
                      <dt>Example</dt>
                      <dd>{mode.example}</dd>
                      <dt>Important limitation</dt>
                      <dd>{mode.limitation}</dd>
                    </dl>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="portal-section" aria-labelledby="thinking-title">
          <h2 id="thinking-title">Thinking depth is not authority</h2>
          <div className="portal-principle-grid">
            {THINKING_LEVELS_MANUAL.map((level) => (
              <article key={level.name}>
                <h3>
                  {level.name} <span className="portal-muted">({level.also})</span>
                </h3>
                <p>
                  <strong>What it does.</strong> {level.what}
                </p>
                <p>
                  <strong>When to use.</strong> {level.when}
                </p>
                <p>
                  <strong>Example.</strong> {level.example}
                </p>
                <p>
                  <strong>Important limitation.</strong> {level.limitation}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="portal-manual" id={PORTAL_SECTION_IDS.manual} aria-labelledby="manual-title">
          <div className="portal-manual-header">
            <div>
              <p className="portal-kicker">Researcher Manual</p>
              <h2 id="manual-title">How to work with SYNAPSE-Ω</h2>
            </div>
            <label className="portal-search">
              <span>Search the manual</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search modes, evidence, install…"
                data-testid="manual-search"
                aria-label="Search the researcher manual"
              />
            </label>
          </div>
          {hits.length > 0 ? (
            <ul className="portal-search-hits" data-testid="manual-search-hits">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <a href={`#manual-${hit.id}`}>
                    <strong>{hit.title}</strong>
                    <span>{hit.snippet}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="portal-toc-toggle"
            aria-expanded={tocOpen}
            aria-controls="manual-toc"
            onClick={() => setTocOpen((open) => !open)}
          >
            Contents
          </button>
          <div className="portal-manual-layout">
            <nav id="manual-toc" className={tocOpen ? "is-open" : undefined} aria-label="Manual contents">
              <ol>
                {MANUAL_SECTIONS.map((item) => (
                  <li key={item.id}>
                    <a href={`#manual-${item.id}`} onClick={() => setTocOpen(false)}>
                      {item.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="portal-manual-body">
              {MANUAL_SECTIONS.map((item) => (
                <article key={item.id} id={`manual-${item.id}`}>
                  <h3>{item.title}</h3>
                  <p>
                    <strong>What it does.</strong> {item.what}
                  </p>
                  <p>
                    <strong>When to use.</strong> {item.when}
                  </p>
                  <p>
                    <strong>Example.</strong> {item.example}
                  </p>
                  <p>
                    <strong>Important limitation.</strong> {item.limitation}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="portal-section" aria-labelledby="playbooks-title">
          <h2 id="playbooks-title">Biotech research playbooks</h2>
          <div className="portal-principle-grid">
            {PLAYBOOKS.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <p className="portal-caveat">{item.caveat}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="portal-section" aria-labelledby="neoantigen-title">
          <h2 id="neoantigen-title">{NEOANTIGEN_EXAMPLE.title}</h2>
          <p>{NEOANTIGEN_EXAMPLE.intro}</p>
          <div className="portal-matrix">
            {NEOANTIGEN_EXAMPLE.rows.map((row) => (
              <article key={row.mode}>
                <h3>{row.mode}</h3>
                <p>
                  <strong>Ask conceptually.</strong> {row.ask}
                </p>
                <p>
                  <strong>What to expect.</strong> {row.expect}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="portal-section" id={PORTAL_SECTION_IDS.evidence} aria-labelledby="evidence-title">
          <h2 id="evidence-title">Evidence is not decoration</h2>
          <p>
            RETRIEVED ≠ CITED ≠ SUPPORTED. A source list is not a claim-to-span proof. This page does not disclose a
            citation-validation algorithm.
          </p>
          <p>
            Uncertainty and abstention are product behavior. When identifiability, evidence, or authorization is insufficient,
            SYNAPSE should say what is missing rather than fabricate a result.
          </p>
        </section>

        <section className="portal-section" id={PORTAL_SECTION_IDS.projects} aria-labelledby="projects-title">
          <h2 id="projects-title">Projects and conversations</h2>
          <p>
            <span className="portal-badge">{CAPABILITY_BADGES.projects.badge}</span> {CAPABILITY_BADGES.projects.note}
          </p>
          <p>
            <span className="portal-badge">{CAPABILITY_BADGES.conversations.badge}</span> {CAPABILITY_BADGES.conversations.note}{" "}
            Recency groups currently include Today, Yesterday, Previous 7 days, and Older.
          </p>
          <p>
            <span className="portal-badge">{CAPABILITY_BADGES.archive.badge}</span> {CAPABILITY_BADGES.archive.note}
          </p>
        </section>

        <section className="portal-section" id={PORTAL_SECTION_IDS.voice} aria-labelledby="voice-title">
          <h2 id="voice-title">Voice</h2>
          <p>
            <span className="portal-badge">{CAPABILITY_BADGES.voice.badge}</span> {CAPABILITY_BADGES.voice.note}
          </p>
        </section>

        <InstallHub initialTab={installTab} />

        <section className="portal-section" aria-labelledby="local-hosted-title">
          <h2 id="local-hosted-title">{LOCAL_VS_HOSTED.title}</h2>
          <p className="portal-caption">{LOCAL_VS_HOSTED.caption}</p>
          <div className="portal-diagram" data-testid="local-hosted-diagram" aria-hidden="false">
            <article>
              <h3>Hosted proposer</h3>
              <p>Researcher → SYNAPSE workspace → hosted model → generated proposal</p>
              <p>{LOCAL_VS_HOSTED.hosted}</p>
            </article>
            <article>
              <h3>Local proposer</h3>
              <p>Researcher → SYNAPSE workspace → local runtime → generated proposal</p>
              <p>{LOCAL_VS_HOSTED.local}</p>
            </article>
          </div>
          <p>{LOCAL_VS_HOSTED.neither}</p>
        </section>

        <section className="portal-section" aria-labelledby="not-title">
          <h2 id="not-title">What SYNAPSE is not</h2>
          <ul>
            {WHAT_SYNAPSE_IS_NOT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="portal-section" aria-labelledby="reliability-title">
          <h2 id="reliability-title">Reliability philosophy</h2>
          {RELIABILITY_PHILOSOPHY.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <h3>Proprietary technology</h3>
          <p>{PROPRIETARY_NOTICE}</p>
        </section>

        <section className="portal-section" aria-labelledby="faq-title">
          <h2 id="faq-title">Researcher FAQ</h2>
          <dl className="portal-faq">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt>{item.q}</dt>
                <dd>{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="portal-section" aria-labelledby="glossary-title">
          <h2 id="glossary-title">Glossary</h2>
          <dl className="portal-glossary">
            {GLOSSARY.map((item) => (
              <div key={item.term}>
                <dt>{item.term}</dt>
                <dd>{item.definition}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="portal-section" id={PORTAL_SECTION_IDS.troubleshooting} aria-labelledby="trouble-title">
          <h2 id="trouble-title">Troubleshooting</h2>
          {TROUBLESHOOTING.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </section>

        <section className="portal-section" aria-labelledby="resources-title">
          <h2 id="resources-title">Researcher resources</h2>
          <div className="portal-resource-grid">
            {RESOURCES.map((item) => (
              <a key={item.href} href={item.href} className="portal-resource-card">
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="portal-cta-footer">
          <a className="black-btn" href={CTA.open.href}>
            {CTA.open.label}
          </a>
          <a className="ghost-btn" href={CTA.install.href}>
            {CTA.install.label}
          </a>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
