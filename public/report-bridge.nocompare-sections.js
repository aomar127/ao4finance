// Split module: in "no-compare" mode, hide the comparison-based narrative
// sections (Executive Summary + Analysis) per user request. Self-contained and
// independent of report-bridge.period.js; it only reacts to the
// `html.ln-no-compare` class that period.js toggles.
(function lnNoCompareSections() {
  if (window.__lnNoCompareSections) return;
  window.__lnNoCompareSections = true;

  // Headings that identify the two sections to remove in no-compare mode.
  var EXEC_RE = /(الملخص التنفيذي|executive summary)/i;
  var ANALYSIS_RE = /(التحليل|analysis)/i;
  var HIDE_CLASS = "ln-nc-section-hide";

  function injectStyles() {
    if (document.getElementById("ln-nc-sections-styles")) return;
    var s = document.createElement("style");
    s.id = "ln-nc-sections-styles";
    s.textContent =
      "html.ln-no-compare #reportContent ." +
      HIDE_CLASS +
      "{display:none !important;}";
    document.head.appendChild(s);
  }

  // Walk up to the nearest .section-card container that wraps a heading.
  function closestSection(el) {
    var p = el;
    while (p && p.nodeType === 1) {
      if (p.classList && p.classList.contains("section-card")) return p;
      p = p.parentNode;
    }
    return null;
  }

  function apply() {
    var rc = document.getElementById("reportContent");
    if (!rc) return;
    var on = document.documentElement.classList.contains("ln-no-compare");
    // Always clear our previous tags first so toggling back restores sections.
    var tagged = rc.querySelectorAll("." + HIDE_CLASS);
    Array.prototype.forEach.call(tagged, function (el) {
      el.classList.remove(HIDE_CLASS);
    });
    if (!on) return;
    var heads = rc.querySelectorAll(
      ".section-title, .card-title, h1, h2, h3",
    );
    Array.prototype.forEach.call(heads, function (h) {
      var t = (h.textContent || "").trim();
      if (!t) return;
      if (!EXEC_RE.test(t) && !ANALYSIS_RE.test(t)) return;
      var card = closestSection(h);
      if (card && rc.contains(card)) card.classList.add(HIDE_CLASS);
    });
  }

  function tick() {
    injectStyles();
    apply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tick);
  } else {
    tick();
  }
  setInterval(tick, 1500);
})();
