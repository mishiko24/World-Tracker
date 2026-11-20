// Draws the link-preview image of every static page (CardJob list from pages.ts) into dist/cards/.
// Serves dist/ with `vite preview`, opens share-card.html in headless Chrome and calls its renderShareCard(),
// so the images come from the same code as the site's Share button.

import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { preview } from "vite";
import type { CardJob } from "./pages";

const PORT = 4190;
const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome"; // preinstalled on GitHub's ubuntu runners

export async function renderCards(dist: string, jobs: CardJob[], siteLabel: string): Promise<void> {
  const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: "error" });
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.goto(`http://localhost:${PORT}/share-card.html`);
  await page.waitForFunction(() => window.shareCardReady === true);

  mkdirSync(`${dist}/cards`, { recursive: true });
  for (const job of jobs) {
    const dataUrl = await page.evaluate(([a, b, label]) => window.renderShareCard(a!, b, label!), [job.a, job.b, siteLabel] as const);
    writeFileSync(`${dist}/${job.file}`, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
  }

  await browser.close();
  await server.close();
}
