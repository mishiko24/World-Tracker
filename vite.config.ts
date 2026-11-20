import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "./", // relative paths, so the build works on GitHub Pages under any repo name
  build: {
    rollupOptions: {
      // Every page of the site. index.html = the map; about.html = Sources & method;
      // share-card.html = headless card renderer for the static pages (scripts/site/cards.ts).
      input: { main: "index.html", about: "about.html", shareCard: "share-card.html" },
    },
  },
});
