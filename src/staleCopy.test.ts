import { describe, expect, it } from "vitest";
import { PRODUCT_WORKFLOWS, THINKING_LEVELS } from "@ui/design/productModes";
import { LEGAL_NOTICE } from "./LegalFooter";
import { LEGAL_PAGES } from "./legal/legalContent";

const FORBIDDEN = [
  /Verify with sources/i,
  /Casual does not retrieve/i,
  /Syn-Science required/i,
  /This requires Analyze/i,
  /switch to Analyze/i,
  /\bScience Answer\b/,
  /\bα\b/,
  /The science-only AI/i,
  /science-only assistant/i,
];

describe("frontend-owned copy cleanup", () => {
  it("keeps obsolete public product labels out of the mode catalog", () => {
    const blob = PRODUCT_WORKFLOWS.map((item) => `${item.label} ${item.description} ${item.emptyCopy}`).join("\n");
    expect(blob).not.toMatch(/Verify with sources/);
    expect(blob).not.toMatch(/Casual does not retrieve/);
    expect(blob).not.toMatch(/Syn-Science required/);
    expect(blob).not.toMatch(/This requires Analyze/);
    expect(blob).not.toMatch(/Science Answer/);
    expect(PRODUCT_WORKFLOWS.map((item) => item.label)).not.toContain("Deep Research");
    expect(PRODUCT_WORKFLOWS.map((item) => item.label)).not.toContain("Deep Science");
    expect(PRODUCT_WORKFLOWS.map((item) => item.label)).not.toContain("Analyze");
    expect(blob).not.toMatch(/\bα\b/);
  });

  it("keeps obsolete product labels out of legal copy and thinking labels", () => {
    const legal = Object.values(LEGAL_PAGES)
      .flatMap((page) => [page.title, page.kicker, ...page.sections.flatMap((section) => [section.heading, ...section.paragraphs])])
      .join("\n");
    const thinking = THINKING_LEVELS.map((item) => `${item.label} ${item.equivalent} ${item.copy}`).join("\n");
    const blob = `${LEGAL_NOTICE}\n${legal}\n${thinking}`;
    for (const pattern of FORBIDDEN) {
      expect(blob).not.toMatch(pattern);
    }
    expect(blob).not.toMatch(/The science-only AI/i);
    expect(blob).not.toMatch(/science-only assistant/i);
    expect(blob).not.toMatch(/Casual is limited/i);
    expect(blob).not.toMatch(/non-scientific chatbot/i);
    expect(THINKING_LEVELS.map((item) => item.label)).toEqual(["Basic", "Medium", "Advanced"]);
    const privacy = LEGAL_PAGES.privacy.sections.map((section) => `${section.heading}\n${section.paragraphs.join("\n")}`).join("\n");
    expect(privacy).toMatch(/Deleting a conversation removes it from normal workspace access/i);
    expect(privacy).toMatch(/may be retained according to/i);
    expect(privacy).toMatch(/does not claim that deleted content is always physically erased immediately/i);
    expect(privacy).toMatch(/does not claim that every deleted record is retained indefinitely/i);
    expect(privacy).not.toMatch(/permanently erased from all systems/i);
  });
});
