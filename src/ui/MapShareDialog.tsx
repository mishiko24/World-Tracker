// "Share map": the world colored by the current number as an image (src/share/mapCard.ts), linking to that
// map's static page (map/<slug>/, scripts/site/pages.ts). Every number offered in "Color countries by" has one.

import type { ColorScale } from "../map/colorBy";
import type { Country } from "../map/geo";
import { drawMapCard, loadTopFlags } from "../share/mapCard";
import { loadCardFonts } from "../share/shareCard";
import { DialogFrame, SharePreviewActions, siteLabel, siteUrl, useCardImage } from "./ShareParts";

export function MapShareDialog({ scale, countries, onClose }: { scale: ColorScale; countries: Country[]; onClose: () => void }) {
  const title = `World map: ${scale.column.fullLabel}`;
  const image = useCardImage(
    async (canvas) => {
      await loadCardFonts();
      drawMapCard(canvas, countries, scale, await loadTopFlags(scale), siteLabel());
    },
    `world-tracker-map-${scale.column.slug}.png`,
    [scale, countries],
  );
  return (
    <DialogFrame title="Share map" onClose={onClose}>
      <SharePreviewActions title={title} image={image} shareUrl={siteUrl(`map/${scale.column.slug}/`)} />
    </DialogFrame>
  );
}
