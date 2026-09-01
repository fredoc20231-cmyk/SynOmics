import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { execSync } from "node:child_process";

function frontendSha(): string {
  if (process.env.SYNAPSE_FRONTEND_SHA) return process.env.SYNAPSE_FRONTEND_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

export default defineConfig({
  define: {
    __SYNAPSE_FRONTEND_SHA__: JSON.stringify(frontendSha()),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@ui": path.resolve(__dirname, "../src/ui"),
      "react-markdown": path.resolve(__dirname, "node_modules/react-markdown/lib/index.js"),
      "remark-gfm": path.resolve(__dirname, "node_modules/remark-gfm/index.js"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/chat": { target: "http://127.0.0.1:3020", changeOrigin: true },
      "/auth": { target: "http://127.0.0.1:3020", changeOrigin: true },
      "/approve": { target: "http://127.0.0.1:3020", changeOrigin: true },
      "/resolve": { target: "http://127.0.0.1:3020", changeOrigin: true },
      "/api": { target: "http://127.0.0.1:3020", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:3020", changeOrigin: true },
      "/version": { target: "http://127.0.0.1:3020", changeOrigin: true },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
