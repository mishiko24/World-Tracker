// Wikidata SPARQL (CC0, no key). Current head of state / government and their parties,
// plus each country's World Factbook code (used by fetch/factbook.ts).
//
// "Current" = statement without an end time (P582) and not deprecated. If several remain,
// preferred rank wins, then the latest start time (P580). Old office holders whose statements
// lack end dates (common for past prime ministers) lose to the newer start date.

import { loadCountries } from "../lib/countries.ts";
import { fetchJson, writeCache } from "../lib/io.ts";

export interface WikidataEntry {
  headOfState: string | null;
  headOfStateParty: string | null;
  headOfGovernment: string | null;
  headOfGovernmentParty: string | null;
  factbookCode: string | null;
}

interface Binding {
  [variable: string]: { value: string } | undefined;
}

interface Candidate {
  key: string; // country or person QID the statement belongs to
  item: string; // QID of the value (person or party)
  label: string;
  preferred: boolean;
  start: string; // ISO date or ""
}

const ENDPOINT = "https://query.wikidata.org/sparql";

async function sparql(query: string, label: string): Promise<Binding[]> {
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}`;
  const result = await fetchJson<{ results: { bindings: Binding[] } }>(url, label, {
    Accept: "application/sparql-results+json",
  });
  return result.results.bindings;
}

function qid(uri: string): string {
  return uri.slice(uri.lastIndexOf("/") + 1);
}

// Best current statement per key: preferred rank first, then the latest start date.
function pickCurrent(candidates: Candidate[]): Map<string, Candidate> {
  const best = new Map<string, Candidate>();
  for (const c of candidates) {
    const current = best.get(c.key);
    const better =
      current === undefined ||
      (c.preferred && !current.preferred) ||
      (c.preferred === current.preferred && c.start > current.start);
    if (better) {
      best.set(c.key, c);
    }
  }
  return best;
}

// Statements of `property` on the given items that are still in effect.
async function currentStatements(items: string[], property: string, label: string): Promise<Map<string, Candidate>> {
  const query = `
    SELECT ?item ?value ?valueLabel ?rank ?start WHERE {
      VALUES ?item { ${items.map((q) => `wd:${q}`).join(" ")} }
      ?item p:${property} ?statement .
      ?statement ps:${property} ?value ;
                 wikibase:rank ?rank .
      FILTER(?rank != wikibase:DeprecatedRank)
      FILTER NOT EXISTS { ?statement pq:P582 ?end }
      OPTIONAL { ?statement pq:P580 ?start }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`;
  const rows = await sparql(query, label);
  const candidates = rows.map((r) => ({
    key: qid(r.item!.value),
    item: qid(r.value!.value),
    label: r.valueLabel!.value,
    preferred: r.rank!.value.endsWith("PreferredRank"),
    start: r.start?.value ?? "",
  }));
  return pickCurrent(candidates);
}

export async function fetchWikidata(): Promise<void> {
  const countries = loadCountries();
  const countryQids = countries.map((c) => c.wikidata);

  const heads = await currentStatements(countryQids, "P35", "Wikidata heads of state");
  const governments = await currentStatements(countryQids, "P6", "Wikidata heads of government");

  const people = [...new Set([...heads.values(), ...governments.values()].map((c) => c.item))];
  const parties = await currentStatements(people, "P102", "Wikidata parties");

  const factbookRows = await sparql(
    `SELECT ?item ?code WHERE { VALUES ?item { ${countryQids.map((q) => `wd:${q}`).join(" ")} } ?item wdt:P9948 ?code . }`,
    "Wikidata Factbook codes",
  );
  const factbookCodes = new Map(factbookRows.map((r) => [qid(r.item!.value), r.code!.value]));

  const byCountry: Record<string, WikidataEntry> = {};
  for (const c of countries) {
    const head = heads.get(c.wikidata);
    const government = governments.get(c.wikidata);
    byCountry[c.id] = {
      headOfState: head?.label ?? null,
      headOfStateParty: head ? (parties.get(head.item)?.label ?? null) : null,
      headOfGovernment: government?.label ?? null,
      headOfGovernmentParty: government ? (parties.get(government.item)?.label ?? null) : null,
      factbookCode: factbookCodes.get(c.wikidata) ?? null,
    };
  }

  const count = (pick: (e: WikidataEntry) => string | null) => Object.values(byCountry).filter((e) => pick(e) !== null).length;
  console.log(`  heads of state ${count((e) => e.headOfState)}, heads of government ${count((e) => e.headOfGovernment)}, factbook codes ${count((e) => e.factbookCode)}`);
  writeCache("wikidata", byCountry);
}
