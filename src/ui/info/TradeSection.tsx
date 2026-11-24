// Trade (goods): exports, imports and balance, then an Exports / Imports tab with what the country sells or
// buys (donut by category), its top products (with world rank) and its main partners.
// Comparing: totals and each category's share, paired; product and partner lists are for one country only.

import { useState } from "react";
import type { CountryData, NumberFact, Trade } from "../../data/countryData";
import { TRADE_GROUPS, tradeColor } from "../../data/trade";
import { Flag } from "../Flag";
import { Donut } from "./Donut";
import { FactRow, tooltipText } from "./FactRow";
import { dollars, percent, roundDollars } from "./formatData";

type Side = "exports" | "imports";

const SIDE_TEXT = {
  exports: { group: "exportsByGroup", products: "topExports", partners: "exportPartners", what: "What it sells", top: "Top exports", partnerTitle: "Main buyers", center: "exported" },
  imports: { group: "importsByGroup", products: "topImports", partners: "importPartners", what: "What it buys", top: "Top imports", partnerTitle: "Main suppliers", center: "imported" },
} as const;

function signedDollars(v: number): string {
  return v < 0 ? `−${dollars(-v)}` : `+${dollars(v)}`;
}

function fact(trade: Trade | null, value: (t: Trade) => number): NumberFact | null {
  return trade === null ? null : { value: value(trade), year: trade.year, source: trade.source };
}

export function TradeSection({ trade, other }: { trade: Trade | null; other: CountryData | null }) {
  const [side, setSide] = useState<Side>("exports");
  const b = other === null ? undefined : other.trade;
  const comparing = b !== undefined;
  const rows: [string, (t: Trade) => number, (v: number) => string][] = [
    ["Exports", (t) => t.exports, dollars],
    ["Imports", (t) => t.imports, dollars],
    ["Trade balance", (t) => t.exports - t.imports, signedDollars],
  ];
  return (
    <>
      {rows.map(([label, value, format]) => {
        const fa = fact(trade, value);
        const fb = b === undefined ? undefined : fact(b, value);
        return (
          <FactRow
            key={label}
            label={label}
            value={fa === null ? null : format(fa.value)}
            year={fa?.year}
            source={fa?.source}
            compare={fb === undefined ? undefined : { a: fa?.value ?? null, b: fb?.value ?? null, format, better: label === "Trade balance" ? "none" : undefined }}
          />
        );
      })}
      {(trade !== null || (b !== undefined && b !== null)) && (
        <>
          <div className="tabs">
            <button className={side === "exports" ? "tab active" : "tab"} onClick={() => setSide("exports")}>
              Exports
            </button>
            <button className={side === "imports" ? "tab active" : "tab"} onClick={() => setSide("imports")}>
              Imports
            </button>
          </div>
          {comparing ? <CategoryCompare a={trade} b={b} side={side} /> : trade !== null && <SideDetail trade={trade} side={side} />}
        </>
      )}
    </>
  );
}

function SideDetail({ trade, side }: { trade: Trade; side: Side }) {
  const text = SIDE_TEXT[side];
  const total = trade[side];
  const byGroup = trade[text.group];
  const share = (usd: number) => (total === 0 ? 0 : (usd / total) * 100);
  return (
    <>
      <div className="data-group">
        <div className="data-group-title">{text.what}</div>
        <Donut
          slices={TRADE_GROUPS.map((g) => ({ key: g.id, label: g.label, share: share(byGroup[g.id]), color: tradeColor(g.id) }))}
          rows={TRADE_GROUPS.map((g) => ({
            key: g.id,
            slice: g.id,
            label: g.label,
            hint: tooltipText(`${g.about}.`, trade.year, trade.source)!,
            share: percent(share(byGroup[g.id])),
            amount: roundDollars(byGroup[g.id]),
          }))}
          center={{ value: roundDollars(total), label: `${text.center} (${trade.year})` }}
          ariaLabel={`${text.what}, by category`}
        />
      </div>
      <div className="data-group">
        <div className="data-group-title">{text.top}</div>
        {trade[text.products].map((p) => (
          <FactRow
            key={p.code}
            label={p.name}
            hint={`${p.description}.\n\n${side === "exports" ? "Exporters" : "Importers"} worldwide: #${p.worldRank}, ${percent(p.worldShare)} of world trade in this product.`}
            year={trade.year}
            source={trade.source}
            value={roundDollars(p.usd)}
            meta={p.worldRank <= 10 ? `#${p.worldRank} world · ${percent(p.worldShare)}` : `${percent(share(p.usd))} of ${side}`}
          />
        ))}
      </div>
      <div className="data-group">
        <div className="data-group-title">{text.partnerTitle}</div>
        {trade[text.partners].map((p) => (
          <FactRow
            key={p.id}
            label={
              <span className="partner">
                <Flag id={p.id} /> {p.name}
              </span>
            }
            hint={`${side === "exports" ? "Goods sold to" : "Goods bought from"} ${p.name} in ${trade.year}.`}
            year={trade.year}
            source={trade.source}
            value={roundDollars(p.usd)}
            meta={`${percent(share(p.usd))} of ${side}`}
          />
        ))}
      </div>
    </>
  );
}

// Each category's share of exports (or imports), side by side.
function CategoryCompare({ a, b, side }: { a: Trade | null; b: Trade | null; side: Side }) {
  const group = SIDE_TEXT[side].group;
  const shareOf = (t: Trade | null, id: (typeof TRADE_GROUPS)[number]["id"]): NumberFact | null =>
    t === null || t[side] === 0 ? null : { value: (t[group][id] / t[side]) * 100, year: t.year, source: t.source };
  const pct = (v: number) => percent(v);
  return (
    <div className="data-group">
      <div className="data-group-title">Share of {side}</div>
      {TRADE_GROUPS.map((g) => {
        const fa = shareOf(a, g.id);
        const fb = shareOf(b, g.id);
        return (
          <FactRow
            key={g.id}
            label={g.label}
            hint={`${g.about}. Share of the country's goods ${side}.`}
            value={fa === null ? null : pct(fa.value)}
            year={fa?.year}
            source={fa?.source}
            compare={{ a: fa?.value ?? null, b: fb?.value ?? null, format: pct, mode: "points", better: "none" }}
          />
        );
      })}
    </div>
  );
}
