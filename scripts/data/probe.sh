#!/usr/bin/env bash
# One-off: downloads samples from data sources so their formats can be inspected.
# Runs in GitHub Actions (.github/workflows/probe.yml) because the dev sandbox can't reach these hosts.
#
# SECURITY: the EIA key must never reach the output. curl runs with -s (no error text, which would echo
# the URL), every output file is scrubbed, and the script fails if the key is still found anywhere.
set -u
OUT=probe-output
mkdir -p "$OUT"
UA="WorldTracker/1.0 (https://github.com/mishiko24/World-Tracker)"
KEY="$(printf '%s' "${EIA_API_KEY:-}" | tr -d '[:space:]')"

probe() {
  local name="$1" url="$2"
  local result
  result=$(curl -s -g -L -m 300 -A "$UA" -o "$OUT/$name.full" -w "%{http_code} %{content_type} %{size_download}" "$url")
  echo "$name | exit $? | $result" >> "$OUT/_index.txt"
  head -c 300000 "$OUT/$name.full" > "$OUT/$name.txt"
  rm -f "$OUT/$name.full"
}

probe usgs-commodities "https://www.sciencebase.gov/catalog/file/get/69837e43b66b01367d7ec7c7?f=__disk__d3%2Fac%2F84%2Fd3ac8466552946c5e8caa2c2c6338d9e1aff655d"
probe usgs-commodities-meta "https://www.sciencebase.gov/catalog/file/get/69837e43b66b01367d7ec7c7?f=__disk__59%2F9f%2F78%2F599f78dcdae6cfc820ec8410e8a0e684c28be9d2"

probe eia-products "https://api.eia.gov/v2/international/facet/productId?api_key=$KEY"
probe eia-activities "https://api.eia.gov/v2/international/facet/activityId?api_key=$KEY"
probe eia-units "https://api.eia.gov/v2/international/facet/unit?api_key=$KEY"
probe eia-countries "https://api.eia.gov/v2/international/facet/countryRegionId?api_key=$KEY"
probe eia-sample "https://api.eia.gov/v2/international/data/?api_key=$KEY&frequency=annual&data[0]=value&facets[countryRegionId][]=GEO&facets[countryRegionId][]=SAU&start=2022&length=1000"

if [ -n "$KEY" ]; then
  grep -rl --fixed-strings "$KEY" "$OUT" | xargs -r sed -i "s/$KEY/REDACTED/g"
  if grep -rq --fixed-strings "$KEY" "$OUT"; then
    echo "EIA key still present in output, refusing to continue" >&2
    rm -rf "$OUT"
    exit 1
  fi
fi
