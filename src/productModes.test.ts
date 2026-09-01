import { describe, expect, it } from "vitest";
import {
  persistedModeFromWorkflow,
  workflowFromPersistedMode,
  workflowById,
  PRODUCT_WORKFLOWS,
} from "@ui/design/productModes";

describe("five-mode product catalog", () => {
  it("exposes the Omega public mode identity with stable backend workflow IDs", () => {
    expect(PRODUCT_WORKFLOWS.map((item) => item.label)).toEqual([
      "Casual",
      "Synthesis",
      "Deep Cortex",
      "Synthetic Mapping",
      "Governed Compute",
    ]);
    expect(PRODUCT_WORKFLOWS.map((item) => item.id)).toEqual([
      "casual",
      "science_answer",
      "deep_research",
      "analyze",
      "governed_compute",
    ]);
    expect(workflowById("deep_research").shortHelp).toMatch(/Deep Research/i);
    expect(workflowById("analyze").shortHelp).toMatch(/Data|modeling/i);
    for (const workflow of PRODUCT_WORKFLOWS) {
      expect(workflow.description.length).toBeGreaterThan(20);
      expect(workflow.shortHelp.length).toBeGreaterThan(8);
      expect(workflow.shortHelpMobile.length).toBeGreaterThan(4);
      expect(workflow.description).not.toMatch(/Oncology|Genomics|Physics|Chemistry/i);
    }
  });

  it("maps UI selection to persisted conversation mode without inventing a new conversation", () => {
    expect(persistedModeFromWorkflow("casual")).toEqual({ product_mode: "syn_chat" });
    expect(persistedModeFromWorkflow("science_answer")).toEqual({
      product_mode: "syn_science",
      science_preset: "science_answer",
    });
    expect(persistedModeFromWorkflow("deep_research")).toEqual({
      product_mode: "syn_science",
      science_preset: "deep_research",
    });
    expect(persistedModeFromWorkflow("analyze")).toEqual({
      product_mode: "syn_science",
      science_preset: "analyze",
    });
  });

  it("restores the selector from persisted conversation state", () => {
    expect(workflowFromPersistedMode("syn_chat", "deep_research")).toBe("casual");
    expect(workflowFromPersistedMode("syn_science", "deep_research")).toBe("deep_research");
    expect(workflowFromPersistedMode("syn_science", "analyze")).toBe("analyze");
    expect(workflowById("deep_research").starters.length).toBeGreaterThanOrEqual(2);
    expect(workflowById("science_answer").starters.length).toBeGreaterThanOrEqual(2);
  });
});
