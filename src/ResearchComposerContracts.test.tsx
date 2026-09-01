import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NeuronSourceMenu } from "@ui/components/NeuronSourceMenu";
import { QuestionActionsMenu } from "@ui/components/QuestionActionsMenu";
import { ThinkingDisclosure, safeThinkingStage } from "@ui/components/ThinkingDisclosure";
import { emptyAssistantMessage } from "@ui/sse";

describe("research composer contracts", () => {
  it("keeps thinking collapsed and never renders arbitrary internal event text", () => {
    const message = emptyAssistantMessage("msg-thinking");
    message.events = [
      {
        type: "research.contradictions",
        payload: {
          message: "SECRET INTERNAL REASONING THAT MUST NEVER RENDER",
        },
      },
    ];

    expect(safeThinkingStage(message)).toBe("Checking contradictions");
    const markup = renderToStaticMarkup(
      <ThinkingDisclosure msg={message} streaming />,
    );

    expect(markup).toContain("Thinking");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("Checking contradictions");
    expect(markup).not.toContain("SECRET INTERNAL REASONING THAT MUST NEVER RENDER");
  });

  it("renders Neuron as the source gateway trigger without claiming disconnected providers are active", () => {
    const markup = renderToStaticMarkup(
      <NeuronSourceMenu
        onGitHub={() => undefined}
        onLiterature={() => undefined}
        onLocalFiles={() => undefined}
      />,
    );

    expect(markup).toContain("Neuron");
    expect(markup).toContain("Neuron · Sources &amp; knowledge");
    expect(markup).not.toContain("Dropbox</strong>");
    expect(markup).not.toContain("Box</strong>");
  });

  it("keeps posted-question actions behind an explicit overflow control", () => {
    const markup = renderToStaticMarkup(
      <QuestionActionsMenu
        onEdit={() => undefined}
        onCopy={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Question actions"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("Delete turn");
    expect(markup).not.toContain("Revise question");
  });
});
