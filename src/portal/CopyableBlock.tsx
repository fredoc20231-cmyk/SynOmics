import { useState } from "react";

export function CopyableBlock({
  label,
  code,
  caption,
}: {
  label: string;
  code: string;
  caption?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <figure className="portal-copy-block">
      <figcaption>
        <span>{label}</span>
        <button type="button" className="ghost-btn" onClick={() => void copy()} aria-label={`Copy ${label}`}>
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre>
        <code>{code}</code>
      </pre>
      {caption ? <p className="portal-copy-caption">{caption}</p> : null}
    </figure>
  );
}
