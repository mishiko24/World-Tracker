// Share dialog: preview of the share card plus Copy link / Download image / Share… (native share sheet,
// shown only where the browser can share files: mostly phones).
// The link is the country's or the comparison's static page (src/data/sitePages.ts), because chat apps show those
// with the share card as preview; a pair without a page gets the map's own URL (?c=A&vs=B, urlState.ts).
// Rendered into <body> because the info panel's backdrop-filter would trap a position:fixed child.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { comparePagePath, countryPagePath, hasComparePage, type Nearby } from "../data/sitePages";
import { drawShareCard, shareFileName, type CardSide } from "../share/shareCard";

interface ShareDialogProps {
  a: CardSide;
  b: CardSide | null;
  onClose: () => void;
}

// "mishiko24.github.io/World-Tracker" — what the card prints as the address.
function siteLabel(): string {
  return (window.location.host + window.location.pathname).replace(/\/$/, "");
}

// Absolute address of the page to share, or null while nearby.json (which pairs have a page) is loading.
function useShareUrl(a: CardSide, b: CardSide | null): string | null {
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
  const siteRoot = new URL(".", window.location.href); // the map page's folder = site root
  if (b === null) {
    return new URL(countryPagePath(a.data.name), siteRoot).href;
  }
  return hasComparePage(nearby, a.data.id, b.data.id)
    ? new URL(comparePagePath(a.data.name, b.data.name), siteRoot).href
    : window.location.href;
}

export function ShareDialog({ a, b, onClose }: ShareDialogProps) {
  const shareUrl = useShareUrl(a, b);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const title = b === null ? `${a.country.name} on World Tracker` : `${a.country.name} vs ${b.country.name} on World Tracker`;

  useEffect(() => {
    const canvas = document.createElement("canvas");
    drawShareCard(canvas, a, b, siteLabel());
    let url: string | null = null;
    canvas.toBlob((blob) => {
      const png = new File([blob!], shareFileName(a.country, b?.country ?? null), { type: "image/png" });
      url = URL.createObjectURL(png);
      setFile(png);
      setImageUrl(url);
    }, "image/png");
    return () => {
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
      </div>
    </div>,
    document.body,
  );
}
