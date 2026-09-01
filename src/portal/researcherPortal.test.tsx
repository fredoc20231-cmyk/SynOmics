import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  DEPRECATED_STARTUP_COMMANDS,
  FRONTEND_COMMANDS,
  LOCAL_API_COMMAND,
  LOCAL_API_NOTE,
  PYTHON_VENV_COMMANDS,
} from "../docs/installGuide";
import { FORBIDDEN_INTERNAL_TERMS, APPROVED_ARCHITECTURE_LABELS, ARCHITECTURE_ABSTRACTION_LABEL } from "./architecture";
import { CAPABILITY_BADGES } from "./capabilityBadges";
import { FAQ, MANUAL_SECTIONS, MODE_CARDS, RESOURCES, WHAT_SYNAPSE_IS_NOT, portalCopyBlob, searchManual } from "./content";
import { ResearcherPortal } from "./ResearcherPortal";
import { SYNAPSE_REPOSITORY_PUBLIC_CLONE, SYNAPSE_REPOSITORY_URL } from "./repoAccess";
import { PORTAL_SECTIONS, portalHash, portalSectionFromHash } from "./routes";
import { SynapseWordmark } from "./Wordmark";

function readFromHere(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

const researcherManual = readFromHere("../../../docs/RESEARCHER_MANUAL.md");
const portalCss = readFromHere("../styles/portal.css");
const appSource = readFromHere("../App.tsx");

const FORBIDDEN_CLAIMS = [
  "never makes mistakes",
  "mistake-free",
  "hallucination-free",
  "100% accurate",
  "guaranteed scientifically correct",
  "clinically certified",
  "clinically validated",
  "autonomous doctor",
];

function portalMarkup(section: (typeof PORTAL_SECTIONS)[number] = "home"): string {
  return renderToStaticMarkup(<ResearcherPortal section={section} authenticated={false} />);
}

describe("researcher portal routing", () => {
  it("parses public deep links", () => {
    expect(portalSectionFromHash("#/synapse")).toBe("home");
    expect(portalSectionFromHash("#/synapse/architecture")).toBe("architecture");
    expect(portalSectionFromHash("#/synapse/manual")).toBe("manual");
    expect(portalSectionFromHash("#/synapse/modes")).toBe("modes");
    expect(portalSectionFromHash("#/synapse/evidence")).toBe("evidence");
    expect(portalSectionFromHash("#/synapse/install")).toBe("install");
    expect(portalSectionFromHash("#/synapse/local-models")).toBe("local-models");
    expect(portalSectionFromHash("#/synapse/projects")).toBe("projects");
    expect(portalSectionFromHash("#/synapse/voice")).toBe("voice");
    expect(portalSectionFromHash("#/synapse/troubleshooting")).toBe("troubleshooting");
    expect(portalSectionFromHash("#/legal/terms")).toBeNull();
    expect(portalHash("install")).toBe("#/synapse/install");
  });
});

describe("wordmark and public portal chrome", () => {
  it("renders a wordmark link that is not a generic blue underline", () => {
    const markup = renderToStaticMarkup(<SynapseWordmark />);
    expect(markup).toContain("href=\"#/synapse\"");
    expect(markup).toContain("synapse-wordmark-link");
    expect(markup).toContain("SYNAPSE-Ω");
    const css = portalCss;
    expect(css).toMatch(/\.synapse-wordmark-link\s*\{[^}]*color:\s*var\(--logo-color\)/s);
    expect(css).toMatch(/text-decoration:\s*none/);
    expect(css).not.toMatch(/\.synapse-wordmark-link[^{]*\{[^}]*color:\s*(blue|#00f|#0000ff)/i);
  });

  it("renders skip-to-content, Open SYNAPSE, and Install Locally as a hash route", () => {
    const markup = portalMarkup();
    expect(markup).toContain("Skip to content");
    expect(markup).toContain("href=\"#synapse-main\"");
    expect(markup).toContain("Open SYNAPSE");
    expect(markup).toContain("href=\"#/\"");
    expect(markup).toContain("Install Locally");
    expect(markup).toContain("href=\"#/synapse/install\"");
    expect(markup).toContain("data-testid=\"install-locally-cta\"");
    expect(markup).not.toMatch(/>Request Access</);
    expect(markup).not.toMatch(/href=["'][^"']*request-access/i);
  });

  it("keeps the wordmark wired in the app header", () => {
    const app = appSource;
    expect(app).toContain("SynapseWordmark");
    expect(app).toContain("researcher-portal-overlay");
    expect(app).toContain("portalSectionFromHash");
  });
});

describe("architecture atlas and proprietary abstraction", () => {
  it("exposes only approved conceptual layer labels", () => {
    const markup = portalMarkup("architecture");
    const decoded = markup.replace(/&amp;/g, "&");
    for (const label of APPROVED_ARCHITECTURE_LABELS) {
      expect(decoded).toContain(label);
    }
    expect(decoded).toContain(ARCHITECTURE_ABSTRACTION_LABEL);
    expect(markup).toContain("data-testid=\"architecture-atlas-keyboard\"");
    const blob = `${decoded}\n${portalCopyBlob()}`;
    for (const term of FORBIDDEN_INTERNAL_TERMS) {
      expect(blob.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });
});

describe("modes, evidence, voice, projects", () => {
  it("documents science-first positioning that is not science-only", () => {
    const markup = portalMarkup();
    expect(markup).toContain("Scientific Intelligence for Research, Biomedicine and Biotechnology");
    expect(markup).toContain("Built for science. Capable beyond it.");
    expect(markup).toContain("not restricted only to scientific conversation");
    expect(WHAT_SYNAPSE_IS_NOT.join("\n")).toMatch(/not restricted only to scientific conversation/i);
  });

  it("distinguishes discussing analysis from Analyze and documents thinking as depth", () => {
    const markup = portalMarkup("modes");
    expect(markup).toMatch(/Discussing an analysis is not Analyze/i);
    expect(markup).toContain("Thinking depth is not authority");
    expect(MODE_CARDS.map((item) => item.name)).toEqual([
      "Casual",
      "Science",
      "Deep Science",
      "Analyze",
      "Governed Compute",
    ]);
  });

  it("documents Archive as organizational read-only state", () => {
    expect(CAPABILITY_BADGES.archive.badge).toBe("Available");
    expect(CAPABILITY_BADGES.archive.note).toMatch(/read-only/i);
    const blob = portalCopyBlob();
    expect(blob).toMatch(/organizational/i);
    expect(blob).toMatch(/Unarchive/i);
    expect(blob).not.toMatch(/PENDING_CODEX/);
  });

  it("discloses browser speech and does not claim a proprietary speech model", () => {
    const markup = portalMarkup("voice");
    expect(markup).toMatch(/browser/i);
    expect(markup).toMatch(/does not claim a proprietary speech model/i);
  });

  it("states that projects do not authorize computation", () => {
    const markup = portalMarkup("projects");
    expect(markup).toMatch(/do not authorize computation/i);
  });
});

describe("install hub and repository access", () => {
  it("uses access-controlled repository language and the configured URL", () => {
    expect(SYNAPSE_REPOSITORY_PUBLIC_CLONE).toBe(false);
    const markup = portalMarkup("install");
    expect(markup).toContain(SYNAPSE_REPOSITORY_URL);
    expect(markup).toContain("data-testid=\"repo-access-controlled\"");
    expect(markup).toContain("Python 3.11");
    expect(markup).toContain("Node.js 22");
    expect(markup).toContain(PYTHON_VENV_COMMANDS.split("\n")[0]);
    expect(markup).toContain("npm ci");
    expect(markup).toMatch(/make dev/);
    expect(markup).toMatch(/scripts\/start-synapse\.sh/);
    expect(markup).toMatch(/Docker is not required for a simple Chat/i);
  });
});

describe("client-side manual search", () => {
  it("finds evidence and install sections without a server", () => {
    expect(searchManual("retrieved")).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "evidence-manual" })]),
    );
    expect(searchManual("venv")).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "python-install-manual" })]),
    );
    expect(searchManual("")).toEqual([]);
  });
});

