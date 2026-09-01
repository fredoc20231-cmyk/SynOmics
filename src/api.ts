export type UserStatus = "pending_profile" | "pending_approval" | "active" | "rejected" | "suspended";
export type ProductMode = "syn_chat" | "syn_science";
export type SciencePreset = "science_answer" | "deep_research" | "analyze" | "governed_compute";
export type ChatRigor = "quick" | "professional" | "scientific" | "discover";
export type ModeState =
  | "CHAT_READY"
  | "SCIENCE_READY"
  | "SCIENCE_RESEARCH"
  | "SCIENCE_AWAITING_APPROVAL"
  | "SCIENCE_EXECUTING"
  | "SCIENCE_RECONCILING"
  | "SCIENCE_COMPLETE"
  | "SCIENCE_ABSTAINED"
  | "SCIENCE_FAILED";

export type ConversationMode = {
  conversation_id: string;
  product_mode: ProductMode;
  mode_state: ModeState;
  science_preset: SciencePreset;
  chat_rigor: ChatRigor;
  mode_version: number;
  updated_at: number | null;
  stale_contexts_cleared: number;
};

export type PublicUser = {
  id: string;
  email: string;
  name?: string;
  organization?: string;
  intended_use?: string;
  created_at?: string;
  role: string;
  status: UserStatus;
  profile: {
    display_name: string;
    organization: string;
    title: string;
    specialty: string;
    intended_use: string;
    complete: boolean;
  };
  setup: {
    iensure_default: boolean;
    continue_until_done_default: boolean;
    theme: string;
  };
  initials: string;
};

export type Conversation = {
  id: string;
  owner_user_id: string;
  title: string;
  created_at: number;
  updated_at: number;
  archived_at?: number | null;
  archived?: boolean;
};

export type StoredMessage = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  scientific: Record<string, unknown>;
  created_at: number;
  attachments?: ConversationAttachment[];
};

export type AttachmentType = "file" | "image" | "github_repository";

export type ConversationAttachment = {
  attachment_id: string;
  conversation_id: string;
  project_id?: string | null;
  message_id?: string | null;
  attachment_type: AttachmentType;
  source_type: "upload" | "github";
  filename: string;
  mime_type: string;
  bytes: number;
  sha256: string;
  metadata: Record<string, unknown>;
  created_at: number;
};

export type DiscoveryStatus = "validated" | "supported" | "hypothesis" | "contradicted" | "unresolved";

