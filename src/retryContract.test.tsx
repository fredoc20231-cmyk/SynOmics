import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildRetryBody } from "@ui/design/chatContracts";
import { classifyModelReadiness } from "@ui/design/modelReadiness";
import { assistantRetryAllowed, classifyChatAuthFailure, planChatAuthFailure } from "@ui/design/sessionExpiry";
import { RequestErrorCard } from "@ui/components/EpistemicChatApp";
import { AssistantMessageView } from "@ui/components/AssistantMessageView";
import { emptyAssistantMessage } from "@ui/sse";
import type { ChatItem } from "@ui/components/EpistemicChatApp";

function itemsAfterRetry(items: ChatItem[], errorId: string, assistantId: string): ChatItem[] {
  return [
    ...items.filter((item) => item.id !== errorId && item.role !== "error"),
    {
      role: "assistant",
      id: assistantId,
      assistantMsg: {
        id: assistantId,
        conversationId: "conv_black_hole",
        planeStage: "proposal",
        pipeline: {
          proposal: "complete",
          verification: "waiting",
          authorization: "waiting",
          execution: "waiting",
          reconciliation: "waiting",
        },
        claims: [],
        evidence: [],
        contradictions: [],
        artifactRefs: [],
        events: [],
        timestamp: 1,
        text: "A black hole forms when mass is concentrated enough that escape velocity exceeds the speed of light.",
      },
    },
  ];
}

describe("retry contract invariants", () => {
  it("keeps one user turn and submits retry_last_user for the original black-hole question", () => {
    const user: ChatItem = {
      role: "user",
      id: "usr_1",
      content: "how to make a black hole",
      attachments: [
        {
          attachment_id: "att_1",
          conversation_id: "conv_black_hole",
          attachment_type: "file",
          source_type: "upload",
          filename: "notes.txt",
          mime_type: "text/plain",
          bytes: 12,
          sha256: "abc",
          metadata: {},
        },
      ],
    };
    const error: ChatItem = {
      role: "error",
      id: "err_1",
      summary: "The generated answer did not pass the required integrity checks",
      technical: "ANSWER_COMPILER_REJECTED",
      userMessageId: "usr_1",
      readiness: classifyModelReadiness({ code: "ANSWER_COMPILER_REJECTED" }),
      retry: { path: "/chat", body: { message: "how to make a black hole" } },
    };
    const history: ChatItem[] = [user, error];
    const request = buildRetryBody({
      conversationId: "conv_black_hole",
      originalUserContent: user.role === "user" ? user.content : "",
    });
    expect(request.conversation_id).toBe("conv_black_hole");
    expect(request.retry_last_user).toBe(true);
    expect(request.message).toBe("how to make a black hole");
    expect(history.filter((item) => item.role === "user")).toHaveLength(1);

    const after = itemsAfterRetry(history, "err_1", "msg_ok");
    expect(after.filter((item) => item.role === "user")).toHaveLength(1);
    expect(after.filter((item) => item.role === "error")).toHaveLength(0);
    expect(after.some((item) => item.role === "assistant" && item.assistantMsg.text?.includes("escape velocity"))).toBe(true);
    expect(after.filter((item) => item.role === "user")[0]).toMatchObject({
      content: "how to make a black hole",
      attachments: user.role === "user" ? user.attachments : [],
    });
  });

  it("keeps the error card associated with the original user message", () => {
    const markup = renderToStaticMarkup(
      <RequestErrorCard
        summary="I couldn't complete that answer reliably. Retry the request."
        technical="ANSWER_USEFULNESS_REJECTED"
        readiness={classifyModelReadiness({ code: "ANSWER_USEFULNESS_REJECTED" })}
        userMessageId="usr_black_hole"
        onRetry={() => undefined}
      />,
    );
    expect(markup).toContain('data-user-message-id="usr_black_hole"');
    expect(markup).not.toContain("ANSWER_USEFULNESS_REJECTED</p>");
    expect(markup).toContain("Technical details");
    expect(markup).toContain("ANSWER_USEFULNESS_REJECTED");
  });

  it("does not show Retry on a successfully completed assistant answer", () => {
    const msg = emptyAssistantMessage("msg_ok");
    msg.text = "Homologous recombination repairs DNA double-strand breaks with high fidelity.";
    expect(assistantRetryAllowed({ answerStatus: "ANSWERED", backendRetryable: true })).toBe(false);
    const markup = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        workflow="casual"
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onRetry={() => undefined}
        onStop={() => undefined}
      />,
    );
    expect(markup).toContain("Homologous recombination");
    expect(markup).not.toContain(">Retry<");
  });

  it("shows Retry on a model or provider failure error card", () => {
    const view = classifyModelReadiness({ code: "MODEL_UNREACHABLE" });
    expect(view.retryable).toBe(true);
    const markup = renderToStaticMarkup(
      <RequestErrorCard
        summary={view.message}
        technical="MODEL_PROVIDER_UNAVAILABLE"
        readiness={view}
        onRetry={() => undefined}
      />,
    );
    expect(markup).toContain(">Retry<");
    expect(markup).toContain("Chat is temporarily unavailable");
  });

  it("shows Retry on a rejected draft when the backend marks the original turn retryable", () => {
    const view = classifyModelReadiness({ code: "ANSWER_USEFULNESS_REJECTED" });
    expect(view.retryable).toBe(true);
    expect(view.state).toBe("ANSWER_DRAFT_REJECTED");
    const markup = renderToStaticMarkup(
      <RequestErrorCard
        summary={view.message}
        technical="ANSWER_USEFULNESS_REJECTED"
        readiness={view}
        onRetry={() => undefined}
      />,
    );
    expect(markup).toContain(">Retry<");
    expect(assistantRetryAllowed({ answerStatus: "FAILED", backendRetryable: true })).toBe(true);
    expect(assistantRetryAllowed({ answerStatus: "ANSWERED", backendRetryable: true })).toBe(false);
  });

  it("does not treat Chat 401 as a retryable model failure", () => {
    expect(classifyChatAuthFailure({ status: 401, code: "UNAUTHENTICATED" })).toBe("session_expired");
    const plan = planChatAuthFailure("session_expired");
    expect(plan.showModelRetry).toBe(false);
    expect(plan.autoRetry).toBe(false);
    expect(plan.showSessionExpiredUi).toBe(true);
    expect(plan.stopOmega).toBe(true);
    const view = classifyModelReadiness({ status: 401, code: "UNAUTHENTICATED", message: "Authentication required." });
    expect(view.retryable).toBe(false);
    const markup = renderToStaticMarkup(
      <RequestErrorCard summary={view.message} technical="UNAUTHENTICATED" readiness={view} onRetry={() => undefined} />,
    );
    expect(markup).not.toContain(">Retry<");
  });
});
