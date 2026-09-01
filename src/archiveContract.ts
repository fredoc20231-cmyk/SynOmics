/**
 * Conversation archive is organizational state, not deletion.
 * The durable backend contract is POST /api/conversations/{id}/archive
 * and POST /api/conversations/{id}/unarchive, with GET /api/conversations/archived
 * listing archived rows. Archive is reversible. SYNAPSE must not fake
 * archive persistence in localStorage or emulate Archive as a project.
 */
import { ApiError, apiFetch, type Conversation } from "./api";

export const ARCHIVE_CONTRACT_STATUS = "BACKEND_ARCHIVE" as const;

export type ArchiveContractStatus = typeof ARCHIVE_CONTRACT_STATUS | "ARCHIVE_FAILED";

export type ConversationArchiveResult = {
  ok: boolean;
  persisted: boolean;
  status: ArchiveContractStatus | "ARCHIVED" | "ACTIVE";
  code: string;
  conversation_id: string;
  action: "archive" | "unarchive";
  message: string;
  conversation?: Conversation;
};

export const ARCHIVE_READ_ONLY_LABEL = "Archived conversation · Read only";

export function conversationArchiveAvailable(): boolean {
  return true;
}

export function isArchivedConversation(
  conversation: { archived?: boolean; archived_at?: number | null } | null | undefined,
): boolean {
  if (!conversation) return false;
  if (conversation.archived === true) return true;
  return conversation.archived_at != null && Number(conversation.archived_at) > 0;
}

export function normalizeConversationArchive(conversation: Conversation): Conversation {
  const archived = isArchivedConversation(conversation);
  return {
    ...conversation,
    archived,
    archived_at: archived ? conversation.archived_at ?? conversation.updated_at : conversation.archived_at ?? null,
  };
}

export async function listArchivedConversations(): Promise<{ conversations: Conversation[] }> {
  const data = await apiFetch<{ conversations: Conversation[] }>("/api/conversations/archived");
  return {
    conversations: (data.conversations ?? []).map(normalizeConversationArchive),
  };
}

async function mutateArchive(
  conversationId: string,
  action: "archive" | "unarchive",
): Promise<ConversationArchiveResult> {
  try {
    const body = await apiFetch<{ archived: boolean; conversation: Conversation }>(
      `/api/conversations/${conversationId}/${action}`,
      { method: "POST" },
    );
    const conversation = normalizeConversationArchive(body.conversation);
    const archived = action === "archive";
    return {
      ok: true,
      persisted: true,
      status: archived ? "ARCHIVED" : "ACTIVE",
      code: archived ? "ARCHIVED" : "ACTIVE",
      conversation_id: conversationId,
      action,
      message: archived
        ? "Conversation archived. It is read-only until unarchived."
        : "Conversation restored to the workspace.",
      conversation,
    };
  } catch (err) {
    const message =
      err instanceof ApiError
        ? err.message
        : "Conversation archive could not be persisted.";
    return {
      ok: false,
      persisted: false,
      status: "ARCHIVE_FAILED",
      code: err instanceof ApiError && err.code ? err.code : "ARCHIVE_FAILED",
      conversation_id: conversationId,
      action,
      message,
    };
  }
}

export async function requestConversationArchive(conversationId: string): Promise<ConversationArchiveResult> {
  return mutateArchive(conversationId, "archive");
}

export async function requestConversationUnarchive(conversationId: string): Promise<ConversationArchiveResult> {
  return mutateArchive(conversationId, "unarchive");
}
