// Sources & method page (about.html): where every number comes from, its license, when the data was built,
// and how the Power Level is calculated. Linked from the settings panel and the Power Level card (#power-level).
//
// Keep in sync by hand: the Power Level method text below <-> scripts/data/powerLevel.ts,
// and the DATASETS table <-> the fetchers in scripts/data/fetch/. Pillar weights and source licenses
// are read from src/data/countryData.ts, so those can't drift.

import { useDataMeta } from "../data/useDataMeta";
import { COPYRIGHT, REPORT_ISSUE_URL } from "../links";
import { PILLAR_LABELS, PILLAR_ORDER, PILLAR_WEIGHTS, SOURCES, type PillarId, type SourceId } from "../data/countryData";

// What goes into each pillar, in plain words.
const PILLAR_CONTENTS: Record<PillarId, string> = {
  economy:
    "GDP (40%), total GDP at purchasing-power parity (25%), GDP per person at PPP (15%), real growth (10%), inflation (5%, closest to 2% is best), government debt (5%, lower is better)",
  resources:
    "The country's share of world production (60%) and reserves (40%) of oil, gas, coal and strategic minerals such as lithium, cobalt, rare earths and copper, weighted by importance",
  population: "Population size (60%), working-age share (20%), life expectancy (20%)",
  energy: "Total electricity generation (70%) and generation per person (30%)",
  food: "The country's share of world production of staple foods (cereals, oils, meat, milk, sugar…), weighted by importance",
  stability: "The World Bank's political stability score (0–100): perceived likelihood of unrest, political violence or terrorism",
};

