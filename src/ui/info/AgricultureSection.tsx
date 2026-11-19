// Agriculture: biggest products by tonnage, and products where the country is a world top-10 producer.

import type { Agriculture, Crop } from "../../data/countryData";
import { SourceNote } from "./FactRow";
import { share, tonnes } from "./formatData";

export function AgricultureSection({ agriculture }: { agriculture: Agriculture | null }) {
  if (agriculture === null) {
    return <p className="no-data">No data</p>;
  }
  return (
    <>
      <div className="data-group">
        <div className="data-group-title">
          Largest products <SourceNote year={agriculture.year} source={agriculture.source} />
        </div>
        {agriculture.largest.map((c) => (
          <CropRow key={c.name} crop={c} />
        ))}
      </div>
      {agriculture.worldLeading.length > 0 && (
        <div className="data-group">
          <div className="data-group-title">World top-10 producer of</div>
          {agriculture.worldLeading.map((c) => (
            <CropRow key={c.name} crop={c} />
          ))}
        </div>
      )}
    </>
  );
}

function CropRow({ crop }: { crop: Crop }) {
  return (
    <div className="fact">
      <span className="fact-label">{crop.name}</span>
      <span className="fact-value">
        {tonnes(crop.tonnes)}
        <span className="fact-meta">
          #{crop.worldRank} world · {share(crop.worldShare)}
        </span>
      </span>
    </div>
  );
}
