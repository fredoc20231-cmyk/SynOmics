import { describe, expect, it } from "vitest";
import { shouldAcceptSend, shouldApplyStreamEvent } from "@ui/design/chatContracts";

describe("generation race guards", () => {
  it("drops late tokens after stop and after a conversation switch", () => {
    expect(
      shouldApplyStreamEvent({
        boundConversationId: "A",
        activeConversationId: "A",
        generationId: "g1",
        activeGenerationId: "g1",
        aborted: true,
      }),
    ).toBe(false);
    expect(
      shouldApplyStreamEvent({
        boundConversationId: "A",
        activeConversationId: "B",
        generationId: "g1",
        activeGenerationId: "g1",
        aborted: false,
      }),
    ).toBe(false);
    expect(
      shouldApplyStreamEvent({
        boundConversationId: "A",
        activeConversationId: "A",
        generationId: "g1",
        activeGenerationId: "g2",
        aborted: false,
      }),
    ).toBe(false);
  });

  it("accepts only one in-flight send", () => {
    expect(shouldAcceptSend({ streaming: false, inFlight: true })).toBe(false);
    expect(shouldAcceptSend({ streaming: true, inFlight: false })).toBe(false);
    expect(shouldAcceptSend({ streaming: false, inFlight: false })).toBe(true);
  });

  it("keeps a stopped generation from looking retryable just because it aborted", () => {
    const stopped = shouldApplyStreamEvent({
      boundConversationId: "A",
      activeConversationId: "A",
      generationId: "g1",
      activeGenerationId: "g1",
      aborted: true,
    });
    expect(stopped).toBe(false);
  });
});
