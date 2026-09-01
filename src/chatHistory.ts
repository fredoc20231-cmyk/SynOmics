import type { Conversation } from "./api";
import { isArchivedConversation } from "./archiveContract";

export const RECENT_CHAT_LIMIT = 7;

export type ConversationRecord = Conversation & { archived?: boolean; archived_at?: number | null };

export type ChatPeriod = "Today" | "Yesterday" | "Previous 7 days" | "Older";

export type ChatPeriodGroup = { label: ChatPeriod; conversations: ConversationRecord[] };

export type ChatHistoryView = {
  recent: ConversationRecord[];
  old: ConversationRecord[];
  archived: ConversationRecord[];
  searching: boolean;
  searchMatches: ConversationRecord[];
  archivedSearchMatches: ConversationRecord[];
};

function byUpdatedDesc(left: ConversationRecord, right: ConversationRecord): number {
  return right.updated_at - left.updated_at;
}

export function conversationMatchesSearch(conversation: ConversationRecord, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return conversation.title.toLowerCase().includes(trimmed);
}

export function sortConversations(conversations: readonly ConversationRecord[]): ConversationRecord[] {
  return [...conversations].sort(byUpdatedDesc);
}

export function partitionConversations(
  conversations: readonly ConversationRecord[],
  options: { selectedId?: string | null; search?: string } = {},
): ChatHistoryView {
  const query = options.search?.trim() ?? "";
  const searching = query.length > 0;
  const selectedId = options.selectedId ?? null;

  const archived = sortConversations(conversations.filter(isArchivedConversation));
  const active = sortConversations(conversations.filter((item) => !isArchivedConversation(item)));
  const recent = active.slice(0, RECENT_CHAT_LIMIT);
  const old = active.slice(RECENT_CHAT_LIMIT);
  if (selectedId && !recent.some((item) => item.id === selectedId)) {
    const pinned = active.find((item) => item.id === selectedId);
    if (pinned) recent.push(pinned);
  }

  const searchPool = searching
    ? sortConversations(conversations.filter((item) => conversationMatchesSearch(item, query)))
    : [];

  return {
    recent,
    old,
    archived,
    searching,
    searchMatches: searchPool.filter((item) => !isArchivedConversation(item)),
    archivedSearchMatches: searchPool.filter(isArchivedConversation),
  };
}

export function groupConversationsByPeriod(
  conversations: readonly ConversationRecord[],
  now = new Date(),
): ChatPeriodGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
  const groups: ChatPeriodGroup[] = [
    { label: "Today", conversations: [] },
    { label: "Yesterday", conversations: [] },
    { label: "Previous 7 days", conversations: [] },
    { label: "Older", conversations: [] },
  ];
  for (const conversation of conversations) {
    const ageDays = (startOfToday - conversation.updated_at) / 86_400;
    if (ageDays < 1) groups[0].conversations.push(conversation);
    else if (ageDays < 2) groups[1].conversations.push(conversation);
    else if (ageDays < 7) groups[2].conversations.push(conversation);
    else groups[3].conversations.push(conversation);
  }
  return groups.filter((group) => group.conversations.length > 0);
}

export function epochToDate(epoch: number): Date {
  return new Date(epoch > 1e12 ? epoch : epoch * 1000);
}

export function formatConversationTimestamp(epoch: number, locale = "en-US"): string {
  const date = epochToDate(epoch);
  const datePart = date.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" });
  const timePart = date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

export function formatDuration(startEpoch: number, endEpoch: number): string {
  const start = epochToDate(startEpoch).getTime();
  const end = epochToDate(endEpoch).getTime();
  const deltaMs = Math.max(0, end - start);
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return "Less than a minute";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function approximateWordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
