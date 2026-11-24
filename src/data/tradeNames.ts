// Short names for the HS 2022 products that most often top a country's exports or imports (the official
// descriptions run to 100+ characters). Others fall back to the description's heading; see productName().
// The full description is always in the tooltip.

const SHORT_NAMES: Record<string, string> = {
  "271000": "Refined petroleum",
  "270900": "Crude oil",
  "300490": "Medicines",
  "710812": "Gold",
  "710813": "Gold (semi-finished)",
  "870321": "Cars (small engine)",
  "870322": "Cars (1–1.5 L)",
  "870323": "Cars (1.5–3 L)",
  "870324": "Cars (over 3 L)",
  "870332": "Diesel cars (1.5–2.5 L)",
  "870340": "Hybrid cars",
  "870360": "Plug-in hybrid cars",
  "870380": "Electric cars",
  "870410": "Dump trucks",
  "870421": "Diesel trucks (small)",
  "271111": "Liquefied natural gas (LNG)",
  "271121": "Natural gas (pipeline)",
  "271112": "Propane",
  "271113": "Butane",
  "271119": "Liquefied petroleum gas",
  "851713": "Smartphones",
  "851762": "Network equipment",
  "271600": "Electricity",
  "890190": "Cargo ships",
  "890120": "Tankers",
  "890110": "Cruise ships and ferries",
  "890200": "Fishing vessels",
  "890332": "Yachts (7.5–24 m)",
  "890333": "Yachts (over 24 m)",
  "890400": "Tugboats",
  "890520": "Drilling platforms",
  "890590": "Special vessels",
  "890690": "Other vessels",
  "100630": "Rice",
  "100640": "Broken rice",
  "711319": "Gold jewellery",
  "854231": "Processors (chips)",
  "854232": "Memory chips",
  "854239": "Integrated circuits",
  "260300": "Copper ore",
  "880240": "Large aircraft",
  "880730": "Aircraft parts",
  "020714": "Frozen chicken",
  "720449": "Steel scrap",
  "170199": "Refined sugar",
  "170114": "Raw cane sugar",
  "100199": "Wheat",
  "100119": "Durum wheat",
  "260111": "Iron ore",
  "260112": "Iron ore pellets",
  "090111": "Coffee",
  "854430": "Vehicle wiring sets",
  "300215": "Immunological products",
  "300241": "Vaccines",
  "300212": "Antisera",
  "180100": "Cocoa beans",
  "100590": "Maize (corn)",
  "710231": "Rough diamonds",
  "710239": "Cut diamonds",
  "120740": "Sesame seeds",
  "740400": "Copper scrap",
  "740311": "Refined copper",
  "740200": "Unrefined copper",
  "110100": "Wheat flour",
  "120190": "Soybeans",
  "270112": "Coal (bituminous)",
  "270119": "Coal",
  "841112": "Jet engines",
  "841191": "Jet engine parts",
  "030341": "Frozen albacore tuna",
  "030342": "Frozen yellowfin tuna",
  "030343": "Frozen skipjack tuna",
  "030344": "Frozen bigeye tuna",
  "030349": "Frozen tuna",
  "030383": "Frozen toothfish",
  "030611": "Rock lobsters",
  "160414": "Canned tuna",
  "210690": "Food preparations",
  "520100": "Raw cotton",
  "151110": "Crude palm oil",
  "151190": "Palm oil",
  "150710": "Crude soybean oil",
  "150920": "Extra virgin olive oil",
  "847130": "Laptops",
  "847150": "Computer processing units",
  "847170": "Computer storage units",
  "847330": "Computer parts",
  "230400": "Soybean meal",
  "230120": "Fish meal",
  "760110": "Aluminium",
  "760120": "Aluminium alloys",
  "760200": "Aluminium scrap",
  "610910": "Cotton T-shirts",
  "610990": "T-shirts",
  "611020": "Cotton sweaters",
  "611030": "Synthetic sweaters",
  "620342": "Men's cotton trousers",
  "620462": "Women's cotton trousers",
  "080131": "Cashew nuts",
  "080390": "Bananas",
  "240220": "Cigarettes",
  "240210": "Cigars",
  "240120": "Tobacco",
  "850760": "Lithium-ion batteries",
  "090240": "Black tea",
  "310420": "Potash",
  "310210": "Urea",
  "290511": "Methanol",
  "251010": "Phosphate rock",
  "220840": "Rum",
  "252329": "Cement",
  "261690": "Precious metal ores",
  "261610": "Silver ore",
  "260900": "Tin ore",
  "260800": "Zinc ore",
  "260600": "Bauxite",
  "260400": "Nickel ore",
  "261000": "Chromium ore",
  "720241": "Ferrochrome",
  "720221": "Ferrosilicon",
  "720230": "Ferrosilicomanganese",
  "720310": "Direct-reduced iron",
  "970191": "Paintings",
  "281820": "Alumina",
  "860900": "Shipping containers",
  "730890": "Steel structures",
  "440349": "Tropical logs",
  "330129": "Essential oils",
  "330210": "Food flavourings",
  "010410": "Live sheep",
  "400122": "Natural rubber",
  "848620": "Chipmaking machines",
  "284410": "Uranium",
  "281410": "Ammonia",
  "020230": "Frozen beef",
  "020130": "Fresh beef",
  "640610": "Shoe parts",
  "848180": "Valves and taps",
  "490700": "Stamps",
  "283620": "Soda ash",
  "080810": "Apples",
  "080929": "Cherries",
  "870899": "Car parts",
  "870829": "Car body parts",
  "870840": "Gearboxes",
  "300220": "Vaccines",
  "852352": "Smart cards",
  "852859": "Monitors",
  "852872": "TVs",
  "283691": "Lithium carbonate",
  "030441": "Salmon fillets",
  "030481": "Frozen salmon fillets",
  "030214": "Fresh salmon",
  "030213": "Fresh Pacific salmon",
  "282520": "Lithium hydroxide",
};

