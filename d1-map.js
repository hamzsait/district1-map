/*!
 * District 1 public map widget — https://github.com/hamzsait/district1-map
 *
 * Embed with:
 *   <div id="d1-map-root"></div>
 *   <script src="https://cdn.jsdelivr.net/gh/hamzsait/district1-map@main/d1-map.js"></script>
 *
 * Data files (d1-outline.geojson, d1-precincts.geojson) are loaded from the same
 * location this script was loaded from, so nothing here needs editing.
 */
(function () {
  var LEAFLET_CSS = { href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", integrity: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" };
  var LEAFLET_JS  = { src:  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",  integrity: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" };

  // Where am I loaded from? Data lives next to this file.
  var me = document.currentScript || (function () { var s = document.getElementsByTagName("script"); return s[s.length - 1]; })();
  var DATA_BASE = (me && me.src ? me.src.replace(/\/[^\/]*$/, "") : "");

  var root = document.getElementById("d1-map-root") || (function () {
    var d = document.createElement("div"); d.id = "d1-map-root"; me.parentNode.insertBefore(d, me); return d;
  })();
  if (root.getAttribute("data-d1-loaded")) return;   // guard against double-inclusion
  root.setAttribute("data-d1-loaded", "1");

  // ---- styles + markup -----------------------------------------
  var style = document.createElement("style");
  style.textContent = '#d1-wrap { font-family: inherit; color: #0e2952; }\n  #d1-map .leaflet-container { font: 13px/1.4 "Prompt", Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }\n  #d1-wrap .d1-input { width:100%; box-sizing:border-box; padding:12px 16px; border:2px solid #0e2952; border-radius:999px; font-size:16px; font-family:inherit; color:#0e2952; background:#fff; outline:none; }\n  #d1-wrap .d1-input:focus { box-shadow:0 0 0 3px rgba(250,114,30,.35); }\n  #d1-wrap .d1-input::placeholder { color:#6b7a90; }\n  #d1-wrap .d1-btn { padding:12px 22px; border-radius:999px; font-size:15px; font-weight:600; font-family:inherit; cursor:pointer; letter-spacing:.02em; white-space:nowrap; }\n  #d1-wrap .d1-btn-primary { background:#fa721e; color:#fff; border:2px solid #fff; box-shadow:0 0 0 2px #fa721e; }\n  #d1-wrap .d1-btn-primary:hover { background:#e8630f; }\n  #d1-wrap .d1-btn-secondary { background:#fff; color:#0e2952; border:2px solid #0e2952; }\n  #d1-wrap .d1-btn-secondary:hover { background:#f8f4ec; }\n  #d1-wrap .d1-sugg { position:absolute; left:12px; right:12px; top:calc(100% + 4px); z-index:2000; background:#fff; border:2px solid #0e2952; border-radius:14px; box-shadow:0 6px 18px rgba(14,41,82,.18); margin:0; padding:6px 0; list-style:none; max-height:280px; overflow-y:auto; }\n  #d1-wrap .d1-sugg li { padding:9px 16px; cursor:pointer; font-size:15px; line-height:1.3; color:#0e2952; }\n  #d1-wrap .d1-sugg li small { display:block; color:#5b6b82; font-size:12.5px; }\n  #d1-wrap .d1-sugg li:hover, #d1-wrap .d1-sugg li.active { background:#f8f4ec; }\n  #d1-map .precinct-tip { background:#0e2952; color:#fff; border:0; border-radius:8px; padding:5px 10px; font-weight:600; box-shadow:0 2px 8px rgba(14,41,82,.3); }\n  #d1-map .precinct-tip::before { display:none; }\n  #d1-map .d1-legend { background:#fff; color:#0e2952; padding:10px 12px; border-radius:10px; border:2px solid #0e2952; line-height:1.7; font-size:13px; }\n  #d1-map .d1-legend .sw { display:inline-block; width:22px; height:13px; vertical-align:middle; margin-right:7px; border-radius:3px; box-sizing:border-box; }\n  #d1-map .leaflet-popup-content-wrapper { border-radius:12px; border:2px solid #0e2952; box-shadow:0 6px 18px rgba(14,41,82,.2); color:#0e2952; }\n  #d1-map .leaflet-popup-tip { background:#0e2952; }\n  #d1-map .leaflet-bar a { color:#0e2952; }\n  #d1-map .leaflet-tile-pane { filter: saturate(.45) contrast(.92); }\n  #d1-map .leaflet-control-attribution a { color:#0e2952; }';
  document.head.appendChild(style);

  root.innerHTML = '<div id="d1-wrap" style="width:100%">\n  <form id="d1-search" style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 10px">\n    <div style="flex:1 1 260px;min-width:0;position:relative">\n      <input id="d1-q" class="d1-input" type="text" placeholder="Start typing an Austin address…" autocomplete="off" />\n      <ul id="d1-sugg" class="d1-sugg" hidden></ul>\n    </div>\n    <button type="submit" class="d1-btn d1-btn-primary">Search</button>\n    <button type="button" id="d1-locate" class="d1-btn d1-btn-secondary">&#9673; Use my location</button>\n  </form>\n  <div id="d1-result" style="min-height:24px;margin:0 0 10px;font-size:16px"></div>\n  <div id="d1-map" style="height:560px;width:100%;border-radius:16px;overflow:hidden;background:#f8f4ec;border:2px solid #0e2952"></div>\n</div>';

  // ---- load Leaflet (once), then boot ---------------------------
  function loadLeaflet(cb) {
    if (!document.querySelector('link[href="' + LEAFLET_CSS.href + '"]')) {
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = LEAFLET_CSS.href;
      l.integrity = LEAFLET_CSS.integrity; l.crossOrigin = ""; document.head.appendChild(l);
    }
    if (window.L && L.geoJSON) return cb();
    var s = document.createElement("script"); s.src = LEAFLET_JS.src; s.integrity = LEAFLET_JS.integrity;
    s.crossOrigin = ""; s.onload = cb;
    s.onerror = function () { document.getElementById("d1-map").innerHTML = '<p style="padding:1em;color:#b91c1c">Map library failed to load.</p>'; };
    document.head.appendChild(s);
  }

function start(DATA_BASE) {
  var NAVY = "#0e2952", ORANGE = "#fa721e", LIGHT_BLUE = "#8eb8cc";
  // ------------------------------------------------------------

  function base(p) { return (DATA_BASE ? DATA_BASE.replace(/\/$/, "") + "/" : "") + p; }

  var map = L.map("d1-map", { scrollWheelZoom: false, zoomControl: true, zoomSnap: 0.25 })
    .setView([30.33, -97.63], 11);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &middot; Boundaries: Texas Legislative Council, City of Austin'
  }).addTo(map);

  var precinctLayer, outlineLayer;

  Promise.all([
    fetch(base("d1-precincts.geojson")).then(function (r) { return r.json(); }),
    fetch(base("d1-outline.geojson")).then(function (r) { return r.json(); })
  ]).then(function (res) {
    var precincts = res[0], outline = res[1];

    // 1) Solid district shading underneath everything
    L.geoJSON(outline, { style: { stroke: false, fillColor: NAVY, fillOpacity: 0.28 }, interactive: false }).addTo(map);

    // 2) Precinct boundaries (hover to highlight in orange)
    precinctLayer = L.geoJSON(precincts, {
      style: { color: NAVY, weight: 1.2, opacity: 0.55, fillColor: NAVY, fillOpacity: 0 },
      onEachFeature: function (f, layer) {
        layer.bindTooltip("Precinct " + f.properties.p, { sticky: true, className: "precinct-tip", direction: "top" });
        layer.on({
          mouseover: function (e) { e.target.setStyle({ fillColor: ORANGE, fillOpacity: 0.45, color: ORANGE, weight: 2.5, opacity: 1 }); e.target.bringToFront(); },
          mouseout: function (e) { precinctLayer.resetStyle(e.target); }
        });
      }
    }).addTo(map);

    // 3) Bold district outline on top
    outlineLayer = L.geoJSON(outline, { style: { color: NAVY, weight: 4, opacity: 1, fill: false }, interactive: false }).addTo(map);
    outlineLayer.bringToFront();

    function fit() { map.invalidateSize(); map.fitBounds(outlineLayer.getBounds(), { padding: [12, 12] }); }
    fit();
    setTimeout(fit, 300);
    window.addEventListener("load", fit);

    var legend = L.control({ position: "bottomleft" });
    legend.onAdd = function () {
      var d = L.DomUtil.create("div", "d1-legend");
      d.innerHTML =
        '<div><span class="sw" style="border:2px solid ' + NAVY + ';background:rgba(14,41,82,.28)"></span><strong>District 1</strong></div>' +
        '<div><span class="sw" style="border:1px solid ' + NAVY + ';opacity:.7"></span>Voting precinct</div>';
      return d;
    };
    legend.addTo(map);
    enableLookup(precincts, outline);
  }).catch(function (err) {
    document.getElementById("d1-map").innerHTML =
      '<p style="padding:1em;color:#b91c1c">Map data failed to load.</p>';
    console.error("D1 map:", err);
  });

  // Squarespace sometimes lays the block out after Leaflet measures it.
  setTimeout(function () { map.invalidateSize(); }, 300);

  // ---- Address search + geolocation --------------------------
  var form = document.getElementById("d1-search"),
      input = document.getElementById("d1-q"),
      locateBtn = document.getElementById("d1-locate"),
      resultEl = document.getElementById("d1-result"),
      marker = null;

  // Ray-casting point-in-polygon for GeoJSON Polygon / MultiPolygon ([lng, lat]).
  function inRing(pt, ring) {
    var x = pt[0], y = pt[1], inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function inPolygon(pt, polyCoords) {           // outer ring + holes
    if (!inRing(pt, polyCoords[0])) return false;
    for (var h = 1; h < polyCoords.length; h++) if (inRing(pt, polyCoords[h])) return false;
    return true;
  }
  function inFeature(pt, f) {
    var g = f.geometry;
    if (g.type === "Polygon") return inPolygon(pt, g.coordinates);
    if (g.type === "MultiPolygon") return g.coordinates.some(function (p) { return inPolygon(pt, p); });
    return false;
  }

  function setResult(html, isErr) {
    resultEl.innerHTML = html;
    resultEl.style.color = isErr ? "#c2410c" : "#0e2952";
  }

  function enableLookup(precincts, outline) {
    function showPoint(lat, lng, label) {
      var pt = [lng, lat];
      var inD1 = inFeature(pt, outline.features[0]);
      var pct = null;
      for (var i = 0; i < precincts.features.length; i++) {
        if (inFeature(pt, precincts.features[i])) { pct = precincts.features[i].properties.p; break; }
      }
      if (marker) map.removeLayer(marker);
      marker = L.circleMarker([lat, lng], { radius: 9, color: "#fff", weight: 3, fillColor: ORANGE, fillOpacity: 1 }).addTo(map);
      var msg = inD1
        ? '<strong style="color:#fa721e">&#10003; In District 1</strong>' + (pct != null ? ' <span style="color:#0e2952">&middot; Precinct ' + pct + "</span>" : "")
        : '<strong style="color:#0e2952">Not in District 1</strong>';
      if (label) msg += '<div style="font-size:13px;color:#5b6b82">' + label + "</div>";
      marker.bindPopup(msg).openPopup();
      setResult(msg);
      map.flyTo([lat, lng], Math.max(map.getZoom(), 13.5));
    }

    // ---- City of Austin address locator (typeahead + house-number interpolation)
    var GEO = "https://maps.austintexas.gov/arcgis/rest/services/Geocode/COA_Locator/GeocodeServer";
    var suggEl = document.getElementById("d1-sugg"),
        suggestions = [], activeIdx = -1, debounceT = null, lastReq = 0;

    function titleCase(t) {
      return t.replace(/\w\S*/g, function (w) {
        var core = w.replace(/[^A-Za-z]/g, "");
        if (/^\d+(ST|ND|RD|TH)\b/i.test(w)) return w.toLowerCase();          // 11TH -> 11th
        return /^(TX|NE|NW|SE|SW|N|S|E|W|IH|US|FM|RM|RR)$/.test(core) || /\d/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase();
      });
    }
    function suggest(q) {
      var url = GEO + "/suggest?f=json&maxSuggestions=6&text=" + encodeURIComponent(q);
      return fetch(url).then(function (r) { return r.json(); }).then(function (j) { return j.suggestions || []; });
    }
    function geocode(text, magicKey) {
      var url = GEO + "/findAddressCandidates?f=json&outSR=4326&maxLocations=1&SingleLine=" + encodeURIComponent(text) +
                (magicKey ? "&magicKey=" + encodeURIComponent(magicKey) : "");
      return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
        var c = (j.candidates || [])[0];
        return c && c.score >= 60 ? c : null;
      });
    }
    function labelOf(sg) {
      var parts = sg.text.split(","), main = titleCase(parts[0].trim());
      return { main: main, sub: parts.slice(1).join(",").replace(/^\s+/, "").replace(/\b(\w)(\w*)/g, function (_, a, b) { return a + b.toLowerCase(); }).replace(/\bTx\b/, "TX") };
    }
    function hideSugg() { suggEl.hidden = true; suggEl.innerHTML = ""; suggestions = []; activeIdx = -1; }
    function renderSugg(list) {
      suggestions = list; activeIdx = -1; suggEl.innerHTML = "";
      if (!list.length) { hideSugg(); return; }
      list.forEach(function (sg, i) {
        var l = labelOf(sg), li = document.createElement("li");
        li.innerHTML = l.main + (l.sub ? "<small>" + l.sub + "</small>" : "");
        li.addEventListener("mousedown", function (e) { e.preventDefault(); choose(i); });
        suggEl.appendChild(li);
      });
      suggEl.hidden = false;
    }
    function setActive(i) {
      activeIdx = i;
      Array.prototype.forEach.call(suggEl.children, function (li, k) { li.classList.toggle("active", k === i); });
    }
    function locate(text, magicKey) {
      setResult("Searching&hellip;");
      geocode(text, magicKey).then(function (c) {
        if (!c) { setResult("Couldn't find that address. Try adding the street name or ZIP code.", true); return; }
        input.value = titleCase(c.address);
        showPoint(c.location.y, c.location.x, titleCase(c.address));
      }).catch(function () { setResult("Address lookup failed. Please try again.", true); });
    }
    function choose(i) {
      var sg = suggestions[i]; if (!sg) return;
      hideSugg();
      // If the user typed a house number but the suggestion is just a street, keep their number.
      var num = (input.value.trim().match(/^\d+[A-Za-z]?\b/) || [])[0];
      if (num && !/^\d/.test(sg.text)) locate(num + " " + sg.text, null);
      else locate(sg.text, sg.magicKey);
    }

    input.addEventListener("input", function () {
      var q = input.value.trim();
      clearTimeout(debounceT);
      if (q.length < 3) { hideSugg(); return; }
      debounceT = setTimeout(function () {
        var reqId = ++lastReq;
        suggest(q).then(function (list) { if (reqId === lastReq) renderSugg(list); })
                  .catch(function () {});
      }, 250);
    });
    input.addEventListener("keydown", function (e) {
      if (suggEl.hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(activeIdx + 1, suggestions.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); }
      else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); choose(activeIdx); }
      else if (e.key === "Escape") { hideSugg(); }
    });
    input.addEventListener("blur", function () { setTimeout(hideSugg, 150); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearTimeout(debounceT);
      var q = input.value.trim();
      if (!q) return;
      if (!suggEl.hidden && suggestions.length) { choose(activeIdx >= 0 ? activeIdx : 0); return; }
      hideSugg();
      locate(q, null);
    });

    locateBtn.addEventListener("click", function () {
      if (!navigator.geolocation) { setResult("Your browser doesn't support location.", true); return; }
      setResult("Getting your location&hellip;");
      navigator.geolocation.getCurrentPosition(
        function (pos) { showPoint(pos.coords.latitude, pos.coords.longitude, "Your current location"); },
        function (err) {
          setResult(err.code === 1 ? "Location access was denied. You can type an address instead." : "Couldn't get your location.", true);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
}

  loadLeaflet(function () { start(DATA_BASE); });
})();
