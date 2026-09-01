export const PORTAL_HASH_PREFIX = "#/synapse";

export const PORTAL_SECTIONS = [
  "home",
  "architecture",
  "manual",
  "modes",
  "evidence",
  "install",
  "local-models",
  "projects",
  "voice",
  "troubleshooting",
] as const;

export type PortalSection = (typeof PORTAL_SECTIONS)[number];

export const PORTAL_SECTION_IDS: Record<PortalSection, string> = {
  home: "synapse-hero",
  architecture: "synapse-architecture",
  manual: "synapse-manual",
  modes: "synapse-modes",
  evidence: "synapse-evidence",
  install: "synapse-install",
  "local-models": "synapse-local-models",
  projects: "synapse-projects",
  voice: "synapse-voice",
  troubleshooting: "synapse-troubleshooting",
};

export function isPortalSection(value: string): value is PortalSection {
  return (PORTAL_SECTIONS as readonly string[]).includes(value);
}

export function portalSectionFromHash(hash: string): PortalSection | null {
  const trimmed = hash.trim();
  const match = trimmed.match(/^#\/synapse(?:\/([A-Za-z0-9-]+))?\/?$/);
  if (!match) return null;
  const rest = match[1];
  if (!rest) return "home";
  return isPortalSection(rest) ? rest : "home";
}

export function portalHash(section: PortalSection = "home"): string {
  return section === "home" ? PORTAL_HASH_PREFIX : `${PORTAL_HASH_PREFIX}/${section}`;
}

export function isPortalHash(hash: string): boolean {
  return portalSectionFromHash(hash) !== null;
}