describe("documentation truth", () => {
  it("forbids absolute scientific and clinical claims except as denials", () => {
    const blob = `${portalCopyBlob()}\n${researcherManual}\n${portalMarkup()}`;
    for (const claim of FORBIDDEN_CLAIMS) {
      const re = new RegExp(`[^.!?]{0,180}${claim}[^.!?]{0,180}`, "gi");
      const matches = blob.match(re) ?? [];
      for (const match of matches) {
        expect(match.toLowerCase()).toMatch(/\b(not|never|no|isn't|nor|without)\b/);
      }
    }
    expect(blob.toLowerCase()).not.toContain("never makes mistakes");
    expect(WHAT_SYNAPSE_IS_NOT.join("\n")).toMatch(/not medical advice/i);
  });

  it("keeps legal deletion language: deletion is not immediate physical erasure", () => {
    const blob = portalCopyBlob();
    expect(blob).toMatch(/ordinary workspace access/i);
    expect(blob).toMatch(/physical erasure/i);
    expect(blob).not.toMatch(/permanently erased from all systems/i);
    expect(FAQ.some((item) => /laptop|local/i.test(item.q))).toBe(true);
    expect(FAQ.find((item) => /laptop/i.test(item.q))?.a).toMatch(/Not unless/i);
  });

  it("does not leak secrets, live API keys, or private endpoints", () => {
    const blob = `${portalCopyBlob()}\n${researcherManual}\n${portalMarkup("install")}`;
    expect(blob).not.toMatch(/BEGIN [A-Z ]+PRIVATE KEY/);
    expect(blob).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
    expect(blob).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(blob).not.toMatch(/xox[baprs]-/);
    expect(blob).not.toMatch(/api[_-]?key\s*=\s*['\"][^'\"]{8,}/i);
    expect(blob).not.toMatch(/https:\/\/[a-z0-9.-]+\.(internal|local)\/[^\s]+/i);
  });
});

describe("researcher manual source of truth", () => {
  it("has the 24-section structure and matches install commands", () => {
    const markdown = researcherManual;
    expect(MANUAL_SECTIONS).toHaveLength(24);
    for (const section of MANUAL_SECTIONS) {
      expect(markdown).toContain(section.title.replace(/^\d+\.\s*/, ""));
    }
    expect(markdown).toContain(PYTHON_VENV_COMMANDS);
    expect(markdown).toContain(FRONTEND_COMMANDS);
    expect(markdown).toContain(LOCAL_API_COMMAND);
    expect(markdown).toContain(LOCAL_API_NOTE.split(".")[0]);
    expect(markdown).toContain("Conceptual architecture — implementation details intentionally abstracted.");
    for (const deprecated of DEPRECATED_STARTUP_COMMANDS) {
      expect(markdown).not.toContain(deprecated);
    }
  });

  it("only offers researcher resource links that exist in this client", () => {
    for (const resource of RESOURCES) {
      expect(resource.href.startsWith("#/")).toBe(true);
      expect(resource.href).not.toContain("http://");
    }
  });
});
