// Goods trade from CEPII BACI (Etalab Open Licence 2.0): UN Comtrade flows reconciled between exporter and
// importer, by HS 2022 product (6 digits). One zip (~300 MB) holds a CSV per year (t,i,j,k,v,q; v = thousand
// USD); we stream the newest year through `unzip -p` and keep per-country totals, categories, top products and
// top partners.

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { TRADE_GROUPS, tradeGroupOf, type TradeGroupId } from "../../../src/data/trade.ts";
import { loadCountries } from "../lib/countries.ts";
import { parseCsv } from "../lib/csv.ts";
import { fetchBytes, fetchText, writeCache } from "../lib/io.ts";

const BASE = "https://www.cepii.fr/DATA_DOWNLOAD/baci/data/";
const TOP_PRODUCTS = 8;
const TOP_PARTNERS = 6;

export interface TradeProduct {
  code: string; // HS 2022, 6 digits
  description: string; // HS description (shortened for display by shortProductName)
  usd: number;
  worldRank: number; // among all exporters of this product (importers, for imports)
  worldShare: number; // percent of world trade in this product
}

export interface TradePartner {
  id: string;
  usd: number;
}

export interface TradeEntry {
  year: number;
  exports: number; // goods, US dollars
  imports: number;
  exportsByGroup: Record<TradeGroupId, number>;
  importsByGroup: Record<TradeGroupId, number>;
  topExports: TradeProduct[];
  topImports: TradeProduct[];
  exportPartners: TradePartner[];
  importPartners: TradePartner[];
}

// One side (exports or imports) of every country's trade.
interface Side {
  total: Map<string, number>; // country -> USD
  byGroup: Map<string, Record<TradeGroupId, number>>;
  byProduct: Map<string, Map<string, number>>; // product -> country -> USD
  byPartner: Map<string, Map<string, number>>; // country -> partner -> USD
}

function emptySide(): Side {
  return { total: new Map(), byGroup: new Map(), byProduct: new Map(), byPartner: new Map() };
}

function add(side: Side, country: string, partner: string | undefined, product: string, group: TradeGroupId, usd: number): void {
  side.total.set(country, (side.total.get(country) ?? 0) + usd);
  const groups = side.byGroup.get(country) ?? (Object.fromEntries(TRADE_GROUPS.map((g) => [g.id, 0])) as Record<TradeGroupId, number>);
  side.byGroup.set(country, groups);
  groups[group] += usd;
  const byCountry = side.byProduct.get(product) ?? new Map<string, number>();
  side.byProduct.set(product, byCountry);
  byCountry.set(country, (byCountry.get(country) ?? 0) + usd);
  if (partner !== undefined) {
    const partners = side.byPartner.get(country) ?? new Map<string, number>();
    side.byPartner.set(country, partners);
    partners.set(partner, (partners.get(partner) ?? 0) + usd);
  }
}

