import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { AssistantMessageView } from "@ui/components/AssistantMessageView";
import { EpistemicChatApp } from "@ui/components/EpistemicChatApp";
import { VoiceInputButton } from "@ui/components/VoiceInputButton";
import { ReadAloudControls } from "@ui/components/ReadAloudControls";
import { emptyAssistantMessage } from "@ui/sse";
import {
  createBrowserVoiceRecognition,
  VOICE_PRIVACY_DISCLOSURE,
  VOICE_UNSUPPORTED_MESSAGE,
  voiceInputSupported,
} from "@ui/voice/voiceInput";
import {
  getReadAloudState,
  pauseReadAloud,
  resetReadAloudForTests,
  resumeReadAloud,
  sanitizeForReadAloud,
  setReadAloudHostForTests,
  startReadAloud,
  stopReadAloud,
} from "@ui/voice/readAloud";

import { WorkspaceRail } from "./WorkspaceRail";
import { LegalFooter, LEGAL_NOTICE, LEGAL_NOTICE_NARROW, legalNoticeContainsForbiddenClaims } from "./LegalFooter";
import { RenameConversationDialog, DeleteConversationDialog, propertiesFromSources } from "./ChatDialogs";
import {
  conversationArchiveAvailable,
  requestConversationArchive,
  requestConversationUnarchive,
} from "./archiveContract";
import { partitionConversations, RECENT_CHAT_LIMIT, type ConversationRecord } from "./chatHistory";
import { persistentMenuShouldDismiss } from "./persistentMenu";
import type { ChatRigor, ConversationMode, Project, PublicUser, StoredMessage } from "./api";

const TEST_USER: PublicUser = {
  id: "user_1",
  email: "researcher@synapse.test",
  role: "researcher",
  status: "active",
  profile: {
    display_name: "Ada Researcher",
    organization: "SYNAPSE Lab",
    title: "Scientist",
    specialty: "Biology",
    intended_use: "Evidence review",
    complete: true,
  },
  setup: {
    iensure_default: false,
    continue_until_done_default: false,
    theme: "light",
  },
  initials: "AR",
};

const NOOP = () => undefined;

function conversation(id: string, title: string, updatedAt: number, archived = false): ConversationRecord {
  return {
    id,
    owner_user_id: "owner",
    title,
    created_at: updatedAt - 10,
    updated_at: updatedAt,
    ...(archived ? { archived: true } : {}),
  };
}

function railMarkup({
  conversations = [],
  conversationId = null,
  chatSearch = "",
  projects = [],
  projectId = "",
  activeMenuId = null,
}: {
  conversations?: ConversationRecord[];
  conversationId?: string | null;
  chatSearch?: string;
  projects?: Project[];
  projectId?: string;
  activeMenuId?: string | null;
} = {}) {
  return renderToStaticMarkup(
    <WorkspaceRail
      productMode="syn_chat"
      sciencePreset="science_answer"
      chatRigor="professional"
      profile="BALANCED"
      user={TEST_USER}
      theme="light"
      modeChanging={false}
      conversations={conversations}
      conversationId={conversationId}
      chatSearch={chatSearch}
      projects={projects}
      projectId={projectId}
      projectFiles={[]}
      discoveries={[]}
      activeMenuId={activeMenuId}
      onNewChat={NOOP}
      onWorkflowChange={NOOP}
      onProfileChange={NOOP}
      onPreferenceChange={NOOP}
      onSearch={NOOP}
      onAllChats={NOOP}
      onSelectConversation={NOOP}
      onNewProject={NOOP}
      onSelectProject={NOOP}
      onRenameProject={NOOP}
      onRenameConversation={NOOP}
      onDeleteConversation={NOOP}
      onOpenProperties={NOOP}
      onMoveToProject={NOOP}
      onRemoveChatFromProject={NOOP}
      onArchiveConversation={NOOP}
      onUnarchiveConversation={NOOP}
      onActiveMenu={NOOP}
      onOpenInspector={NOOP}
      onOpenInfo={NOOP}
      onOpenSettings={NOOP}
      onThemeToggle={NOOP}
      onAdmin={NOOP}
      onLogout={NOOP}
    />,
  );
}