// Which source provides what. Order = info panel order.
const DATASETS: { section: string; data: string; source: SourceId }[] = [
  { section: "Government", data: "Government type", source: "factbook" },
  { section: "Government", data: "Head of state, head of government, ruling party", source: "wikidata" },
  { section: "Government", data: "Political stability", source: "worldbank" },
  { section: "Population", data: "Population, density, children per woman, life expectancy, age structure", source: "worldbank" },
  { section: "Population", data: "Median age (and fallbacks where the World Bank has no value)", source: "unwpp" },
  { section: "Economy", data: "GDP and rank, GDP per person (nominal and PPP), growth, inflation, central government debt", source: "worldbank" },
  { section: "Economy", data: "Government budget by function, EU and EFTA countries (% of GDP; dollars with World Bank GDP)", source: "eurostat" },
  { section: "Economy", data: "Government budget by function, other OECD members", source: "oecd" },
  { section: "Military", data: "Military spending (% of GDP, in dollars with World Bank GDP), active personnel", source: "factbook" },
  { section: "Resources", data: "Oil, gas and coal production; coal reserves; oil and gas reserves", source: "eia" },
  { section: "Resources", data: "Mineral production and reserves", source: "usgs" },
  { section: "Agriculture", data: "Crop and livestock production, world ranks and shares", source: "faostat" },
  { section: "Power generation", data: "Electricity generation by source", source: "ember" },
  { section: "Power generation", data: "Access to electricity", source: "worldbank" },
];

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function AboutPage() {
  const meta = useDataMeta();

  return (
    <main className="about">
      <a className="back-link" href="./">
        ← Back to the map
      </a>
      <h1>Sources &amp; method</h1>
      <p className="lead">
        World Tracker shows official and open statistics for every country on one map, and lets you compare any two of them.
        Every number comes from a public source listed below; hover over a value on the map page to see its year and source.
      </p>

      <section className="facts-strip">
        <div>
          <span className="label">Data last updated</span>
          <span className="value">{meta === null ? "…" : formatDate(meta.builtAt)}</span>
        </div>
        <div>
          <span className="label">Update schedule</span>
          <span className="value">Monthly, automatically</span>
        </div>
        <div>
          <span className="label">Countries</span>
          <span className="value">{meta === null ? "…" : meta.countries}</span>
        </div>
      </section>

      <h2>How the data is handled</h2>
      <ul>
        <li>Each value shows the most recent year the source has for that country, so years can differ between countries.</li>
        <li>Missing values are shown as “No data”. Nothing is estimated or filled in by us.</li>
        <li>World Bank values more than six years old are hidden rather than shown as if they were current.</li>
        <li>
          Trend charts (the small chart icon next to a value) show every year since 2000 that the World Bank has for
          population, life expectancy, children per woman, GDP, GDP per person, growth, inflation and access to electricity.
        </li>
        <li>Overseas regions that are legally part of a country are counted with it (French Guiana is part of France).</li>
      </ul>

      <h2 id="power-level">Power Level{meta !== null && <span className="version">version {meta.powerLevelVersion}</span>}</h2>
      <p>
        Power Level is World Tracker’s own 0–100 index of a country’s weight in the world, calculated from the same public
        data as the rest of the site. It is not an official statistic. The country with the highest value of an indicator
        scores 100 on it, and everyone else is placed relative to that.
      </p>
      <table>
        <thead>
          <tr>
            <th>Pillar</th>
            <th>Weight</th>
            <th>What goes in</th>
          </tr>
        </thead>
        <tbody>
          {PILLAR_ORDER.map((pillar) => (
            <tr key={pillar}>
              <td className="strong">{PILLAR_LABELS[pillar]}</td>
              <td className="number">{Math.round(PILLAR_WEIGHTS[pillar] * 100)}%</td>
              <td>{PILLAR_CONTENTS[pillar]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Scaling</h3>
      <ul>
        <li>
          Totals (GDP, population, electricity) are compressed so that giants don’t flatten everyone else: a country with 1% of
          the largest value still scores about 25, not 1.
        </li>
        <li>Per-person values (GDP per person, electricity per person) use a logarithmic scale between the lowest and highest country.</li>
        <li>World shares (resources, food) use a square-root scale.</li>
        <li>If a country is missing data for a pillar, that pillar’s weight is spread over the others. A country needs economy and population data and at least five of the six pillars to be scored, so a single number can't make up most of a score. Places with less data show “Not enough data” instead of a forced score.</li>
      </ul>
      <h3>Limits</h3>
      <ul>
        <li>Military strength is not included: the best military datasets are not licensed for a site like this.</li>
        <li>Size matters a lot. This is why China, the world leader in food, resources and electricity output, ranks first.</li>
        <li>
          The stability score is based on expert and survey perceptions, not on hard counts. It measures the risk of unrest,
          not democracy or freedom, so tightly controlled states can score well.
        </li>
        <li>When the formula changes, the version number above changes too.</li>
      </ul>

      <h2>Sources</h2>
      <table>
        <thead>
          <tr>
            <th>Section</th>
            <th>Data</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {DATASETS.map((d) => (
            <tr key={d.data}>
              <td className="strong">{d.section}</td>
              <td>{d.data}</td>
              <td>
                <a href={SOURCES[d.source].url} target="_blank" rel="noreferrer">
                  {SOURCES[d.source].name}
                </a>
                <span className="license">{SOURCES[d.source].license}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Map</h2>
      <ul>
        <li>
          Country shapes:{" "}
          <a href="https://www.naturalearthdata.com" target="_blank" rel="noreferrer">
            Natural Earth
          </a>{" "}
          (public domain). Borders show who controls a territory in practice, as Natural Earth draws them; they are not a
          statement about disputed claims.
        </li>
        <li>
          Flags:{" "}
          <a href="https://github.com/lipis/flag-icons" target="_blank" rel="noreferrer">
            flag-icons
          </a>{" "}
          (MIT license).
        </li>
        <li>
          Satellite map: NASA Blue Marble imagery via{" "}
          <a href="https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api" target="_blank" rel="noreferrer">
            NASA GIBS
          </a>
          .
        </li>
      </ul>

      <h2>Found a mistake?</h2>
      <p>
        If a number looks wrong or out of date,{" "}
        <a href={REPORT_ISSUE_URL} target="_blank" rel="noreferrer">
          report it here
        </a>
        . Include the country and the value; we check it against the source.
      </p>

      <h2>Who makes this</h2>
      <p>
        World Tracker is made by Mishiko (AstraBuilds). The site, its design, its texts and the Power Level index are
        not open source: copying or republishing them needs permission. The data belongs to the sources above, under
        their own licences.
      </p>
      <p className="copyright">{COPYRIGHT}</p>
    </main>
  );
}
