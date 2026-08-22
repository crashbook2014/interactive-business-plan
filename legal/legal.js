/* Language switching for the three policy pages.
 *
 * Both languages are in the DOM and CSS shows one, so there is no templating
 * and no flash of the wrong language. Arabic is the default because most of
 * this product's readers read Arabic; a reader with JavaScript disabled still
 * gets a complete, readable document rather than an empty page.
 *
 * ?lang=en is honoured so a specific language can be LINKED. That is not a
 * nicety: a payment gateway's onboarding reviewer needs to be sent a policy
 * they can read, and "open it and press the toggle" is a step that goes wrong.
 */
(function () {
  "use strict";
  var KEY = "wodouh.lang";
  var root = document.documentElement;

  function apply(lang) {
    root.setAttribute("lang", lang);
    root.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    var btns = document.querySelectorAll(".langs button");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-pressed", String(btns[i].dataset.set === lang));
    }
    try { localStorage.setItem(KEY, lang); } catch (e) {}
  }

  function initial() {
    var q = (location.search.match(/[?&]lang=(ar|en)\b/) || [])[1];
    if (q) return q;
    var h = (location.hash.match(/^#(ar|en)$/) || [])[1];
    if (h) return h;
    try { var s = localStorage.getItem(KEY); if (s === "ar" || s === "en") return s; } catch (e) {}
    return /^ar\b/i.test(navigator.language || "") ? "ar" : "ar";
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".langs button") : null;
    if (b && b.dataset.set) apply(b.dataset.set);
  });

  apply(initial());
})();