// Fallback for products without a short name. HS descriptions read "Heading: detail, more detail".
// - generic headings take the detail: "Fruit, edible: grapes, fresh" -> "Grapes"; "Meat: of sheep, ..." -> "Meat of sheep"
// - others keep the heading, with a short detail in brackets: "Diamonds: industrial, ..." -> "Diamonds (industrial)"
const GENERIC_HEADING = /^(fruit|meat|fish|cereals|vegetables|vehicles|spices|dairy produce|vegetable oils|oil seeds|nuts|crustaceans|molluscs|sugars|tea|cocoa|flours|wood)\b/i;

export function productName(code: string, description: string): string {
  const known = SHORT_NAMES[code];
  if (known !== undefined) {
    return known;
  }
  const clean = (text: string) => text.replace(/\s*\([^)]*\)/g, "").trim();
  const [heading, rest = ""] = description.split(/:\s*/, 2).map((part) => clean(part).replace(/,? n\.e\.c\..*$/, ""));
  const clauses = rest.split(/[,;]/).map(clean);
  const isVague = (c: string) => c === "" || /^(other|n\.e\.c|excluding|whether|not\b|parts? of\b)/i.test(c);
  const isState = (c: string) => /^(live|fresh|frozen|chilled|dried|smoked|salted)( or (live|fresh|frozen|chilled|dried|smoked|salted))*$/i.test(c);
  const detail = clauses[0] ?? "";
  let name = heading.split(";")[0];
  if (GENERIC_HEADING.test(heading)) {
    const kind = heading.split(",")[0];
    const specific = clauses.find((c) => !isVague(c) && !isState(c));
    if (specific !== undefined && /^of\b/i.test(specific)) {
      name = `${kind} ${specific}`; // "Meat of sheep"
    } else if (specific !== undefined) {
      name = specific; // "Grapes"
    } else if (isState(detail)) {
      name = `${detail} ${kind.toLowerCase()}`; // "Frozen fish"
    }
  } else if (!isVague(detail) && detail.length <= 24) {
    name = `${name} (${detail})`;
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}
