import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "./a11y";
import type { ChatRigor, PublicUser } from "./api";
import type { AccentColor, BackgroundStyle, GlobalSettings, ProjectThinkingDefault } from "./globalSettings";
import type { ThemeMode } from "./theme";

type SettingsSection = "general" | "appearance" | "billing" | "projects";

const SECTIONS: Array<{ id: SettingsSection; label: string; icon: string }> = [
  { id: "general", label: "General", icon: "◌" },
  { id: "appearance", label: "Appearance", icon: "◐" },
  { id: "billing", label: "Billing & usage", icon: "▤" },
  { id: "projects", label: "Projects", icon: "▣" },
];

const THINKING: Array<{ value: ChatRigor; label: string; equivalent: string; copy: string }> = [
  { value: "quick", label: "Basic", equivalent: "Faster", copy: "Shallower reasoning. Chat remains allowed." },
  { value: "professional", label: "Medium", equivalent: "Balanced", copy: "Standard reasoning depth. No extra authority." },
  { value: "scientific", label: "Advanced", equivalent: "Deeper", copy: "Deeper reasoning. Advanced is not higher authority." },
  { value: "discover", label: "Discover", equivalent: "Exploratory", copy: "Competing hypotheses, research gaps, and testable next questions. No extra authority." },
];

const ACCENTS: Array<{ value: AccentColor; label: string }> = [
  { value: "teal", label: "SYNAPSE teal" },
  { value: "blue", label: "Research blue" },
  { value: "violet", label: "Violet" },
  { value: "amber", label: "Amber" },
];

const BACKGROUNDS: Array<{ value: BackgroundStyle; label: string; copy: string }> = [
  { value: "warm", label: "Warm canvas", copy: "Soft neutral workspace" },
  { value: "clean", label: "Clean", copy: "Bright, minimal background" },
  { value: "contrast", label: "High contrast", copy: "Stronger panel separation" },
];

export function GlobalSettingsDialog({
  settings,
  theme,
  user,
  projectCount,
  onChange,
  onThemeChange,
  onClose,
}: {
  settings: GlobalSettings;
  theme: ThemeMode;
  user: PublicUser;
  projectCount: number;
  onChange: (settings: GlobalSettings) => void;
  onThemeChange: (theme: ThemeMode) => void;
  onClose: () => void;
}) {
  const [section, setSection] = useState<SettingsSection>("general");
  const dialogRef = useRef<HTMLElement | null>(null);
  useFocusTrap(dialogRef, true, onClose);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const patch = (next: Partial<GlobalSettings>) => onChange({ ...settings, ...next });

  return (
    <div className="workspace-info-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} className="global-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="global-settings-title" tabIndex={-1}>
        <div className="global-settings-heading">
          <div><span>SYNAPSE-Ω</span><h2 id="global-settings-title">Settings</h2></div>
          <button type="button" aria-label="Close Settings" onClick={onClose}>×</button>
        </div>
        <div className="global-settings-layout">
          <nav className="global-settings-nav" aria-label="Settings sections">
            {SECTIONS.map((item) => (
              <button key={item.id} type="button" className={section === item.id ? "active" : ""} aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}>
                <span aria-hidden="true">{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
          <div className="global-settings-panel">
            {section === "general" && (
              <section aria-labelledby="settings-general-heading">
                <div className="settings-section-heading"><h3 id="settings-general-heading">Global thinking</h3><p>Choose the default reasoning depth for new chats. Individual chats can still override it.</p></div>
                <div className="settings-choice-list" role="radiogroup" aria-label="Global thinking level">
                  {THINKING.map((option) => (
                    <button key={option.value} type="button" role="radio" aria-checked={settings.thinking === option.value} className={settings.thinking === option.value ? "active" : ""} onClick={() => patch({ thinking: option.value })}>
                      <span className="settings-radio-mark" aria-hidden="true" /><span><strong>{option.label}</strong><small>{option.equivalent} · {option.copy}</small></span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {section === "appearance" && (
              <section aria-labelledby="settings-appearance-heading">
                <div className="settings-section-heading"><h3 id="settings-appearance-heading">Appearance</h3><p>Personalize SYNAPSE on this device.</p></div>
                <fieldset className="settings-fieldset"><legend>Theme</legend><div className="settings-segmented">
                  {(["light", "dark"] as ThemeMode[]).map((mode) => <button key={mode} type="button" className={theme === mode ? "active" : ""} aria-pressed={theme === mode} onClick={() => onThemeChange(mode)}>{mode === "light" ? "Light" : "Dark"}</button>)}
                </div></fieldset>
                <fieldset className="settings-fieldset"><legend>Accent color</legend><div className="settings-swatch-grid">
                  {ACCENTS.map((accent) => <button key={accent.value} type="button" className={settings.accent === accent.value ? "active" : ""} aria-pressed={settings.accent === accent.value} onClick={() => patch({ accent: accent.value })}><span className={`settings-swatch ${accent.value}`} aria-hidden="true" />{accent.label}</button>)}
                </div></fieldset>
                <fieldset className="settings-fieldset"><legend>Background</legend><div className="settings-background-grid">
                  {BACKGROUNDS.map((background) => <button key={background.value} type="button" className={settings.background === background.value ? "active" : ""} aria-pressed={settings.background === background.value} onClick={() => patch({ background: background.value })}><strong>{background.label}</strong><span>{background.copy}</span></button>)}
                </div></fieldset>
              </section>
            )}
            {section === "billing" && (
              <section aria-labelledby="settings-billing-heading">
                <div className="settings-section-heading"><h3 id="settings-billing-heading">Billing & usage</h3><p>Workspace plan and metering for {user.email}.</p></div>
                <div className="settings-status-card"><div><span>Current plan</span><strong>Local beta workspace</strong></div><span className="settings-status-badge">Active</span></div>
                <div className="settings-status-card"><div><span>Usage metering</span><strong>Not connected</strong></div><span className="settings-status-muted">—</span></div>
                <button type="button" className="settings-disabled-action" disabled>Billing portal unavailable in this deployment</button>
                <p className="settings-footnote">A billing provider has not been configured. No payment or usage balance is being represented here.</p>
              </section>
            )}
            {section === "projects" && (
              <section aria-labelledby="settings-projects-heading">
                <div className="settings-section-heading"><h3 id="settings-projects-heading">Projects</h3><p>Set the thinking default for new project conversations.</p></div>
                <label className="settings-select-row"><span><strong>Project thinking</strong><small>{projectCount} project{projectCount === 1 ? "" : "s"} in this workspace</small></span><select aria-label="Default project thinking" value={settings.projectThinking} onChange={(event) => patch({ projectThinking: event.target.value as ProjectThinkingDefault })}><option value="inherit">Use global default</option><option value="quick">Basic · Faster</option><option value="professional">Medium · Balanced</option><option value="scientific">Advanced · Deeper</option><option value="discover">Discover · Exploratory</option></select></label>
                <p className="settings-footnote">This applies when SYNAPSE creates a new conversation inside a project. Existing project conversations keep their saved thinking level.</p>
              </section>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
