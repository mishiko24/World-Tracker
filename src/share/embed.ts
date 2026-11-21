// Embed code for other websites: an iframe of embed.html (src/embed/) plus a plain text link under it.
// The plain link matters: links inside an iframe don't count for search engines, this one does.
// Absolute URLs (SITE_URL): the code is pasted on someone else's site.

import { SITE_URL } from "../links";

export type EmbedTheme = "dark" | "light";

// iframe heights, measured from embed.css's layout (the iframe can't size itself to its content). Comparison has
// room for long names wrapping (DR Congo vs Central African Republic); spare space is transparent.
export const EMBED_SIZE = { width: 420, single: 236, comparison: 396 };

export interface EmbedTarget {
  a: { id: string; name: string };
  b: { id: string; name: string } | null;
  pageUrl: string; // absolute: the country/comparison page the plain link points to
}

export function embedCode({ a, b, pageUrl }: EmbedTarget, theme: EmbedTheme): string {
  const query = `c=${a.id}${b === null ? "" : `&vs=${b.id}`}${theme === "light" ? "&theme=light" : ""}`;
  const title = b === null ? a.name : `${a.name} vs ${b.name}`;
  const height = b === null ? EMBED_SIZE.single : EMBED_SIZE.comparison;
  return (
    `<iframe src="${SITE_URL}embed.html?${query}" width="${EMBED_SIZE.width}" height="${height}" ` +
    `style="border:0;max-width:100%" loading="lazy" title="${title}: World Tracker"></iframe>\n` +
    `<p style="font-size:13px;margin:4px 0 0">Data: <a href="${pageUrl}">${title} on World Tracker</a></p>`
  );
}
