# District 1 Public Map

Read-only interactive map of Austin City Council District 1 with voting precinct
boundaries. Intended to be embedded on the public Squarespace site.

**Contains no voter or canvassing data** — only two boundary files:

| File | What |
|------|------|
| `d1-outline.geojson` | District 1 boundary (1 feature) |
| `d1-precincts.geojson` | 28 voting precincts; only property is `p` (precinct number) |
| `embed.html` | The snippet to paste into Squarespace |
| `index.html` | Local preview page that renders `embed.html` |

Boundary sources: Texas Legislative Council, City of Austin.

## Features

- District 1 outline + precinct boundaries with hover tooltips
- **Address search with autocomplete** — suggestions as you type from the City of Austin's public address locator (ArcGIS, no API key); handles house-number ranges, not just mapped buildings
- **Use my location** — browser geolocation (requires HTTPS, which Squarespace provides; the user must click "Allow")
- Either one drops a pin and reports **In District 1 · Precinct N** or **Not in District 1**, computed in-browser against the GeoJSON — no server involved

The geocoder is `maps.austintexas.gov/arcgis/rest/services/Geocode/COA_Locator` — the City's own public service, so it knows Austin addresses better than any general geocoder. If it were ever retired, `suggest()`/`geocode()` in `embed.html` are the only two functions to swap.

## Preview locally

```sh
cd district-map
python3 -m http.server 8080
# open http://localhost:8080
```

(`fetch()` needs an HTTP server — opening `index.html` directly from the file system won't load the GeoJSON.)

## Publish

1. Push this folder to a **public** GitHub repo (e.g. `district1-map`).
2. `embed.html` already points `DATA_BASE` at
   `https://cdn.jsdelivr.net/gh/hamzsait/district1-map@main` — jsDelivr serves the
   files with correct headers + CDN caching (`raw.githubusercontent.com` does not).
   For local testing against the files in this folder, set `DATA_BASE = ""`.
3. In Squarespace: add a **Code Block** (Business plan or higher), paste the entire contents of `embed.html`, save.

Notes:
- The Squarespace editor preview may show a blank box; the live page renders fine.
- jsDelivr caches `@main` for ~12h. To force an update, reference a commit SHA or tag instead (`@v1`).
- Scroll-wheel zoom is off so the map doesn't hijack page scrolling; users use the +/− buttons or pinch.
