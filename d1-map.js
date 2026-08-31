/*!
 * District 1 map — bootstrap. https://github.com/hamzsait/district1-map
 *
 * Embed with:
 *   <div id="d1-map-root"></div>
 *   <script src="https://hamzsait.github.io/district1-map/d1-map.js"></script>
 *
 * This file intentionally never changes (CDNs and browsers cache it for days).
 * It loads the actual widget (d1-widget.js) from GitHub Pages, which is served
 * with a 10-minute cache, so pushes to the repo go live quickly for everyone.
 */
(function () {
  var PAGES = "https://hamzsait.github.io/district1-map";
  var me = document.currentScript || (function () { var s = document.getElementsByTagName("script"); return s[s.length - 1]; })();
  var here = me && me.src ? me.src.replace(/\/[^\/]*$/, "") : "";
  // Served from a CDN mirror of the repo -> use Pages. Served locally / elsewhere -> stay relative (local preview).
  var base = /cdn\.jsdelivr\.net|raw\.githubusercontent\.com|statically\.io/.test(here) ? PAGES : here;
  var s = document.createElement("script");
  s.src = base + "/d1-widget.js";
  s.async = true;
  s.onerror = function () {
    if (base === PAGES && here) { var f = document.createElement("script"); f.src = here + "/d1-widget.js"; document.head.appendChild(f); }
  };
  (me && me.parentNode ? me.parentNode : document.head).appendChild(s);
})();
