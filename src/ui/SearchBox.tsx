// Country search (top center). Type to filter, arrows + Enter or click to pick.
// Matches names and ISO codes ("usa", "deu"); names starting with the query rank first.

import { useState } from "react";
import type { Country } from "../map/geo";

const MAX_RESULTS = 8;

function search(countries: Country[], query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (q === "") {
    return [];
  }
  const scored: { country: Country; score: number }[] = [];
  for (const c of countries) {
    const name = c.name.toLowerCase();
    let score = -1;
    if (name.startsWith(q) || c.iso3?.toLowerCase() === q || c.iso2?.toLowerCase() === q) {
      score = 0;
    } else if (name.split(/[\s-]/).some((word) => word.startsWith(q))) {
      score = 1;
    } else if (name.includes(q)) {
      score = 2;
    }
    if (score >= 0) {
      scored.push({ country: c, score });
    }
  }
  scored.sort((a, b) => a.score - b.score || a.country.name.localeCompare(b.country.name));
  return scored.slice(0, MAX_RESULTS).map((s) => s.country);
}

interface SearchBoxProps {
  countries: Country[];
  onPick: (id: string) => void;
}

export function SearchBox({ countries, onPick }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = search(countries, query);

  function pick(country: Country) {
    onPick(country.id);
    setQuery("");
    setActive(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(active + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(active - 1, 0));
    } else if (e.key === "Enter" && results.length > 0) {
      pick(results[active]);
    } else if (e.key === "Escape") {
      e.stopPropagation(); // don't also deselect the country (App listens for Esc)
      setQuery("");
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <div className="search-box">
      <input
        type="search"
        placeholder="Search countries…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={handleKeyDown}
        aria-label="Search countries"
      />
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((c, i) => (
            <li
              key={c.id}
              className={i === active ? "active" : undefined}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus so the click lands before blur
                pick(c);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