describe("account menu persistence", () => {
  it("never treats pointer movement or mouse leave as dismissal", () => {
    expect(persistentMenuShouldDismiss({ type: "pointermove" })).toBe(false);
    expect(persistentMenuShouldDismiss({ type: "mousemove" })).toBe(false);
    expect(persistentMenuShouldDismiss({ type: "mouseleave" })).toBe(false);
    expect(persistentMenuShouldDismiss({ type: "mouseout" })).toBe(false);
    expect(persistentMenuShouldDismiss({ type: "pointerdown", inside: true })).toBe(false);
  });

  it("closes on outside pointerdown, Escape, action, or trigger toggle — not travel", () => {
    expect(persistentMenuShouldDismiss({ type: "pointerdown", inside: false })).toBe(true);
    expect(persistentMenuShouldDismiss({ type: "keydown", key: "Escape" })).toBe(true);
    expect(persistentMenuShouldDismiss({ type: "keydown", key: "Tab" })).toBe(false);
    expect(persistentMenuShouldDismiss({ type: "action" })).toBe(true);
    expect(persistentMenuShouldDismiss({ type: "trigger-toggle" })).toBe(true);
  });

  it("renders a click-owned account menu with truthful aria", () => {
    const markup = railMarkup();
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('data-testid="account-menu-trigger"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('data-account-menu-dismiss="pointerdown-escape"');
    expect(markup).not.toContain("onMouseLeave");
  });
});

describe("chat list cap, old chats, search, and archive grouping", () => {
  const rows = Array.from({ length: 10 }, (_, index) =>
    conversation(`c${index + 1}`, index === 8 ? "Neoantigen analysis" : `Chat ${index + 1}`, 1_000 + (10 - index)),
  );
  rows.push(conversation("arch_1", "Archived neoantigen notes", 50, true));

  it("caps the main chat list at 7 most recently updated non-archived conversations", () => {
    const view = partitionConversations(rows);
    expect(RECENT_CHAT_LIMIT).toBe(7);
    expect(view.recent).toHaveLength(7);
    expect(view.recent.map((item) => item.id)).toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c7"]);
    expect(view.old.map((item) => item.id)).toEqual(["c8", "c9", "c10"]);
    expect(view.archived.map((item) => item.id)).toEqual(["arch_1"]);
    expect(view.recent.some((item) => item.id === "arch_1")).toBe(false);
    expect(view.old.some((item) => item.id === "arch_1")).toBe(false);
  });

  it("keeps the selected conversation visible even when it falls outside the top 7", () => {
    const view = partitionConversations(rows, { selectedId: "c10" });
    expect(view.recent.some((item) => item.id === "c10")).toBe(true);
    expect(view.recent.length).toBe(8);
    expect(view.old.some((item) => item.id === "c10")).toBe(true);
  });

  it("places the 8th chat under Earlier sessions and keeps archived out of Recent and Earlier sessions", () => {
    const markup = railMarkup({ conversations: rows });
    const recent = markup.split('data-testid="old-chats"')[0] ?? markup;
    expect(recent).toContain("data-testid=\"chat-row-c1\"");
    expect(recent).toContain("data-testid=\"chat-row-c7\"");
    expect(recent).not.toContain("data-testid=\"chat-row-c8\"");
    expect(markup).toContain("Earlier sessions");
    expect(markup).toContain("data-testid=\"old-chats\"");
    expect(markup).toContain("Session archive");
    expect(recent).not.toContain("Archived neoantigen notes");
    expect(markup).not.toContain("data-testid=\"chat-row-arch_1\"");
  });

  it("searches complete history, including older chats, and badges archived hits", () => {
    const view = partitionConversations(rows, { search: "neoantigen" });
    expect(view.searching).toBe(true);
    expect(view.searchMatches.map((item) => item.title)).toEqual(["Neoantigen analysis"]);
    expect(view.archivedSearchMatches.map((item) => item.title)).toEqual(["Archived neoantigen notes"]);
    const markup = railMarkup({ conversations: rows, chatSearch: "neoantigen" });
    expect(markup).toContain("Neoantigen analysis");
    expect(markup).toContain("Archived neoantigen notes");
    expect(markup).toContain(">Archived<");
    expect(markup).not.toContain("data-testid=\"old-chats\"");
  });
});

describe("chat overflow menu", () => {
  const conv = conversation("conv_1", "Analysis notes", 10);
  const projects: Project[] = [
    { project_id: "proj_alpha", title: "Alpha study", description: "" },
    { project_id: "proj_beta", title: "Beta cohort", description: "" },
  ];

  it("keeps the chat menu open in markup until an action and lists Rename, Properties, Move to, Delete", () => {
    const markup = railMarkup({ conversations: [conv], conversationId: "conv_1", activeMenuId: "conv_conv_1", projects });
    expect(markup).toContain("data-testid=\"chat-menu-conv_1\"");
    expect(markup).toContain(">Rename<");
    expect(markup).toContain(">Properties<");
    expect(markup).toContain("Move to");
    expect(markup).toContain('class="rail-delete-action"');
    expect(markup).toContain(">Delete<");
    expect(markup).toContain('role="separator"');
    expect(markup).toContain('aria-haspopup="menu"');
  });

  it("builds Move to from actual projects plus Archive, not hard-coded names", () => {
    const markup = railMarkup({
      conversations: [conv],
      conversationId: "conv_1",
      activeMenuId: "conv_conv_1",
      projects,
    });
    expect(markup).toContain("data-testid=\"move-to-conv_1\"");
    expect(markup).not.toContain("Oncology");
    expect(markup).not.toContain("Genomics");
  });

  it("uses Unarchive instead of Archive when the conversation is archived", () => {
    const archived = conversation("conv_arch", "Old notes", 5, true);
    const markup = railMarkup({ conversations: [archived], conversationId: "conv_arch", activeMenuId: "conv_conv_arch" });
    expect(markup).toContain(">Unarchive<");
    expect(markup).not.toContain(">Rename<");
    expect(markup).not.toContain("Move to");
    expect(markup).toContain(">Properties<");
    expect(markup).toContain(">Delete<");
  });
});

describe("properties, rename, move, archive contract, and delete", () => {
  it("computes Properties only from real conversation, message, mode, and project sources", () => {
    const conversationRow = conversation("conv_p", "Neoantigen analysis", 1_756_000_000);
    conversationRow.created_at = 1_756_000_000;
    const messages: StoredMessage[] = [
      { id: "m1", conversation_id: "conv_p", role: "user", content: "What is a neoantigen?", scientific: {}, created_at: 1_756_000_000 },
      { id: "m2", conversation_id: "conv_p", role: "assistant", content: "A neoantigen is a tumor-specific antigen.", scientific: {}, created_at: 1_756_000_100 },
    ];
    const mode: ConversationMode = {
      conversation_id: "conv_p",
      product_mode: "syn_science",
      mode_state: "SCIENCE_READY",
      science_preset: "deep_research",
      chat_rigor: "scientific" as ChatRigor,
      mode_version: 2,
      updated_at: 1_756_000_100,
      stale_contexts_cleared: 0,
    };
    const details = propertiesFromSources(conversationRow, messages, mode, {
      project_id: "proj_1",
      project_title: "Alpha study",
    });
    expect(details.title).toBe("Neoantigen analysis");
    expect(details.totalMessages).toBe(2);
    expect(details.userMessages).toBe(1);
    expect(details.assistantMessages).toBe(1);
    expect(details.modeLabel).toBe("Deep Cortex");
    expect(details.thinkingLabel).toBe("Advanced");
    expect(details.projectLabel).toBe("Alpha study");
    expect(details.statusLabel).toBe("Active");
    expect(details.createdLabel).toMatch(/·/);
    expect(JSON.stringify(details)).not.toMatch(/gpt-|claude|kernel|sha256|provider/i);
  });

  it("renders rename with the current title prefilled and delete confirmation copy", () => {
    const rename = renderToStaticMarkup(
      <RenameConversationDialog title="Neoantigen analysis" onCancel={NOOP} onSave={NOOP} />,
    );
    expect(rename).toContain('value="Neoantigen analysis"');
    expect(rename).toContain("data-testid=\"rename-conversation-dialog\"");
    const destroy = renderToStaticMarkup(
      <DeleteConversationDialog title="Neoantigen analysis" onCancel={NOOP} onConfirm={NOOP} />,
    );
    expect(destroy).toContain("Delete “Neoantigen analysis”?");
    expect(destroy).toContain("This removes the conversation from your workspace.");
    expect(destroy).toContain("Required audit/provenance records may be retained according to policy.");
    expect(destroy.toLowerCase()).not.toContain("archive");
    expect(destroy).not.toContain("permanently erased");
  });

  it("archives and unarchives through the durable backend contract", async () => {
    expect(conversationArchiveAvailable()).toBe(true);
    const original = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method || "GET"} ${url}`);
      const unarchive = url.endsWith("/unarchive");
      return new Response(
        JSON.stringify({
          archived: !unarchive,
          conversation: {
            id: "conv_1",
            owner_user_id: "owner",
            title: "Analysis notes",
            created_at: 1,
            updated_at: 2,
            archived_at: unarchive ? null : 3,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      const archived = await requestConversationArchive("conv_1");
      expect(archived.ok).toBe(true);
      expect(archived.persisted).toBe(true);
      expect(archived.status).toBe("ARCHIVED");
      expect(archived.code).not.toBe("PENDING_CODEX_ARCHIVE");
      const restored = await requestConversationUnarchive("conv_1");
      expect(restored.ok).toBe(true);
      expect(restored.status).toBe("ACTIVE");
      expect(restored.persisted).toBe(true);
      expect(calls).toEqual([
        "POST /api/conversations/conv_1/archive",
        "POST /api/conversations/conv_1/unarchive",
      ]);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("footer copy", () => {
  it("uses the verifiable-claims statement without accuracy guarantees", () => {
    expect(LEGAL_NOTICE).toBe(
      "SYNAPSE-O™ · Private Research Beta · Designed to verify, challenge, and trace claims—not just generate them · Research & educational use only · Not medical advice · Terms",
    );
    expect(LEGAL_NOTICE_NARROW).toContain("Designed for verifiable answers");
    expect(legalNoticeContainsForbiddenClaims(LEGAL_NOTICE)).toBe(false);
    const markup = renderToStaticMarkup(<LegalFooter />);
    expect(markup).toContain("Designed to verify, challenge, and trace claims—not just generate them");
    expect(markup).toContain("Research &amp; educational use only");
    expect(markup).toContain("Not medical advice");
    expect(markup).toContain("Terms");
    expect(markup).toContain("Private Research Beta");
    expect(markup.toLowerCase()).not.toContain("clinically validated");
    expect(markup.toLowerCase()).not.toContain("production certified");
    expect(markup.toLowerCase()).not.toContain("all other ai tools make mistakes");
    expect(markup.toLowerCase()).not.toContain("hallucination-free");
    expect(markup.toLowerCase()).not.toContain("100% accurate");
  });
});

describe("microphone / voice input", () => {
  it("hides active listening when SpeechRecognition is unsupported", () => {
    expect(voiceInputSupported({})).toBe(false);
    const markup = renderToStaticMarkup(<VoiceInputButton onTranscript={NOOP} />);
    expect(markup).toContain(VOICE_UNSUPPORTED_MESSAGE);
    expect(markup).toContain('data-voice-state="unsupported"');
    expect(markup).toContain("disabled");
  });

  it("inserts a transcript without sending and reports permission denied", () => {
    const transcripts: string[] = [];
    const states: string[] = [];
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((event: { results: Array<{ 0: { transcript: string }; isFinal: boolean; length: number }> }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        this.onresult?.({ results: [{ 0: { transcript: "BRCA1 repair" }, isFinal: true, length: 1 }] });
      }
      stop() {}
      abort() {}
    }
    const engine = createBrowserVoiceRecognition(
      {
        onTranscript: (text, isFinal) => {
          if (isFinal) transcripts.push(text);
        },
        onState: (state) => states.push(state),
      },
      { SpeechRecognition: FakeRecognition },
    );
    engine.start();
    expect(transcripts).toEqual(["BRCA1 repair"]);
    expect(states).not.toContain("unsupported");

    const denied: string[] = [];
    class DeniedRecognition extends FakeRecognition {
      start() {
        this.onerror?.({ error: "not-allowed" });
      }
    }
    const blocked = createBrowserVoiceRecognition(
      { onTranscript: NOOP, onState: (state) => denied.push(state), onError: (message) => denied.push(message) },
      { SpeechRecognition: DeniedRecognition },
    );
    blocked.start();
    expect(denied).toContain("permission-denied");
    expect(denied).toContain("Microphone permission denied.");
    expect(VOICE_PRIVACY_DISCLOSURE).toMatch(/browser or operating-system provider/i);
    expect(VOICE_PRIVACY_DISCLOSURE.toLowerCase()).not.toContain("local");
    expect(VOICE_PRIVACY_DISCLOSURE.toLowerCase()).not.toContain("private");
  });

  it("renders a read-only banner and locks the composer when archived", () => {
    const markup = renderToStaticMarkup(
      <EpistemicChatApp conversationId="conv_arch" conversationArchived />,
    );
    expect(markup).toContain("Archived conversation · Read only");
    expect(markup).toContain('data-testid="archived-conversation-banner"');
    expect(markup).toContain('data-archived="true"');
    expect(markup).toContain("Archived conversation is read only");
  });
});

describe("read aloud", () => {
  afterEach(() => {
    resetReadAloudForTests();
  });

  it("omits code, URLs, and reads a references cue instead of DOI/PMID URLs", () => {
    const sanitized = sanitizeForReadAloud(
      "Homologous recombination repairs breaks.\n```python\nprint(1)\n```\nSee https://doi.org/10.1/xyz and PMID:123.\nReferences\nhttps://pubmed.ncbi.nlm.nih.gov/1/",
    );
    expect(sanitized.omittedCode).toBe(true);
    expect(sanitized.text).toContain("Code block omitted from read-aloud.");
    expect(sanitized.text).toContain("References available below.");
    expect(sanitized.text).not.toContain("https://");
    expect(sanitized.text).not.toContain("print(1)");
  });

  it("starts, pauses, resumes, stops, and lets a second answer stop the first", () => {
    const spoken: string[] = [];
    const engine = {
      paused: false,
      cancel() {
        spoken.push("cancel");
      },
      pause() {
        spoken.push("pause");
      },
      resume() {
        spoken.push("resume");
      },
      speak(utterance: { text: string }) {
        spoken.push(`speak:${utterance.text}`);
      },
    };
    setReadAloudHostForTests({
      getSynthesis: () => engine,
      createUtterance: (text) => ({ text, onend: null, onerror: null }),
    });
    startReadAloud("msg_a", "First answer");
    expect(getReadAloudState()).toEqual({ messageId: "msg_a", status: "speaking" });
    pauseReadAloud();
    expect(getReadAloudState().status).toBe("paused");
    resumeReadAloud();
    expect(getReadAloudState().status).toBe("speaking");
    startReadAloud("msg_b", "Second answer");
    expect(getReadAloudState()).toEqual({ messageId: "msg_b", status: "speaking" });
    expect(spoken.filter((item) => item.startsWith("speak:")).map((item) => item.slice(6))).toEqual(["First answer", "Second answer"]);
    stopReadAloud();
    expect(getReadAloudState()).toEqual({ messageId: null, status: "idle" });
  });

  it("renders read-aloud controls on a completed assistant answer", () => {
    const msg = emptyAssistantMessage("msg_speak");
    msg.text = "Homologous recombination repairs double-strand breaks.";
    const markup = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        onResolve={NOOP}
        onApproval={NOOP}
        onFocus={NOOP}
        onStop={NOOP}
      />,
    );
    expect(markup).toContain("Read aloud");
    expect(markup).toContain('aria-label="Read answer aloud"');
    const controls = renderToStaticMarkup(<ReadAloudControls messageId="msg_speak" text={msg.text} />);
    expect(controls).toContain("Read answer aloud");
  });
});

describe("mobile and accessibility affordances", () => {
  it("keeps menus in the rail with flip-friendly popovers and ⋮ not as the chat row", () => {
    const conv = conversation("conv_m", "Mobile chat", 20);
    const markup = railMarkup({ conversations: [conv], activeMenuId: "conv_conv_m", projects: [{ project_id: "p1", title: "Project One", description: "" }] });
    expect(markup).toContain("rail-menu-trigger");
    expect(markup).toContain("data-testid=\"chat-menu-trigger-conv_m\"");
    expect(markup).toContain("rail-popover");
    expect(markup).toContain("Move to");
    expect(markup).toContain("rail-popover");
  });

  it("exposes voice and read-aloud accessible names", () => {
    const voice = renderToStaticMarkup(<VoiceInputButton onTranscript={NOOP} />);
    expect(voice).toMatch(/Start voice input|Voice input is not supported by this browser/);
    const speak = renderToStaticMarkup(<ReadAloudControls messageId="m" text="Hello" />);
    expect(speak).toContain("Read answer aloud");
  });
});
