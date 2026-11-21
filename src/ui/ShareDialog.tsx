// Share dialog: preview of the share card plus Copy link / Download image / Share… (native share sheet,
// shown only where the browser can share files: mostly phones).
// The link is the country's or the comparison's static page (src/data/sitePages.ts), because chat apps show those
// with the share card as preview; a pair without a page gets the map's own URL (?c=A&vs=B, urlState.ts).
// "Embed on a website": iframe code for embed.html (src/share/embed.ts), dark or light.
// Rendered into <body> because the info panel's backdrop-filter would trap a position:fixed child.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { comparePagePath, countryPagePath, hasComparePage, type Nearby } from "../data/sitePages";
import { SITE_URL } from "../links";
import { embedCode, type EmbedTheme } from "../share/embed";
import { drawShareCard, loadCardFlags, shareFileName, type CardSide } from "../share/shareCard";

interface ShareDialogProps {
  a: CardSide;
  b: CardSide | null;
  onClose: () => void;
}

// "mishiko24.github.io/World-Tracker" — what the card prints as the address.
function siteLabel(): string {
  return (window.location.host + window.location.pathname).replace(/\/$/, "");
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
  const shareUrl = sharePath === null ? null : new URL(sharePath, new URL(".", window.location.href)).href; // map page's folder = site root
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const title = b === null ? `${a.country.name} on World Tracker` : `${a.country.name} vs ${b.country.name} on World Tracker`;

  useEffect(() => {
    let url: string | null = null;
    let closed = false;
    loadCardFlags(a, b).then((flags) => {
      if (closed) {
        return;
      }
      const canvas = document.createElement("canvas");
      drawShareCard(canvas, a, b, flags, siteLabel());
      canvas.toBlob((blob) => {
        const png = new File([blob!], shareFileName(a.country, b?.country ?? null), { type: "image/png" });
        url = URL.createObjectURL(png);
        setFile(png);
        setImageUrl(url);
      }, "image/png");
    });
    return () => {
      closed = true;
      if (url !== null) {
        URL.revokeObjectURL(url);
      }
    };
  }, [a, b]);

  // Esc closes the dialog only (App's Esc handler would also clear the selection).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [onClose]);

  function copyLink() {
    navigator.clipboard.writeText(shareUrl!).then(() => {
      setCopied(true);
    });
  }

  function shareNative() {
    navigator.share({ title, text: title, url: shareUrl!, files: [file!] }).catch((e: DOMException) => {
      if (e.name !== "AbortError") {
        throw e; // AbortError = the user closed the share sheet
      }
    });
  }

  const canShareFiles = file !== null && shareUrl !== null && "canShare" in navigator && navigator.canShare({ files: [file] });

  return createPortal(
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog share-dialog" role="dialog" aria-label="Share" onClick={(e) => e.stopPropagation()}>
        <header className="dialog-header">
          <h2>Share</h2>
          <button className="icon-button" onClick={onClose} title="Close">
            ✕
          </button>
        </header>
        <div className="share-preview">{imageUrl === null ? <span className="no-data">Drawing…</span> : <img src={imageUrl} alt={title} />}</div>
        <p className="share-link">{shareUrl ?? "…"}</p>
        <div className="share-actions">
          {canShareFiles && (
            <button className="primary-button" onClick={shareNative}>
              Share…
            </button>
          )}
          <button className="secondary-button" onClick={copyLink} disabled={shareUrl === null}>
            {copied ? "Link copied" : "Copy link"}
          </button>
          {imageUrl !== null && (
            <a className="secondary-button" href={imageUrl} download={file!.name}>
              Download image
            </a>
          )}
        </div>
        {sharePath !== null && <EmbedSection a={a} b={b} pageUrl={SITE_URL + sharePath} />}
      </div>
    </div>,
    document.body,
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
