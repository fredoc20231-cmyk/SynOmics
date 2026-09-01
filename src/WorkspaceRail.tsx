import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type {
  ChatRigor,
  Conversation,
  Discovery,
  ProductMode,
  Project,
  PublicUser,
  SciencePreset,
} from "./api";
import { getConversationProject } from "./api";
import type { ThemeMode } from "./theme";
import { ModeSelector, type ModeAvailability } from "@ui/components/ModeSelector";
import { OmegaGlyph } from "@ui/components/OmegaGlyph";
import { workflowFromPersistedMode, type WorkflowSelection } from "@ui/design/productModes";
import type { WorkspaceInfoPage } from "./WorkspaceInfoDialog";
import { isArchivedConversation } from "./archiveContract";
import {
  groupConversationsByPeriod,
  partitionConversations,
  type ConversationRecord,
} from "./chatHistory";
import { flipMenuIntoViewport, usePersistentMenu } from "./persistentMenu";

type ProjectFile = { file_id: string; filename: string };

const ACCOUNT_DESTINATIONS: Array<{ page: WorkspaceInfoPage; label: string }> = [
  { page: "about", label: "About SYNAPSE" },
  { page: "faqs", label: "FAQs" },
  { page: "join", label: "Join the team" },
  { page: "research", label: "Research & educational use" },
  { page: "disclaimer", label: "Terms / Disclaimer" },
  { page: "privacy", label: "Privacy" },
  { page: "ip", label: "Intellectual Property" },
];

const THINKING_PREFERENCES: Array<{ rigor: ChatRigor; label: string; equivalent: string }> = [
  { rigor: "quick", label: "Basic", equivalent: "Faster" },
  { rigor: "professional", label: "Medium", equivalent: "Balanced" },
  { rigor: "scientific", label: "Advanced", equivalent: "Deeper" },
];

