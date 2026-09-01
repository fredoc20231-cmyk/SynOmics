import { readFileSync } from "fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantMessageView } from "@ui/components/AssistantMessageView";
import { EpistemicChatApp } from "@ui/components/EpistemicChatApp";
import { ModeSelector } from "@ui/components/ModeSelector";
import { shouldAcceptSend } from "@ui/design/chatContracts";
import {
  MIXED_CONVERSATION_STARTERS,
  PRODUCT_IDENTITY,
  PRODUCT_WORKFLOWS,
  workflowById,
} from "@ui/design/productModes";
import {
  deepScienceWorkflowOccurred,
  scientificPresentationWarranted,
} from "@ui/design/scientificPresentation";
import { emptyAssistantMessage } from "@ui/sse";
import { LEGAL_NOTICE } from "./LegalFooter";
import { HERO, MODE_CARDS, WHAT_SYNAPSE_IS_NOT, portalCopyBlob } from "./portal/content";
import { ResearcherPortal } from "./portal/ResearcherPortal";

/**
 * P1.3 science-first identity acceptance.
 * Asserts presentation, copy, and no-refusal UX.
 * Live model intelligence remains backend-owned and release-qualified separately.
 */

const NON_SCIENCE_PROMPTS = [
  "Write a birthday message.",
  "Help me draft a professional thank-you email.",
  "Write a Python function that computes a rolling mean.",
] as const;

const SCIENCE_PROMPTS = [
  "Explain homologous recombination.",
  "Summarize evidence linking BRCA1 deficiency to PARP inhibitor sensitivity.",
] as const;

const REFUSAL_COPY = [
  "not a scientific question",
  "sciencePrompt",
  "switch to Casual",
  "restricted only to scientific",
  "science-only AI",
  "The science-only AI",
];

function frontendSource(relativeFromSrc: string): string {
  return readFileSync(new URL(relativeFromSrc, import.meta.url), "utf8");
}

function modeMarkup(preset: "casual" | "science_answer" | "deep_research" | "analyze" | "governed_compute"): string {
  if (preset === "casual") {
    return renderToStaticMarkup(<EpistemicChatApp conversationId={preset} experienceMode="syn_chat" />);
  }
  return renderToStaticMarkup(
    <EpistemicChatApp conversationId={preset} experienceMode="syn_science" sciencePreset={preset} />,
  );
}

