import { useEffect, useMemo, useState } from "react";
import { EpistemicChatApp, type ChatItem } from "@ui/components/EpistemicChatApp";
import { ScientificInspector } from "@ui/components/ScientificInspector";
import { applyKernelEvents, emptyAssistantMessage } from "@ui/sse";
import type { AssistantMessage, InspectorTab, ScientificStreamEvent } from "@ui/types/message";
import { classifyModelReadiness, isHeuristicProvider } from "@ui/design/modelReadiness";
import { AdminPanel } from "./AdminPanel";
import { GlobalSettingsDialog } from "./GlobalSettingsDialog";
import { LegalFooter } from "./LegalFooter";
import { WorkspaceRail } from "./WorkspaceRail";
import { WorkspaceInfoDialog, type WorkspaceInfoPage } from "./WorkspaceInfoDialog";
import { ChatPropertiesDialog, DeleteConversationDialog, RenameConversationDialog } from "./ChatDialogs";
import {
  ARCHIVE_READ_ONLY_LABEL,
  isArchivedConversation,
  listArchivedConversations,
  normalizeConversationArchive,
  requestConversationArchive,
  requestConversationUnarchive,
} from "./archiveContract";
import { ResearcherPortal } from "./portal/ResearcherPortal";
import { portalSectionFromHash, type PortalSection } from "./portal/routes";
import { SynapseWordmark } from "./portal/Wordmark";
import { stopReadAloud } from "@ui/voice/readAloud";
import {
  applyGlobalAppearance,
  profileForRigor,
  projectRigor,
  readStoredGlobalSettings,
  storeGlobalSettings,
  type GlobalSettings,
} from "./globalSettings";
import {
  ApiError,
  attachConversationToProject,
  authLogin,
  authLogout,
  authMe,
  authProfile,
  authRegister,
  authSetupStatus,
  createConversation,
  createProject,
  deleteConversation,
  detachConversationFromProject,
  getConversationMode,
  getConversationReadiness,
  listConversations,
  listMessages,
  listProjectConversations,
  listProjectDiscoveries,
  listProjectFiles,
  listProjects,
  patchProject,
  renameConversation,
  setConversationMode as persistConversationMode,
  type ChatRigor,
  type Conversation,
  type ConversationMode,
  type Discovery,
  type Project,
  type PublicUser,
  type SciencePreset,
  type StoredMessage,
} from "./api";
import { persistedModeFromWorkflow, researchModeForWorkflow, workflowById, workflowFromPersistedMode } from "@ui/design/productModes";
import { extractMeasuredQualifications, modeAvailabilityFromBackend } from "@ui/design/modeQualification";
import type { ModeAvailability } from "@ui/components/ModeSelector";
import { SESSION_EXPIRED_USER_MESSAGE } from "@ui/design/sessionExpiry";
import { AcceptanceGallery } from "./AcceptanceGallery";
import { LegalPage } from "./legal/LegalPage";
import { legalPageFromHash, type LegalPageId } from "./legal/legalContent";
import { applyTheme, readStoredTheme, toggleTheme, type ThemeMode } from "./theme";

type AuthMode = "login" | "register";

const DEFAULT_CONVERSATION_MODE: ConversationMode = {
  conversation_id: "",
  product_mode: "syn_chat",
  mode_state: "CHAT_READY",
  science_preset: "science_answer",
  chat_rigor: "professional",
  mode_version: 2,
  updated_at: null,
  stale_contexts_cleared: 0,
};

