/*!
 * Poll-greeting sign-up: autofill + auto-submit for the /data-feed form page.
 * https://github.com/hamzsait/district1-map
 *
 * Only needed as a fallback. On misaelforaustin.com the widget submits the
 * form itself through a hidden iframe. When the widget runs anywhere else
 * (e.g. the GitHub Pages preview) it sends the visitor to
 *   /data-feed#pg=<base64 JSON>
 * and this script fills in the form and presses Submit. Squarespace then
 * redirects to /poll-greeting. Add to the /data-feed page in a Code Block:
 *   <script src="https://hamzsait.github.io/district1-map/pg-form-autofill.js"></script>
 */
(function () {
  var m = location.hash.match(/[#&]pg=([^&]+)/);
  if (!m) return;
  var v;
  try { v = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))); } catch (e) { return; }
  history.replaceState(null, "", location.pathname + location.search);   // drop the data from the URL bar

  var ORDER = ["shift", "location", "notes", "key"];
  function set(el, val) {
    if (!el || val == null) return;
    var proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, val);
    ["input", "change", "blur"].forEach(function (t) { el.dispatchEvent(new Event(t, { bubbles: true })); });
  }
  var tries = 0, t = setInterval(function () {
    var form = document.querySelector("form");
    var fname = form && form.querySelector('input[name="fname"]'), btn = form && form.querySelector('button[type="submit"]');
    if (!fname || !btn) { if (++tries > 100) clearInterval(t); return; }
    clearInterval(t);
    set(fname, v.fname);
    set(form.querySelector('input[name="lname"]'), v.lname);
    set(form.querySelector('input[type="email"]'), v.email);
    set(form.querySelector('input[autocomplete="tel-national"]'), v.phone);
    var texts = Array.prototype.filter.call(form.querySelectorAll('input[id^="text-"]'), function (e) { return !/message-field/.test(e.id); });
    ORDER.forEach(function (k, i) { set(texts[i], v[k]); });
    setTimeout(function () { btn.click(); }, 300);
  }, 200);
})();