export type Discovery = {
  discovery_id: string;
  project_id: string;
  conversation_id: string;
  message_id: string;
  title: string;
  summary: string;
  status: DiscoveryStatus;
  claim_ids: string[];
  evidence_ids: string[];
  evidence_link_ids: string[];
  execution_ids: string[];
  receipt_ids: string[];
  artifact_refs: string[];
  contradiction_claim_ids: string[];
  alternative_explanations: string[];
  falsification_tests: string[];
  reviewer_ids: string[];
  created_at: number;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  state?: string;
  detail?: unknown;
  constructor(status: number, message: string, extra?: { code?: string; state?: string; detail?: unknown }) {
    super(message);
    this.status = status;
    this.code = extra?.code;
    this.state = extra?.state;
    this.detail = extra?.detail;
  }
}

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )synapse_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function parseError(res: Response): Promise<{ message: string; code?: string; state?: string; detail?: unknown }> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object") {
      const rec = body as { detail?: unknown; error?: { message?: unknown; code?: unknown }; code?: unknown; state?: unknown };
      const detail = rec.detail;
      if (detail && typeof detail === "object" && !Array.isArray(detail)) {
        const obj = detail as { code?: unknown; state?: unknown; message?: unknown };
        const message =
          (typeof obj.message === "string" && obj.message) ||
          (typeof rec.error?.message === "string" && rec.error.message) ||
          res.statusText ||
          `HTTP ${res.status}`;
        return {
          message,
          code: typeof obj.code === "string" ? obj.code : typeof rec.code === "string" ? rec.code : undefined,
          state: typeof obj.state === "string" ? obj.state : typeof rec.state === "string" ? rec.state : undefined,
          detail: body,
        };
      }
      if (typeof rec.error?.message === "string" && rec.error.message) {
        return { message: rec.error.message, detail: body };
      }
      if (typeof rec.detail === "string") return { message: rec.detail, detail: body };
    }
  } catch {
    /* fall through */
  }
  return { message: res.statusText || `HTTP ${res.status}` };
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type") && !(typeof FormData !== "undefined" && init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const method = (init.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", csrfToken());
  }
  const res = await fetch(path, { credentials: "include", ...init, headers });
  if (!res.ok) {
    const parsed = await parseError(res);
    throw new ApiError(res.status, parsed.message, parsed);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type ConversationReadinessView = {
  state: string;
  ready: boolean;
  provider: string;
  model: string;
  heuristic?: boolean;
  transport?: string;
  qualification?: string;
  quality_gate_passed?: boolean;
  measured_qualifications?: string[];
};

export type VersionView = {
  version: string;
  git_sha?: string;
  frontend_sha?: string;
  backend_sha?: string;
  build_date?: string;
  environment?: string;
  schema_version?: string;
};

export async function getVersion(): Promise<VersionView> {
  return apiFetch<VersionView>("/version");
}

export function conversationReadinessFromHealth(
  body: Record<string, unknown>,
): ConversationReadinessView {
  const conversation = (body.conversation && typeof body.conversation === "object"
    ? body.conversation
    : {}) as Partial<ConversationReadinessView>;
  const checks = (body.checks && typeof body.checks === "object" ? body.checks : {}) as Record<string, unknown>;
  const checkConversation = (checks.conversation && typeof checks.conversation === "object"
    ? (checks.conversation as { detail?: ConversationReadinessView }).detail
    : undefined);
  const modelCheck = (checks.model && typeof checks.model === "object" ? checks.model : {}) as Record<string, unknown>;
  const merged = { ...checkConversation, ...conversation };
  const heuristic =
    typeof merged.heuristic === "boolean"
      ? merged.heuristic
      : typeof (body.model as { detail?: { heuristic?: unknown } } | undefined)?.detail?.heuristic === "boolean"
        ? Boolean((body.model as { detail: { heuristic: boolean } }).detail.heuristic)
        : undefined;
  return {
    state: typeof merged.state === "string" && merged.state.trim() ? merged.state : "UNKNOWN",
    ready: typeof merged.ready === "boolean" ? merged.ready : false,
    provider: String(merged.provider || modelCheck.provider || ""),
    model: String(merged.model || modelCheck.model || ""),
    heuristic,
    transport: typeof merged.transport === "string" ? merged.transport : undefined,
    qualification: typeof merged.qualification === "string" ? merged.qualification : undefined,
    quality_gate_passed: typeof merged.quality_gate_passed === "boolean" ? merged.quality_gate_passed : undefined,
    measured_qualifications: Array.isArray(merged.measured_qualifications)
      ? merged.measured_qualifications.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}

export async function getConversationReadiness(): Promise<{
  readiness: ConversationReadinessView;
  health: Record<string, unknown>;
}> {
  const response = await fetch("/health/ready", { credentials: "include" });
  const body = (await response.json()) as Record<string, unknown>;
  return {
    health: body,
    readiness: conversationReadinessFromHealth(body),
  };
}

export function authMe() {
  return apiFetch<{ user: PublicUser }>("/auth/me");
}

export function authSetupStatus() {
  return apiFetch<{
    setup_required: boolean;
    has_admin: boolean;
    owner_configured: boolean;
    message: string;
  }>("/auth/setup-status");
}

export function authLogin(email: string, password: string) {
  return apiFetch<{ user: PublicUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function authRegister(email: string, password: string) {
  return apiFetch<{ user: PublicUser }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function authLogout() {
  return apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export function authProfile(payload: {
  display_name: string;
  organization: string;
  title: string;
  specialty: string;
  intended_use: string;
}) {
  return apiFetch<{ user: PublicUser }>("/auth/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminUsers() {
  return apiFetch<{ users: PublicUser[] }>("/auth/admin/users");
}

export function adminPending() {
  return apiFetch<{ users: PublicUser[] }>("/auth/admin/pending");
}

export function adminAction(user_id: string, action: string) {
  return apiFetch<{ user: PublicUser }>("/auth/admin/action", {
    method: "POST",
    body: JSON.stringify({ user_id, action }),
  });
}

export function listConversations() {
  return apiFetch<{ conversations: Conversation[] }>("/api/conversations");
}

export function createConversation(title = "New conversation") {
  return apiFetch<Conversation>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function renameConversation(conversationId: string, title: string) {
  return apiFetch<Conversation>(`/api/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function deleteConversation(conversationId: string) {
  return apiFetch<{
    deleted: boolean;
    conversation_id: string;
    deleted_at: number;
    expired_approvals: number;
    retained_audit_lineage: boolean;
  }>(`/api/conversations/${conversationId}`, { method: "DELETE" });
}

export function getConversationMode(conversationId: string) {
  return apiFetch<ConversationMode>(`/api/conversations/${conversationId}/mode`);
}

export function setConversationMode(
  conversationId: string,
  product_mode: ProductMode,
  science_preset?: SciencePreset,
  chat_rigor?: ChatRigor,
) {
  return apiFetch<ConversationMode>(`/api/conversations/${conversationId}/mode`, {
    method: "PATCH",
    body: JSON.stringify({
      product_mode,
      ...(science_preset ? { science_preset } : {}),
      ...(chat_rigor ? { chat_rigor } : {}),
    }),
  });
}

export function listMessages(conversationId: string) {
  return apiFetch<{ messages: StoredMessage[] }>(`/api/conversations/${conversationId}/messages`);
}

export function deleteConversationTurn(conversationId: string, messageId: string) {
  return apiFetch<{
    deleted: boolean;
    conversation_id: string;
    message_id: string;
    hidden_message_ids: string[];
    deleted_at: number;
    retained_audit_lineage: boolean;
  }>(`/api/conversations/${conversationId}/messages/${messageId}`, { method: "DELETE" });
}

export function uploadConversationAttachment(
  conversationId: string,
  file: File,
  kind: "file" | "image",
  projectId = "",
) {
  const form = new FormData();
  form.append("file", file);
  const params = new URLSearchParams({ kind });
  if (projectId) params.set("project_id", projectId);
  return apiFetch<{ attachment: ConversationAttachment }>(
    `/api/conversations/${conversationId}/attachments?${params}`,
    { method: "POST", body: form },
  );
}

export function attachGitHubRepository(
  conversationId: string,
  url: string,
  ref = "",
  projectId = "",
) {
  return apiFetch<{ attachment: ConversationAttachment }>(
    `/api/conversations/${conversationId}/attachments/github`,
    { method: "POST", body: JSON.stringify({ url, ref, project_id: projectId }) },
  );
}

export function deleteConversationAttachment(conversationId: string, attachmentId: string) {
  return apiFetch<{ deleted: boolean }>(
    `/api/conversations/${conversationId}/attachments/${attachmentId}`,
    { method: "DELETE" },
  );
}

export type Project = {
  project_id: string;
  title: string;
  description: string;
  owner_id?: string;
  created_at?: number;
  updated_at?: number;
};

export function listProjects() {
  return apiFetch<{ projects: Project[] }>("/api/projects");
}

export function createProject(title: string, description = "") {
  return apiFetch<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify({ title, description }),
  });
}

export function patchProject(projectId: string, title?: string, description?: string) {
  return apiFetch<Project>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify({ title, description }),
  });
}

export function listProjectFiles(projectId: string) {
  return apiFetch<{ files: Array<{ file_id: string; filename: string; content_hash: string }> }>(
    `/api/projects/${projectId}/files`,
  );
}

export function listProjectConversations(projectId: string) {
  return apiFetch<{ conversations: Conversation[] }>(`/api/projects/${projectId}/conversations`);
}

export function listProjectDiscoveries(projectId: string) {
  return apiFetch<{ discoveries: Discovery[]; status_values: DiscoveryStatus[] }>(
    `/api/projects/${projectId}/discoveries`,
  );
}

export function attachConversationToProject(projectId: string, conversationId: string) {
  return apiFetch<{ linked: boolean; project_id: string; conversation_id: string }>(
    `/api/projects/${projectId}/conversations/${conversationId}`,
    { method: "POST" },
  );
}

export function detachConversationFromProject(projectId: string, conversationId: string) {
  return apiFetch<{ linked: boolean; project_id: string; conversation_id: string }>(
    `/api/projects/${projectId}/conversations/${conversationId}`,
    { method: "DELETE" },
  );
}

export function getConversationProject(conversationId: string) {
  return apiFetch<{ project_id: string | null; project_title?: string; conversation_id: string }>(
    `/api/conversations/${conversationId}/project`,
  );
}

export function approveExecution(request_id: string, approved: boolean, conversation_id?: string) {
  return apiFetch<Response>("/approve", {
    method: "POST",
    body: JSON.stringify({ request_id, approved, conversation_id }),
  });
}