export function App() {
  const [theme, setTheme] = useState<ThemeMode>(readStoredTheme);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(readStoredGlobalSettings);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [setupMessage, setSetupMessage] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("claims");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AssistantMessage | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [workspaceInfoPage, setWorkspaceInfoPage] = useState<WorkspaceInfoPage | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [legalPage, setLegalPage] = useState<LegalPageId | null>(() =>
    typeof window === "undefined" ? null : legalPageFromHash(window.location.hash),
  );
  const [portalSection, setPortalSection] = useState<PortalSection | null>(() =>
    typeof window === "undefined" ? null : portalSectionFromHash(window.location.hash),
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [restoredItems, setRestoredItems] = useState<ChatItem[]>([]);
  const [conversationMode, setConversationModeState] = useState<ConversationMode>(DEFAULT_CONVERSATION_MODE);
  const [modeChanging, setModeChanging] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [profile, setProfile] = useState(() => profileForRigor(readStoredGlobalSettings().thinking));
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectFiles, setProjectFiles] = useState<Array<{ file_id: string; filename: string }>>([]);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [toast, setToast] = useState("");
  const [modeAvailability, setModeAvailability] = useState<ModeAvailability>({});
  const [sessionExpired, setSessionExpired] = useState(false);
  const [unsentComposerDraft, setUnsentComposerDraft] = useState("");
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [propertiesId, setPropertiesId] = useState<string | null>(null);
  const productMode = conversationMode.product_mode;
  const sciencePreset = conversationMode.science_preset;
  const chatRigor = conversationMode.chat_rigor;
  const activeWorkflow = workflowFromPersistedMode(productMode, sciencePreset);
  const researchMode = researchModeForWorkflow(activeWorkflow);

  const visibleConversations = useMemo(() => {
    const query = chatSearch.trim().toLowerCase();
    const rows = conversations.map(normalizeConversationArchive);
    if (!query) return rows;
    return rows.filter((item) => item.title.toLowerCase().includes(query));
  }, [chatSearch, conversations]);
  const currentConversation = conversations.find((item) => item.id === conversationId);
  const conversationArchived = isArchivedConversation(currentConversation);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyGlobalAppearance(globalSettings);
    storeGlobalSettings(globalSettings);
  }, [globalSettings]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getConversationReadiness()
      .then(({ health, readiness }) => {
        if (cancelled) return;
        setModeAvailability(
          modeAvailabilityFromBackend({
            measuredQualifications: extractMeasuredQualifications(health, readiness),
            qualification: readiness.qualification,
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setModeAvailability({});
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const onHash = () => {
      setLegalPage(legalPageFromHash(window.location.hash));
      setPortalSection(portalSectionFromHash(window.location.hash));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const setup = await authSetupStatus();
      setSetupMessage(setup.setup_required ? setup.message : "");
    } catch {
      setSetupMessage("");
    }
    try {
      const me = await authMe();
      setUser(me.user);
      if (me.user.setup.theme === "dark" || me.user.setup.theme === "light") {
        setTheme(me.user.setup.theme);
      }
      if (me.user.status === "active") {
        await loadProjects();
        await loadAllConversations();
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function onLogin(email: string, password: string) {
    setError("");
    try {
      const res = await authLogin(email, password);
      setUser(res.user);
      setSessionExpired(false);
      if (res.user.status === "active") {
        await loadProjects();
        await loadAllConversations();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    }
  }

  async function onRegister(email: string, password: string) {
    setError("");
    try {
      const res = await authRegister(email, password);
      setUser(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
    }
  }

  async function onProfile(payload: {
    display_name: string;
    organization: string;
    title: string;
    specialty: string;
    intended_use: string;
  }) {
    setError("");
    try {
      const res = await authProfile(payload);
      setUser(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Profile update failed.");
    }
  }

  async function onLogout() {
    stopReadAloud();
    await authLogout();
    clearAuthenticatedClientState();
  }

  function clearAuthenticatedClientState(options?: { preserveComposerDraft?: string; sessionExpired?: boolean }) {
    setUser(null);
    setSelected(null);
    setAdminOpen(false);
    setWorkspaceInfoPage(null);
    setSettingsOpen(false);
    setConversations([]);
    setConversationId(null);
    setRestoredItems([]);
    setConversationModeState(DEFAULT_CONVERSATION_MODE);
    setProjectId("");
    setProjectFiles([]);
    setDiscoveries([]);
    setChatSearch("");
    setInspectorOpen(false);
    setStreaming(false);
    setError("");
    setRenameTarget(null);
    setDeleteTarget(null);
    setPropertiesId(null);
    stopReadAloud();
    setSessionExpired(Boolean(options?.sessionExpired));
    if (options?.preserveComposerDraft != null) {
      setUnsentComposerDraft(options.preserveComposerDraft);
    } else {
      setUnsentComposerDraft("");
    }
  }

  function onChatAuthenticationExpired(draft: { conversationId: string | null; composerText: string }) {
    void authLogout().catch(() => undefined);
    clearAuthenticatedClientState({
      preserveComposerDraft: draft.composerText,
      sessionExpired: true,
    });
  }

  async function loadProjects() {
    try {
      const data = await listProjects();
      setProjects(data.projects);
    } catch {
      setProjects([]);
    }
  }

  async function applyNewConversationDefaults(id: string, rigor: ChatRigor) {
    await persistConversationMode(id, "syn_chat", undefined, rigor);
  }

  async function loadArchivedConversationRows(): Promise<Conversation[]> {
    try {
      const archived = await listArchivedConversations();
      return archived.conversations.map(normalizeConversationArchive);
    } catch {
      return [];
    }
  }

  function mergeActiveAndArchived(active: Conversation[], archived: Conversation[]): Conversation[] {
    const activeRows = active.map((row) => normalizeConversationArchive({ ...row, archived: false, archived_at: null }));
    const archivedRows = archived.map((row) => normalizeConversationArchive({ ...row, archived: true }));
    const seen = new Set(activeRows.map((row) => row.id));
    return [...activeRows, ...archivedRows.filter((row) => !seen.has(row.id))];
  }

  async function loadAllConversations(preferredId?: string) {
    const [data, archivedRows] = await Promise.all([listConversations(), loadArchivedConversationRows()]);
    let active = data.conversations.map((row) => normalizeConversationArchive({ ...row, archived: false, archived_at: row.archived_at ?? null }));
    if (!active.length) {
      const created = await createConversation("New conversation");
      await applyNewConversationDefaults(created.id, globalSettings.thinking);
      active = [normalizeConversationArchive(created)];
    }
    const rows = mergeActiveAndArchived(active, archivedRows);
    setProjectId("");
    setProjectFiles([]);
    setDiscoveries([]);
    setConversations(rows);
    const preferred = preferredId && rows.some((row) => row.id === preferredId) ? preferredId : null;
    const nextId = preferred ?? active[0]?.id ?? rows[0].id;
    await selectConversation(nextId, rows);
  }

  async function loadProjectConversationList(project: string, preferredId?: string) {
    const [data, archivedRows] = await Promise.all([listProjectConversations(project), loadArchivedConversationRows()]);
    let active = data.conversations.map((row) => normalizeConversationArchive({ ...row, archived: false, archived_at: row.archived_at ?? null }));
    if (!active.length) {
      const created = await createConversation("New conversation");
      await applyNewConversationDefaults(created.id, projectRigor(globalSettings));
      await attachConversationToProject(project, created.id);
      active = [normalizeConversationArchive(created)];
    }
    const rows = mergeActiveAndArchived(active, archivedRows);
    setConversations(rows);
    const preferred = preferredId && rows.some((row) => row.id === preferredId) ? preferredId : null;
    const nextId = preferred ?? active[0]?.id ?? rows[0].id;
    await selectConversation(nextId, rows);
  }

  async function onNewConversation() {
    setError("");
    try {
      const created = await createConversation("New conversation");
      await applyNewConversationDefaults(created.id, projectId ? projectRigor(globalSettings) : globalSettings.thinking);
      if (projectId) {
        await attachConversationToProject(projectId, created.id);
        await loadProjectConversationList(projectId, created.id);
      } else {
        await loadAllConversations(created.id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create a new chat.");
    }
  }

  async function selectConversation(id: string, rows?: Conversation[]) {
    stopReadAloud();
    setConversationId(id);
    setSelected(null);
    setActiveMenuId(null);
    const [data, mode] = await Promise.all([listMessages(id), getConversationMode(id)]);
    setRestoredItems(hydrateMessages(data.messages));
    setConversationModeState(mode);
    if (mode.product_mode === "syn_chat") {
      setInspectorOpen(false);
      setFocusId(null);
    }
    if (rows) setConversations(rows);
  }

  async function onWorkflowChange(next: "casual" | SciencePreset) {
    if (!conversationId || streaming || conversationArchived) return;
    if (next === "casual" && productMode === "syn_chat") return;
    if (next !== "casual" && productMode === "syn_science" && sciencePreset === next) return;
    const mapped = persistedModeFromWorkflow(next);
    setError("");
    setModeChanging(true);
    try {
      const mode = await persistConversationMode(
        conversationId,
        mapped.product_mode,
        mapped.science_preset,
        chatRigor,
      );
      setConversationModeState(mode);
      if (mode.product_mode === "syn_chat") {
        setInspectorOpen(false);
        setFocusId(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to switch the workflow.");
    } finally {
      setModeChanging(false);
    }
  }

  async function onChatRigorChange(next: ChatRigor) {
    if (!conversationId || conversationArchived) return;
    setError("");
    setModeChanging(true);
    try {
      const mode = await persistConversationMode(
        conversationId,
        productMode,
        productMode === "syn_science" ? sciencePreset : undefined,
        next,
      );
      setConversationModeState(mode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change answer rigor.");
    } finally {
      setModeChanging(false);
    }
  }

  function onPreferenceChange(next: ChatRigor) {
    setGlobalSettings((current) => ({ ...current, thinking: next }));
    setProfile(profileForRigor(next));
    if (!conversationArchived) void onChatRigorChange(next);
  }

  function onGlobalSettingsChange(next: GlobalSettings) {
    const thinkingChanged = next.thinking !== globalSettings.thinking;
    setGlobalSettings(next);
    setProfile(profileForRigor(next.thinking));
    if (thinkingChanged) void onChatRigorChange(next.thinking);
  }

  async function onEscalation(nextPreset: SciencePreset) {
    if (!conversationId || conversationArchived) return;
    setError("");
    setModeChanging(true);
    try {
      const mode = await persistConversationMode(conversationId, "syn_science", nextPreset, chatRigor);
      setConversationModeState(mode);
      setFocusId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to accept the mode transition.");
    } finally {
      setModeChanging(false);
    }
  }

  async function onNewProject() {
    setError("");
    try {
      const created = await createProject("Research project");
      setProjects((prev) => [created, ...prev]);
      setProjectId(created.project_id);
      setProjectFiles([]);
      setDiscoveries([]);
      const conversation = await createConversation("New conversation");
      await applyNewConversationDefaults(conversation.id, projectRigor(globalSettings));
      await attachConversationToProject(created.project_id, conversation.id);
      setConversations([conversation]);
      await selectConversation(conversation.id, [conversation]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create a project.");
    }
  }

  async function createProjectForConversation(convId: string) {
    const title = window.prompt("Name the new project:", "Research project");
    if (!title?.trim()) return;
    const created = await createProject(title.trim());
    setProjects((prev) => [created, ...prev]);
    await attachConversationToProject(created.project_id, convId);
    setProjectId(created.project_id);
    setProjectFiles([]);
    setDiscoveries([]);
    await loadProjectConversationList(created.project_id, convId);
  }

  function onRenameConversation(convId: string, currentTitle: string) {
    setActiveMenuId(null);
    if (isArchivedConversation(conversations.find((item) => item.id === convId))) return;
    setRenameTarget({ id: convId, title: currentTitle });
  }

  async function saveRenamedConversation(nextTitle: string) {
    if (!renameTarget) return;
    const convId = renameTarget.id;
    const currentTitle = renameTarget.title;
    setRenameTarget(null);
    if (nextTitle === currentTitle) return;
    try {
      const updated = await renameConversation(convId, nextTitle);
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, title: updated.title } : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to rename conversation.");
    }
  }

  function onDeleteConversation(convId: string) {
    setActiveMenuId(null);
    const row = conversations.find((item) => item.id === convId);
    setDeleteTarget({ id: convId, title: row?.title || "this conversation" });
  }

  async function confirmDeleteConversation() {
    if (!deleteTarget) return;
    const convId = deleteTarget.id;
    setDeleteTarget(null);
    const previous = conversations;
    const remaining = conversations.filter((item) => item.id !== convId);
    const deletingCurrent = conversationId === convId;
    setConversations(remaining);
    if (deletingCurrent) {
      setConversationId(null);
      setRestoredItems([]);
      setSelected(null);
      setInspectorOpen(false);
      stopReadAloud();
    }
    try {
      await deleteConversation(convId);
      if (deletingCurrent) {
        if (remaining.length > 0) {
          await selectConversation(remaining[0].id, remaining);
        } else {
          const created = await createConversation("New conversation");
          await applyNewConversationDefaults(created.id, projectId ? projectRigor(globalSettings) : globalSettings.thinking);
          if (projectId) await attachConversationToProject(projectId, created.id);
          await selectConversation(created.id, [created]);
        }
      }
      setToast("Chat deleted");
    } catch (err) {
      setConversations(previous);
      if (deletingCurrent) await selectConversation(convId, previous).catch(() => undefined);
      setError(err instanceof ApiError ? err.message : "Failed to delete conversation.");
    }
  }

  async function onRenameProject(projId: string, currentTitle: string) {
    setActiveMenuId(null);
    const newTitle = window.prompt("Enter new project title:", currentTitle);
    if (!newTitle || newTitle.trim() === currentTitle) return;
    try {
      const updated = await patchProject(projId, newTitle.trim());
      setProjects((prev) => prev.map((p) => (p.project_id === projId ? { ...p, title: updated.title } : p)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to rename project.");
    }
  }

  async function onMoveToProject(convId: string, targetProjectId: string) {
    setActiveMenuId(null);
    if (isArchivedConversation(conversations.find((item) => item.id === convId))) return;
    try {
      if (projectId && projectId !== targetProjectId) {
        await detachConversationFromProject(projectId, convId);
      }
      await attachConversationToProject(targetProjectId, convId);
      setProjectId(targetProjectId);
      const [files, discoveryData] = await Promise.all([
        listProjectFiles(targetProjectId),
        listProjectDiscoveries(targetProjectId),
      ]);
      setProjectFiles(files.files);
      setDiscoveries(discoveryData.discoveries);
      await loadProjectConversationList(targetProjectId, convId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to move chat to project.");
    }
  }

  async function onArchiveConversation(convId: string) {
    setActiveMenuId(null);
    const result = await requestConversationArchive(convId);
    setToast(result.message);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (projectId) await loadProjectConversationList(projectId, convId);
    else await loadAllConversations(convId);
  }

  async function onUnarchiveConversation(convId: string) {
    setActiveMenuId(null);
    const result = await requestConversationUnarchive(convId);
    setToast(result.message);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (projectId) await loadProjectConversationList(projectId, convId);
    else await loadAllConversations(convId);
  }

  async function onAssignChatToProject(convId: string) {
    setActiveMenuId(null);
    if (isArchivedConversation(conversations.find((item) => item.id === convId))) return;
    const projectTitles = projects.map((p, idx) => `${idx + 1}. ${p.title}`).join("\n");
    const prompt = projects.length
      ? `Move this chat to a project:\n0. Create a new project\n${projectTitles}`
      : "Move this chat to a project:\n0. Create a new project";
    const selection = window.prompt(prompt, projects.length ? "1" : "0");
    if (!selection) return;
    const selectedNumber = Number.parseInt(selection.trim(), 10);
    try {
      if (selectedNumber === 0) {
        await createProjectForConversation(convId);
        return;
      }
      const index = selectedNumber - 1;
      if (Number.isNaN(index) || index < 0 || index >= projects.length) {
        setError("Invalid project selection.");
        return;
      }
      const targetProject = projects[index];
      await attachConversationToProject(targetProject.project_id, convId);
      setProjectId(targetProject.project_id);
      const [files, discoveryData] = await Promise.all([
        listProjectFiles(targetProject.project_id),
        listProjectDiscoveries(targetProject.project_id),
      ]);
      setProjectFiles(files.files);
      setDiscoveries(discoveryData.discoveries);
      await loadProjectConversationList(targetProject.project_id, convId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to move chat to project.");
    }
  }

  async function onRemoveChatFromProject(convId: string) {
    if (!projectId) return;
    if (isArchivedConversation(conversations.find((item) => item.id === convId))) return;
    setActiveMenuId(null);
    try {
      await detachConversationFromProject(projectId, convId);
      await loadProjectConversationList(projectId);
      const discoveryData = await listProjectDiscoveries(projectId);
      setDiscoveries(discoveryData.discoveries);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove chat from project.");
    }
  }

  async function selectProject(id: string) {
    if (!id) {
      await loadAllConversations(conversationId ?? undefined);
      return;
    }
    setError("");
    setProjectId(id);
    setChatSearch("");
    try {
      const [files, discoveryData] = await Promise.all([listProjectFiles(id), listProjectDiscoveries(id)]);
      setProjectFiles(files.files);
      setDiscoveries(discoveryData.discoveries);
      await loadProjectConversationList(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open project.");
    }
  }

  function closeLegal() {
    setLegalPage(null);
    if (legalPageFromHash(window.location.hash)) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }

  const legalOverlay = legalPage ? <LegalPage page={legalPage} onClose={closeLegal} /> : null;
  const portalPage = portalSection ? (
    <ResearcherPortal
      section={portalSection}
      authenticated={Boolean(user && user.status === "active")}
      isAdmin={user?.role === "admin"}
      isDeveloper={user?.role === "admin"}
    />
  ) : null;
  const acceptanceOpen = typeof window !== "undefined" && window.location.hash === "#/acceptance";
  const liveAcceptanceOpen = typeof window !== "undefined" && window.location.hash === "#/acceptance/live";
  if (liveAcceptanceOpen) {
    return (
      <div className="acceptance-gallery" data-testid="live-acceptance">
        <header className="legal-page-header">
          <div>
            <p className="legal-page-kicker">LIVE PRODUCT ACCEPTANCE</p>
            <h1>Real backend only</h1>
          </div>
          <button type="button" className="ghost-btn" onClick={closeLegal}>Close</button>
        </header>
        <p>This surface is not a layout fixture and does not use fake answers. Run <code>node frontend/acceptance/live/run-live-acceptance.mjs</code> against a configured SYNAPSE backend. Results are recorded in <code>frontend/acceptance/LIVE_PRODUCT_ACCEPTANCE.md</code>.</p>
      </div>
    );
  }
  if (acceptanceOpen) {
    return <AcceptanceGallery onClose={closeLegal} />;
  }

  function openInspector(tab: "claims" | "evidence" | "proofs" | "execution") {
    if (productMode !== "syn_science") return;
    setInspectorTab(tab);
    setFocusId(null);
    setInspectorOpen(true);
  }

  if (loading) {
    if (portalPage) {
      return (
        <>
          {portalPage}
          {legalOverlay}
        </>
      );
    }
    return (
      <div className="auth-gate">
        <p className="text-sm text-[var(--muted-foreground)]">Loading SYNAPSE-Ω…</p>
        <LegalFooter onOpen={(target) => { window.location.hash = `#/legal/${target}`; }} />
        {legalOverlay}
      </div>
    );
  }

  if (!user) {
    if (portalPage) {
      return (
        <>
          {portalPage}
          {legalOverlay}
        </>
      );
    }
    return (
      <>
        <AuthGate
          mode={authMode}
          error={error}
          setupMessage={setupMessage}
          sessionExpired={sessionExpired}
          onToggle={() => {
            setError("");
            setAuthMode(authMode === "login" ? "register" : "login");
          }}
          onSubmit={authMode === "login" ? onLogin : onRegister}
        />
        {legalOverlay}
      </>
    );
  }

  if (user.status === "pending_profile" || !user.profile.complete) {
    if (portalPage) {
      return (
        <>
          {portalPage}
          {legalOverlay}
        </>
      );
    }
    return (
      <>
        <ProfileGate error={error} onSubmit={onProfile} />
        {legalOverlay}
      </>
    );
  }

  if (user.status !== "active") {
    if (portalPage) {
      return (
        <>
          {portalPage}
          {legalOverlay}
        </>
      );
    }
    const copy =
      user.status === "pending_approval"
        ? `An administrator must approve ${user.email} before you can run the kernel.`
        : user.status === "suspended"
          ? "An administrator has suspended this account."
          : "This account cannot use the platform.";
    return (
      <div className="auth-gate">
        <div className="auth-card glass-panel">
          <h1>{user.status === "pending_approval" ? "Access pending" : "Account not authorized"}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{copy}</p>
          <button className="black-btn mt-4" onClick={() => void onLogout()}>
            Sign out
          </button>
        </div>
        <LegalFooter onOpen={(target) => { window.location.hash = `#/legal/${target}`; }} />
        {legalOverlay}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col canvas">
      <header className="app-header">
        <button type="button" className="mobile-menu-btn" aria-label="Open navigation" onClick={() => setRailOpen(true)}>☰</button>
        <SynapseWordmark />
        <div className="app-mode-chip" title={workflowById(activeWorkflow).description} data-testid="active-mode">
          {workflowById(activeWorkflow).label}
        </div>
        <div className="app-header-spacer" />
        {productMode === "syn_science" && (
          <button className="header-text-action" type="button" onClick={() => setInspectorOpen((open) => !open)}>
            {inspectorOpen ? "Hide inspector" : "Inspector"}
          </button>
        )}
      </header>

      {error && <div className="setup-banner mx-4 mt-2">{error}</div>}
      {toast && <div className="app-toast" role="status" aria-live="polite">{toast}</div>}
      {conversationArchived && (
        <div className="setup-banner mx-4 mt-2" data-testid="archived-read-only" role="status">
          {ARCHIVE_READ_ONLY_LABEL}
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        <WorkspaceRail
          productMode={productMode}
          sciencePreset={sciencePreset}
          chatRigor={chatRigor}
          profile={profile}
          user={user}
          theme={theme}
          modeChanging={modeChanging || streaming || conversationArchived}
          conversations={visibleConversations}
          conversationId={conversationId}
          chatSearch={chatSearch}
          projects={projects}
          projectId={projectId}
          projectFiles={projectFiles}
          discoveries={discoveries}
          activeMenuId={activeMenuId}
          mobileOpen={railOpen}
          onNewChat={() => void onNewConversation()}
          onWorkflowChange={(workflow) => void onWorkflowChange(workflow)}
          onProfileChange={setProfile}
          onPreferenceChange={onPreferenceChange}
          onSearch={setChatSearch}
          onAllChats={() => void loadAllConversations(conversationId ?? undefined)}
          onSelectConversation={(id) => void selectConversation(id)}
          onNewProject={() => void onNewProject()}
          onSelectProject={(id) => void selectProject(id)}
          onRenameProject={(id, title) => void onRenameProject(id, title)}
          onRenameConversation={(id, title) => onRenameConversation(id, title)}
          onDeleteConversation={onDeleteConversation}
          onOpenProperties={setPropertiesId}
          onMoveToProject={(id, target) => void onMoveToProject(id, target)}
          onAssignChatToProject={(id) => void onAssignChatToProject(id)}
          onRemoveChatFromProject={(id) => void onRemoveChatFromProject(id)}
          onArchiveConversation={(id) => void onArchiveConversation(id)}
          onUnarchiveConversation={(id) => void onUnarchiveConversation(id)}
          onActiveMenu={setActiveMenuId}
          onOpenInspector={openInspector}
          onOpenInfo={setWorkspaceInfoPage}
          onOpenSettings={() => setSettingsOpen(true)}
          onThemeToggle={() => setTheme(toggleTheme())}
          onAdmin={() => setAdminOpen(true)}
          onLogout={() => void onLogout()}
          onMobileClose={() => setRailOpen(false)}
          modeAvailability={modeAvailability}
        />

        <div className="flex-1 min-w-0">
          {conversationId && (
            <EpistemicChatApp
              key={conversationId}
              apiHost=""
              conversationId={conversationId}
              restoredItems={restoredItems}
              iensureMode={user.setup.iensure_default}
              profile={profile}
              researchMode={researchMode}
              projectId={projectId}
              experienceMode={productMode}
              chatRigor={chatRigor}
              sciencePreset={sciencePreset}
              modeChanging={modeChanging}
              conversationArchived={conversationArchived}
              persistedWorkflow={activeWorkflow}
              modeAvailability={modeAvailability}
              onWorkflowChange={(workflow) => void onWorkflowChange(workflow)}
              onChatRigorChange={(rigor) => void onChatRigorChange(rigor)}
              onStreamingChange={setStreaming}
              initialComposerDraft={unsentComposerDraft}
              onComposerDraftApplied={() => setUnsentComposerDraft("")}
              onAuthenticationExpired={onChatAuthenticationExpired}
              onSelect={setSelected}
              onEscalation={(preset) => void onEscalation(preset)}
              onFocusInspector={(tab, objectId) => {
                if (productMode !== "syn_science") return;
                setInspectorTab(tab);
                setFocusId(objectId);
                setInspectorOpen(true);
              }}
            />
          )}
        </div>

        {productMode === "syn_science" && (
          <ScientificInspector
            msg={selected}
            collapsed={!inspectorOpen}
            tab={inspectorTab}
            focusId={focusId}
            onToggle={() => setInspectorOpen((open) => !open)}
            onTab={setInspectorTab}
          />
        )}
      </div>

      {adminOpen && (
        <AdminPanel
          onClose={() => setAdminOpen(false)}
          mode={activeWorkflow}
          thinking={chatRigor}
        />
      )}
      {settingsOpen && (
        <GlobalSettingsDialog
          settings={globalSettings}
          theme={theme}
          user={user}
          projectCount={projects.length}
          onChange={onGlobalSettingsChange}
          onThemeChange={setTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {workspaceInfoPage && <WorkspaceInfoDialog page={workspaceInfoPage} onClose={() => setWorkspaceInfoPage(null)} />}
      {renameTarget && (
        <RenameConversationDialog
          title={renameTarget.title}
          onCancel={() => setRenameTarget(null)}
          onSave={(next) => void saveRenamedConversation(next)}
        />
      )}
      {deleteTarget && (
        <DeleteConversationDialog
          title={deleteTarget.title}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDeleteConversation()}
        />
      )}
      {propertiesId && conversations.some((item) => item.id === propertiesId) && (
        <ChatPropertiesDialog
          conversation={conversations.find((item) => item.id === propertiesId)!}
          onClose={() => setPropertiesId(null)}
        />
      )}
      <LegalFooter onOpen={(target) => { window.location.hash = `#/legal/${target}`; }} />
      {legalOverlay}
      {portalPage ? (
        <div className="researcher-portal-overlay" data-testid="researcher-portal-overlay">
          {portalPage}
        </div>
      ) : null}
    </div>
  );
}

function hydrateMessages(messages: StoredMessage[]): ChatItem[] {
  return messages.map((msg, index) => {
    if (msg.role === "user") {
      return { role: "user", id: msg.id, content: msg.content, attachments: msg.attachments ?? [] };
    }
    const eventsRaw = msg.scientific.events;
    const events = Array.isArray(eventsRaw) ? (eventsRaw as ScientificStreamEvent[]) : [];
    const assistantMsg = events.length
      ? applyKernelEvents(msg.id, events, Math.round(msg.created_at * 1000))
      : { ...emptyAssistantMessage(msg.id, Math.round(msg.created_at * 1000)), text: msg.content };
    if (
      isHeuristicProvider({
        text: assistantMsg.text || msg.content,
        provider: assistantMsg.scientific?.model_metadata?.provider,
        model: assistantMsg.scientific?.model_metadata?.model,
        fallbackStatus: assistantMsg.scientific?.model_metadata?.fallback_status,
      })
    ) {
      const previous = [...messages.slice(0, index)].reverse().find((item) => item.role === "user");
      const readiness = classifyModelReadiness({
        heuristicProse: true,
        message: assistantMsg.text || msg.content,
      });
      return {
        role: "error",
        id: msg.id,
        summary: readiness.message,
        technical: assistantMsg.text || msg.content,
        readiness,
        userMessageId: previous?.id,
        retry: { path: "/chat", body: { message: previous?.content || "" } },
      };
    }
    return { role: "assistant", id: msg.id, assistantMsg };
  });
}

export function AuthGate({
  mode,
  error,
  setupMessage,
  sessionExpired = false,
  onToggle,
  onSubmit,
}: {
  mode: AuthMode;
  error: string;
  setupMessage: string;
  sessionExpired?: boolean;
  onToggle: () => void;
  onSubmit: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="auth-gate" data-testid="auth-gate" data-session-expired={sessionExpired || undefined}>
      <form
        className="auth-card glass-panel space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(email, password);
        }}
      >
        <h1 className="auth-wordmark-heading">
          <SynapseWordmark />
        </h1>
        <p
          className="text-sm text-[var(--muted-foreground)]"
          data-testid={sessionExpired ? "session-expired" : undefined}
          role={sessionExpired ? "status" : undefined}
        >
          {sessionExpired
            ? SESSION_EXPIRED_USER_MESSAGE
            : mode === "login"
              ? "Sign in to your private SYNAPSE workspace."
              : "Create a researcher account. An administrator must approve access."}
        </p>
        {setupMessage && <div className="setup-banner">{setupMessage}</div>}
        <label className="auth-label" htmlFor="email">
          Email
        </label>
        <input id="email" className="auth-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label className="auth-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="auth-input"
          type="password"
          minLength={12}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <p className="auth-error">{error}</p>
        <button className="black-btn w-full" type="submit">
          {mode === "login" ? "Sign in" : "Register"}
        </button>
        <button type="button" className="ghost-btn w-full" onClick={onToggle}>
          {mode === "login" ? "Need an account?" : "Already registered?"}
        </button>
        <a className="ghost-btn w-full portal-auth-manual" href="#/synapse">
          Researcher portal &amp; local manual
        </a>
      </form>
      <LegalFooter />
    </div>
  );
}

function ProfileGate({
  error,
  onSubmit,
}: {
  error: string;
  onSubmit: (payload: {
    display_name: string;
    organization: string;
    title: string;
    specialty: string;
    intended_use: string;
  }) => void;
}) {
  const [display_name, setDisplayName] = useState("");
  const [organization, setOrganization] = useState("");
  const [title, setTitle] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [intended_use, setIntendedUse] = useState("");
  return (
    <div className="auth-gate">
      <form
        className="auth-card glass-panel space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ display_name, organization, title, specialty, intended_use });
        }}
      >
        <h1>Researcher profile</h1>
        <p className="text-sm text-[var(--muted-foreground)]">Required before administrator approval.</p>
        <label className="auth-label">Display name</label>
        <input className="auth-input" value={display_name} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} />
        <label className="auth-label">Organization</label>
        <input className="auth-input" value={organization} onChange={(event) => setOrganization(event.target.value)} required minLength={2} />
        <label className="auth-label">Title</label>
        <input className="auth-input" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} />
        <label className="auth-label">Specialty</label>
        <input className="auth-input" value={specialty} onChange={(event) => setSpecialty(event.target.value)} />
        <label className="auth-label">Intended use</label>
        <textarea className="auth-input" value={intended_use} onChange={(event) => setIntendedUse(event.target.value)} required minLength={8} />
        <p className="auth-error">{error}</p>
        <button className="black-btn w-full" type="submit">
          Submit profile
        </button>
      </form>
      <LegalFooter />
    </div>
  );
}
