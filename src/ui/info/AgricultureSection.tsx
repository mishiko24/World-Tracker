// Agriculture: biggest products by tonnage, and products where the country is a world top-10 producer.
// In comparison mode each product also shows the other country's tonnage of the same product.

import type { Agriculture, CountryData, Crop } from "../../data/countryData";
import { FactRow, sourceTooltip } from "./FactRow";
import { share, tonnes } from "./formatData";
import { cropHint } from "./hints";

interface AgricultureSectionProps {
  agriculture: Agriculture | null;
  other: CountryData | null;
}

export function AgricultureSection({ agriculture, other }: AgricultureSectionProps) {
  if (agriculture === null) {
    return <p className="no-data">No data</p>;
  }
  // undefined = not comparing; [] = the other country has no agriculture data
  const otherCrops = other === null ? undefined : (other.agriculture?.all ?? []);
  const tooltip = sourceTooltip(agriculture.year, agriculture.source);
  return (
    <>
      <div className="data-group" title={tooltip}>
        <div className="data-group-title">Largest products</div>
        {agriculture.largest.map((c) => (
          <CropRow key={c.name} crop={c} otherCrops={otherCrops} />
        ))}
      </div>
      {agriculture.worldLeading.length > 0 && (
        <div className="data-group" title={tooltip}>
          <div className="data-group-title">World top-10 producer of</div>
          {agriculture.worldLeading.map((c) => (
            <CropRow key={c.name} crop={c} otherCrops={otherCrops} />
          ))}
        </div>
      )}
    </>
  );
}

function CropRow({ crop, otherCrops }: { crop: Crop; otherCrops: Crop[] | undefined }) {
  const other = otherCrops?.find((c) => c.name === crop.name) ?? null;
  return (
    <FactRow
      label={crop.name}
      hint={cropHint(crop.name)}
      value={tonnes(crop.tonnes)}
      meta={`#${crop.worldRank} world · ${share(crop.worldShare)}`}
      compare={otherCrops === undefined ? undefined : { a: crop.tonnes, b: other?.tonnes ?? null, format: tonnes }}
    />
  );
}
