/// <reference types="vite/client" />

declare const __SYNAPSE_FRONTEND_SHA__: string;

declare module "fs" {
  export function readFileSync(path: string | URL, encoding: string): string;
}

interface Window {
  SYNAPSE_THEME_KEY?: string;
}