export function WorkspaceRail({
  productMode,
  sciencePreset,
  chatRigor,
  profile,
  user,
  theme,
  modeChanging,
  conversations,
  conversationId,
  chatSearch,
  projects,
  projectId,
  projectFiles,
  discoveries,
  activeMenuId,
  mobileOpen = false,
  onNewChat,
  onWorkflowChange,
  onProfileChange,
  onPreferenceChange,
  onSearch,
  onAllChats,
  onSelectConversation,
  onNewProject,
  onSelectProject,
  onRenameProject,
  onRenameConversation,
  onDeleteConversation,
  onOpenProperties,
  onMoveToProject,
  onAssignChatToProject,
  onRemoveChatFromProject,
  onArchiveConversation,
  onUnarchiveConversation,
  onActiveMenu,
  onOpenInspector,
  onOpenInfo,
  onOpenSettings,
  onThemeToggle,
  onAdmin,
  onLogout,
  onMobileClose,
  modeAvailability,
}: {
  productMode: ProductMode;
  sciencePreset: SciencePreset;
  chatRigor: ChatRigor;
  profile: string;
  user: PublicUser;
  theme: ThemeMode;
  modeChanging: boolean;
  conversations: Conversation[];
  conversationId: string | null;
  chatSearch: string;
  projects: Project[];
  projectId: string;
  projectFiles: ProjectFile[];
  discoveries: Discovery[];
  activeMenuId: string | null;
  mobileOpen?: boolean;
  onNewChat: () => void;
  onWorkflowChange: (workflow: WorkflowSelection) => void;
  onProfileChange: (profile: string) => void;
  onPreferenceChange: (rigor: ChatRigor) => void;
  onSearch: (value: string) => void;
  onAllChats: () => void;
  onSelectConversation: (id: string) => void;
  onNewProject: () => void;
  onSelectProject: (id: string) => void;
  onRenameProject: (id: string, title: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onOpenProperties?: (id: string) => void;
  onMoveToProject?: (conversationId: string, projectId: string) => void;
  onAssignChatToProject?: (id: string) => void;
  onRemoveChatFromProject: (id: string) => void;
  onArchiveConversation?: (id: string) => void;
  onUnarchiveConversation?: (id: string) => void;
  onActiveMenu: (id: string | null) => void;
  onOpenInspector: (tab: "claims" | "evidence" | "proofs" | "execution") => void;
  onOpenInfo: (page: WorkspaceInfoPage) => void;
  onOpenSettings: () => void;
  onThemeToggle: () => void;
  onAdmin: () => void;
  onLogout: () => void;
  onMobileClose?: () => void;
  modeAvailability?: ModeAvailability;
}) {
  const history = partitionConversations(conversations, { selectedId: conversationId, search: chatSearch });
  const railRef = useRef<HTMLElement | null>(null);
  const menuTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [oldChatsOpen, setOldChatsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(() =>
    Boolean(conversationId && conversations.some((item) => item.id === conversationId && isArchivedConversation(item))),
  );
  const [moveToId, setMoveToId] = useState<string | null>(null);
  const [conversationProject, setConversationProject] = useState<{
    conversationId: string;
    project_id: string | null;
    project_title?: string;
  } | null>(null);

  const closeAccountMenu = useCallback(() => setAccountMenuOpen(false), []);
  usePersistentMenu(accountMenuOpen, accountMenuRef, closeAccountMenu, () => {
    accountMenuTriggerRef.current?.focus();
  });

  const selectWorkflow = (workflow: WorkflowSelection) => {
    onActiveMenu(null);
    onWorkflowChange(workflow);
    onMobileClose?.();
  };

  const actFromMenu = (menuId: string, action: () => void) => {
    onActiveMenu(null);
    setMoveToId(null);
    action();
    window.requestAnimationFrame(() => menuTriggerRefs.current.get(menuId)?.focus());
  };

  useEffect(() => {
    if (!activeMenuId) {
      setMoveToId(null);
      return;
    }
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const container = railRef.current?.querySelector(`[data-menu-container="${activeMenuId}"]`);
      if (!container?.contains(target)) onActiveMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (moveToId) {
        setMoveToId(null);
        return;
      }
      const trigger = menuTriggerRefs.current.get(activeMenuId);
      onActiveMenu(null);
      window.requestAnimationFrame(() => trigger?.focus());
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeMenuId, moveToId, onActiveMenu]);

  useEffect(() => {
    if (!moveToId) {
      setConversationProject(null);
      return;
    }
    let cancelled = false;
    void getConversationProject(moveToId)
      .then((result) => {
        if (!cancelled) setConversationProject({ conversationId: moveToId, ...result });
      })
      .catch(() => {
        if (!cancelled) setConversationProject({ conversationId: moveToId, project_id: projectId || null });
      });
    return () => {
      cancelled = true;
    };
  }, [moveToId, projectId]);

  const openInfo = (page: WorkspaceInfoPage) => {
    setAccountMenuOpen(false);
    onOpenInfo(page);
    onMobileClose?.();
  };

  const renderConversation = (conversation: ConversationRecord, opts?: { archivedBadge?: boolean }) => {
    const menuId = `conv_${conversation.id}`;
    const archived = isArchivedConversation(conversation) || Boolean(opts?.archivedBadge);
    return (
      <ConversationRow
        key={conversation.id}
        conversation={conversation}
        active={conversation.id === conversationId}
        archived={archived}
        menuOpen={activeMenuId === menuId}
        moveToOpen={moveToId === conversation.id}
        projects={projects}
        currentProjectId={
          conversationProject?.conversationId === conversation.id
            ? conversationProject.project_id
            : projectId || null
        }
        currentProjectTitle={
          conversationProject?.conversationId === conversation.id ? conversationProject.project_title : undefined
        }
        menuTriggerRefs={menuTriggerRefs}
        onSelect={() => {
          onActiveMenu(null);
          onSelectConversation(conversation.id);
          onMobileClose?.();
        }}
        onToggleMenu={() => onActiveMenu(activeMenuId === menuId ? null : menuId)}
        onToggleMoveTo={() => setMoveToId((current) => (current === conversation.id ? null : conversation.id))}
        onRename={() => actFromMenu(menuId, () => onRenameConversation(conversation.id, conversation.title))}
        onProperties={() => actFromMenu(menuId, () => onOpenProperties?.(conversation.id))}
        onMoveToProject={(targetProjectId) =>
          actFromMenu(menuId, () => {
            if (onMoveToProject) onMoveToProject(conversation.id, targetProjectId);
            else onAssignChatToProject?.(conversation.id);
          })
        }
        onRemoveFromProject={() => actFromMenu(menuId, () => onRemoveChatFromProject(conversation.id))}
        onArchive={() => actFromMenu(menuId, () => onArchiveConversation?.(conversation.id))}
        onUnarchive={() => actFromMenu(menuId, () => onUnarchiveConversation?.(conversation.id))}
        onDelete={() => actFromMenu(menuId, () => onDeleteConversation(conversation.id))}
      />
    );
  };

  const searching = history.searching;
  const recentRows = searching ? history.searchMatches : history.recent;
  const empty = searching
    ? history.searchMatches.length === 0 && history.archivedSearchMatches.length === 0
    : history.recent.length === 0 && history.old.length === 0 && history.archived.length === 0;

  return (
    <nav
      ref={railRef}
      className={`workspace-rail ${mobileOpen ? "mobile-open" : ""}`}
      aria-label="SYNAPSE-Ω workspace"
      onScroll={() => {
        if (activeMenuId) onActiveMenu(null);
      }}
    >
      <div className="rail-top-row">
        <button
          type="button"
          className="rail-new-chat omega-initialize"
          data-testid="initialize-omega"
          onClick={() => {
            onActiveMenu(null);
            onNewChat();
            onMobileClose?.();
          }}
        >
          <OmegaGlyph name="initialize" />
          <span>Initialize Ω</span>
        </button>
        <button type="button" className="rail-mobile-close" aria-label="Close navigation" onClick={onMobileClose}>×</button>
      </div>

      <section className="rail-section rail-chats" aria-labelledby="rail-sessions" data-testid="rail-chats">
        <div className="rail-heading-row">
          <div id="rail-sessions" className="rail-heading">Recent Sessions</div>
          {projectId && <button type="button" className="rail-text-action" onClick={onAllChats}>All</button>}
        </div>
        <label className="rail-search omega-session-search">
          <OmegaGlyph name="history" />
          <input
            type="search"
            value={chatSearch}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search sessions"
            aria-label="Search sessions"
          />
        </label>
        {empty ? (
          <div className="rail-empty">{searching ? "No sessions match this search" : "No sessions yet"}</div>
        ) : (
          <>
            <div className="rail-recent-chats" data-testid="recent-chats">
              {recentRows.map((conversation) => renderConversation(conversation))}
            </div>
            {searching && history.archivedSearchMatches.length > 0 && (
              <div className="rail-search-archived" data-testid="search-archived">
                {history.archivedSearchMatches.map((conversation) => renderConversation(conversation, { archivedBadge: true }))}
              </div>
            )}
            {!searching && (
              <div className="rail-disclosure-block" data-testid="old-chats">
                <button
                  type="button"
                  className={`rail-disclosure ${oldChatsOpen ? "open" : ""}`}
                  aria-expanded={oldChatsOpen}
                  onClick={() => setOldChatsOpen((open) => !open)}
                >
                  <span>Earlier sessions</span>
                  <span aria-hidden="true">›</span>
                </button>
                {oldChatsOpen &&
                  (history.old.length === 0 ? (
                    <div className="rail-empty">No earlier sessions</div>
                  ) : (
                    groupConversationsByPeriod(history.old).map((group) => (
                      <div key={group.label} className="rail-chat-group">
                        <div className="rail-chat-period">{group.label}</div>
                        {group.conversations.map((conversation) => renderConversation(conversation))}
                      </div>
                    ))
                  ))}
              </div>
            )}
            {!searching && (
              <div className="rail-disclosure-block" data-testid="archive-disclosure">
                <button
                  type="button"
                  className={`rail-disclosure ${archiveOpen ? "open" : ""}`}
                  aria-expanded={archiveOpen}
                  onClick={() => setArchiveOpen((open) => !open)}
                >
                  <span>
                    Session archive <span className="rail-count">{history.archived.length}</span>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
                {archiveOpen && (
                  <div data-testid="archive-list">
                    {history.archived.length === 0 ? (
                      <div className="rail-empty">No archived sessions</div>
                    ) : (
                      history.archived.map((conversation) => renderConversation(conversation, { archivedBadge: true }))
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <section className="rail-section" aria-labelledby="rail-modes">
        <div id="rail-modes" className="rail-heading">Execution Modes</div>
        <ModeSelector
          variant="rail"
          value={workflowFromPersistedMode(productMode, sciencePreset)}
          disabled={modeChanging}
          availability={modeAvailability}
          onChange={selectWorkflow}
        />
      </section>

      <section className="rail-section" aria-labelledby="rail-trust">
        <div id="rail-trust" className="rail-heading">Trust &amp; Records</div>
        <div className="omega-nav-stack">
          <button
            type="button"
            className="omega-nav-row"
            data-testid="scientific-inspector-nav"
            onClick={() => {
              onOpenInspector("claims");
              onMobileClose?.();
            }}
          >
            <OmegaGlyph name="inspector" />
            <span className="omega-nav-copy">
              <strong>Scientific Inspector</strong>
              <span>Claims, proofs &amp; execution trace</span>
            </span>
            <span className="omega-nav-meta">{discoveries.length || ""}</span>
          </button>
          <button
            type="button"
            className="omega-nav-row"
            data-testid="evidence-nexus-nav"
            onClick={() => {
              onOpenInspector("evidence");
              onMobileClose?.();
            }}
          >
            <OmegaGlyph name="evidence" />
            <span className="omega-nav-copy">
              <strong>Evidence Nexus</strong>
              <span>Sources, passages &amp; verification</span>
            </span>
            <span aria-hidden="true" className="omega-nav-meta">›</span>
          </button>
        </div>
      </section>

      <section className="rail-section" aria-labelledby="rail-workspaces">
        <div className="rail-heading-row">
          <div id="rail-workspaces" className="rail-heading">Workspaces</div>
          <button type="button" className="rail-icon-action" aria-label="Create project in Project Vault" title="Create project" onClick={onNewProject}>＋</button>
        </div>
        <div className="omega-nav-stack">
          <div className="omega-nav-row rail-vault-project" aria-label="Project Vault">
            <OmegaGlyph name="vault" />
            <span className="omega-nav-copy">
              <strong>Project Vault</strong>
              <span>Projects, files &amp; durable context</span>
            </span>
            <span className="omega-nav-meta">{projects.length}</span>
          </div>
        </div>
        {projects.length === 0 ? <div className="rail-empty">No vault projects yet</div> : projects.map((project) => (
          <div key={project.project_id} className="rail-row-wrap" data-menu-container={`proj_${project.project_id}`}>
            <button type="button" className={`rail-item-row ${project.project_id === projectId ? "active" : ""}`} onClick={() => { onActiveMenu(null); onSelectProject(project.project_id); }}>
              <OmegaGlyph name="vault" className="rail-project-glyph" /><span>{project.title}</span>
            </button>
            <button ref={(node) => { if (node) menuTriggerRefs.current.set(`proj_${project.project_id}`, node); }} type="button" className="rail-menu-trigger" aria-label={`Options for project ${project.title}`} aria-haspopup="menu" aria-expanded={activeMenuId === `proj_${project.project_id}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onActiveMenu(activeMenuId === `proj_${project.project_id}` ? null : `proj_${project.project_id}`); }}>⋯</button>
            {activeMenuId === `proj_${project.project_id}` && (
              <div className="rail-popover" role="menu"><button type="button" role="menuitem" onClick={() => actFromMenu(`proj_${project.project_id}`, () => onRenameProject(project.project_id, project.title))}>Rename project</button></div>
            )}
          </div>
        ))}
        {projectId && projectFiles.length > 0 && <div className="rail-project-meta">{projectFiles.length} project file{projectFiles.length === 1 ? "" : "s"}</div>}
        <div className="omega-nav-stack">
          <button
            type="button"
            className="omega-nav-row"
            data-testid="capability-catalog-nav"
            onClick={() => openInfo("capabilities")}
          >
            <OmegaGlyph name="catalog" />
            <span className="omega-nav-copy">
              <strong>Capability Catalog</strong>
              <span>Read-only capability contracts</span>
            </span>
            <span aria-hidden="true" className="omega-nav-meta">›</span>
          </button>
        </div>
      </section>

      <div className="rail-bottom">
        <details className="rail-collapsible system-details">
          <summary><span>System details</span><span aria-hidden="true">›</span></summary>
          <div className="rail-system-card">
            <strong>{productMode === "syn_chat" ? "General Analyst" : "Scientific Analyst"}</strong>
            <span>Evidence, privacy, tools, and validation details</span>
            <label>Profile<select value={profile} onChange={(event) => onProfileChange(event.target.value)}><option>FAST</option><option>BALANCED</option><option>DEEP</option><option>LOCAL</option></select></label>
          </div>
        </details>
        <div
          ref={accountMenuRef}
          className="rail-account-menu-wrap"
          data-testid="account-menu-wrap"
          data-account-menu-dismiss="pointerdown-escape"
        >
          <div
            className="rail-account-menu"
            role="menu"
            aria-label="Account, preferences, and help"
            hidden={!accountMenuOpen}
            data-testid="account-menu"
          >
            {ACCOUNT_DESTINATIONS.map((item) => (
              <button key={item.page} type="button" role="menuitem" onClick={() => openInfo(item.page)}>{item.label}<span aria-hidden="true">›</span></button>
            ))}
            <div className="rail-account-menu-separator" role="separator" />
            <button type="button" role="menuitem" className="rail-settings-entry" onClick={() => { setAccountMenuOpen(false); onOpenSettings(); onMobileClose?.(); }}><span>Settings</span><span aria-hidden="true">›</span></button>
            <div className="rail-preferences" aria-label="Preferences">
              <div className="rail-preferences-heading"><strong>Preferences</strong><span>Thinking level</span></div>
              <div className="rail-preference-options" role="group" aria-label="Thinking preference">
                {THINKING_PREFERENCES.map((option) => (
                  <button
                    key={option.rigor}
                    type="button"
                    role="menuitemradio"
                    aria-checked={chatRigor === option.rigor}
                    className={chatRigor === option.rigor ? "active" : ""}
                    disabled={modeChanging}
                    onClick={() => onPreferenceChange(option.rigor)}
                  >
                    <strong>{option.label}</strong><span>{option.equivalent}</span>
                  </button>
                ))}
              </div>
              <button type="button" role="menuitem" className="rail-preference-action" onClick={onThemeToggle}>Quick theme<span>{theme === "light" ? "Dark" : "Light"}</span></button>
              {user.role === "admin" && <button type="button" role="menuitem" className="rail-preference-action" onClick={() => { setAccountMenuOpen(false); onAdmin(); }}>Administration<span>›</span></button>}
              <button type="button" role="menuitem" className="rail-preference-action" onClick={onLogout}>Sign out<span>↗</span></button>
            </div>
          </div>
          <div className="rail-account-row">
            <div className="rail-account-avatar" aria-hidden="true">{user.initials || user.email.slice(0, 1).toUpperCase()}</div>
            <div className="rail-account-identity">
              <strong>{user.profile.display_name || user.name || "Account"}</strong>
              <span>{user.email}</span>
            </div>
            <button
              ref={accountMenuTriggerRef}
              type="button"
              className="rail-account-trigger"
              aria-label={`Open account menu for ${user.profile.display_name || user.email}`}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              data-testid="account-menu-trigger"
              onClick={() => setAccountMenuOpen((open) => !open)}
            >⋮</button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function ConversationRow({
  conversation,
  active,
  archived,
  menuOpen,
  moveToOpen,
  projects,
  currentProjectId,
  currentProjectTitle,
  menuTriggerRefs,
  onSelect,
  onToggleMenu,
  onToggleMoveTo,
  onRename,
  onProperties,
  onMoveToProject,
  onRemoveFromProject,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  conversation: ConversationRecord;
  active: boolean;
  archived: boolean;
  menuOpen: boolean;
  moveToOpen: boolean;
  projects: Project[];
  currentProjectId: string | null;
  currentProjectTitle?: string;
  menuTriggerRefs: MutableRefObject<Map<string, HTMLButtonElement>>;
  onSelect: () => void;
  onToggleMenu: () => void;
  onToggleMoveTo: () => void;
  onRename: () => void;
  onProperties: () => void;
  onMoveToProject: (projectId: string) => void;
  onRemoveFromProject: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const menuId = `conv_${conversation.id}`;
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (menuOpen) flipMenuIntoViewport(popoverRef.current);
  }, [menuOpen]);
  useEffect(() => {
    if (moveToOpen) flipMenuIntoViewport(submenuRef.current);
  }, [moveToOpen]);

  return (
    <div className="rail-row-wrap" data-menu-container={menuId} data-testid={`chat-row-${conversation.id}`}>
      <button
        type="button"
        className={`rail-item-row rail-chat-row ${active ? "active" : ""}`}
        onClick={onSelect}
        title={conversation.title}
      >
        <span>{conversation.title}</span>
        {archived && <span className="rail-archived-badge">Archived</span>}
      </button>
      <button
        ref={(node) => {
          if (node) menuTriggerRefs.current.set(menuId, node);
        }}
        type="button"
        className="rail-menu-trigger"
        aria-label={`Options for session ${conversation.title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        data-testid={`chat-menu-trigger-${conversation.id}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onToggleMenu();
        }}
      >
        ⋯
      </button>
      {menuOpen && (
        <div ref={popoverRef} className="rail-popover" role="menu" data-testid={`chat-menu-${conversation.id}`}>
          {!archived && (
            <button type="button" role="menuitem" onClick={onRename}>
              Rename
            </button>
          )}
          <button type="button" role="menuitem" onClick={onProperties}>
            Properties
          </button>
          {!archived && (
            <div className="rail-submenu-anchor">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={moveToOpen}
              data-testid={`move-to-${conversation.id}`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleMoveTo();
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (!moveToOpen) onToggleMoveTo();
                }
                if (event.key === "ArrowLeft" && moveToOpen) {
                  event.preventDefault();
                  onToggleMoveTo();
                }
              }}
            >
              Move to <span aria-hidden="true">›</span>
            </button>
            {moveToOpen && (
              <div
                ref={submenuRef}
                className="rail-submenu"
                role="menu"
                aria-label="Move to"
                data-testid={`move-to-menu-${conversation.id}`}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "Escape") {
                    event.stopPropagation();
                    onToggleMoveTo();
                  }
                }}
              >
                {projects.map((project) => (
                  <button
                    key={project.project_id}
                    type="button"
                    role="menuitem"
                    disabled={project.project_id === currentProjectId}
                    onClick={() => onMoveToProject(project.project_id)}
                  >
                    {project.title}
                  </button>
                ))}
                <div className="rail-popover-separator" role="separator" />
                <button type="button" role="menuitem" data-testid={`move-to-archive-${conversation.id}`} onClick={onArchive}>
                    Archive
                </button>
                {(currentProjectId || currentProjectTitle) && (
                  <button type="button" role="menuitem" onClick={onRemoveFromProject}>
                    No project
                  </button>
                )}
              </div>
            )}
          </div>
          )}
          {archived && (
            <button type="button" role="menuitem" onClick={onUnarchive}>
              Unarchive
            </button>
          )}
          <div className="rail-popover-separator" role="separator" />
          <button type="button" role="menuitem" className="rail-delete-action" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export type { WorkflowSelection };
