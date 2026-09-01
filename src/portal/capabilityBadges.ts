export type CapabilityBadge =
  | "Available"
  | "In current beta"
  | "Coming in next candidate"
  | "Deployment dependent";

export const CAPABILITY_BADGES: Record<
  string,
  { badge: CapabilityBadge; note: string }
> = {
  chat: {
    badge: "Available",
    note: "Fast, natural assistance for everyday questions, writing, coding and clear scientific explanations. Casual describes experience, not a lower trust level.",
  },
  science: {
    badge: "In current beta",
    note: "Evidence-aware scientific explanation depends on configured retrieval and the current SYNAPSE release.",
  },
  deepScience: {
    badge: "In current beta",
    note: "Research-grade synthesis is available when the configured release actually performs it. Ordinary questions are answered naturally. The interface does not invent research activity from mode selection.",
  },
  analyze: {
    badge: "Deployment dependent",
    note: "Discussing an analysis is not the same as Analyze. Execution capability depends on the configured SYNAPSE release and enabled governed tools.",
  },
  governedCompute: {
    badge: "Deployment dependent",
    note: "Authorized computation runs only when verification, authorization, and an enabled execution path exist in that deployment. Selecting the mode does not automatically execute.",
  },
  projects: {
    badge: "Available",
    note: "Projects are organizational context. They do not authorize computation.",
  },
  conversations: {
    badge: "Available",
    note: "Saved chats, search, rename, delete, and project membership are available in the authenticated workspace.",
  },
  archive: {
    badge: "Available",
    note: "Archive is organizational state. Archived conversations open as read-only: view messages, references, Properties, Unarchive, and Delete. Send, attach, rename, mode change, execution, and project mutation are blocked until Unarchive.",
  },
  voice: {
    badge: "Deployment dependent",
    note: "When voice controls are present, they use the browser's speech APIs. SYNAPSE does not claim a proprietary speech model.",
  },
  localModels: {
    badge: "Deployment dependent",
    note: "Local model runtimes such as Ollama are optional and must be configured. A local model is not a privacy guarantee.",
  },
};
