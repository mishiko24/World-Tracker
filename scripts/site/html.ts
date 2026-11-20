// HTML helpers for the static pages: escaping, the shared page layout, URLs.
// Every page lives in its own folder (country/france/index.html), so links to the site root are relative ("../../").

import { ABOUT_URL, SITE_URL } from "../../src/links";

export function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Relative path from a page folder back to the site root: "country/france/" -> "../../".
export function rootFrom(path: string): string {
  return "../".repeat(path.split("/").filter((part) => part !== "").length);
}

export interface PageInput {
  path: string; // folder under the site root, with trailing slash: "country/france/"
  title: string; // <title>: what Google shows, with keywords and the site name
  previewTitle: string; // link-preview title in chat apps, which cut long titles and show the site name anyway
  description: string; // meta description and link-preview text, ~160 characters
  image: string; // link-preview image, path under the site root: "cards/fra.jpg"
  body: string; // HTML inside <main>
  builtAt: string; // data date, shown in the footer
}

export function page({ path, title, previewTitle, description, image, body, builtAt }: PageInput): string {
  const root = rootFrom(path);
  const url = SITE_URL + path;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="World Tracker">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escape(previewTitle)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:image" content="${SITE_URL}${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:,">
<link rel="stylesheet" href="${root}site.css">
</head>
<body>
<header class="site-header">
<a class="brand" href="${root}">World Tracker</a>
<nav><a href="${root}">Map</a><a href="${root}countries/">Countries &amp; rankings</a><a href="${root}${ABOUT_URL}">Sources &amp; method</a></nav>
</header>
<main>
${body}
</main>
<footer class="site-footer">Data updated ${escape(formatDate(builtAt))} from the World Bank, UN, FAO, EIA, USGS and others. <a href="${root}${ABOUT_URL}">Sources &amp; method</a></footer>
</body>
</html>
`;
}

export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// 68_516_699 -> "68.5 million", 3.1e12 -> "3.1 trillion". For sentences; tables use formatData.ts.
export function inWords(value: number): string {
  const units: [number, string][] = [
    [1e12, "trillion"],
    [1e9, "billion"],
    [1e6, "million"],
  ];
  for (const [size, word] of units) {
    if (Math.abs(value) >= size) {
      return `${(value / size).toLocaleString("en-US", { maximumFractionDigits: 1 })} ${word}`;
    }
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
