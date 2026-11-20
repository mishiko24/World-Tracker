// Static pages + link-preview images, added to dist/ after `vite build`. Run with: npm run build:site
// Plain .mjs entry because the page code imports the app's own TypeScript modules (formatters, columns, Power Level
// labels); Vite's module loader runs them in Node without a separate build step.

import { createServer } from "vite";

const DIST = "dist";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const { buildPages } = await vite.ssrLoadModule("/scripts/site/pages.ts");
const { renderCards } = await vite.ssrLoadModule("/scripts/site/cards.ts");
const { SITE_URL } = await vite.ssrLoadModule("/src/links.ts");

const started = Date.now();
const { cards, pages } = buildPages(DIST);
console.log(`${pages} pages written`);
await renderCards(DIST, cards, SITE_URL.replace(/^https:\/\//, "").replace(/\/$/, ""));
console.log(`${cards.length} card images drawn (${((Date.now() - started) / 1000).toFixed(0)} s total)`);
await vite.close();
