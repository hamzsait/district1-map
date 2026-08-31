# District 1 Public Map

Read-only interactive map of Austin City Council District 1 with voting precinct
boundaries. Intended to be embedded on the public Squarespace site.

**Contains no voter or canvassing data** — only two boundary files:

| File | What |
|------|------|
| `d1-outline.geojson` | District 1 boundary (1 feature) |
| `d1-precincts.geojson` | 28 voting precincts; only property is `p` (precinct number) |
| `d1-map.js` | The whole widget: markup, styles, Leaflet loader, search, geolocation |
| `embed.html` | The 2-line snippet to paste into Squarespace |
| `index.html` | Standalone page (GitHub Pages / local preview / iframe target) |

Boundary sources: Texas Legislative Council, City of Austin.

## Features

- District 1 outline + precinct boundaries with hover tooltips
- **Address search with autocomplete** — suggestions as you type from the City of Austin's public address locator (ArcGIS, no API key); handles house-number ranges, not just mapped buildings
- **Use my location** — browser geolocation (requires HTTPS, which Squarespace provides; the user must click "Allow")
- Either one drops a pin and reports **In District 1 · Precinct N** or **Not in District 1**, computed in-browser against the GeoJSON — no server involved

The geocoder is `maps.austintexas.gov/arcgis/rest/services/Geocode/COA_Locator` — the City's own public service, so it knows Austin addresses better than any general geocoder. If it were ever retired, `suggest()`/`geocode()` in `embed.html` are the only two functions to swap.

## Embed in Squarespace

Add a **Code Block** (Business plan or higher) and paste exactly this — it's the whole of `embed.html`:

```html
<div id="d1-map-root"></div>
<script src="https://cdn.jsdelivr.net/gh/hamzsait/district1-map@main/d1-map.js"></script>
```

That's it. The script builds the whole widget, loads Leaflet, and fetches the boundary files from wherever it was loaded from. Any change pushed to this repo shows up on the site automatically (jsDelivr caches `@main` for up to ~12 h; pin a tag like `@v1` instead if you want to control exactly when the site updates).

**Alternative: iframe.** GitHub Pages serves `index.html` at https://hamzsait.github.io/district1-map/ — an iframe fully isolates the map from Squarespace's CSS and updates within a minute of a push:

```html
<iframe src="https://hamzsait.github.io/district1-map/" style="width:100%;height:640px;border:0" allow="geolocation" loading="lazy" title="District 1 map"></iframe>
```

(`allow="geolocation"` is required for the "Use my location" button to work inside an iframe.)

Notes:
- The Squarespace editor preview may show a blank box; the live page renders fine.
- Scroll-wheel zoom is off so the map doesn't hijack page scrolling; users use the +/− buttons or pinch.

## Preview locally

```sh
cd district-map
python3 -m http.server 8080
# open http://localhost:8080
```

(`fetch()` needs an HTTP server — opening `index.html` directly from the file system won't load the GeoJSON.)
