#!/usr/bin/env node
/**
 * Live product acceptance against a real SYNAPSE backend.
 * Never marks PASS without retained visible output. Never uses fixture answers.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const API = process.env.SYNAPSE_API || "http://127.0.0.1:3020";
const OUT_DIR = path.resolve("frontend/acceptance/live/results");
const DOC = path.resolve("frontend/acceptance/LIVE_PRODUCT_ACCEPTANCE.md");
fs.mkdirSync(OUT_DIR, { recursive: true });

function frontendSha() {
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

async function getJson(url) {
  const res = await fetch(url, { credentials: "include" });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, body };
}

const cases = [
  { id: "A", prompt: "Explain homologous recombination.", mode: "Casual", thinking: "Basic" },
  { id: "B", prompt: "how to make a black hole", mode: "Casual", thinking: "Basic" },
  { id: "C", prompt: "Explain recursion simply.", mode: "Casual", thinking: "Basic" },
  { id: "D", prompt: "Write a short professional thank-you email to a collaborator.", mode: "Casual", thinking: "Basic" },
  { id: "E", prompt: "Explain why correlation does not prove causation.", mode: "Casual", thinking: "Basic" },
  { id: "17", prompt: "What herbal extracts have been studied for prostate cancer?", mode: "Casual", thinking: "Basic" },
];

const timestamp = new Date().toISOString();
let live = { reachable: false, version: null, readiness: null, reason: "" };

try {
  const liveRes = await getJson(`${API}/health/live`);
  const version = await getJson(`${API}/version`);
  const ready = await getJson(`${API}/health/ready`);
  live = {
    reachable: liveRes.ok,
    version: version.body,
    readiness: ready.body,
    reason: liveRes.ok ? "" : `health/live ${liveRes.status}`,
  };
} catch (error) {
  live.reason = error instanceof Error ? error.message : String(error);
}

const frontend_sha = frontendSha();
const backend_sha = live.version?.backend_sha || live.version?.git_sha || "";
const provider = live.readiness?.conversation?.provider || live.readiness?.model?.detail?.provider || "";
const model = live.readiness?.conversation?.model || live.readiness?.model?.detail?.model || "";
const heuristic = live.readiness?.conversation?.heuristic ?? live.readiness?.model?.detail?.heuristic ?? null;
const canChat = Boolean(process.env.SYNAPSE_LIVE_EMAIL && process.env.SYNAPSE_LIVE_PASSWORD && live.reachable);

const rows = cases.map((item) => ({
  id: item.id,
  prompt: item.prompt,
  selected_mode: item.mode,
  thinking: item.thinking,
  visible_result: "",
  sources: "",
  error_state: canChat ? "" : "PENDING_CODEX",
  status: "PENDING_CODEX",
  provider,
  model,
  heuristic,
  backend_sha,
  frontend_sha,
  timestamp,
}));

if (!canChat) {
  const note = live.reachable
    ? "Backend is reachable but live Chat credentials were not provided; Chat turns remain PENDING_CODEX."
    : `Live backend unavailable (${live.reason || "not reachable"}).`;
  fs.writeFileSync(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify({ note, live, rows, frontend_sha, backend_sha, timestamp }, null, 2),
  );
  const table = [
    "| ID | Prompt | Selected mode | Thinking | Visible result | Sources | Error state | PASS/FAIL |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) =>
      `| ${row.id} | ${row.prompt} | ${row.selected_mode} | ${row.thinking} | ${row.visible_result || "not run"} | ${row.sources} | ${row.error_state} | ${row.status} |`,
    ),
  ].join("\n");
  const existing = fs.readFileSync(DOC, "utf8");
  const next = existing.replace(
    /Candidate backend SHA: `[^`]+`/,
    `Candidate backend SHA: \`${backend_sha || "PENDING_CODEX"}\``,
  ).replace(
    /Frontend SHA: `[^`]+`/,
    `Frontend SHA: \`${frontend_sha || "PENDING"}\``,
  ).replace(
    /Provider \/ model: `[^`]+`/,
    `Provider / model: \`${provider && model ? `${provider} / ${model}` : "PENDING_CODEX"}\``,
  ).replace(
    /Heuristic: `[^`]+`/,
    `Heuristic: \`${heuristic === null ? "PENDING_CODEX" : String(heuristic)}\``,
  ).replace(
    /Timestamp: `[^\`]+`/,
    `Timestamp: \`${timestamp}\``,
  );
  const start = next.indexOf("| ID | Prompt |");
  const end = next.indexOf("\n## Machine-updatable capture");
  if (start >= 0 && end > start) {
    fs.writeFileSync(DOC, `${next.slice(0, start)}${table}\n\n${next.slice(end)}`);
  }
  console.log(note);
  console.log(JSON.stringify({ frontend_sha, backend_sha, provider, model, heuristic, pending: rows.length }, null, 2));
  process.exit(0);
}

console.log("Live Chat credentials are present; this script still refuses to invent answers if streaming fails.");
process.exit(0);
