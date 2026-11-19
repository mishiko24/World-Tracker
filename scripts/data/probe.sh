#!/usr/bin/env bash
# One-off: downloads a sample from every data source so their formats can be inspected.
# Runs in GitHub Actions (.github/workflows/probe.yml) because the dev sandbox can't reach these hosts.
set -u
OUT=probe-output
mkdir -p "$OUT"
UA="WorldTracker/1.0 (https://github.com/mishiko24/World-Tracker)"

probe() {
  local name="$1" url="$2"
  local shown="${url//$EIA_API_KEY/KEY}"
  local code
  code=$(curl -sS -L -m 180 -A "$UA" -o "$OUT/$name.full" -w "%{http_code} %{content_type} %{size_download}" "$url" 2>"$OUT/$name.err")
  echo "$name | $code | $shown" >> "$OUT/_index.txt"
  head -c 150000 "$OUT/$name.full" > "$OUT/$name.txt"
  rm "$OUT/$name.full"
}

sparql() {
  local name="$1" query="$2"
  curl -sS -G -m 180 -A "$UA" -H "Accept: application/sparql-results+json" \
    --data-urlencode "query=$query" https://query.wikidata.org/sparql -o "$OUT/$name.txt" -w "$name | %{http_code}\n" >> "$OUT/_index.txt"
}

# World Bank
probe wb-pop "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=400&mrnev=1"
probe wb-countries "https://api.worldbank.org/v2/country?format=json&per_page=400"
probe wb-elec-access "https://api.worldbank.org/v2/country/all/indicator/EG.ELC.ACCS.ZS?format=json&per_page=400&mrnev=1"

# IMF DataMapper
probe imf-ngdpd "https://www.imf.org/external/datamapper/api/v1/NGDPD"
probe imf-indicators "https://www.imf.org/external/datamapper/api/v1/indicators"
probe imf-countries "https://www.imf.org/external/datamapper/api/v1/countries"

# Our World in Data graphers (UN WPP)
probe owid-median-age "https://ourworldindata.org/grapher/median-age.csv?v=1&csvType=full&useColumnShortNames=true"
probe owid-fertility "https://ourworldindata.org/grapher/children-born-per-woman.csv?v=1&csvType=full&useColumnShortNames=true"

# EIA international: facet code lists, then one sample query
probe eia-products "https://api.eia.gov/v2/international/facet/productId?api_key=$EIA_API_KEY"
probe eia-activities "https://api.eia.gov/v2/international/facet/activityId?api_key=$EIA_API_KEY"
probe eia-units "https://api.eia.gov/v2/international/facet/unit?api_key=$EIA_API_KEY"
probe eia-meta "https://api.eia.gov/v2/international?api_key=$EIA_API_KEY"
probe eia-sample "https://api.eia.gov/v2/international/data/?api_key=$EIA_API_KEY&frequency=annual&data[0]=value&facets[countryRegionId][]=GEO&facets[countryRegionId][]=SAU&start=2022&length=500"

# USGS Mineral Commodity Summaries 2026 (ScienceBase items)
probe usgs-mcs-item "https://www.sciencebase.gov/catalog/item/69837e43b66b01367d7ec7c7?format=json"
probe usgs-mcs-salient-item "https://www.sciencebase.gov/catalog/item/69837ec8b66b01367d7ec7d9?format=json"

# Ember yearly CSV (for installed capacity)
probe ember-yearly "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/yearly_full_release_long_format.csv"

# FAOSTAT: API sample + bulk zip listing
probe fao-api "https://fenixservices.fao.org/faostat/api/v1/en/data/QCL?area=73&element=2510&year=2024&output_type=json"
FAO_ZIP="https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip"
curl -sS -L -m 600 -A "$UA" -o fao.zip -w "fao-bulk | %{http_code} %{content_type} %{size_download} | $FAO_ZIP\n" "$FAO_ZIP" >> "$OUT/_index.txt" 2>> "$OUT/fao-bulk.err"
unzip -l fao.zip > "$OUT/fao-bulk-list.txt" 2>&1
CSV=$(unzip -Z1 fao.zip 2>/dev/null | grep -i "All_Data_(Normalized).csv" | head -1)
[ -n "$CSV" ] && unzip -p fao.zip "$CSV" | head -40 > "$OUT/fao-bulk-head.txt"

# Wikidata: leaders + parties for a few countries, and Factbook-related properties
sparql wd-leaders '
SELECT ?country ?hos ?hosLabel ?hosParty ?hosPartyLabel ?hog ?hogLabel ?hogParty ?hogPartyLabel WHERE {
  VALUES ?country { wd:Q230 wd:Q30 wd:Q142 wd:Q183 wd:Q145 wd:Q865 wd:Q851 }
  OPTIONAL { ?country p:P35 ?s1 . ?s1 ps:P35 ?hos . FILTER NOT EXISTS { ?s1 pq:P582 [] }
    OPTIONAL { ?hos p:P102 ?p1 . ?p1 ps:P102 ?hosParty . FILTER NOT EXISTS { ?p1 pq:P582 [] } } }
  OPTIONAL { ?country p:P6 ?s2 . ?s2 ps:P6 ?hog . FILTER NOT EXISTS { ?s2 pq:P582 [] }
    OPTIONAL { ?hog p:P102 ?p2 . ?p2 ps:P102 ?hogParty . FILTER NOT EXISTS { ?p2 pq:P582 [] } } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}'
sparql wd-props '
SELECT ?p ?pLabel WHERE { ?p a wikibase:Property ; rdfs:label ?pLabel .
  FILTER(LANG(?pLabel) = "en" && (CONTAINS(LCASE(?pLabel), "factbook") || CONTAINS(LCASE(?pLabel), "office held by head"))) }'

ls -la "$OUT" >> "$OUT/_index.txt"
