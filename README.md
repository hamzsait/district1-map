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

## Poll-greeting sign-up (`/poll-greeting`)

A second, separate widget: a map of polling places in and near District 1 where
volunteers click a site, pick a day and one or more hour slots, enter their
contact info, and sign up to poll greet. Each slot shows how many people have
already signed up ("Needs greeters" / "2 signed up"), and each map pin shows the
site's total.

| File | What |
|------|------|
| `poll-greet.js` | Never-changing bootstrap for the Squarespace Code Block → loads `pg-widget.js` |
| `pg-widget.js` | The widget (map, slot picker, form submission, sheet reader) |
| `pg-form-autofill.js` | Fallback only: autofills + submits the `/data-feed` form from a `#pg=` link |
| `poll-greet.html` | Standalone preview page |

Embed on the `/poll-greeting` page:

```html
<div id="pg-root"></div>
<script src="https://hamzsait.github.io/district1-map/poll-greet.js"></script>
```

**Backend — no server.** The Squarespace form at `/data-feed` (which feeds the
Google Sheet) *is* the backend:

- **Write:** on submit the widget loads `/data-feed` in a hidden iframe (same
  origin, so it can reach into it), fills in the form and presses Submit, so
  Squarespace's own code does the posting and appends the row to the sheet. The
  volunteer never leaves the map. Takes ~3–5 s.
- **Read:** a tiny Google Apps Script web app attached to the sheet
  (`apps-script/Code.gs`) returns only the machine-readable `PG|v1|…` cells;
  the widget counts sign-ups per slot from those. Runs as the sheet owner, so
  the spreadsheet stays **private** — names/emails/phones never leave it.
  Counts are live (cached ≤15 s).

What lands in the four "Text" fields of the form (in form order):

| Field | Example |
|---|---|
| 1 | `Shift: Sat Oct 24 8–10am, 1–2pm; Thu Oct 29 9–10pm` |
| 2 | `Location: Millennium Youth Entertainment Complex (1156 Hargrave St, Austin TX 78702)` |
| 3 | `Notes: bringing a friend` (blank if none) |
| 4 | `PG\|v1\|Millennium Youth Entertainment Complex\|2026-10-24 08,09,13;2026-10-29 21` ← machine-readable, what the counts come from |

Column order in the sheet doesn't matter — the reader scans every cell of a row
for `PG|v1|`. Rows without it (like hand-entered ones) are ignored. **To cancel
someone's sign-up, delete their row** (or clear its `PG|v1|` cell).

Slots: hourly, 7am–7pm Oct 19–30 at early-voting sites (to 10pm Oct 29–30 at
extended-hours sites), and 7am–7pm Nov 3 at every site. Past slots are disabled.

Options (`data-*` on `#pg-root`):

| Attribute | Default | |
|---|---|---|
| `data-target` | `2` | greeters wanted per slot (slot turns green at this) |
| `data-buffer-mi` | `1` | also show sites within N miles of D1; `0` = only sites inside D1 |
| `data-api` | `API_URL` in `pg-widget.js` | Apps Script web-app URL (the normal way to read counts) |
| `data-csv` | — | "Publish to web" CSV URL of the sheet (see privacy note) |
| `data-sheet` / `data-gid` | campaign sheet / `0` | read the sheet via Google's gviz endpoint instead |
| `data-form` | `https://misaelforaustin.com/data-feed` | the form page |
| `data-dry-run` | off | fill the form but don't press Submit (testing) |

### Setting up the counts endpoint (one time)

1. Open the sign-up sheet → **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with `apps-script/Code.gs` from this repo. Save.
3. **Deploy → New deployment** → gear icon → **Web app**. Execute as: **Me**.
   Who has access: **Anyone**. Deploy, then click through Google's authorization
   prompt (it asks to let the script read this spreadsheet).
4. Copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`) into
   `API_URL` at the top of `pg-widget.js` and push.
5. Set the spreadsheet's sharing back to **Restricted**. The form keeps writing
   to it; the widget keeps reading counts through the script.

**After pasting a new `Code.gs`:** pick `setup` in the function dropdown and
click **Run** (adds a 1-minute trigger that keeps the script warm), then
publish a new version (below).

**Freshness vs. speed.** Every request re-reads the sheet unless another did
in the last 5 s, so new sign-ups appear right away. Apps Script itself is the
slow part (typically 1–5 s, occasionally 30–50 s), so the widget never waits
on it: the page renders immediately with the last counts this browser saw
(localStorage), and a status bar says "Loading the latest sign-ups… 12s" with
the time of the saved counts, then turns green ("Up to date · as of 2:15 PM").
First-time visitors see `·` on pins until counts arrive; everything else works.
While the page is open it re-checks quietly every minute.

To change the script later: edit, then **Deploy → Manage deployments → edit
(pencil) → Version: New version → Deploy**. That keeps the same URL. A *new
deployment* would create a new URL.

Fallbacks, if you ever need them: `data-csv` ("Publish to web" CSV of a tab
holding only the `PG|v1|` column; Google refreshes it about every 5 minutes) or
`data-sheet` (gviz, which requires the whole sheet to be link-viewable).

**If the form changes.** Field ids are at the top of `pg-widget.js` (`FIELD`);
if they don't match, it falls back to "the Nth text field". Keep the form's
four Text fields in the same order. The form's post-submit redirect to
`/poll-greeting` is fine (the widget treats it as success and doesn't boot
inside the iframe).

**Fallback.** When the widget runs somewhere other than misaelforaustin.com
(e.g. the GitHub Pages preview) it can't reach into the form, so it sends the
volunteer to `/data-feed#pg=…` instead. For that to auto-submit, add
`<script src="https://hamzsait.github.io/district1-map/pg-form-autofill.js"></script>`
in a Code Block on the `/data-feed` page. Not needed for the normal embed.
