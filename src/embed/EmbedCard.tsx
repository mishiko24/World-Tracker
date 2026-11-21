// Embeddable card (embed.html, shown in an iframe on other websites). ?c=FRA for one country, &vs=DEU for a
// comparison, &theme=light for light pages. Everything links to World Tracker in a new tab.
//
//   one country   flag, name, Power Level + rank, four key facts
//   comparison    both flags and names (underlined in their colors), Power Level and four facts as two bars each,
//                 better value teal, how much more/less B has (same rules as the app: ui/info/Compare.tsx)

import { useEffect, useState } from "react";
import type { CountryData } from "../data/countryData";
import { comparePagePath, countryPagePath, hasComparePage, type Nearby } from "../data/sitePages";
import { SITE_URL } from "../links";
import { flagUrl } from "../ui/Flag";
import { barWidths, difference, winner, type Comparison, type DiffMode } from "../ui/info/Compare";
import { dollars, shortNumber } from "../ui/info/formatData";

interface Fact {
  label: string;
  get: (d: CountryData) => number | null;
  format: (v: number) => string;
  mode?: DiffMode;
}

const FACTS: Fact[] = [
  { label: "Population", get: (d) => d.population.total?.value ?? null, format: (v) => shortNumber(v) },
  { label: "GDP", get: (d) => d.economy.gdp?.value ?? null, format: dollars },
  { label: "GDP per person", get: (d) => d.economy.gdpPerCapita?.value ?? null, format: dollars },
  { label: "Life expectancy", get: (d) => d.population.lifeExpectancy?.value ?? null, format: (v) => `${v.toFixed(1)} years`, mode: "years" },
];

// Relative difference: the "score" mode compares whole points, which reads "same" for 27.9 vs 27.5.
const POWER_LEVEL: Fact = { label: "Power Level", get: (d) => d.powerLevel?.score ?? null, format: (v) => v.toFixed(1) };

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

interface Loaded {
  a: CountryData;
  b: CountryData | null;
  pageUrl: string; // where "World Tracker" links: the static page, or the map for a pair without one
}

function useEmbedData(): Loaded | null {
  const [data, setData] = useState<Loaded | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const aId = params.get("c");
    const bId = params.get("vs");
    if (aId === null) {
      throw new Error("embed.html needs ?c=<country id>");
    }
    Promise.all([
      fetchJson<CountryData>(`data/countries/${aId}.json`),
      bId === null ? null : fetchJson<CountryData>(`data/countries/${bId}.json`),
      fetchJson<Nearby>("data/nearby.json"),
    ]).then(([a, b, nearby]) => {
      const path =
        b === null
          ? countryPagePath(a.name)
          : hasComparePage(nearby, a.id, b.id)
            ? comparePagePath(a.name, b.name)
            : `?c=${a.id}&vs=${b.id}`;
      setData({ a, b, pageUrl: SITE_URL + path });
    });
  }, []);
  return data;
}

export function EmbedCard() {
  const data = useEmbedData();
  const theme = new URLSearchParams(window.location.search).get("theme") === "light" ? "light" : "dark";
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  if (data === null) {
    return null;
  }
  const { a, b, pageUrl } = data;
  return (
    <a className="embed" href={pageUrl} target="_blank" rel="noopener">
      {b === null ? <Single d={a} /> : <Compared a={a} b={b} />}
      <footer>
        <span className="brand">World Tracker</span>
        <span className="more">{b === null ? "More about" : "Full comparison"} →</span>
      </footer>
    </a>
  );
}

function Single({ d }: { d: CountryData }) {
  const level = d.powerLevel;
  return (
    <>
      <header>
        <img className="flag" src={flagUrl(d.id)} alt="" />
        <h1>{d.name}</h1>
      </header>
      <div className="power">
        <span className="power-label">Power Level</span>
        <span className="power-score">{level === null ? "—" : level.score.toFixed(1)}</span>
        {level !== null && (
          <span className="power-rank">
            #{level.rank} of {level.of}
          </span>
        )}
      </div>
      <div className="facts">
        {FACTS.map((f) => {
          const v = f.get(d);
          return (
            <div key={f.label}>
              <span className="fact-label">{f.label}</span>
              <span className="fact-value">{v === null ? "—" : f.format(v)}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Compared({ a, b }: { a: CountryData; b: CountryData }) {
  return (
    <>
      <header className="versus">
        <img className="flag" src={flagUrl(a.id)} alt="" />
        <h1 className="keyed a">{a.name}</h1>
        <span className="vs">vs</span>
        <img className="flag" src={flagUrl(b.id)} alt="" />
        <h1 className="keyed b">{b.name}</h1>
      </header>
      {[POWER_LEVEL, ...FACTS].map((f) => (
        <BarRow key={f.label} fact={f} compare={{ a: f.get(a), b: f.get(b), format: f.format, mode: f.mode }} />
      ))}
    </>
  );
}

function BarRow({ fact, compare }: { fact: Fact; compare: Comparison }) {
  const win = winner(compare);
  const [widthA, widthB] = barWidths(compare);
  const diff = difference(compare);
  const value = (v: number | null) => (v === null ? "—" : compare.format(v));
  return (
    <div className="bar-row">
      <span className="fact-label">{fact.label}</span>
      <span className="bars">
        <span className="bar a">
          <span style={{ width: `${widthA}%` }} />
        </span>
        <span className={win === "a" ? "bar-value win" : "bar-value"}>{value(compare.a)}</span>
        <span className="bar b">
          <span style={{ width: `${widthB}%` }} />
        </span>
        <span className={win === "b" ? "bar-value win" : "bar-value"}>{value(compare.b)}</span>
      </span>
      <span className="diff">{diff ?? ""}</span>
    </div>
  );
}
