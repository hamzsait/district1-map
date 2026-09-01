/*!
 * Prefills the Squarespace "Request a Yard Sign" form from URL parameters:
 *   /request-a-yard-sign?street=1100+Rosewood&city=Austin&state=TX&zip=78702
 * Add to that page in a Code Block (or Settings > Advanced > Code Injection):
 *   <script src="https://hamzsait.github.io/district1-map/yard-sign-prefill.js"></script>
 */
(function () {
  var q = new URLSearchParams(location.search);
  var map = { "address-line1": q.get("street"), "address-level2": q.get("city"), "address-level1": q.get("state"), "postal-code": q.get("zip") };
  if (!Object.keys(map).some(function (k) { return map[k]; })) return;
  var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  function fill() {
    var done = false;
    Object.keys(map).forEach(function (k) {
      var el = document.querySelector('form input[autocomplete="' + k + '"]');
      if (!el || !map[k] || el.value) return;
      setter.call(el, map[k]);                                 // React-safe value set
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      done = true;
    });
    return done;
  }
  var tries = 0, t = setInterval(function () { if (fill() || ++tries > 100) clearInterval(t); }, 200);
})();
