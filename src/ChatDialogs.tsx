import { useEffect, useId, useRef, useState } from "react";
import { useFocusTrap } from "./a11y";
import type { ChatRigor, Conversation, ConversationMode, StoredMessage } from "./api";
import { getConversationMode, getConversationProject, listMessages } from "./api";
import {
  approximateWordCount,
  formatConversationTimestamp,
  formatDuration,
  type ConversationRecord,
} from "./chatHistory";
import { isArchivedConversation } from "./archiveContract";
import { THINKING_LEVELS, workflowById, workflowFromPersistedMode } from "@ui/design/productModes";

export type ChatProperties = {
  title: string;
  createdLabel: string;
  updatedLabel: string;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  wordCount: number;
  durationLabel: string;
  modeLabel: string;
  thinkingLabel: string;
  projectLabel: string;
  statusLabel: "Active" | "Archived";
};

function thinkingLabel(rigor: ChatRigor): string {
  return THINKING_LEVELS.find((item) => item.rigor === rigor)?.label ?? "Medium";
}

export function propertiesFromSources(
  conversation: ConversationRecord,
  messages: StoredMessage[],
  mode: ConversationMode | null,
  project: { project_id: string | null; project_title?: string } | null,
  nowSeconds = Date.now() / 1000,
): ChatProperties {
  const userMessages = messages.filter((item) => item.role === "user");
  const assistantMessages = messages.filter((item) => item.role === "assistant");
  const wordCount = approximateWordCount(messages.map((item) => item.content).join(" "));
  const first = messages[0]?.created_at ?? conversation.created_at;
  const last = messages[messages.length - 1]?.created_at ?? conversation.updated_at;
  const durationEnd = messages.length ? last : nowSeconds;
  const workflow = mode
    ? workflowById(workflowFromPersistedMode(mode.product_mode, mode.science_preset))
    : null;
  return {
    title: conversation.title,
    createdLabel: formatConversationTimestamp(conversation.created_at),
    updatedLabel: formatConversationTimestamp(conversation.updated_at),
    totalMessages: messages.length,
    userMessages: userMessages.length,
    assistantMessages: assistantMessages.length,
    wordCount,
    durationLabel: formatDuration(first, durationEnd),
    modeLabel: workflow?.label ?? "Unknown",
    thinkingLabel: mode ? thinkingLabel(mode.chat_rigor) : "Unknown",
    projectLabel: project?.project_title || (project?.project_id ? project.project_id : "None"),
    statusLabel: isArchivedConversation(conversation) ? "Archived" : "Active",
  };
}

export function ChatPropertiesDialog({
  conversation,
  onClose,
}: {
  conversation: Conversation;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [details, setDetails] = useState<ChatProperties | null>(null);
  useFocusTrap(dialogRef, true, onClose);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void Promise.allSettled([
      listMessages(conversation.id),
      getConversationMode(conversation.id),
      getConversationProject(conversation.id),
    ])
      .then(([messageResult, modeResult, projectResult]) => {
        if (cancelled) return;
        if (messageResult.status !== "fulfilled") {
          throw messageResult.reason instanceof Error ? messageResult.reason : new Error("Unable to load messages.");
        }
        const mode = modeResult.status === "fulfilled" ? modeResult.value : null;
        const project = projectResult.status === "fulfilled" ? projectResult.value : { project_id: null };
        setDetails(propertiesFromSources(conversation, messageResult.value.messages, mode, project));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load conversation properties.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversation]);

  return (
    <div
      className="workspace-info-backdrop"
      role="presentation"
      data-testid="chat-properties-dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="chat-properties-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="workspace-info-heading">
          <div>
            <span className="workspace-info-kicker">CONVERSATION</span>
            <h2 id={titleId}>Properties</h2>
          </div>
          <button type="button" aria-label="Close properties" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="workspace-info-content chat-properties-body">
          {loading && (
            <p className="chat-properties-loading" role="status">
              Loading properties…
            </p>
          )}
          {error && (
            <p className="chat-properties-error" role="alert">
              {error}
            </p>
          )}
          {details && !loading && (
            <dl className="chat-properties-list">
              <div><dt>Title</dt><dd>{details.title}</dd></div>
              <div><dt>Created</dt><dd>{details.createdLabel}</dd></div>
              <div><dt>Last updated</dt><dd>{details.updatedLabel}</dd></div>
              <div>
                <dt>Length</dt>
                <dd>
                  {details.totalMessages} messages · {details.userMessages} user · {details.assistantMessages} assistant
                  {details.wordCount > 0 ? ` · ~${details.wordCount} words` : ""}
                </dd>
              </div>
              <div><dt>Duration</dt><dd>{details.durationLabel}</dd></div>
              <div><dt>Mode</dt><dd>{details.modeLabel}</dd></div>
              <div><dt>Thinking level</dt><dd>{details.thinkingLabel}</dd></div>
              <div><dt>Project</dt><dd>{details.projectLabel}</dd></div>
              <div><dt>Status</dt><dd>{details.statusLabel}</dd></div>
            </dl>
          )}
        </div>
      </section>
    </div>
  );
}

export function RenameConversationDialog({
  title,
  onCancel,
  onSave,
}: {
  title: string;
  onCancel: () => void;
  onSave: (nextTitle: string) => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState(title);
  const trimmed = value.trim();
  const invalid = trimmed.length === 0;
  useFocusTrap(dialogRef, true, onCancel);

  return (
    <div
      className="workspace-info-backdrop"
      role="presentation"
      data-testid="rename-conversation-dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="attachment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId}>Rename</h2>
        <label>
          Title
          <input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (!invalid) onSave(trimmed);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
          />
        </label>
        {invalid && <div className="attachment-dialog-error" role="alert">Title cannot be empty.</div>}
        <div className="attachment-dialog-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="black-btn" disabled={invalid} onClick={() => onSave(trimmed)}>
            Save
          </button>
        </div>
      </section>
    </div>
  );
}

export function DeleteConversationDialog({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  useFocusTrap(dialogRef, true, onCancel);

  return (
    <div
      className="workspace-info-backdrop"
      role="presentation"
      data-testid="delete-conversation-dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="attachment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId}>Delete conversation</h2>
        <p>
          Delete “{title}”? This removes the conversation from your workspace. Required audit/provenance records may be
          retained according to policy.
        </p>
        <div className="attachment-dialog-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="black-btn rail-delete-action" data-testid="confirm-delete-conversation" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}
