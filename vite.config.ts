import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { ANALYTICS_SNIPPET, SITE_URL } from "./src/links.ts";

// Analytics on the site's real pages, in production builds only (not in `npm run dev`).
const ANALYTICS_PAGES = ["index.html", "about.html", "play.html", "embed.html"];
const analytics: Plugin = {
  name: "analytics",
  apply: "build",
  transformIndexHtml(html, context) {
    return ANALYTICS_PAGES.some((page) => context.filename.endsWith(page)) ? html.replace("</head>", `${ANALYTICS_SNIPPET}\n</head>`) : html;
  },
};

// Link-preview image for the map and the about page: cards/home.jpg, drawn by `npm run build:site`
// (scripts/site/cards.ts). Absolute URLs, as link previews require.
const PREVIEW_PAGES: Record<string, string> = { "index.html": "", "about.html": "about.html", "play.html": "play.html" };
const previewImage: Plugin = {
  name: "preview-image",
  apply: "build",
  transformIndexHtml(html, context) {
    const page = Object.keys(PREVIEW_PAGES).find((name) => context.filename.endsWith(name));
    if (page === undefined) {
      return html;
    }
    const meta = [
      `<meta property="og:url" content="${SITE_URL}${PREVIEW_PAGES[page]}" />`,
      `<meta property="og:image" content="${SITE_URL}cards/home.jpg" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
    ].join("\n");
    return html.replace("</head>", `${meta}\n</head>`);
  },
};

export default defineConfig({
  plugins: [react(), analytics, previewImage],
  base: "./", // relative paths, so the build works on GitHub Pages under any repo name
  build: {
    rollupOptions: {
      // Every page of the site. index.html = the map; about.html = Sources & method; play.html = games;
      // embed.html = card for other websites (iframe); share-card.html = headless card renderer for the static
      // pages (scripts/site/cards.ts).
      input: { main: "index.html", about: "about.html", play: "play.html", embed: "embed.html", shareCard: "share-card.html" },
    },
  },
});
