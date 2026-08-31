# District 1 Public Map

Read-only interactive map of Austin City Council District 1 with voting precinct
boundaries. Intended to be embedded on the public Squarespace site.

**Contains no voter or canvassing data** — only two boundary files:

| File | What |
|------|------|
| `d1-outline.geojson` | District 1 boundary (1 feature) |
| `d1-precincts.geojson` | 36 Travis County voting precincts clipped to District 1; only property is `p` (precinct number) |
| `d1-map.js` | Tiny bootstrap the website points at. **Never changes.** Loads `d1-widget.js` from GitHub Pages |
| `d1-widget.js` | The whole widget: markup, styles, Leaflet loader, search, geolocation |
| `embed.html` | The 2-line snippet to paste into Squarespace |
| `index.html` | Standalone page (GitHub Pages / local preview / iframe target) |

Boundary sources: City of Austin ArcGIS open data — `BOUNDARIES_single_member_districts` (council districts) and `EXTERNAL_travis_voter_precincts` (Travis County precincts). Rebuilt with `scripts/build-data.py`.

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

That's it. `d1-map.js` is a tiny bootstrap that never changes; it loads the real widget and data from GitHub Pages (`https://hamzsait.github.io/district1-map/`), which browsers re-check every 10 minutes. **Any push to `main` is live for all visitors within ~10 minutes** — no cache purging, no hard refresh.

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