export async function fetchTrade(): Promise<void> {
  // Newest HS 2022 release, e.g. BACI_HS22_V202601.zip
  const listing = await fetchText(BASE, "BACI file list");
  const versions = [...listing.matchAll(/BACI_HS22_V(\d{6})\.zip/g)].map((m) => m[1]).sort();
  const version = versions.at(-1);
  if (version === undefined) {
    throw new Error(`BACI: no BACI_HS22_V*.zip in ${BASE}`);
  }
  const zipPath = join(mkdtempSync(join(tmpdir(), "baci-")), "baci.zip");
  writeFileSync(zipPath, await fetchBytes(`${BASE}BACI_HS22_V${version}.zip`, `BACI HS22 ${version}`));
  const entries = (await unzipText(["-Z1", zipPath])).trim().split("\n");

  // BACI country codes (numeric) -> our ids, by ISO3. "S19" = "Other Asia, not elsewhere specified", which is how
  // UN trade statistics report Taiwan.
  const ourId = new Map(loadCountries().flatMap((c) => (c.iso3 === null ? [] : [[c.iso3, c.id] as const])));
  ourId.set("S19", "TWN");
  const countryOf = new Map<string, string>();
  for (const row of parseCsv(await unzipText(["-p", zipPath, entry(entries, /^country_codes/)]))) {
    const id = ourId.get(row.country_iso3);
    if (id !== undefined) {
      countryOf.set(row.country_code, id);
    }
  }
  const descriptions = new Map(parseCsv(await unzipText(["-p", zipPath, entry(entries, /^product_codes/)])).map((r) => [r.code, r.description]));

  const yearFile = entries.filter((e) => /_Y\d{4}_/.test(e)).sort().at(-1)!;
  const year = Number(/_Y(\d{4})_/.exec(yearFile)![1]);
  const exports = emptySide();
  const imports = emptySide();
  let rows = 0;
  const unzip = spawn("unzip", ["-p", zipPath, yearFile]);
  for await (const line of createInterface({ input: unzip.stdout })) {
    if (rows++ === 0) {
      if (line !== "t,i,j,k,v,q") {
        throw new Error(`BACI ${yearFile}: unexpected header "${line}"`);
      }
      continue;
    }
    const [, i, j, k, v] = line.split(","); // numbers only, never quoted
    const exporter = countryOf.get(i);
    const importer = countryOf.get(j);
    const usd = Number(v) * 1000;
    const group = tradeGroupOf(k);
    if (exporter !== undefined) {
      add(exports, exporter, importer, k, group, usd);
    }
    if (importer !== undefined) {
      add(imports, importer, exporter, k, group, usd);
    }
  }
  console.log(`  BACI ${version}, ${year}: ${rows - 1} flows`);

  const byCountry: Record<string, TradeEntry> = {};
  for (const id of new Set([...exports.total.keys(), ...imports.total.keys()])) {
    byCountry[id] = {
      year,
      exports: exports.total.get(id) ?? 0,
      imports: imports.total.get(id) ?? 0,
      exportsByGroup: exports.byGroup.get(id) ?? zeroGroups(),
      importsByGroup: imports.byGroup.get(id) ?? zeroGroups(),
      topExports: topProducts(exports, id, descriptions),
      topImports: topProducts(imports, id, descriptions).slice(0, 5),
      exportPartners: topPartners(exports, id),
      importPartners: topPartners(imports, id),
    };
  }
  for (const id of ["CHL", "DEU", "USA"]) {
    const t = byCountry[id];
    console.log(`  ${id}: exports $${(t.exports / 1e9).toFixed(1)} bn, top ${t.topExports[0]?.description.slice(0, 40)} (#${t.topExports[0]?.worldRank})`);
  }
  writeCache("trade", byCountry);
}

function zeroGroups(): Record<TradeGroupId, number> {
  return Object.fromEntries(TRADE_GROUPS.map((g) => [g.id, 0])) as Record<TradeGroupId, number>;
}

function topProducts(side: Side, id: string, descriptions: Map<string, string>): TradeProduct[] {
  const own: [string, number][] = [];
  for (const [product, byCountry] of side.byProduct) {
    const usd = byCountry.get(id);
    if (usd !== undefined) {
      own.push([product, usd]);
    }
  }
  return own
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_PRODUCTS)
    .map(([code, usd]) => {
      const all = [...side.byProduct.get(code)!.values()];
      const world = all.reduce((sum, v) => sum + v, 0);
      const description = descriptions.get(code);
      if (description === undefined) {
        throw new Error(`BACI: no description for product ${code}`);
      }
      return { code, description, usd, worldRank: all.filter((v) => v > usd).length + 1, worldShare: (usd / world) * 100 };
    });
}

function topPartners(side: Side, id: string): TradePartner[] {
  return [...(side.byPartner.get(id) ?? new Map<string, number>())]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_PARTNERS)
    .map(([partner, usd]) => ({ id: partner, usd }));
}

function entry(entries: string[], pattern: RegExp): string {
  const found = entries.find((e) => pattern.test(e));
  if (found === undefined) {
    throw new Error(`BACI zip: no file matching ${pattern} in ${entries.join(", ")}`);
  }
  return found;
}

function unzipText(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("unzip", args);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`unzip ${args.join(" ")}: ${err}`))));
  });
}
