import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantMessageView } from "@ui/components/AssistantMessageView";
import { EpistemicChatApp, RequestErrorCard } from "@ui/components/EpistemicChatApp";
import { emptyAssistantMessage } from "@ui/sse";
import { WorkspaceRail } from "./WorkspaceRail";
import { WorkspaceInfoDialog } from "./WorkspaceInfoDialog";
import { GlobalSettingsDialog } from "./GlobalSettingsDialog";
import { DEFAULT_GLOBAL_SETTINGS, profileForRigor, projectRigor } from "./globalSettings";

const TEST_USER = {
  id: "user_1",
  email: "researcher@synapse.test",
  role: "researcher",
  status: "active" as const,
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

describe("goal-based SYNAPSE product shell", () => {
  it("renders the Omega academic navigation hierarchy with advanced details collapsed", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceRail
        productMode="syn_chat"
        sciencePreset="science_answer"
        chatRigor="professional"
        profile="BALANCED"
        user={TEST_USER}
        theme="light"
        modeChanging={false}
        conversations={[]}
        conversationId={null}
        chatSearch=""
        projects={[]}
        projectId=""
        projectFiles={[]}
        discoveries={[]}
        activeMenuId={null}
        onNewChat={() => undefined}
        onWorkflowChange={() => undefined}
        onProfileChange={() => undefined}
        onPreferenceChange={() => undefined}
        onSearch={() => undefined}
        onAllChats={() => undefined}
        onSelectConversation={() => undefined}
        onNewProject={() => undefined}
        onSelectProject={() => undefined}
        onRenameProject={() => undefined}
        onRenameConversation={() => undefined}
        onDeleteConversation={() => undefined}
        onAssignChatToProject={() => undefined}
        onRemoveChatFromProject={() => undefined}
        onActiveMenu={() => undefined}
        onOpenInspector={() => undefined}
        onOpenInfo={() => undefined}
        onOpenSettings={() => undefined}
        onThemeToggle={() => undefined}
        onAdmin={() => undefined}
        onLogout={() => undefined}
      />,
    );

    for (const label of [
      "Initialize Ω",
      "Search sessions",
      "Recent Sessions",
      "Execution Modes",
      "Trust &amp; Records",
      "Scientific Inspector",
      "Evidence Nexus",
      "Workspaces",
      "Project Vault",
      "Capability Catalog",
      "System details",
    ]) {
      expect(markup).toContain(label);
    }
    for (const mode of ["Casual", "Synthesis", "Deep Cortex", "Synthetic Mapping", "Governed Compute"]) {
      expect(markup).toContain(mode);
    }
    expect(markup).not.toContain("Research tools");
    expect(markup).not.toContain("Science Answer");
    expect(markup).not.toContain("Oncology");
    expect(markup).not.toContain("Genomics");
    expect(markup).not.toContain("Response style");
    expect(markup).toContain('<details class="rail-collapsible system-details">');
    expect(markup).not.toContain("Plugins");
    expect(markup).not.toContain("New Task");
  });

  it("renders an explicit server-backed mode transition without implying automatic rerun", () => {
    const msg = emptyAssistantMessage("msg_escalation");
    msg.text = "This request requires Syn-Science controls.";
    msg.events = [
      {
        type: "escalation.required",
        payload: {
          message: "This request requires Syn-Science controls because it asks for evidence-backed research.",
          suggested_preset: "deep_research",
          automatic_mode_switch: false,
          automatic_preset_change: false,
          execution_attempted: false,
        },
      },
    ];

    const markup = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onFeedback={() => undefined}
        onEscalation={() => undefined}
        onStop={() => undefined}
      />,
    );

    expect(markup).toContain("Stay in Casual");
    expect(markup).not.toContain("This requires Analyze.");
    expect(markup).not.toContain("Use Mode in the left panel");
  });

  it("shows persisted scientific workflows and a functional delete action without title inference", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceRail
        productMode="syn_science"
        sciencePreset="governed_compute"
        chatRigor="professional"
        profile="BALANCED"
        user={TEST_USER}
        theme="light"
        modeChanging={false}
        conversations={[{ id: "conv_1", owner_user_id: "owner", title: "Analysis notes", created_at: 1, updated_at: 1 }]}
        conversationId="conv_1"
        chatSearch=""
        projects={[]}
        projectId=""
        projectFiles={[]}
        discoveries={[]}
        activeMenuId="conv_conv_1"
        onNewChat={() => undefined}
        onWorkflowChange={() => undefined}
        onProfileChange={() => undefined}
        onPreferenceChange={() => undefined}
        onSearch={() => undefined}
        onAllChats={() => undefined}
        onSelectConversation={() => undefined}
        onNewProject={() => undefined}
        onSelectProject={() => undefined}
        onRenameProject={() => undefined}
        onRenameConversation={() => undefined}
        onDeleteConversation={() => undefined}
        onAssignChatToProject={() => undefined}
        onRemoveChatFromProject={() => undefined}
        onActiveMenu={() => undefined}
        onOpenInspector={() => undefined}
        onOpenInfo={() => undefined}
        onOpenSettings={() => undefined}
        onThemeToggle={() => undefined}
        onAdmin={() => undefined}
        onLogout={() => undefined}
      />,
    );
    for (const workflow of ["Casual", "Synthesis", "Deep Cortex", "Synthetic Mapping", "Governed Compute"]) {
      expect(markup).toContain(workflow);
    }
    expect(markup).toContain('data-testid="mode-governed_compute"');
    expect(markup).toContain("does not itself authorize or run anything");
    expect(markup).toContain(">Delete<");
    expect(markup).toContain('role="separator"');
  });

  it("places the user account at the bottom with the requested standard menu and thinking aliases", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceRail
        productMode="syn_chat"
        sciencePreset="science_answer"
        chatRigor="professional"
        profile="BALANCED"
        user={TEST_USER}
        theme="light"
        modeChanging={false}
        conversations={[]}
        conversationId={null}
        chatSearch=""
        projects={[]}
        projectId=""
        projectFiles={[]}
        discoveries={[]}
        activeMenuId={null}
        onNewChat={() => undefined}
        onWorkflowChange={() => undefined}
        onProfileChange={() => undefined}
        onPreferenceChange={() => undefined}
        onSearch={() => undefined}
        onAllChats={() => undefined}
        onSelectConversation={() => undefined}
        onNewProject={() => undefined}
        onSelectProject={() => undefined}
        onRenameProject={() => undefined}
        onRenameConversation={() => undefined}
        onDeleteConversation={() => undefined}
        onAssignChatToProject={() => undefined}
        onRemoveChatFromProject={() => undefined}
        onActiveMenu={() => undefined}
        onOpenInspector={() => undefined}
        onOpenInfo={() => undefined}
        onOpenSettings={() => undefined}
        onThemeToggle={() => undefined}
        onAdmin={() => undefined}
        onLogout={() => undefined}
      />,
    );

    for (const item of ["About SYNAPSE", "FAQs", "Join the team", "Research &amp; educational use", "Terms / Disclaimer", "Privacy", "Intellectual Property", "Preferences"]) {
      expect(markup).toContain(item);
    }
    expect(markup).toContain("Ada Researcher");
    expect(markup).toContain("researcher@synapse.test");
    expect(markup).toContain("Faster");
    expect(markup).toContain("Basic");
    expect(markup).toContain("Balanced");
    expect(markup).toContain("Medium");
    expect(markup).toContain("Deeper");
    expect(markup).toContain("Advanced");
    expect(markup).toContain("Settings");
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('hidden=""');
  });

  it("renders global settings with appearance, billing, usage, projects, and thinking destinations", () => {
    const markup = renderToStaticMarkup(
      <GlobalSettingsDialog
        settings={DEFAULT_GLOBAL_SETTINGS}
        theme="light"
        user={TEST_USER}
        projectCount={2}
        onChange={() => undefined}
        onThemeChange={() => undefined}
        onClose={() => undefined}
      />,
    );
    for (const label of ["Settings", "General", "Appearance", "Billing &amp; usage", "Projects", "Global thinking", "Basic", "Medium", "Advanced", "Faster", "Balanced", "Deeper"]) {
      expect(markup).toContain(label);
    }
  });

  it("maps global and project thinking defaults onto the existing execution profiles", () => {
    expect(profileForRigor("quick")).toBe("FAST");
    expect(profileForRigor("professional")).toBe("BALANCED");
    expect(profileForRigor("scientific")).toBe("DEEP");
    expect(projectRigor({ ...DEFAULT_GLOBAL_SETTINGS, thinking: "scientific", projectThinking: "inherit" })).toBe("scientific");
    expect(projectRigor({ ...DEFAULT_GLOBAL_SETTINGS, thinking: "quick", projectThinking: "professional" })).toBe("professional");
  });

  it("renders the in-app information destinations and truthful capability catalog", () => {
    const about = renderToStaticMarkup(<WorkspaceInfoDialog page="about" onClose={() => undefined} />);
    const join = renderToStaticMarkup(<WorkspaceInfoDialog page="join" onClose={() => undefined} />);
    const catalog = renderToStaticMarkup(<WorkspaceInfoDialog page="capabilities" onClose={() => undefined} />);
    expect(about).toContain("About SYNAPSE");
    expect(about).toContain("academic scientific intelligence workspace");
    expect(join).toContain("Submit a community request");
    expect(join).toContain("SYNAPSE/issues/new/choose");
    expect(catalog).toContain("Capability Catalog");
    expect(catalog).toContain("Listed capability ≠ authorization");
    expect(catalog).toContain("does not invent unavailable manifest records");
  });

  it("puts an accessible question actions menu beside every user question", () => {
    const markup = renderToStaticMarkup(
      <EpistemicChatApp
        conversationId="conv_edit"
        restoredItems={[{ role: "user", id: "user_1", content: "What does BRCA1 do?" }]}
      />,
    );
    expect(markup).toContain('aria-label="Question actions"');
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain("•••");
    expect(markup).not.toContain('aria-label="Edit question"');
    expect(markup).not.toContain('aria-label="Copy question"');
  });

  it("puts durable thinking levels and attachment entry points in the composer", () => {
    const markup = renderToStaticMarkup(
      <EpistemicChatApp conversationId="conv_composer" chatRigor="professional" />,
    );
    expect(markup).toContain('aria-label="Add files or images"');
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('aria-label="Thinking level"');
    expect(markup).toContain('aria-label="Execution mode"');
    expect(markup).toContain('data-testid="mode-selector"');
    expect(markup).toContain(">Casual</span>");
    expect(markup).toContain('<option value="quick">Basic</option>');
    expect(markup).toContain('<option value="professional" selected="">Medium</option>');
    expect(markup).toContain('<option value="scientific">Advanced</option>');
  });

  it("gives Synthetic Mapping a data-aware interface and analysis-specific pipeline", () => {
    const markup = renderToStaticMarkup(
      <EpistemicChatApp
        conversationId="conv_analyze"
        experienceMode="syn_science"
        sciencePreset="analyze"
      />,
    );
    expect(markup).toContain('data-testid="analyze-workbench"');
    expect(markup).toContain("Synthetic Mapping");
    expect(markup).toContain("Dataset required for computed results");
    expect(markup).toContain('data-testid="analyze-attach-data"');
    expect(markup).toContain("Summarize &amp; QC");
    expect(markup).not.toContain('data-testid="governed-compute-workbench"');
  });

  it("gives Governed Compute an explicit authorization boundary and useful templates", () => {
    const markup = renderToStaticMarkup(
      <EpistemicChatApp
        conversationId="conv_compute"
        experienceMode="syn_science"
        sciencePreset="governed_compute"
      />,
    );
    expect(markup).toContain('data-testid="governed-compute-workbench"');
    expect(markup).toContain("Verify first. Execute only with authorization.");
    for (const stage of ["Propose", "Verify", "Authorize", "Execute", "Reconcile"]) {
      expect(markup).toContain(stage);
    }
    expect(markup).toContain('data-testid="compute-mean-template"');
    expect(markup).toContain("Thinking level changes depth, never execution authority.");
    expect(markup).not.toContain('data-testid="analyze-workbench"');
  });

  it("shows the live omega working state only while an answer is active", () => {
    const msg = emptyAssistantMessage("msg_working");
    const active = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        streaming
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onStop={() => undefined}
      />,
    );
    const complete = renderToStaticMarkup(
      <AssistantMessageView
        msg={msg}
        streaming={false}
        onResolve={() => undefined}
        onApproval={() => undefined}
        onFocus={() => undefined}
        onStop={() => undefined}
      />,
    );
    expect(active).toContain('role="status"');
    expect(active).toContain('omega-working-mark');
    expect(active).toContain("Ω");
    expect(complete).not.toContain('omega-working-mark');
  });

  it("renders provider failures as retryable UI state rather than assistant prose", () => {
    const markup = renderToStaticMarkup(
      <RequestErrorCard
        summary="The research service could not be reached."
        technical="Failed to fetch"
        onRetry={() => undefined}
      />,
    );
    expect(markup).toContain("Chat is temporarily unavailable");
    expect(markup).toContain("No answer was substituted.");
    expect(markup).toContain(">Retry<");
    expect(markup).toContain("Technical details");
    expect(markup).not.toContain("assistant-turn");
  });
});
