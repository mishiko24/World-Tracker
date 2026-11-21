// Links between the site's pages and to the issue tracker. Relative, so they work under any base path.

// Absolute address of the published site. Only for things that must be absolute: canonical URLs, link-preview
// images, the sitemap (scripts/site). Change here if the site moves to its own domain.
export const SITE_URL = "https://mishiko24.github.io/World-Tracker/";

export const ABOUT_URL = "about.html";
export const POWER_LEVEL_METHOD_URL = "about.html#power-level";
export const REPORT_ISSUE_URL = "https://github.com/mishiko24/World-Tracker/issues/new";
export const COUNTRIES_URL = "countries/"; // static hub page: every country and every ranking (scripts/site)

// Cloudflare Web Analytics (free, cookieless: no consent banner needed). Dashboard: dash.cloudflare.com ->
// Analytics & Logs -> Web Analytics. The token is public by design (it's in every page's HTML).
// Added to index.html and about.html by vite.config.ts and to the static pages by scripts/site/html.ts;
// not to 404.html (it only forwards) or share-card.html (build tool), so visits aren't counted twice.
export const ANALYTICS_SNIPPET = `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "df73664960414aeabfe2e8650f1bfa83"}'></script>`;
