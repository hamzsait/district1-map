/*!
 * District 1 poll-greeting sign-up widget — https://github.com/hamzsait/district1-map
 *
 * Sites embed poll-greet.js (a tiny, never-changing bootstrap) which loads
 * this file. Data files are loaded from the same location as this script.
 *
 * Backend = the campaign's Squarespace form + the Google Sheet it feeds:
 *   WRITE: the sign-up is submitted through the real Squarespace form
 *          (/data-feed), loaded in a hidden same-origin iframe, filled in and
 *          submitted with Squarespace's own code. Squarespace appends the row
 *          to the Google Sheet.
 *   READ:  a tiny Apps Script web app bound to the (private) sheet
 *          (apps-script/Code.gs) returns only the machine-readable "PG|v1|…"
 *          cells, which the widget counts per slot. Names, emails and phone
 *          numbers never leave the sheet.
 *
 * Options (data-* attributes on #pg-root):
 *   data-api       Apps Script web-app URL            (default: API_URL below)
 *   data-sheet     Google Sheet id                    (default: campaign sheet)
 *   data-gid       tab id within the sheet            (default: 0)
 *   data-csv       "Publish to web" CSV URL — use instead of data-sheet if the
 *                  sheet itself is private (recommended; see README)
 *   data-form      form page URL                      (default: /data-feed)
 *   data-target    greeters wanted per hour slot      (default: 2)
 *   data-buffer-mi also show sites within N miles of D1 (default: 1; 0 = D1 only)
 *   data-dry-run   fill the form but don't press Submit (testing)
 */
