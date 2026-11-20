// 404.html: GitHub Pages serves it for any address that doesn't exist. People guess addresses
// ("compare/usa-vs-russia", "country/uk", "/georgia"), so a small script resolves common names, country codes
// and either order of a pair, then forwards to the real page:
//   compare/<a>-vs-<b>   -> the comparison page if it exists, otherwise the comparison on the map (?c=A&vs=B)
//   country/<x>, /<x>    -> the country page
// Anything else shows a plain "not found" page. Links are absolute (/World-Tracker/...) because the page is
// served at whatever depth the missing address had.

import { SITE_URL } from "../../src/links";
import { escape } from "./html";

// Common names that aren't a country's slug, ISO3 or ISO2 code.
const EXTRA_ALIASES: Record<string, string> = {
  us: "USA",
  america: "USA",
  "united-states-of-america": "USA",
  uk: "GBR",
  britain: "GBR",
  "great-britain": "GBR",
  england: "GBR",
  uae: "ARE",
  emirates: "ARE",
  drc: "COD",
  "dr-congo": "COD",
  czechia: "CZE",
  "ivory-coast": "CIV",
  burma: "MMR",
  holland: "NLD",
  "east-timor": "TLS",
  korea: "KOR",
  turkiye: "TUR",
  macedonia: "MKD",
};

export interface NotFoundInput {
  slugs: Map<string, string>; // country id -> page slug
  codes: Map<string, (string | null)[]>; // country id -> [ISO3, ISO2]
  comparePaths: string[]; // existing "compare/<a>-vs-<b>/" paths
}

export function notFoundPage({ slugs, codes, comparePaths }: NotFoundInput): string {
  const base = new URL(SITE_URL).pathname; // "/World-Tracker/"
  const aliases: Record<string, string> = {};
  for (const [id, slug] of slugs) {
    for (const name of [slug, id, ...codes.get(id)!]) {
      if (name !== null) {
        aliases[name.toLowerCase()] = id;
      }
    }
  }
  for (const [name, id] of Object.entries(EXTRA_ALIASES)) {
    aliases[name] = id;
  }

  const script = `
const BASE = ${JSON.stringify(base)};
const ALIASES = ${JSON.stringify(aliases)};
const SLUGS = ${JSON.stringify(Object.fromEntries(slugs))};
const COMPARE_PATHS = new Set(${JSON.stringify(comparePaths)});
// Same normalization as slugOf() in src/data/sitePages.ts.
function find(name) {
  return ALIASES[name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")];
}
function target(parts) {
  if (parts[0] === "compare" && parts.length >= 2) {
    const names = parts[1].split("-vs-");
    const a = names.length === 2 ? find(names[0]) : undefined;
    const b = names.length === 2 ? find(names[1]) : undefined;
    if (a === undefined || b === undefined || a === b) return null;
    const [first, second] = [SLUGS[a], SLUGS[b]].sort();
    const path = "compare/" + first + "-vs-" + second + "/";
    return COMPARE_PATHS.has(path) ? path : "?c=" + a + "&vs=" + b;
  }
  const name = parts[0] === "country" ? parts[1] : parts.length === 1 ? parts[0] : undefined;
  const id = name === undefined ? undefined : find(name);
  return id === undefined ? null : "country/" + SLUGS[id] + "/";
}
const path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : "";
const found = target(decodeURIComponent(path).toLowerCase().split("/").filter((p) => p !== ""));
if (found !== null) location.replace(BASE + found);
`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Page not found | World Tracker</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="${base}site.css">
<script>${script}</script>
</head>
<body>
<main>
<h1>Page not found</h1>
<p class="lead">There’s no page at this address.</p>
<p><a class="cta" href="${base}">Open the map</a></p>
<p><a href="${base}countries/">${escape("All countries & rankings")}</a></p>
</main>
</body>
</html>
`;
}
