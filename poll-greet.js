/*!
 * District 1 poll-greeting sign-up — bootstrap. https://github.com/hamzsait/district1-map
 *
 * Embed with:
 *   <div id="pg-root"></div>
 *   <script src="https://hamzsait.github.io/district1-map/poll-greet.js"></script>
 *
 * Like d1-map.js, this file intentionally never changes. It loads the real
 * widget (pg-widget.js) from GitHub Pages so pushes go live within ~10 minutes.
 */
(function () {
  var PAGES = "https://hamzsait.github.io/district1-map";
  var me = document.currentScript || (function () { var s = document.getElementsByTagName("script"); return s[s.length - 1]; })();
  var here = me && me.src ? me.src.replace(/\/[^\/]*$/, "") : "";
  var base = /cdn\.jsdelivr\.net|raw\.githubusercontent\.com|statically\.io/.test(here) ? PAGES : here;
  var s = document.createElement("script");
  s.src = base + "/pg-widget.js";
  s.async = true;
  s.onerror = function () {
    if (base === PAGES && here) { var f = document.createElement("script"); f.src = here + "/pg-widget.js"; document.head.appendChild(f); }
  };
  (me && me.parentNode ? me.parentNode : document.head).appendChild(s);
})();
