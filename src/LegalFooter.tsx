export const LEGAL_NOTICE =
  "SynOmics™ · Private Research Beta · Designed to verify, challenge, and trace claims—not just generate them · Research & educational use only · Not medical advice · Terms";

export const LEGAL_NOTICE_NARROW =
  "SynOmics™ · Designed for verifiable answers · Research & educational use only · Not medical advice · Terms";

const FORBIDDEN_FOOTER_CLAIMS = [
  "All other AI tools make mistakes; we don't.",
  "mistake-free",
  "100% accurate",
  "hallucination-free",
  "guaranteed",
  "clinically validated",
  "production certified",
];

export function legalNoticeContainsForbiddenClaims(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_FOOTER_CLAIMS.some((claim) => lower.includes(claim.toLowerCase()));
}

export function LegalFooter({
  onOpen,
}: {
  onOpen?: (target: "research" | "terms") => void;
}) {
  return (
    <footer className="legal-footer" role="contentinfo">
      <span>SynOmics™</span>
      <span aria-hidden="true">·</span>
      <span>Private Research Beta</span>
      <span aria-hidden="true">·</span>
      <span className="legal-footer-marketing legal-footer-marketing-full">
        Designed to verify, challenge, and trace claims—not just generate them
      </span>
      <span className="legal-footer-marketing legal-footer-marketing-short">Designed for verifiable answers</span>
      <span aria-hidden="true">·</span>
      {onOpen ? (
        <button type="button" className="legal-footer-link" onClick={() => onOpen("research")}>
          Research & educational use only
        </button>
      ) : (
        <a className="legal-footer-link" href="#/legal/research">Research & educational use only</a>
      )}
      <span aria-hidden="true">·</span>
      <span>Not medical advice</span>
      <span aria-hidden="true">·</span>
      {onOpen ? (
        <button type="button" className="legal-footer-link" onClick={() => onOpen("terms")}>
          Terms
        </button>
      ) : (
        <a className="legal-footer-link" href="#/legal/terms">Terms</a>
      )}
    </footer>
  );
}
