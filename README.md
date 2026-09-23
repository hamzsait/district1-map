# District 1 Public Map

Read-only interactive map of Austin City Council District 1 with voting precinct
boundaries. Intended to be embedded on the public Squarespace site.

**Contains no private data.** The voter files below are derived from the public
Travis County registered voter list (a public record published by the county).

| File | What |
|------|------|
| `d1-outline.geojson` | District 1 boundary (1 feature) |
| `d1-precincts.geojson` | 36 Travis County voting precincts clipped to District 1; only property is `p` (precinct number) |
| `d1-voters.json` | Registered/active voter counts per precinct (shown in hover tooltips) |
| `d1-polling.json` | Travis County early-voting + election-day polling locations (geocoded) for the Nov 3, 2026 election |
| `d1-voter-index.json` | `[name, precinct, active, registered address]` for District 1 voters only — powers the voter lookup; lazy-loaded (~4.4 MB) only when someone uses it |
| `d1-map.js` | Tiny bootstrap the website points at. **Never changes.** Loads `d1-widget.js` from GitHub Pages |
| `d1-widget.js` | The whole widget: markup, styles, Leaflet loader, search, geolocation |
| `embed.html` | The 2-line snippet to paste into Squarespace |
| `yard-sign-prefill.js` | Prefills the yard-sign form's address fields from `?street=&city=&state=&zip=` |
| `index.html` | Standalone page (GitHub Pages / local preview / iframe target) |

Boundary sources: City of Austin ArcGIS open data — `BOUNDARIES_single_member_districts` (council districts) and `EXTERNAL_travis_voter_precincts` (Travis County precincts). Rebuilt with `scripts/build-data.py`.

Voter data source: [Travis County voter registration data files](https://voter-registration-maps-traviscountytx.hub.arcgis.com/pages/data-files-and-reference).
Rebuild after downloading a fresh CSV with:

```sh
python3 scripts/build-voters.py /path/to/Registered_Voter_List.csv
```

Only District 1 voters (`CITYSM == CA1`) are included; VUID, gender, mailing
address, and all other columns are dropped.

## Features

Three tools, shown as tabs. Which ones appear is controlled by `data-mode` on the
embed div (or the script tag): `voter`, `address`, `polling`, or a comma list —
e.g. `<div id="d1-map-root" data-mode="polling"></div>` shows only the polling
place finder, with no tab bar. Omit `data-mode` for all three.

- **Voter lookup** (default tab) — type a name, get typeahead matches from the D1 voter roll with Active/Suspense status, registered address, and precinct; clicking a match pins the address on the map
- District 1 outline + precinct boundaries with hover tooltips showing registered/active voter counts
- **Address search with autocomplete** — suggestions as you type from the City of Austin's public address locator (ArcGIS, no API key); handles house-number ranges, not just mapped buildings
- **Use my location** — browser geolocation (requires HTTPS, which Squarespace provides; the user must click "Allow")
- When the address is in District 1, a **Request a yard sign →** button links to `/request-a-yard-sign?street=…&city=…&state=…&zip=…`
- **Polling place finder** — enter an address (same typeahead) or use your location; shows the closest early-voting site (Oct 19–30) and closest election-day site (Nov 3) with distance, hours, and a Google Maps driving-directions link. Data from the county's official location flyers, rebuilt with `scripts/build-polling.py`. Travis County uses countywide vote centers, and the UI says so — any location works.
- Either one drops a pin and reports **In District 1 · Precinct N** or **Not in District 1**, computed in-browser against the GeoJSON — no server involved

The geocoder is `maps.austintexas.gov/arcgis/rest/services/Geocode/COA_Locator` — the City's own public service, so it knows Austin addresses better than any general geocoder. If it were ever retired, `suggest()`/`geocode()` in `embed.html` are the only two functions to swap.

## Embed in Squarespace

Add a **Code Block** (Business plan or higher) and paste exactly this — it's the whole of `embed.html`:

```html
<div id="d1-map-root"></div>
<script src="https://hamzsait.github.io/district1-map/d1-map.js"></script>
```

That's it. Files are served by GitHub Pages, which browsers re-check every 10 minutes, so **any push to `main` is live for all visitors within ~10 minutes** — no cache purging, no hard refresh.

Don't use a jsDelivr URL (`cdn.jsdelivr.net/gh/...@main/...`) for the script: jsDelivr tells browsers to cache it for 7 days and its own `@main` cache can lag pushes by up to 12 hours, so visitors see stale versions. (`d1-map.js` is a bootstrap that still works if loaded from jsDelivr — it forwards to GitHub Pages — but the bootstrap itself would be stuck in caches.)

**Yard-sign prefill.** On the *Request a Yard Sign* page, add a Code Block containing:

```html
<script src="https://hamzsait.github.io/district1-map/yard-sign-prefill.js"></script>
```

It reads `street`/`city`/`state`/`zip` from the URL and fills the matching form fields (it targets the fields by their `autocomplete` attribute, so it survives the form being re-created).

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
