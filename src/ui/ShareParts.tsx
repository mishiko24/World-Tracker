// Building blocks of the share dialogs (ShareDialog: countries, MapShareDialog: a colored world map):
// the dialog frame, the drawn card as an image file, its preview, and Share… / Copy link / Download image.

import { useEffect, useState, type DependencyList, type ReactNode } from "react";
import { createPortal } from "react-dom";

// "mishiko24.github.io/World-Tracker" — what the cards print as the address.
export function siteLabel(): string {
  return (window.location.host + window.location.pathname).replace(/\/$/, "");
}

// A page path relative to the site root ("compare/france-vs-germany/") as a full URL (the map page's folder is
// the site root).
export function siteUrl(path: string): string {
  return new URL(path, new URL(".", window.location.href)).href;
}

// Rendered into <body> because the info panel's backdrop-filter would trap a position:fixed child.
// Esc closes the dialog only (App's Esc handler would also clear the selection).
export function DialogFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
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

  return createPortal(
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog share-dialog" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="dialog-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} title="Close">
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export interface CardImage {
  file: File;
  url: string; // object URL for the preview and the download link
}

// Draws a card (draw = null: not ready yet) and keeps it as a PNG file; redrawn when deps change.
export function useCardImage(draw: ((canvas: HTMLCanvasElement) => Promise<void>) | null, fileName: string, deps: DependencyList): CardImage | null {
  const [image, setImage] = useState<CardImage | null>(null);
  useEffect(() => {
    if (draw === null) {
      return;
    }
    let url: string | null = null;
    let closed = false;
    setImage(null);
    const canvas = document.createElement("canvas");
    draw(canvas).then(() => {
      if (closed) {
        return;
      }
      canvas.toBlob((blob) => {
        const file = new File([blob!], fileName, { type: "image/png" });
        url = URL.createObjectURL(file);
        setImage({ file, url });
      }, "image/png");
    });
    return () => {
      closed = true;
      if (url !== null) {
        URL.revokeObjectURL(url);
      }
    };
  }, deps); // the caller lists what the drawing depends on
  return image;
}

// Preview, the link, and the buttons. shareUrl = null while it's being worked out.
export function SharePreviewActions({ title, image, shareUrl }: { title: string; image: CardImage | null; shareUrl: string | null }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(shareUrl!).then(() => {
      setCopied(true);
    });
  }

  function shareNative() {
    navigator.share({ title, text: title, url: shareUrl!, files: [image!.file] }).catch((e: DOMException) => {
      if (e.name !== "AbortError") {
        throw e; // AbortError = the user closed the share sheet
      }
    });
  }

  const canShareFiles = image !== null && shareUrl !== null && "canShare" in navigator && navigator.canShare({ files: [image.file] });

  return (
    <>
      <div className="share-preview">{image === null ? <span className="no-data">Drawing…</span> : <img src={image.url} alt={title} />}</div>
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
        {image !== null && (
          <a className="secondary-button" href={image.url} download={image.file.name}>
            Download image
          </a>
        )}
      </div>
    </>
  );
}
