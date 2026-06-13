// Override: completely removes the "no-compare" option from the period selector UI.
// This module runs after report-bridge.period.js and neutralizes the no-compare feature
// without modifying the large period.js file (avoiding truncation risk).
(function lnNoCompareKill() {
  if (window.__lnNoCompareKill) return;
  window.__lnNoCompareKill = true;

  // Force any stored no-compare selection back to comparison mode.
  function clearStoredNoCompare() {
    try {
      var rid = new URLSearchParams(location.search).get("reportId") || "default";
      var key = "ln-period:" + rid;
      var stored = sessionStorage.getItem(key);
      if (stored) {
        var obj = JSON.parse(stored);
        if (obj && obj.noCompare) {
          obj.noCompare = false;
          sessionStorage.setItem(key, JSON.stringify(obj));
        }
      }
    } catch (_e) {}
  }

  // Remove the "no-compare" option from the modal UI.
  function removeNoCompareUI() {
    var opts = document.querySelectorAll('[data-row="cmpmode"] .ln-period-opt');
    Array.prototype.forEach.call(opts, function (o) {
      var val = o.getAttribute("data-cmp");
      if (val === "without") {
        o.remove();
      }
    });
  }

  // Ensure the comparison grid is always visible with only "with" option.
  function enforceCompareGrid() {
    var grid = document.querySelector('[data-row="cmpmode"]');
    if (!grid) return;
    // If only one option remains, hide the entire comparison mode row.
    var opts = grid.querySelectorAll(".ln-period-opt");
    if (opts.length === 1) {
      var label = grid.previousElementSibling;
      if (label && label.classList.contains("ln-period-label")) {
        label.style.display = "none";
      }
      grid.style.display = "none";
    }
  }

  // Intercept the openModal function to force comparison mode.
  function interceptModal() {
    var orig = window.LN_openPeriodModal;
    if (!orig || orig.__lnKilled) return;
    var wrapped = function () {
      clearStoredNoCompare();
      var result = orig.apply(this, arguments);
      // After modal opens, remove the no-compare option.
      setTimeout(function () {
        removeNoCompareUI();
        enforceCompareGrid();
      }, 50);
      setTimeout(function () {
        removeNoCompareUI();
        enforceCompareGrid();
      }, 200);
      return result;
    };
    wrapped.__lnKilled = true;
    window.LN_openPeriodModal = wrapped;
  }

  function tick() {
    clearStoredNoCompare();
    interceptModal();
    removeNoCompareUI();
    enforceCompareGrid();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tick);
  } else {
    tick();
  }
  setInterval(tick, 1500);
})();
