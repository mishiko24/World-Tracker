import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { ANALYTICS_SNIPPET } from "./src/links.ts";

// Analytics on the site's real pages, in production builds only (not in `npm run dev`).
const ANALYTICS_PAGES = ["index.html", "about.html"];
const analytics: Plugin = {
  name: "analytics",
  apply: "build",
  transformIndexHtml(html, context) {
    return ANALYTICS_PAGES.some((page) => context.filename.endsWith(page)) ? html.replace("</head>", `${ANALYTICS_SNIPPET}\n</head>`) : html;
  },
};

export default defineConfig({
  plugins: [react(), analytics],
  base: "./", // relative paths, so the build works on GitHub Pages under any repo name
  build: {
    rollupOptions: {
      // Every page of the site. index.html = the map; about.html = Sources & method;
      // share-card.html = headless card renderer for the static pages (scripts/site/cards.ts).
      input: { main: "index.html", about: "about.html", shareCard: "share-card.html" },
    },
  },
});
