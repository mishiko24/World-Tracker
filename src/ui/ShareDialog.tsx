// Share dialog: preview of the share card plus Copy link / Download image / Share… (native share sheet,
// shown only where the browser can share files: mostly phones).
// The link is the country's or the comparison's static page (src/data/sitePages.ts), because chat apps show those
// with the share card as preview; a pair without a page gets the map's own URL (?c=A&vs=B, urlState.ts).
// One country: tabs pick the card (Overview, World rankings, Then and now); the link is the same.
// "Embed on a website": iframe code for embed.html (src/share/embed.ts), dark or light.
// Frame, preview and buttons: ShareParts.tsx.

import { useEffect, useMemo, useState } from "react";
import { worldRanks, type WorldRank } from "../data/rankings";
import { comparePagePath, countryPagePath, hasComparePage, type Nearby } from "../data/sitePages";
import { useDataMeta } from "../data/useDataMeta";
import { useSummaries } from "../data/useSummaries";
import { SITE_URL } from "../links";
import { embedCode, type EmbedTheme } from "../share/embed";
import { drawRankingsCard, drawShareCard, drawThenNowCard, loadCardAssets, shareFileName, type CardSide } from "../share/shareCard";
import { thenNowRows } from "../share/thenNowCard";
import { columnGroups, numberColumns } from "./list/columns";
import { DialogFrame, SharePreviewActions, siteLabel, siteUrl, useCardImage } from "./ShareParts";

type CardKind = "overview" | "rankings" | "thenNow";

const KIND_LABELS: Record<CardKind, string> = { overview: "Overview", rankings: "World rankings", thenNow: "Then and now" };
const KIND_FILE_SUFFIX: Record<CardKind, string | undefined> = { overview: undefined, rankings: "rankings", thenNow: "then-and-now" };

// The country's world rankings, once summary.json and meta.json have loaded.
function useWorldRanks(id: string): WorldRank[] | null {
  const rows = useSummaries();
  const meta = useDataMeta();
  return useMemo(
    () => (rows === null || meta === null ? null : worldRanks(id, rows, numberColumns(columnGroups(meta.resources)))),
    [id, rows, meta],
  );
}

interface ShareDialogProps {
  a: CardSide;
  b: CardSide | null;
  onClose: () => void;
}

// Address of the page to share relative to the site root ("compare/france-vs-germany/", or "?c=TUV&vs=ISL" for a
// pair without a page), or null while nearby.json (which pairs have a page) is loading.
function useSharePath(a: CardSide, b: CardSide | null): string | null {
  const [nearby, setNearby] = useState<Nearby | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/nearby.json`)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`nearby.json: HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(setNearby);
  }, []);
  if (nearby === null) {
    return null;
  }
  if (b === null) {
    return countryPagePath(a.data.name);
  }
  return hasComparePage(nearby, a.data.id, b.data.id) ? comparePagePath(a.data.name, b.data.name) : `?c=${a.data.id}&vs=${b.data.id}`;
}

export function ShareDialog({ a, b, onClose }: ShareDialogProps) {
  const sharePath = useSharePath(a, b);
  const [kind, setKind] = useState<CardKind>("overview");
  const ranks = useWorldRanks(a.data.id);
  const thenNow = useMemo(() => thenNowRows(a.data), [a]);
  const title = b === null ? `${a.country.name} on World Tracker` : `${a.country.name} vs ${b.country.name} on World Tracker`;
  // Tabs for one country; a tab without data (no rankings, too little history) isn't offered.
  const kinds: CardKind[] = b !== null ? [] : ["overview", ...(ranks === null || ranks.length > 0 ? (["rankings"] as const) : []), ...(thenNow.length > 0 ? (["thenNow"] as const) : [])];

  const draw =
    kind === "rankings" && ranks === null
      ? null // drawn once the rankings have loaded
      : async (canvas: HTMLCanvasElement) => {
          const flags = await loadCardAssets(a, b);
          if (kind === "rankings") {
            drawRankingsCard(canvas, a, flags.a, ranks!, siteLabel());
          } else if (kind === "thenNow") {
            drawThenNowCard(canvas, a, flags.a, thenNow, siteLabel());
          } else {
            drawShareCard(canvas, a, b, flags, siteLabel());
          }
        };
  const image = useCardImage(draw, shareFileName(a.country, b?.country ?? null, KIND_FILE_SUFFIX[kind]), [a, b, kind, ranks, thenNow]);

  return (
    <DialogFrame title="Share" onClose={onClose}>
      {kinds.length > 1 && (
        <div className="card-tabs" role="tablist">
          {kinds.map((k) => (
            <button key={k} role="tab" aria-selected={k === kind} className={k === kind ? "active" : undefined} onClick={() => setKind(k)}>
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      )}
      <SharePreviewActions title={title} image={image} shareUrl={sharePath === null ? null : siteUrl(sharePath)} />
      {sharePath !== null && <EmbedSection a={a} b={b} pageUrl={SITE_URL + sharePath} />}
    </DialogFrame>
  );
}

// Collapsed by default: most people share a link; embedding is for site owners.
function EmbedSection({ a, b, pageUrl }: { a: CardSide; b: CardSide | null; pageUrl: string }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<EmbedTheme>("dark");
  const [copied, setCopied] = useState(false);
  const code = embedCode(
    { a: { id: a.data.id, name: a.data.name }, b: b === null ? null : { id: b.data.id, name: b.data.name }, pageUrl },
    theme,
  );
  if (!open) {
    return (
      <button className="embed-toggle" onClick={() => setOpen(true)}>
        Embed on a website ▸
      </button>
    );
  }
  return (
    <section className="embed-section">
      <div className="embed-head">
        <span>Embed on a website</span>
        <span className="embed-themes">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              className={t === theme ? "active" : undefined}
              onClick={() => {
                setTheme(t);
                setCopied(false);
              }}
            >
              {t === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </span>
      </div>
      <textarea className="embed-code" readOnly value={code} rows={4} onFocus={(e) => e.currentTarget.select()} />
      <button className="secondary-button" onClick={() => navigator.clipboard.writeText(code).then(() => setCopied(true))}>
        {copied ? "Code copied" : "Copy code"}
      </button>
    </section>
  );
}
