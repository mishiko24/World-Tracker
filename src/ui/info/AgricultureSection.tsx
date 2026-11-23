// Agriculture: biggest products by tonnage, and products where the country is a world top-10 producer.
// In comparison mode each product also shows the other country's tonnage of the same product.

import type { Agriculture, CountryData, Crop } from "../../data/countryData";
import { FactRow } from "./FactRow";
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
  return (
    <>
      <div className="data-group">
        <div className="data-group-title">Largest products</div>
        {agriculture.largest.map((c) => (
          <CropRow key={c.name} crop={c} otherCrops={otherCrops} agriculture={agriculture} />
        ))}
      </div>
      {agriculture.worldLeading.length > 0 && (
        <div className="data-group">
          <div className="data-group-title">World top-10 producer of</div>
          {agriculture.worldLeading.map((c) => (
            <CropRow key={c.name} crop={c} otherCrops={otherCrops} agriculture={agriculture} />
          ))}
        </div>
      )}
    </>
  );
}

function CropRow({ crop, otherCrops, agriculture }: { crop: Crop; otherCrops: Crop[] | undefined; agriculture: Agriculture }) {
  const other = otherCrops?.find((c) => c.name === crop.name) ?? null;
  return (
    <FactRow
      label={crop.name}
      hint={cropHint(crop.name)}
      year={agriculture.year}
      source={agriculture.source}
      value={tonnes(crop.tonnes)}
      meta={`#${crop.worldRank} world · ${share(crop.worldShare)}`}
      compare={otherCrops === undefined ? undefined : { a: crop.tonnes, b: other?.tonnes ?? null, format: tonnes }}
    />
  );
}