(function () {
  var LEAFLET_CSS = { href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", integrity: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" };
  var LEAFLET_JS  = { src:  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",  integrity: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" };

  var me = document.currentScript || (function () { var s = document.getElementsByTagName("script"); return s[s.length - 1]; })();
  var DATA_BASE = (me && me.src ? me.src.replace(/\/[^\/]*$/, "") : "");

  var root = document.getElementById("pg-root") || (function () {
    var d = document.createElement("div"); d.id = "pg-root"; me.parentNode.insertBefore(d, me); return d;
  })();
  if (root.getAttribute("data-pg-loaded")) return;
  root.setAttribute("data-pg-loaded", "1");

  // Inside the hidden sign-up iframe the form page may redirect to the page
  // this widget lives on. Don't boot a second copy in there.
  try { if (window.frameElement && window.frameElement.getAttribute("data-pg-frame")) return; } catch (e) {}

  function opt(name, dflt) { var v = root.getAttribute("data-" + name); return v == null || v === "" ? dflt : v; }

  // ---- configuration -------------------------------------------
  // Apps Script web-app URL (Deploy → Manage deployments → Web app URL).
  var API_URL = "https://script.google.com/macros/s/AKfycbyHMGXDKwnV_ETZ6XzQLP8kqrA7k_18K5Nr2rCItzUYwCqw6wEaH-3On2Vut01jEhac/exec";

  var CFG = {
    api:    opt("api", API_URL),
    sheet:  opt("sheet", "14iAFtDRyREOr9N1LoYHdSxIJyP7d_rEBuTwzK_tOKEU"),
    gid:    opt("gid", "0"),
    csv:    opt("csv", ""),
    form:   opt("form", "https://misaelforaustin.com/data-feed"),
    target: parseInt(opt("target", "2"), 10) || 2,
    buffer: parseFloat(opt("buffer-mi", "1")),
    dryRun: root.hasAttribute("data-dry-run")
  };
  if (isNaN(CFG.buffer)) CFG.buffer = 1;

  // Squarespace form fields (ids from the form's block JSON). The four generic
  // "Text" fields are used in this order; if the form is rebuilt and the ids
  // change, the code falls back to "the Nth text field in the form".
  var FIELD = {
    shift:    "text-da55c577-4182-473d-a625-8d0b4f5ac8fc-field",
    location: "text-fa355191-0006-47fa-94c9-60b449cbe5f2-field",
    notes:    "text-8291bd50-71d6-4c58-82b1-128d8378be52-field",
    key:      "text-b2182252-7091-4f9e-bd44-77b3d3558be1-field"
  };
  var TEXT_ORDER = ["shift", "location", "notes", "key"];

  // Nov 3, 2026 election. Early voting Oct 19–30, 7am–7pm; sites flagged
  // `ext` stay open until 10pm Oct 29–30. Election day 7am–7pm.
  var EV_DAYS = [], ED_DAY = "2026-11-03";
  for (var dd = 19; dd <= 30; dd++) EV_DAYS.push("2026-10-" + dd);
  var OPEN = 7, CLOSE = 19, EXT_CLOSE = 22, EXT_DAYS = ["2026-10-29", "2026-10-30"];

  // ---- styles + markup -----------------------------------------
  var style = document.createElement("style");
  style.textContent = [
    '#pg-wrap { font-family: inherit; color:#0e2952; }',
    '#pg-wrap *, #pg-wrap *::before, #pg-wrap *::after { box-sizing:border-box; }',
    '#pg-map .leaflet-container, #pg-map { font: 13px/1.4 "Prompt", Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }',
    '#pg-map .leaflet-tile-pane { filter: saturate(.45) contrast(.92); }',
    '#pg-map .leaflet-bar a { color:#0e2952; }',
    '#pg-map .pg-legend { background:#fff; color:#0e2952; padding:8px 12px; border-radius:10px; border:2px solid #0e2952; line-height:1.8; font-size:12.5px; }',
    '#pg-map .pg-legend .sw { display:inline-block; width:14px; height:14px; border-radius:50%; vertical-align:-2px; margin-right:6px; border:2px solid #fff; box-shadow:0 0 0 1px #0e2952; }',
    '#pg-map .pg-pin { width:30px; height:30px; border-radius:50%; border:3px solid #fff; box-shadow:0 1px 5px rgba(14,41,82,.45); color:#fff; font-weight:700; font-size:13px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:transform .12s; }',
    '#pg-map .pg-pin.ev { background:#fa721e; }',
    '#pg-map .pg-pin.ed { background:#0e2952; }',
    '#pg-map .pg-pin.near { opacity:.72; }',
    '#pg-map .pg-pin.sel { transform:scale(1.3); box-shadow:0 0 0 3px #fa721e, 0 2px 8px rgba(14,41,82,.5); opacity:1; }',
    '#pg-map .pg-tip { background:#0e2952; color:#fff; border:0; border-radius:8px; padding:5px 10px; font-weight:600; box-shadow:0 2px 8px rgba(14,41,82,.3); }',
    '#pg-map .pg-tip::before { display:none; }',
    '#pg-wrap .pg-row { display:flex; gap:14px; flex-wrap:wrap; align-items:flex-start; }',
    '#pg-wrap .pg-panel { flex:1 1 340px; min-width:0; border:2px solid #0e2952; border-radius:16px; padding:16px; background:#fff; }',
    '#pg-wrap .pg-mapbox { flex:1.4 1 420px; min-width:0; }',
    '#pg-wrap .pg-select, #pg-wrap .pg-input { width:100%; padding:10px 14px; border:2px solid #0e2952; border-radius:12px; font-size:16px; font-family:inherit; color:#0e2952; background:#fff; outline:none; }',
    '#pg-wrap .pg-select:focus, #pg-wrap .pg-input:focus { box-shadow:0 0 0 3px rgba(250,114,30,.35); }',
    '#pg-wrap .pg-input::placeholder { color:#6b7a90; }',
    '#pg-wrap .pg-label { display:block; font-size:12px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:#fa721e; margin:14px 0 6px; }',
    '#pg-wrap .pg-muted { color:#5b6b82; font-size:13px; }',
    '#pg-wrap .pg-h { font-size:19px; font-weight:700; margin:0 0 2px; line-height:1.25; }',
    '#pg-wrap .pg-badge { display:inline-block; font-size:11px; font-weight:700; padding:2px 9px; border-radius:999px; margin:6px 6px 0 0; }',
    '#pg-wrap .pg-b-in { background:#0e2952; color:#fff; }',
    '#pg-wrap .pg-b-near { background:#e8eef5; color:#0e2952; }',
    '#pg-wrap .pg-b-ev { background:#fdeee3; color:#c2410c; }',
    // Day buttons: rounded rectangles in a grid. Sizes are pinned with !important
    // because the Squarespace theme styles every <button> (big font, padding).
    '#pg-wrap .pg-chips { display:grid; grid-template-columns:repeat(auto-fill,minmax(92px,1fr)); gap:6px; }',
    '#pg-wrap .pg-chip { margin:0 !important; padding:7px 4px !important; width:auto !important; height:auto !important; min-height:0 !important; border-radius:12px !important; border:2px solid #0e2952; background:#fff; color:#0e2952; font-family:inherit; font-size:13px !important; line-height:1.25 !important; font-weight:600 !important; letter-spacing:0 !important; text-transform:none !important; white-space:nowrap; cursor:pointer; text-align:center; }',
    '#pg-wrap .pg-chip small { display:block; font-weight:500; font-size:11px !important; line-height:1.3 !important; opacity:.85; }',
    '#pg-wrap .pg-chip:disabled { opacity:.35; cursor:not-allowed; }',
    '#pg-wrap .pg-chip.on { background:#0e2952; color:#fff; }',
    '#pg-wrap .pg-chip.has { box-shadow:inset 0 -3px 0 #fa721e; }',
    '#pg-wrap .pg-slots { display:grid; grid-template-columns:repeat(auto-fill,minmax(112px,1fr)); gap:6px; }',
    '#pg-wrap .pg-slot { margin:0 !important; padding:8px 6px !important; width:auto !important; height:auto !important; border-radius:12px !important; border:2px solid #0e2952; background:#fff; color:#0e2952; font-family:inherit; font-size:13px !important; letter-spacing:0 !important; text-transform:none !important; cursor:pointer; text-align:center; line-height:1.25 !important; }',
    '#pg-wrap .pg-slot b { display:block; font-size:14px; }',
    '#pg-wrap .pg-slot span { font-size:11.5px; }',
    '#pg-wrap .pg-slot.need span { color:#c2410c; font-weight:600; }',
    '#pg-wrap .pg-slot.full span { color:#177245; font-weight:600; }',
    '#pg-wrap .pg-slot.on { background:#fa721e; border-color:#fa721e; color:#fff; }',
    '#pg-wrap .pg-slot.on span { color:#fff; }',
    '#pg-wrap .pg-slot:disabled { opacity:.35; cursor:not-allowed; }',
    '#pg-wrap .pg-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }',
    '#pg-wrap .pg-btn { width:100%; margin-top:14px; padding:13px 22px; border-radius:999px; font-size:16px; font-weight:600; font-family:inherit; cursor:pointer; background:#fa721e; color:#fff; border:2px solid #fff; box-shadow:0 0 0 2px #fa721e; }',
    '#pg-wrap .pg-btn:hover { background:#e8630f; }',
    '#pg-wrap .pg-btn:disabled { opacity:.6; cursor:wait; }',
    '#pg-wrap .pg-link { color:#fa721e; font-weight:600; font-size:13px; }',
    '#pg-wrap .pg-msg { margin-top:12px; padding:10px 14px; border-radius:12px; font-size:14px; }',
    '#pg-wrap .pg-msg.err { background:#fdeee3; color:#c2410c; }',
    '#pg-wrap .pg-msg.ok { background:#e7f5ec; color:#177245; }',
    '#pg-wrap .pg-picked { margin-top:10px; font-size:13.5px; background:#f8f4ec; border-radius:12px; padding:8px 12px; }',
    '#pg-wrap .pg-spin { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,.5); border-top-color:#fff; border-radius:50%; animation:pgspin .8s linear infinite; vertical-align:-2px; margin-right:8px; }',
    '#pg-wrap .pg-live { display:flex; gap:10px; align-items:flex-start; padding:10px 14px; margin:0 0 10px; border-radius:12px; border:2px solid #0e2952; background:#f8f4ec; color:#0e2952; font-size:14px; line-height:1.35; }',
    '#pg-wrap .pg-live.ok { padding:6px 12px; font-size:13px; background:#e7f5ec; color:#177245; border-color:#b7e0c6; }',
    '#pg-wrap .pg-live.err { background:#fdeee3; color:#c2410c; border-color:#f6c8a8; }',
    '#pg-wrap .pg-live-sub { font-size:12.5px; color:#5b6b82; margin-top:2px; }',
    '#pg-wrap .pg-live-secs { color:#5b6b82; font-variant-numeric:tabular-nums; }',
    '#pg-wrap .pg-live-dot { flex:none; width:9px; height:9px; margin-top:4px; border-radius:50%; background:#1f9d57; }',
    '#pg-wrap .pg-spin-dark { flex:none; margin:2px 0 0; border-color:rgba(14,41,82,.25); border-top-color:#0e2952; }',
    '@keyframes pgspin { to { transform:rotate(360deg); } }',
    '@media (max-width:520px) { #pg-wrap .pg-grid2 { grid-template-columns:1fr; } }'
  ].join("\n");
  document.head.appendChild(style);

  root.innerHTML =
    '<div id="pg-wrap">' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 10px">' +
        '<label for="pg-day" style="font-weight:600">Show sign-ups for</label>' +
        '<select id="pg-day" class="pg-select" style="width:auto;flex:0 1 240px;padding:8px 12px"></select>' +
      '</div>' +
      '<div id="pg-live" class="pg-live loading" role="status" aria-live="polite"></div>' +
      '<div class="pg-row">' +
        '<div class="pg-mapbox"><div id="pg-map" style="height:560px;width:100%;border-radius:16px;overflow:hidden;background:#f8f4ec;border:2px solid #0e2952"></div></div>' +
        '<div class="pg-panel" id="pg-panel"></div>' +
      '</div>' +
    '</div>';

  function loadLeaflet(cb) {
    if (!document.querySelector('link[href="' + LEAFLET_CSS.href + '"]')) {
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = LEAFLET_CSS.href;
      l.integrity = LEAFLET_CSS.integrity; l.crossOrigin = ""; document.head.appendChild(l);
    }
    if (window.L && L.geoJSON) return cb();
    var s = document.createElement("script"); s.src = LEAFLET_JS.src; s.integrity = LEAFLET_JS.integrity;
    s.crossOrigin = ""; s.onload = cb;
    s.onerror = function () { document.getElementById("pg-map").innerHTML = '<p style="padding:1em;color:#b91c1c">Map library failed to load.</p>'; };
    document.head.appendChild(s);
  }

  // ---- small helpers -------------------------------------------
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateObj(ymd) { var p = ymd.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dayLabel(ymd) { var d = dateObj(ymd); return DOW[d.getDay()] + " " + MON[d.getMonth()] + " " + d.getDate(); }
  function hourLabel(h) { var hh = h % 12 || 12; return hh + (h < 12 ? "am" : "pm"); }
  function rangeLabel(a, b) {       // [a, b) in hours, e.g. 7–10am, 11am–1pm
    var sameHalf = (a < 12) === (b < 12);
    return (sameHalf ? String(a % 12 || 12) : hourLabel(a)) + "–" + hourLabel(b);
  }
  function todayYmd() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  // Days a site is open for greeting, and its hours on a given day.
  function siteDays(s) {
    var days = [];
    if (s.k === "both") {
      var only = s.note && s.note.match(/Oct (\d+) only/);
      days = only ? ["2026-10-" + only[1]] : EV_DAYS.slice();
    }
    days.push(ED_DAY);
    return days;
  }
  function siteHours(s, day) {
    var close = s.ext && EXT_DAYS.indexOf(day) !== -1 ? EXT_CLOSE : CLOSE, out = [];
    for (var h = OPEN; h < close; h++) out.push(h);
    return out;
  }
  function slotKey(day, h) { return day + " " + pad(h); }
  function isPast(day, h) {
    var d = dateObj(day); d.setHours(h + 1); return d.getTime() < Date.now();
  }

  // "PG|v1|<site>|2026-10-24 07,08,09;2026-10-25 12" <-> {site, slots: ["2026-10-24 07", …]}
  function encodeKey(site, slots) {
    var byDay = {};
    slots.forEach(function (k) { var p = k.split(" "); (byDay[p[0]] = byDay[p[0]] || []).push(p[1]); });
    return "PG|v1|" + site + "|" + Object.keys(byDay).sort().map(function (d) { return d + " " + byDay[d].sort().join(","); }).join(";");
  }
  function decodeKey(str) {
    var i = str.indexOf("PG|v1|"); if (i === -1) return null;
    var parts = str.slice(i).trim().split("|"); if (parts.length < 4) return null;
    var slots = [];
    parts[3].split(";").forEach(function (chunk) {
      var m = chunk.trim().match(/^(\d{4}-\d{2}-\d{2})\s+([\d,\s]+)$/); if (!m) return;
      m[2].split(",").forEach(function (h) { h = h.trim(); if (/^\d+$/.test(h)) slots.push(m[1] + " " + pad(+h)); });
    });
    return slots.length ? { site: parts[2].trim(), slots: slots } : null;
  }
  // Human-readable shift text: "Sat Oct 24 7–10am, 2–4pm; Sun Oct 25 9–10am"
  function shiftText(slots) {
    var byDay = {};
    slots.forEach(function (k) { var p = k.split(" "); (byDay[p[0]] = byDay[p[0]] || []).push(+p[1]); });
    return Object.keys(byDay).sort().map(function (d) {
      var hs = byDay[d].sort(function (a, b) { return a - b; }), ranges = [], start = hs[0], prev = hs[0];
      for (var i = 1; i <= hs.length; i++) {
        if (hs[i] === prev + 1) { prev = hs[i]; continue; }
        ranges.push(rangeLabel(start, prev + 1)); start = prev = hs[i];
      }
      return dayLabel(d) + " " + ranges.join(", ");
    }).join("; ");
  }

  // ---- geometry: which sites are in / near District 1 -------------
  function inRing(pt, ring) {
    var x = pt[0], y = pt[1], inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function polysOf(f) { return f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates; }
  function inFeature(pt, f) {
    return polysOf(f).some(function (p) {
      if (!inRing(pt, p[0])) return false;
      for (var h = 1; h < p.length; h++) if (inRing(pt, p[h])) return false;
      return true;
    });
  }
  function milesToEdge(pt, f) {    // flat-earth approximation, fine at city scale
    var ky = 69.17, kx = 69.17 * Math.cos(pt[1] * Math.PI / 180), best = Infinity;
    var px = pt[0] * kx, py = pt[1] * ky;
    polysOf(f).forEach(function (p) { p.forEach(function (ring) {
      for (var i = 1; i < ring.length; i++) {
        var ax = ring[i - 1][0] * kx, ay = ring[i - 1][1] * ky, bx = ring[i][0] * kx, by = ring[i][1] * ky;
        var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        var t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
        var ex = ax + t * dx - px, ey = ay + t * dy - py, d = Math.sqrt(ex * ex + ey * ey);
        if (d < best) best = d;
      }
    }); });
    return best;
  }

  // ---- read sign-ups from the Google Sheet -----------------------
  function sheetRows() {
    if (CFG.api) {         // one "row" per PG|v1| key — same shape the parser expects
      var ctl = window.AbortController ? new AbortController() : null;
      if (ctl) setTimeout(function () { ctl.abort(); }, 45000);
      return fetch(CFG.api + (CFG.api.indexOf("?") === -1 ? "?" : "&") + "_=" + Date.now(), ctl ? { signal: ctl.signal } : {})
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (j) { return (j.keys || []).map(function (k) { return [k]; }); });
    }
    if (CFG.csv) {
      return fetch(CFG.csv + (CFG.csv.indexOf("?") === -1 ? "?" : "&") + "_=" + Date.now())
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
        .then(parseCsv);
    }
    // gviz JSONP (works for any sheet shared "anyone with the link can view")
    return new Promise(function (resolve, reject) {
      var cb = "__pgSheet" + Date.now() + Math.floor(Math.random() * 1e6), s = document.createElement("script");
      var t = setTimeout(function () { cleanup(); reject(new Error("timeout")); }, 15000);
      function cleanup() { clearTimeout(t); try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); }
      window[cb] = function (res) {
        cleanup();
        if (!res || res.status !== "ok") return reject(new Error("sheet error"));
        resolve(res.table.rows.map(function (r) { return (r.c || []).map(function (c) { return c && c.v != null ? String(c.v) : ""; }); }));
      };
      s.onerror = function () { cleanup(); reject(new Error("load error")); };
      s.src = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(CFG.sheet) + "/gviz/tq?tqx=out:json;responseHandler:" + cb +
              "&gid=" + encodeURIComponent(CFG.gid) + "&_=" + Date.now();
      document.head.appendChild(s);
    });
  }
  function parseCsv(text) {
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // ---- submit through the Squarespace form -----------------------
  // Fills the form inside `doc` (the form page's document). Returns the submit
  // button, or null if the form isn't rendered yet.
  function fillForm(doc, v) {
    var win = doc.defaultView, form = doc.querySelector("form");
    if (!form) return null;
    var fname = form.querySelector('input[name="fname"]'), lname = form.querySelector('input[name="lname"]'),
        email = form.querySelector('input[type="email"]'), phone = form.querySelector('input[autocomplete="tel-national"]'),
        btn = form.querySelector('button[type="submit"]'),
        texts = Array.prototype.filter.call(form.querySelectorAll('input[id^="text-"], textarea[id^="textarea-"]'), function (e) { return !/message-field/.test(e.id); });
    if (!fname || !email || !btn) return null;
    function set(el, val) {
      if (!el || val == null) return;
      var proto = el.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, val);          // React-safe
      el.dispatchEvent(new win.Event("input", { bubbles: true }));
      el.dispatchEvent(new win.Event("change", { bubbles: true }));
      el.dispatchEvent(new win.Event("blur", { bubbles: true }));
    }
    set(fname, v.fname); set(lname, v.lname); set(email, v.email); set(phone, v.phone);
    TEXT_ORDER.forEach(function (k, i) { set(doc.getElementById(FIELD[k]) || texts[i], v[k]); });
    return btn;
  }
  function formErrors(doc) {
    var form = doc.querySelector("form"); if (!form) return "";
    var msgs = Array.prototype.map.call(form.querySelectorAll('[role="alert"], [class*="error" i]'), function (e) {
      return e.offsetParent !== null ? (e.textContent || "").trim() : "";
    }).filter(Boolean);
    return msgs.filter(function (m, i) { return msgs.indexOf(m) === i; }).join(" ");
  }

  function submitSignup(v) {
    var formUrl = new URL(CFG.form, location.href);
    if (formUrl.origin !== location.origin) {
      // Not on the campaign site (e.g. GitHub Pages preview): hand off to the
      // form page, where pg-form-autofill.js fills and submits it. Data rides
      // in the #hash so it's never sent to a server or logged.
      var payload = btoa(unescape(encodeURIComponent(JSON.stringify(v))));
      location.href = formUrl.href.split("#")[0] + "#pg=" + encodeURIComponent(payload);
      return new Promise(function () {});
    }
    return new Promise(function (resolve, reject) {
      var ifr = document.createElement("iframe"), stage = "load", poll = null, done = false, sqForm = null;
      ifr.setAttribute("data-pg-frame", "1");
      ifr.setAttribute("aria-hidden", "true");
      ifr.tabIndex = -1;
      // Kept in the viewport (behind the page, invisible) so lazy-rendered form blocks still render.
      ifr.style.cssText = "position:fixed;left:0;top:0;width:900px;height:1200px;max-width:100vw;border:0;opacity:0;pointer-events:none;z-index:-1";
      var giveUp = setTimeout(function () {
        finish(stage === "submitted"
          ? new Error("We couldn’t confirm your sign-up. Please wait a few minutes and refresh before trying again — it may have gone through.")
          : new Error("The sign-up form didn’t load. Please try again."));
      }, 30000);
      function finish(err) {
        if (done) return; done = true;
        clearTimeout(giveUp); clearInterval(poll);
        setTimeout(function () { ifr.remove(); }, 500);
        err ? reject(err) : resolve();
      }
      ifr.onload = function () {
        var doc; try { doc = ifr.contentDocument; } catch (e) { return finish(new Error("Couldn’t open the sign-up form.")); }
        if (!doc || doc.location.href === "about:blank") return;
        if (stage === "submitted") return finish();          // form redirected (to /poll-greeting) => accepted
        if (stage !== "load") return;
        stage = "fill";
        var tries = 0;
        poll = setInterval(function () {
          doc = ifr.contentDocument || doc;
          if (stage === "fill") {
            var btn = fillForm(doc, v);
            if (!btn) { if (++tries > 60) finish(new Error("The sign-up form didn’t load. Please try again.")); return; }
            if (CFG.dryRun) { clearInterval(poll); console.log("[poll-greet] dry run: form filled, not submitted", v); return finish(); }
            stage = "submitted"; tries = 0; sqForm = btn.form;
            setTimeout(function () { btn.click(); }, 150);
            return;
          }
          // Success = the form page navigated away (Squarespace redirects to
          // /poll-greeting) or replaced the form with its thank-you message.
          if (doc.location.pathname !== formUrl.pathname || !sqForm.isConnected || !sqForm.querySelector('button[type="submit"]')) return finish();
          if (++tries > 6) { var e = formErrors(doc); if (e) finish(new Error(e)); }
        }, 250);
      };
      ifr.src = formUrl.href;
      document.body.appendChild(ifr);
    });
  }

  // =================================================================
  function start() {
    var NAVY = "#0e2952";

    var map = L.map("pg-map", { scrollWheelZoom: false, zoomControl: true, zoomSnap: 0.25 }).setView([30.3, -97.68], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &middot; Polling places: Travis County'
    }).addTo(map);
    setTimeout(function () { map.invalidateSize(); }, 300);

    var panel = document.getElementById("pg-panel"), daySel = document.getElementById("pg-day");
    var sites = [], byName = {}, counts = {}, markers = {};
    var state = { site: null, day: null, picked: {}, filterDay: "", form: { fname: "", lname: "", email: "", phone: "", notes: "" } };

    // counts[site][slotKey] = n
    function countOf(site, key) { return (counts[site] && counts[site][key]) || 0; }
    function addSignup(site, slots) {
      var c = counts[site] = counts[site] || {};
      slots.forEach(function (k) { c[k] = (c[k] || 0) + 1; });
    }
    function siteTotal(site, day) {
      var c = counts[site] || {}, n = 0;
      Object.keys(c).forEach(function (k) { if (!day || k.indexOf(day) === 0) n += c[k]; });
      return n;
    }

    // ---- sign-up counts --------------------------------------------
    // The page renders right away with the last counts this browser saw
    // (localStorage), and a status bar makes it clear the latest numbers are
    // still loading — the Apps Script endpoint can take 1–50 s. Pins and the
    // sign-up form work the whole time.
    var CACHE_KEY = "pg-keys-v1", countsKnown = false, serverKeys = [], localKeys = [], savedAt = 0, liveAt = 0;
    function keysOf(rows) {
      var out = [];
      rows.forEach(function (r) { for (var i = 0; i < r.length; i++) if (decodeKey(r[i])) { out.push(r[i].slice(r[i].indexOf("PG|v1|")).trim()); break; } });
      return out;
    }
    function rebuildCounts() {
      counts = {};
      // Sign-ups made in this tab count until the sheet reflects them (matched by exact key).
      var pending = localKeys.slice();
      serverKeys.forEach(function (k) { var j = pending.indexOf(k); if (j !== -1) pending.splice(j, 1); });
      serverKeys.concat(pending).forEach(function (k) { var s = decodeKey(k); if (s) addSignup(s.site, s.slots); });
    }
    function refreshViews() {
      if (!sites.length) return;
      drawMarkers();
      var a = document.activeElement;
      if (!(a && panel.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName))) renderPanel();   // don't yank focus mid-typing
    }
    try {
      var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && cached.keys) { serverKeys = cached.keys; savedAt = cached.at || 0; countsKnown = true; rebuildCounts(); }
    } catch (e) {}

    // Status bar: loading (big, with elapsed seconds) → ok (small, green) / err.
    var liveEl = document.getElementById("pg-live"),
        live = { mode: "loading", started: Date.now(), busy: false, inflight: false, retried: false }, liveTick = null;
    function whenText(ms) {
      var d = new Date(ms), t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      return new Date().toDateString() === d.toDateString() ? t : MON[d.getMonth()] + " " + d.getDate() + ", " + t;
    }
    function renderLive() {
      var secs = Math.round((Date.now() - live.started) / 1000), h;
      if (live.mode === "loading") {
        h = '<span class="pg-spin pg-spin-dark"></span><div><strong>Loading the latest sign-ups\u2026</strong> <span class="pg-live-secs">' + secs + "s</span>" +
            '<div class="pg-live-sub">' + (countsKnown && savedAt ? "Showing counts saved at " + whenText(savedAt) + " until it finishes. " : "") +
            "This can take up to a minute \u2014 you can browse and sign up in the meantime.</div></div>";
      } else if (live.mode === "ok") {
        h = (live.busy ? '<span class="pg-spin pg-spin-dark"></span>' : '<span class="pg-live-dot"></span>') + "<div>" +
            (live.busy ? "Checking for new sign-ups\u2026"
                       : "<strong>Up to date</strong> &middot; sign-ups as of " + whenText(liveAt) + ' &nbsp;<a href="#" class="pg-link" data-live-refresh>Refresh</a>') + "</div>";
      } else {
        h = "<div><strong>Couldn\u2019t load the latest sign-ups.</strong> " +
            (countsKnown && savedAt ? "Showing counts saved at " + whenText(savedAt) + ". " : "You can still sign up. ") +
            '<a href="#" class="pg-link" data-live-refresh>Try again</a></div>';
      }
      liveEl.className = "pg-live " + live.mode;
      liveEl.innerHTML = h;
      var r = liveEl.querySelector("[data-live-refresh]");
      if (r) r.addEventListener("click", function (e) { e.preventDefault(); fetchLatest(sheetRows(), live.mode === "err"); });
    }
    function fetchLatest(p, loud) {
      if (live.inflight) return;
      live.inflight = true;
      if (loud || !liveAt) { live.mode = "loading"; live.started = Date.now(); } else live.busy = true;
      clearInterval(liveTick);
      liveTick = setInterval(function () { if (live.mode === "loading") renderLive(); }, 1000);
      renderLive();
      p.then(function (rows) {
        serverKeys = keysOf(rows); countsKnown = true; liveAt = savedAt = Date.now();
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ keys: serverKeys, at: savedAt })); } catch (e) {}
        rebuildCounts(); refreshViews();
        live.mode = "ok";
      }, function (e) {
        console.error("poll-greet: counts", e);
        if (!liveAt && !live.retried) {                  // one quiet automatic retry on first load
          live.retried = true; live.inflight = false;
          setTimeout(function () { fetchLatest(sheetRows(), true); }, 2000);
          return "retrying";
        }
        if (!liveAt) live.mode = "err";                  // a failed background check keeps the last good answer
      }).then(function (r) {
        if (r === "retrying") return;
        live.inflight = false; live.busy = false;
        clearInterval(liveTick); renderLive();
      });
    }
    fetchLatest(EARLY.counts, true);
    // While the page is open, quietly pick up new sign-ups every minute.
    setInterval(function () { if (!document.hidden && live.mode === "ok") fetchLatest(sheetRows(), false); }, 60000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && live.mode === "ok" && Date.now() - liveAt > 60000) fetchLatest(sheetRows(), false);
    });

    Promise.all([EARLY.outline, EARLY.polling]).then(function (res) {
      var outline = res[0], d1 = outline.features[0];
      L.geoJSON(outline, { style: { stroke: false, fillColor: NAVY, fillOpacity: 0.2 }, interactive: false }).addTo(map);
      var ol = L.geoJSON(outline, { style: { color: NAVY, weight: 3.5, opacity: 1, fill: false }, interactive: false }).addTo(map);

      res[1].forEach(function (s) {
        var pt = [s.lng, s.lat], inD1 = inFeature(pt, d1);
        if (!inD1 && !(CFG.buffer > 0 && milesToEdge(pt, d1) <= CFG.buffer)) return;
        s.inD1 = inD1; s.days = siteDays(s);
        sites.push(s); byName[s.n] = s;
      });
      sites.sort(function (a, b) { return (b.inD1 - a.inD1) || ((b.k === "both") - (a.k === "both")) || a.n.localeCompare(b.n); });

      var allBounds = ol.getBounds();
      sites.forEach(function (s) { allBounds.extend([s.lat, s.lng]); });
      function fit() { map.invalidateSize(); map.fitBounds(allBounds, { padding: [16, 16] }); }
      fit(); setTimeout(fit, 300); window.addEventListener("load", fit);

      var legend = L.control({ position: "bottomleft" });
      legend.onAdd = function () {
        var d = L.DomUtil.create("div", "pg-legend");
        d.innerHTML = '<div><span class="sw" style="background:#fa721e"></span>Early voting + Election Day</div>' +
                      '<div><span class="sw" style="background:#0e2952"></span>Election Day only</div>' +
                      '<div style="color:#5b6b82">Number = greeter sign-ups</div>';
        return d;
      };
      legend.addTo(map);

      // Day filter
      var allDays = EV_DAYS.concat([ED_DAY]).filter(function (d) { return !isPast(d, 23); });
      daySel.innerHTML = '<option value="">All days</option>' + allDays.map(function (d) {
        return '<option value="' + d + '">' + dayLabel(d) + (d === ED_DAY ? " · Election Day" : "") + "</option>";
      }).join("");
      daySel.addEventListener("change", function () {
        state.filterDay = daySel.value;
        if (state.filterDay && state.site && state.site.days.indexOf(state.filterDay) !== -1) state.day = state.filterDay;
        drawMarkers(); renderPanel();
      });

      drawMarkers();
      renderPanel();
    }).catch(function (err) {
      document.getElementById("pg-map").innerHTML = '<p style="padding:1em;color:#b91c1c">Map data failed to load.</p>';
      console.error("poll-greet:", err);
    });

    function drawMarkers() {
      Object.keys(markers).forEach(function (k) { map.removeLayer(markers[k]); });
      markers = {};
      sites.forEach(function (s) {
        if (state.filterDay && s.days.indexOf(state.filterDay) === -1) return;
        var n = siteTotal(s.n, state.filterDay), sel = state.site === s, label = countsKnown ? n : "·";
        var icon = L.divIcon({
          className: "", iconSize: [30, 30], iconAnchor: [15, 15],
          html: '<div class="pg-pin ' + (s.k === "both" ? "ev" : "ed") + (s.inD1 ? "" : " near") + (sel ? " sel" : "") + '">' + label + "</div>"
        });
        var m = L.marker([s.lat, s.lng], { icon: icon, zIndexOffset: sel ? 1000 : (s.k === "both" ? 500 : 0), keyboard: true, title: s.n })
          .addTo(map)
          .bindTooltip(esc(s.n) + '<br><span style="font-weight:400">' + (countsKnown ? n + " sign-up" + (n === 1 ? "" : "s") + (state.filterDay ? " on " + dayLabel(state.filterDay) : "") : "loading sign-ups…") + "</span>",
            { className: "pg-tip", direction: "top", offset: [0, -14] })
          .on("click", function () { selectSite(s); });
        markers[s.n] = m;
      });
    }

    function selectSite(s) {
      if (state.site !== s) state.picked = {};
      state.site = s;
      var upcoming = s.days.filter(function (d) { return !isPast(d, 23); });
      state.day = state.filterDay && upcoming.indexOf(state.filterDay) !== -1 ? state.filterDay : upcoming[0] || s.days[s.days.length - 1];
      state.msg = null;
      drawMarkers(); renderPanel();
      map.panTo([s.lat, s.lng]);
      if (window.innerWidth < 800) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function pickedKeys() { return Object.keys(state.picked).filter(function (k) { return state.picked[k]; }).sort(); }

    function renderPanel() {
      var s = state.site, html = "";
      var siteOpts = '<option value="">Choose a polling place…</option>' +
        '<optgroup label="In District 1">' + sites.filter(function (x) { return x.inD1; }).map(opt).join("") + "</optgroup>" +
        (sites.some(function (x) { return !x.inD1; }) ? '<optgroup label="Near District 1">' + sites.filter(function (x) { return !x.inD1; }).map(opt).join("") + "</optgroup>" : "");
      function opt(x) { return '<option value="' + esc(x.n) + '"' + (x === s ? " selected" : "") + ">" + esc(x.n) + (x.k === "both" ? " (early + Election Day)" : "") + "</option>"; }

      if (state.msg && state.msg.ok && !s) {
        html += '<div class="pg-msg ok" style="margin:0 0 12px">' + state.msg.html + "</div>";
      }
      html += '<select id="pg-site" class="pg-select" aria-label="Polling place">' + siteOpts + "</select>";

      if (!s) {
        html += '<p class="pg-muted" style="margin:14px 2px 0">Tap a polling place on the map (or pick one above) to see open poll-greeting shifts and sign up. ' +
                'Orange sites are open for early voting (Oct 19&ndash;30) and on Election Day (Nov 3); navy sites are Election Day only.</p>';
        panel.innerHTML = html; bindPanel(); return;
      }

      html += '<div style="margin-top:14px"><div class="pg-h">' + esc(s.n) + "</div>" +
        '<div class="pg-muted">' + (s.r ? esc(s.r) + " &middot; " : "") + esc(s.a) + "</div>" +
        '<span class="pg-badge ' + (s.inD1 ? 'pg-b-in">In District 1' : 'pg-b-near">Near District 1') + "</span>" +
        '<span class="pg-badge pg-b-ev">' + (s.k === "both" ? "Early voting + Election Day" : "Election Day only") + "</span>" +
        (s.note ? '<div class="pg-muted" style="margin-top:4px"><em>' + esc(s.note) + "</em></div>" : "") +
        ' <a class="pg-link" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.n + ", " + s.a) + '" target="_blank" rel="noopener">Map &rarr;</a></div>';

      // Days
      html += '<span class="pg-label">1 &middot; Pick a day</span><div class="pg-chips">' + s.days.map(function (d) {
        var past = isPast(d, 23), n = siteTotal(s.n, d), mine = pickedKeys().some(function (k) { return k.indexOf(d) === 0; });
        return '<button type="button" class="pg-chip' + (d === state.day ? " on" : "") + (mine ? " has" : "") + '" data-day="' + d + '"' + (past ? " disabled" : "") + ">" +
          dayLabel(d) + "<small>" + (countsKnown ? n + " signed up" : "…") + "</small></button>";
      }).join("") + "</div>";

      // Hours
      html += '<span class="pg-label">2 &middot; Pick hours <span style="text-transform:none;letter-spacing:0;font-weight:500;color:#5b6b82">(pick as many as you like)</span></span><div class="pg-slots">' +
        siteHours(s, state.day).map(function (h) {
          var key = slotKey(state.day, h), n = countOf(s.n, key), on = !!state.picked[key], past = isPast(state.day, h);
          var cls = "pg-slot" + (on ? " on" : "") + (!countsKnown ? "" : n >= CFG.target ? " full" : n === 0 ? " need" : "");
          var sub = !countsKnown ? "…" : n === 0 ? "Needs greeters" : n + " signed up";
          return '<button type="button" class="' + cls + '" data-slot="' + key + '"' + (past ? " disabled" : "") + ' aria-pressed="' + on + '"><b>' + rangeLabel(h, h + 1) + "</b><span>" + sub + "</span></button>";
        }).join("") + "</div>";

      var picked = pickedKeys();
      if (picked.length) html += '<div class="pg-picked"><strong>Your shifts:</strong> ' + esc(shiftText(picked)) + ' &nbsp;<a href="#" class="pg-link" id="pg-clear">clear</a></div>';

      // Contact
      var f = state.form;
      html += '<span class="pg-label">3 &middot; Your info</span>' +
        '<form id="pg-form" novalidate>' +
        '<div class="pg-grid2"><input class="pg-input" name="fname" placeholder="First name" autocomplete="given-name" required value="' + esc(f.fname) + '">' +
        '<input class="pg-input" name="lname" placeholder="Last name" autocomplete="family-name" required value="' + esc(f.lname) + '"></div>' +
        '<div class="pg-grid2" style="margin-top:8px"><input class="pg-input" name="email" type="email" placeholder="Email" autocomplete="email" required value="' + esc(f.email) + '">' +
        '<input class="pg-input" name="phone" type="tel" placeholder="Phone" autocomplete="tel-national" required value="' + esc(f.phone) + '"></div>' +
        '<div class="pg-muted" style="margin:6px 2px 0">We\u2019ll use your email and phone to confirm your shift and send details.</div>' +
        '<input class="pg-input" name="notes" style="margin-top:8px" placeholder="Notes (optional) — e.g. bringing a friend" value="' + esc(f.notes) + '">' +
        '<button type="submit" class="pg-btn" id="pg-submit">Sign me up' + (picked.length ? " for " + picked.length + " hour" + (picked.length === 1 ? "" : "s") : "") + "</button>" +
        "</form>";
      if (state.msg) html += '<div class="pg-msg ' + (state.msg.ok ? "ok" : "err") + '" role="status">' + state.msg.html + "</div>";

      panel.innerHTML = html;
      bindPanel();
    }

    function bindPanel() {
      var sel = document.getElementById("pg-site");
      sel.addEventListener("change", function () { var s = byName[sel.value]; if (s) selectSite(s); });
      if (!state.site) return;
      Array.prototype.forEach.call(panel.querySelectorAll("[data-day]"), function (b) {
        b.addEventListener("click", function () { state.day = b.getAttribute("data-day"); renderPanel(); });
      });
      Array.prototype.forEach.call(panel.querySelectorAll("[data-slot]"), function (b) {
        b.addEventListener("click", function () { var k = b.getAttribute("data-slot"); state.picked[k] = !state.picked[k]; state.msg = null; renderPanel(); });
      });
      var clr = document.getElementById("pg-clear");
      if (clr) clr.addEventListener("click", function (e) { e.preventDefault(); state.picked = {}; renderPanel(); });
      var form = document.getElementById("pg-form");
      form.addEventListener("input", function (e) { if (e.target.name) state.form[e.target.name] = e.target.value; });
      form.addEventListener("submit", onSubmit);
    }

    function onSubmit(e) {
      e.preventDefault();
      var f = state.form, s = state.site, picked = pickedKeys();
      function fail(m) { state.msg = { ok: false, html: m }; renderPanel(); }
      if (!picked.length) return fail("Pick at least one hour above.");
      if (!f.fname.trim() || !f.lname.trim()) return fail("Please enter your first and last name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return fail("Please enter a valid email address.");
      var digits = f.phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
      if (digits.length !== 10) return fail("Please enter a 10-digit phone number so we can reach you.");

      var v = {
        fname: f.fname.trim(), lname: f.lname.trim(), email: f.email.trim(), phone: digits,
        shift: "Shift: " + shiftText(picked),
        location: "Location: " + s.n + " (" + s.a + ")",
        notes: f.notes.trim() ? "Notes: " + f.notes.trim() : "",
        key: encodeKey(s.n, picked)
      };
      var btn = document.getElementById("pg-submit");
      btn.disabled = true; btn.innerHTML = '<span class="pg-spin"></span>Signing you up…';

      submitSignup(v).then(function () {
        localKeys.push(v.key); rebuildCounts();
        var summary = esc(shiftText(picked));
        state.picked = {}; state.form.notes = "";
        state.msg = { ok: true, html: "<strong>You’re signed up, " + esc(v.fname) + "!</strong><br>" + esc(s.n) + " &middot; " + summary +
          "<br>We’ll be in touch with details. Want another shift? Pick more hours or another location." };
        drawMarkers(); renderPanel();
      }).catch(function (err) {
        fail(esc(err.message || "Something went wrong. Please try again."));
      });
    }
  }

  // Start every network request now, in parallel with loading Leaflet —
  // the counts endpoint (Apps Script) can take several seconds.
  function dataUrl(p) { return (DATA_BASE ? DATA_BASE.replace(/\/$/, "") + "/" : "") + p; }
  var EARLY = {
    outline: fetch(dataUrl("d1-outline.geojson")).then(function (r) { return r.json(); }),
    polling: fetch(dataUrl("d1-polling.json")).then(function (r) { return r.json(); }),
    counts:  sheetRows()
  };
  EARLY.counts.catch(function () {});              // handled in start(); avoid unhandled-rejection noise
  loadLeaflet(start);
})();
