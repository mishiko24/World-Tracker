// Which static pages exist and at what address. Shared by the page builder (scripts/site/pages.ts), the data
// pipeline (scripts/data/nearby.ts writes public/data/nearby.json) and the app (Share button links to these pages,
// because their link previews show the share card). Plain TypeScript with no imports, so Node can load it too.
//
//   country/<slug>/          every country
//   compare/<a>-vs-<b>/      every pair with a G20 country, plus each country with its neighbours/nearest countries
//                            (nearby.json); the two slugs in alphabetical order

// Comparison pages exist for every pair that includes one of these (the pairs people search for).
export const G20 = ["ARG", "AUS", "BRA", "CAN", "CHN", "FRA", "DEU", "IND", "IDN", "ITA", "JPN", "KOR", "MEX", "RUS", "SAU", "ZAF", "TUR", "GBR", "USA"];

// Country id -> land neighbours and nearest countries, closest first (public/data/nearby.json).
export type Nearby = Record<string, string[]>;

// "São Tomé and Príncipe" -> "sao-tome-and-principe"
export function slugOf(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function countryPagePath(name: string): string {
  return `country/${slugOf(name)}/`;
}

export function comparePagePath(nameA: string, nameB: string): string {
  const [first, second] = [slugOf(nameA), slugOf(nameB)].sort();
  return `compare/${first}-vs-${second}/`;
}

export function isNearby(nearby: Nearby, a: string, b: string): boolean {
  return nearby[a].includes(b) || nearby[b].includes(a);
}

export function hasComparePage(nearby: Nearby, a: string, b: string): boolean {
  return a !== b && (G20.includes(a) || G20.includes(b) || isNearby(nearby, a, b));
}
