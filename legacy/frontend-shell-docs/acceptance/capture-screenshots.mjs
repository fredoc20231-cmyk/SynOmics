import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const OUT = "/workspace/frontend/acceptance/layout";
const ART = "/opt/cursor/artifacts/screenshots";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(ART, { recursive: true });

const shots = [
  { name: "casual", gallery: "casual", viewport: { width: 1440, height: 900 } },
  { name: "science", gallery: "science", viewport: { width: 1280, height: 800 } },
  { name: "deep-science", gallery: "deep", viewport: { width: 1440, height: 900 } },
  { name: "analyze", gallery: "analyze", viewport: { width: 1280, height: 800 } },
  { name: "governed-compute", gallery: "compute", viewport: { width: 1280, height: 800 } },
  { name: "model-unavailable", gallery: "unavailable", viewport: { width: 1280, height: 800 } },
  { name: "references-expanded", gallery: "references", viewport: { width: 1280, height: 900 } },
  { name: "legal-disclaimer", gallery: "legal", viewport: { width: 1280, height: 900 } },
  { name: "mobile", gallery: "casual", viewport: { width: 390, height: 844 } },
];

const browser = await chromium.launch({ channel: "chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5173/#/acceptance", { waitUntil: "networkidle" });
await page.waitForSelector("[data-testid='acceptance-gallery']", { timeout: 15000 });

for (const shot of shots) {
  await page.setViewportSize(shot.viewport);
  const section = page.locator(`[data-gallery="${shot.gallery}"]`);
  await section.scrollIntoViewIfNeeded();
  const file = `${shot.name}.png`;
  await section.screenshot({ path: path.join(OUT, file) });
  fs.copyFileSync(path.join(OUT, file), path.join(ART, file));
  console.log("wrote", file, shot.viewport.width);
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.screenshot({ path: path.join(OUT, "gallery-desktop.png"), fullPage: true });
fs.copyFileSync(path.join(OUT, "gallery-desktop.png"), path.join(ART, "gallery-desktop.png"));

await browser.close();