describe("P1.3 science-first product identity", () => {
  it("MODE COPY: Omega modes are differentiated without changing trust or authority", () => {
    expect(PRODUCT_WORKFLOWS.map((item) => [item.label, item.shortHelp, item.shortHelpMobile])).toEqual([
      ["Casual", "Fast natural assistance", "Fast assistance"],
      ["Synthesis", "Scientific reasoning + evidence awareness", "Scientific reasoning"],
      ["Deep Cortex", "Deep Research · multi-source synthesis", "Deep Research"],
      ["Synthetic Mapping", "Data, documents + advanced modeling", "Data + modeling"],
      ["Governed Compute", "Authorized reproducible execution", "Verified execution"],
    ]);
    expect(workflowById("casual").description).toContain("Fast, natural everyday assistance");
    expect(workflowById("casual").description).not.toMatch(/limited|non-scientific|basic chatbot/i);
    expect(workflowById("science_answer").description).toMatch(/core academic mode/i);
    expect(workflowById("deep_research").description).toMatch(/Unsupported claims are qualified or withheld/i);
    expect(workflowById("analyze").description).toMatch(/verified data or governed computation/i);
    expect(workflowById("governed_compute").description).toMatch(/does not itself authorize or run anything/i);
    const rail = renderToStaticMarkup(<ModeSelector value="casual" variant="rail" onChange={() => undefined} />);
    expect(rail).toContain("Fast natural assistance");
    expect(rail).toContain("Scientific reasoning + evidence awareness");
    expect(rail).toContain("Deep Research · multi-source synthesis");
    expect(rail).toContain("Data, documents + advanced modeling");
    expect(rail).toContain("Authorized reproducible execution");
    expect(rail).toContain("rail-mode-help-mobile");
    expect(rail).toContain("Data + modeling");
    expect(rail).toContain("Verified execution");
  });

  it("EMPTY STATE: each conversational mode is useful without a client-side science refusal", () => {
    const casual = modeMarkup("casual");
    expect(casual).toContain(PRODUCT_IDENTITY.emptyTitle);
    expect(casual).toContain(PRODUCT_IDENTITY.emptySubtext);
    for (const starter of MIXED_CONVERSATION_STARTERS) expect(casual).toContain(starter.example);

    const synthesis = modeMarkup("science_answer");
    expect(synthesis).toContain(workflowById("science_answer").emptyTitle);
    expect(synthesis).toContain(workflowById("science_answer").starters[0].example);
    expect(synthesis).toContain("Synthesis");

    const cortex = modeMarkup("deep_research");
    expect(cortex).toContain(workflowById("deep_research").emptyTitle);
    expect(cortex).toContain(workflowById("deep_research").starters[0].example);
    expect(cortex).toContain("Deep Cortex");

    for (const markup of [casual, synthesis, cortex]) {
      expect(markup).not.toContain("Ask a scientific question.");
      expect(markup).not.toContain("Investigate in depth.");
      expect(markup).not.toMatch(/not a scientific question/i);
    }
  });

  it("PORTAL POSITIONING: academic science-first identity with general-assistance capability", () => {
    const markup = renderToStaticMarkup(<ResearcherPortal section="home" authenticated={false} />);
    expect(HERO.title).toBe("Academic Scientific Intelligence for Research, Biomedicine and Biotechnology");
    expect(markup).toContain(HERO.title);
    expect(markup).toContain(PRODUCT_IDENTITY.supporting);
    expect(markup).toContain(PRODUCT_IDENTITY.expanded);
    expect(markup).toContain("not restricted only to scientific conversation");
    expect(markup).toContain(PRODUCT_IDENTITY.institutional);
    expect(WHAT_SYNAPSE_IS_NOT.join("\n")).toMatch(/not restricted only to scientific conversation/i);
    expect(MODE_CARDS[0]?.what).toMatch(/fully useful assistant/i);
    expect(portalCopyBlob()).not.toMatch(/The science-only AI/i);
    expect(LEGAL_NOTICE).not.toMatch(/science-only/i);
  });

  it("NO CLIENT-SIDE SCIENCE GATE: send and composer copy never reject non-science prompts", () => {
    expect(shouldAcceptSend({ streaming: false, inFlight: false })).toBe(true);
    const chatApp = frontendSource("../../src/ui/components/EpistemicChatApp.tsx");
    const modeSelector = frontendSource("../../src/ui/components/ModeSelector.tsx");
    const productModes = frontendSource("../../src/ui/design/productModes.ts");
    const blob = `${chatApp}\n${modeSelector}\n${productModes}`;
    expect(blob).not.toMatch(/if\s*\(\s*!?\s*sciencePrompt/);
    expect(blob).not.toMatch(/not a scientific question/i);
    expect(blob).not.toMatch(/keyword allowlist/i);
    for (const preset of ["casual", "science_answer", "deep_research", "analyze", "governed_compute"] as const) {
      const markup = modeMarkup(preset);
      for (const phrase of REFUSAL_COPY) {
        expect(markup.toLowerCase()).not.toContain(phrase.toLowerCase());
      }
      expect(markup).not.toMatch(/reject\(\)/);
    }
    for (const prompt of [...NON_SCIENCE_PROMPTS, ...SCIENCE_PROMPTS]) {
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(8);
    }
  });

  it("DEEP CORTEX FAKE WORKFLOW GUARD: ordinary answers do not gain research chrome from mode selection", () => {
    expect(deepScienceWorkflowOccurred(undefined)).toBe(false);
    expect(scientificPresentationWarranted(undefined)).toBe(false);
    const msg = emptyAssistantMessage("bday");
    msg.text = "Happy birthday — hope the cake is excellent.";
    const ordinary = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        workflow="deep_research"
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onStop={() => undefined}
      />,
    );
    expect(ordinary).toContain("Happy birthday");
    expect(ordinary).not.toContain("Research gaps");
    expect(ordinary).not.toContain("Evidence tables");
    expect(ordinary).not.toContain("Methodological comparisons");
    expect(ordinary).not.toContain("Executive Synthesis");
    expect(ordinary).not.toContain("deep-science-toc");
    expect(ordinary).not.toContain("In this answer");
    expect(ordinary).not.toContain("Sources &amp; reliability");
    expect(ordinary).not.toContain("Limitations");

    const scientific = emptyAssistantMessage("deep");
    scientific.text = "Research-grade synthesis of neoantigen ranking.";
    scientific.scientific = {
      message_id: "deep",
      conversation_id: "conv",
      role: "assistant",
      status: "complete",
      blocks: [{ block_id: "b1", kind: "markdown", text: scientific.text, claim_ids: [] }],
      claim_links: [],
      citation_links: [],
      artifact_refs: [],
      created_at: 0,
      answer_package: {
        schema_version: "synapse.answer.v1",
        answer_id: "deep",
        conversation_id: "conv",
        product_mode: "syn_science",
        output_policy: "DEEP_RESEARCH",
        direct_answer: scientific.text,
        answer_status: "ANSWERED",
        claims: [],
        evidence: [],
        execution_provenance: [],
        figures: [],
        tables: [{ title: "Study comparison", headers: ["Study"], rows: [["Backend row"]] }],
        assumptions: [],
        limitations: [{ limitation_id: "l1", text: "Snapshot, not a systematic review.", affected_claim_ids: [] }],
        recommendations: [],
        citations: [],
        warnings: [],
        trace: { trace_id: "t", events: [] },
        epistemic_badge: "model",
        temporal_freshness: "unavailable",
        research_gaps: [{ gap_id: "g1", text: "Long-term follow-up is not reported." }],
      },
    };
    expect(deepScienceWorkflowOccurred(scientific.scientific?.answer_package)).toBe(true);
    const warranted = renderToStaticMarkup(
      <AssistantMessageView
        msg={scientific}
        workflow="deep_research"
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onStop={() => undefined}
      />,
    );
    expect(warranted).toContain("Study comparison");
    expect(warranted).toContain("Long-term follow-up is not reported.");
    expect(warranted).toContain("Snapshot, not a systematic review.");
  });

  it("ACCEPTANCE: each mode presents science and non-science prompts without refusal UX", () => {
    const cases = [
      { preset: "casual" as const, science: SCIENCE_PROMPTS[0], ordinary: NON_SCIENCE_PROMPTS[0] },
      { preset: "science_answer" as const, science: SCIENCE_PROMPTS[1], ordinary: NON_SCIENCE_PROMPTS[1] },
      { preset: "deep_research" as const, science: SCIENCE_PROMPTS[1], ordinary: NON_SCIENCE_PROMPTS[0] },
      { preset: "analyze" as const, science: "Using the attached cohort table, summarize missingness.", ordinary: NON_SCIENCE_PROMPTS[1] },
      { preset: "governed_compute" as const, science: "Propose a bounded mean on the authorized table.", ordinary: NON_SCIENCE_PROMPTS[2] },
    ];
    for (const item of cases) {
      const markup = modeMarkup(item.preset);
      expect(markup).not.toMatch(/not a scientific question/i);
      expect(markup).not.toMatch(/This requires Analyze\./);
      expect(markup).not.toContain("The science-only AI");
      if (item.preset === "analyze") {
        expect(markup).toContain("Synthetic Mapping");
        expect(markup).toMatch(/Discussing an analysis is not the same as analyzing data/i);
      }
      if (item.preset === "governed_compute") {
        expect(markup).toMatch(/Selecting this mode does not automatically execute/);
        expect(markup).toContain("Verify first. Execute only with authorization.");
      }
      if (item.preset === "casual") {
        expect(markup).toContain(MIXED_CONVERSATION_STARTERS[0].example);
        expect(markup).toContain(MIXED_CONVERSATION_STARTERS[3].example);
        expect(markup).toContain("or simply ask anything");
      }
      if (item.preset === "science_answer" || item.preset === "deep_research") {
        expect(markup).toContain(workflowById(item.preset).starters[0].example);
      }
    }
  });
});
