import { useEffect, useRef } from "react";
import { useFocusTrap } from "../a11y";
import { LEGAL_FOOTER_LINKS, LEGAL_PAGES, type LegalPageId } from "./legalContent";

export function LegalPage({ page, onClose }: { page: LegalPageId; onClose: () => void }) {
  const ref = useRef<HTMLElement | null>(null);
  const content = LEGAL_PAGES[page];
  useFocusTrap(ref, true, onClose);

  useEffect(() => {
    document.title = `${content.title} · SYNAPSE-O`;
    return () => {
      document.title = "SYNAPSE-Ω";
    };
  }, [content.title]);

  return (
    <div
      className="legal-page-shell"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article
        ref={ref}
        className="legal-page"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-page-title"
        tabIndex={-1}
      >
        <header className="legal-page-header">
          <div>
            <p className="legal-page-kicker">{content.kicker}</p>
            <h1 id="legal-page-title">{content.title}</h1>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose} aria-label={`Close ${content.title}`}>
            Close
          </button>
        </header>
        <nav className="legal-page-nav" aria-label="Legal documents">
          {LEGAL_FOOTER_LINKS.map((link) => (
            <a key={link.id} href={link.href} aria-current={page === link.id ? "page" : undefined}>
              {link.label}
            </a>
          ))}
        </nav>
        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
