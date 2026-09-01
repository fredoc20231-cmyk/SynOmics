import { useId, useState, type KeyboardEvent } from "react";
import {
  APPROVED_ARCHITECTURE_LABELS,
  ARCHITECTURE_ABSTRACTION_LABEL,
  ARCHITECTURE_LAYERS,
  CONCEPTUAL_FLOW_CAPTION,
  CONCEPTUAL_FLOW_STEPS,
} from "./architecture";

export function ArchitectureAtlas() {
  const headingId = useId();
  const [active, setActive] = useState(0);

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % ARCHITECTURE_LAYERS.length);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current - 1 + ARCHITECTURE_LAYERS.length) % ARCHITECTURE_LAYERS.length);
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      setActive(ARCHITECTURE_LAYERS.length - 1);
    }
  }

  return (
    <section className="portal-atlas" aria-labelledby={headingId} data-testid="architecture-atlas">
      <header>
        <p className="portal-kicker">Architecture Atlas</p>
        <h2 id={headingId}>Public conceptual layers</h2>
        <p className="portal-lede">{ARCHITECTURE_ABSTRACTION_LABEL}</p>
      </header>
      <ol className="portal-flow" aria-label="Conceptual ASK to REPORT sequence">
        {CONCEPTUAL_FLOW_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="portal-caption">{CONCEPTUAL_FLOW_CAPTION}</p>
      <div
        className="portal-atlas-layers"
        role="listbox"
        aria-label="Conceptual architecture layers"
        tabIndex={0}
        onKeyDown={onKey}
        data-testid="architecture-atlas-keyboard"
      >
        {ARCHITECTURE_LAYERS.map((layer, index) => (
          <button
            type="button"
            role="option"
            aria-selected={active === index}
            key={layer.id}
            className={active === index ? "is-active" : undefined}
            onClick={() => setActive(index)}
          >
            <span className="portal-atlas-index">{String(index + 1).padStart(2, "0")}</span>
            <strong>{layer.name}</strong>
            <span>{layer.summary}</span>
          </button>
        ))}
      </div>
      <p className="portal-atlas-active" data-testid="architecture-atlas-active">
        {ARCHITECTURE_LAYERS[active]?.summary}
      </p>
      <p className="sr-only">Approved conceptual labels: {APPROVED_ARCHITECTURE_LABELS.join(", ")}</p>
    </section>
  );
}
