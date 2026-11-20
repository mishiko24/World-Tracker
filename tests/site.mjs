// Checks the static pages in dist/ (run after `npm run build && npm run build:site`):
// every internal link on every page points at something that exists, every page has a title, description,
// canonical URL and an absolute link-preview image that exists, and the sitemap lists every page.
// Run: node tests/site.mjs

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

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
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
