// Share dialog: preview of the share card plus Copy link / Download image / Share… (native share sheet,
// shown only where the browser can share files: mostly phones).
// The link is the current URL, which already encodes the selection and comparison (urlState.ts).
// Rendered into <body> because the info panel's backdrop-filter would trap a position:fixed child.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

export function ShareDialog({ a, b, onClose }: ShareDialogProps) {
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
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
    });
  }

  function shareNative() {
    navigator.share({ title, text: title, url: window.location.href, files: [file!] }).catch((e: DOMException) => {
      if (e.name !== "AbortError") {
        throw e; // AbortError = the user closed the share sheet
      }
    });
  }

  const canShareFiles = file !== null && "canShare" in navigator && navigator.canShare({ files: [file] });

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
        <div className="share-actions">
          {canShareFiles && (
            <button className="primary-button" onClick={shareNative}>
              Share…
            </button>
          )}
          <button className="secondary-button" onClick={copyLink}>
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
