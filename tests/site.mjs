// Checks the static pages in dist/ (run after `npm run build && npm run build:site`):
// every internal link on every page points at something that exists, every page has a title, description,
// canonical URL and an absolute link-preview image that exists, and the sitemap lists every page.
// Then, in a browser against a server that behaves like GitHub Pages (site under /World-Tracker/, 404.html for
// missing addresses): guessed addresses forward to the right page.
// Run: node tests/site.mjs

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, relative } from "node:path";
import { chromium } from "playwright";

const DIST = "dist";
const SITE_URL = "https://mishiko24.github.io/World-Tracker/";

let failures = 0;
function fail(message) {
  if (failures < 30) console.log(`FAIL  ${message}`);
  failures++;
}

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return ["assets", "data", "cards"].includes(name) ? [] : htmlFiles(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

// A link target exists if it is a file, or a folder with index.html.
function exists(path) {
  return existsSync(path) && (statSync(path).isFile() || existsSync(join(path, "index.html")));
}

const pages = htmlFiles(DIST).filter((p) => !p.endsWith("share-card.html"));
const staticPages = pages.filter((p) => readFileSync(p, "utf8").includes('class="site-header"'));
let links = 0;
for (const file of staticPages) {
  const html = readFileSync(file, "utf8");
  const where = relative(DIST, file);
  for (const tag of ["<title>", 'name="description"', 'rel="canonical"', 'property="og:image"']) {
    if (!html.includes(tag)) fail(`${where}: missing ${tag}`);
  }
  const image = html.match(/property="og:image" content="([^"]+)"/)?.[1];
  if (image !== undefined && !(image.startsWith(SITE_URL) && exists(join(DIST, image.slice(SITE_URL.length))))) {
    fail(`${where}: link-preview image ${image} missing`);
  }
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (/^(https?:|data:|mailto:)/.test(href)) continue;
    links++;
    const target = join(dirname(file), href.replace(/[?#].*$/, ""));
    if (!exists(target)) fail(`${where}: broken link ${href}`);
  }
}

const sitemap = readFileSync(join(DIST, "sitemap.xml"), "utf8");
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const url of listed) {
  if (!url.startsWith(SITE_URL) || !exists(join(DIST, url.slice(SITE_URL.length)))) fail(`sitemap: ${url} doesn't exist`);
}
const countryPages = readdirSync(join(DIST, "country")).length;
const comparePages = readdirSync(join(DIST, "compare")).length;
if (listed.length < countryPages + comparePages) fail(`sitemap lists ${listed.length} URLs, fewer than the pages`);

console.log(`${staticPages.length} static pages, ${links} internal links, ${listed.length} sitemap URLs`);

// ---------- 404 forwarding ----------
const BASE = new URL(SITE_URL).pathname;
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };
const server = createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = url.startsWith(BASE) ? join(DIST, url.slice(BASE.length)) : null;
  if (file !== null && existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  const found = file !== null && existsSync(file);
  res.writeHead(found ? 200 : 404, { "content-type": TYPES[found ? extname(file) : ".html"] ?? "application/octet-stream" });
  res.end(readFileSync(found ? file : join(DIST, "404.html")));
}).listen(4191);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
const page = await browser.newPage();
await page.route("https://static.cloudflareinsights.com/**", (route) => route.abort()); // test runs aren't visits
const guesses = [
  ["compare/usa-vs-russia/", "compare/russia-vs-united-states/"],
  ["compare/united-states-vs-russia", "compare/russia-vs-united-states/"],
  ["compare/geo-vs-arm/", "compare/armenia-vs-georgia/"],
  ["compare/uk-vs-france", "compare/france-vs-united-kingdom/"],
  ["compare/tuvalu-vs-iceland/", "?c=TUV&vs=ISL"], // no page for this pair: open it on the map
  ["country/usa/", "country/united-states/"],
  ["georgia", "country/georgia/"],
  ["country/Côte d'Ivoire/", "country/cote-d-ivoire/"],
];
for (const [guess, expected] of guesses) {
  await page.goto(`http://localhost:4191${BASE}${guess}`);
  await page.waitForLoadState("load");
  const landed = decodeURIComponent(page.url()).replace(`http://localhost:4191${BASE}`, "");
  if (landed !== expected) fail(`404 forwarding: ${guess} -> ${landed}, expected ${expected}`);
}
await page.goto(`http://localhost:4191${BASE}no-such-thing/`);
if (!(await page.textContent("h1")).includes("not found")) fail("unknown address doesn't show the not-found page");
await browser.close();
server.close();
console.log(`${guesses.length} guessed addresses checked`);
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
