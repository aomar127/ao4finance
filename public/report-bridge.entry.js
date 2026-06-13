// Split module 3/3 of report-bridge.js: per-statement entry month selector.
(function lnDataEntryModule() {
  if (window.__lnDataEntryInit) return;
  window.__lnDataEntryInit = true;

  var STMT_TABS = ["tab-income", "tab-balance", "tab-cashflow"];
  var mirrors = [];

  function injectStyles() {
    if (document.getElementById("ln-dataentry-styles")) return;
    var css =
      "#tab-income .items-table th:nth-child(3)," +
      "#tab-income .items-table td:nth-child(3)," +
      "#tab-balance .items-table th:nth-child(3)," +
      "#tab-balance .items-table td:nth-child(3)," +
      "#tab-cashflow .items-table th:nth-child(3)," +
      "#tab-cashflow .items-table td:nth-child(3){display:none !important;}" +
      ".ln-entry-month{display:flex;align-items:center;gap:10px;flex-wrap:wrap;" +
      "background:linear-gradient(135deg,#0d2137,#0f2744);" +
      "border:1px solid rgba(14,165,233,.45);border-radius:12px;" +
      "padding:12px 16px;margin-bottom:16px;}" +
      ".ln-entry-month .ln-em-label{font-size:13px;font-weight:700;color:#38bdf8;" +
      "display:flex;align-items:center;gap:6px;white-space:nowrap;}" +
      ".ln-entry-month select{flex:1;min-width:180px;background:#0d1117;" +
      "border:1px solid #30363d;color:#e6edf3;padding:9px 12px;border-radius:8px;" +
      "font-family:var(--font-main,sans-serif);font-size:13px;}" +
      ".ln-entry-month select:focus{outline:none;border-color:#0ea5e9;}" +
      ".ln-entry-month .ln-em-hint{font-size:11px;color:#8b949e;width:100%;}";
    var s = document.createElement("style");
    s.id = "ln-dataentry-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function getMonth1() {
    return document.getElementById("month1");
  }

  function hideCompanyMonthFields() {
    ["month1", "month2"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var wrap = (el.closest && el.closest(".form-group")) || el.parentElement;
      if (wrap && wrap.getAttribute("data-ln-month-hidden") !== "1") {
        wrap.style.display = "none";
        wrap.setAttribute("data-ln-month-hidden", "1");
      }
    });
  }

  function syncOptions(sel, source) {
    if (!sel || !source) return;
    var keep = sel.value;
    sel.innerHTML = "";
    Array.prototype.forEach.call(source.options, function (o) {
      var opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.textContent;
      sel.appendChild(opt);
    });
    sel.value = source.value || keep;
  }

  function buildSelectorFor(tabId) {
    var tab = document.getElementById(tabId);
    if (!tab || tab.querySelector(".ln-entry-month")) return;
    var month1 = getMonth1();
    if (!month1) return;

    var wrap = document.createElement("div");
    wrap.className = "ln-entry-month";
    wrap.setAttribute("data-ln-em", tabId);
    wrap.innerHTML =
      '<span class="ln-em-label">\ud83d\uddd3\ufe0f \u0634\u0647\u0631 \u0627\u0644\u0625\u062f\u062e\u0627\u0644 | Entry Month</span>' +
      '<select class="ln-em-select"></select>' +
      '<span class="ln-em-hint">\u0627\u062e\u062a\u0631 \u0627\u0644\u0634\u0647\u0631 \u0627\u0644\u0630\u064a \u062a\u064f\u062f\u062e\u0644 \u0628\u064a\u0627\u0646\u0627\u062a\u0647 \u2014 \u062a\u064f\u0633\u062c\u0651\u0644 \u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0645\u0627\u0644\u064a\u0629 \u0639\u0644\u0649 \u0623\u0633\u0627\u0633 \u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631.</span>';
    tab.insertBefore(wrap, tab.firstChild);

    var sel = wrap.querySelector(".ln-em-select");
    syncOptions(sel, month1);
    mirrors.push(sel);

    sel.addEventListener("change", function () {
      var m1 = getMonth1();
      if (!m1) return;
      if (m1.value !== sel.value) {
        m1.value = sel.value;
        m1.dispatchEvent(new Event("change", { bubbles: true }));
      }
      syncAll();
    });
  }

  function syncAll() {
    var m1 = getMonth1();
    if (!m1) return;
    mirrors.forEach(function (sel) {
      if (!sel.isConnected) return;
      if (sel.options.length !== m1.options.length) syncOptions(sel, m1);
      if (sel.value !== m1.value) sel.value = m1.value;
    });
  }

  function tick() {
    injectStyles();
    var m1 = getMonth1();
    if (!m1) return;
    hideCompanyMonthFields();
    STMT_TABS.forEach(buildSelectorFor);
    if (!m1.__lnEmBound) {
      m1.addEventListener("change", syncAll);
      m1.__lnEmBound = true;
    }
    syncAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tick);
  } else {
    tick();
  }
  setInterval(tick, 1500);
})();
