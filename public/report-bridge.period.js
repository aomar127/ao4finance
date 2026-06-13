// Split module 2/3 of report-bridge.js: report period selector + compare mode.
(function lnReportPeriodModule() {
  if (window.__lnPeriodInit) return;
  window.__lnPeriodInit = true;

  var AR_MONTHS = [
    "\u064a\u0646\u0627\u064a\u0631",
    "\u0641\u0628\u0631\u0627\u064a\u0631",
    "\u0645\u0627\u0631\u0633",
    "\u0623\u0628\u0631\u064a\u0644",
    "\u0645\u0627\u064a\u0648",
    "\u064a\u0648\u0646\u064a\u0648",
    "\u064a\u0648\u0644\u064a\u0648",
    "\u0623\u063a\u0633\u0637\u0633",
    "\u0633\u0628\u062a\u0645\u0628\u0631",
    "\u0623\u0643\u062a\u0648\u0628\u0631",
    "\u0646\u0648\u0641\u0645\u0628\u0631",
    "\u062f\u064a\u0633\u0645\u0628\u0631",
  ];
  var EN_MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  var AR_QUARTERS = [
    "\u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u0623\u0648\u0644",
    "\u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u062b\u0627\u0646\u064a",
    "\u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u062b\u0627\u0644\u062b",
    "\u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u0631\u0627\u0628\u0639",
  ];

  var now = new Date();

  function getReportId() {
    try {
      return new URLSearchParams(location.search).get("reportId") || "default";
    } catch (e) {
      return "default";
    }
  }
  function storeKey() {
    return "ln-period:" + getReportId();
  }
  function loadSel() {
    try {
      return JSON.parse(sessionStorage.getItem(storeKey()) || "null");
    } catch (e) {
      return null;
    }
  }
  function saveSel(v) {
    try {
      if (v) sessionStorage.setItem(storeKey(), JSON.stringify(v));
      else sessionStorage.removeItem(storeKey());
    } catch (e) {}
  }

  function toEn(s) {
    return String(s == null ? "" : s)
      .replace(/[\u0660-\u0669]/g, function (d) {
        return String(d.charCodeAt(0) - 0x0660);
      })
      .replace(/[\u06F0-\u06F9]/g, function (d) {
        return String(d.charCodeAt(0) - 0x06f0);
      });
  }

  function parsePeriod(s) {
    if (!s) return null;
    var ar = String(s).split("|")[0];
    var ym = toEn(ar).match(/(19|20)\d{2}/);
    if (!ym) return null;
    var y = parseInt(ym[0], 10);
    var mi = -1;
    for (var i = 0; i < AR_MONTHS.length; i++) {
      if (ar.indexOf(AR_MONTHS[i]) >= 0) {
        mi = i;
        break;
      }
    }
    if (mi < 0) {
      for (var j = 0; j < EN_MONTHS.length; j++) {
        if (ar.toLowerCase().indexOf(EN_MONTHS[j].toLowerCase()) >= 0) {
          mi = j;
          break;
        }
      }
    }
    if (mi < 0) return null;
    return { m: mi, y: y };
  }

  function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function getRecordedMonths() {
    var map = {};
    function add(p) {
      if (p) map[p.y + "-" + p.m] = p;
    }

    ["month1", "month2"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (el.options) {
        for (var i = 0; i < el.options.length; i++) {
          add(parsePeriod(el.options[i].value || el.options[i].textContent));
        }
      }
      add(parsePeriod(el.value));
    });

    var texts = [];
    var chips = document.getElementById("periodChips");
    if (chips) texts.push(chips.innerText || "");
    var blob = document.getElementById("__periodsBlob");
    if (blob && blob.value) texts.push(blob.value);
    var rc = document.getElementById("reportContent");
    if (rc) texts.push(rc.innerText || "");
    texts.forEach(function (txt) {
      var T = toEn(txt);
      for (var i = 0; i < AR_MONTHS.length; i++) {
        var re = new RegExp(
          escapeRe(AR_MONTHS[i]) + "\\s*((?:19|20)\\d{2})",
          "g",
        );
        var mm;
        while ((mm = re.exec(T)) !== null)
          add({ m: i, y: parseInt(mm[1], 10) });
      }
    });

    var out = Object.keys(map).map(function (k) {
      return map[k];
    });
    out.sort(function (a, b) {
      return b.y - a.y || b.m - a.m;
    });
    if (!out.length) out = [{ m: now.getMonth(), y: now.getFullYear() }];
    return out;
  }

  function recordedYears(months) {
    var years = {};
    (months || []).forEach(function (mo) {
      years[mo.y] = true;
    });
    var ids = ["reportDate", "report_date", "reportYear", "year", "date"];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.value) {
        var mm = toEn(el.value).match(/(19|20)\d{2}/);
        if (mm) years[mm[0]] = true;
      }
    }
    try {
      var host = document.getElementById("reportContent") || document.body;
      var txt = toEn(host.innerText || "");
      var re = /(19|20)\d{2}/g;
      var m;
      while ((m = re.exec(txt)) !== null) years[m[0]] = true;
    } catch (e) {}
    var cur = new Date().getFullYear();
    years[String(cur)] = true;
    var outYears = Object.keys(years)
      .map(function (y) {
        return parseInt(y, 10);
      })
      .filter(function (y) {
        return y >= 2000 && y <= cur + 1;
      })
      .sort(function (a, b) {
        return b - a;
      });
    if (outYears.length === 0) outYears = [cur];
    return outYears;
  }

  function buildLabel(level, pick) {
    if (!pick) return null;
    if (level === "month") {
      if (pick.m == null || pick.y == null) return null;
      return {
        ar: AR_MONTHS[pick.m] + " " + pick.y,
        en: EN_MONTHS[pick.m] + " " + pick.y,
      };
    }
    if (level === "quarter") {
      if (pick.q == null || pick.y == null) return null;
      return {
        ar: AR_QUARTERS[pick.q] + " " + pick.y,
        en: "Q" + (pick.q + 1) + " " + pick.y,
      };
    }
    if (pick.y == null) return null;
    return { ar: String(pick.y), en: String(pick.y) };
  }

  function valParts(v) {
    if (!v) return null;
    v = String(v).trim();
    if (!v) return null;
    var parts = v.split("|");
    return {
      full: v,
      ar: (parts[0] || "").trim(),
      en: (parts[1] || "").trim(),
    };
  }

  function buildPairs(sel) {
    var m1 = document.getElementById("month1");
    var m2 = document.getElementById("month2");
    var b1 = valParts(m1 && m1.value);
    var b2 = valParts(m2 && m2.value);
    var lc = buildLabel(sel.level, sel.current);
    var lp = buildLabel(sel.level, sel.comparison);
    var pairs = [];
    function push(base, lab) {
      if (!base || !lab) return;
      if (base.full && lab.ar && lab.en)
        pairs.push([base.full, lab.ar + " | " + lab.en]);
      if (base.ar) pairs.push([base.ar, lab.ar]);
      if (base.en) pairs.push([base.en, lab.en]);
    }
    push(b1, lc);
    push(b2, lp);
    pairs = pairs.filter(function (p) {
      return p[0] && p[1] && p[0] !== p[1];
    });
    pairs.sort(function (a, b) {
      return b[0].length - a[0].length;
    });
    return pairs;
  }

  function skipNode(node, host) {
    var p = node.parentNode;
    while (p && p !== host) {
      if (p.nodeType === 1) {
        if (p.id === "lnPeriodDisplay") return true;
        if (p.classList && p.classList.contains("ln-prd")) return true;
        var tn = p.tagName;
        if (tn === "SCRIPT" || tn === "STYLE") return true;
      }
      p = p.parentNode;
    }
    return false;
  }

  function processTextNode(node, pairs) {
    var s = node.nodeValue;
    var frag = document.createDocumentFragment();
    var made = false;
    var i = 0;
    while (i < s.length) {
      var best = -1;
      var bp = null;
      for (var k = 0; k < pairs.length; k++) {
        var idx = s.indexOf(pairs[k][0], i);
        if (idx >= 0 && (best < 0 || idx < best)) {
          best = idx;
          bp = pairs[k];
        }
      }
      if (best < 0) {
        frag.appendChild(document.createTextNode(s.slice(i)));
        break;
      }
      if (best > i) frag.appendChild(document.createTextNode(s.slice(i, best)));
      var span = document.createElement("span");
      span.className = "ln-prd";
      span.setAttribute("data-ln-orig", bp[0]);
      span.textContent = bp[1];
      frag.appendChild(span);
      made = true;
      i = best + bp[0].length;
    }
    if (made && node.parentNode) node.parentNode.replaceChild(frag, node);
    return made;
  }

  function relabel(sel) {
    var host = document.getElementById("reportContent");
    if (!host) return;
    var pairs = buildPairs(sel);
    if (!pairs.length) return;
    var nodes = [];
    var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode()) !== null) {
      if (!n.nodeValue) continue;
      if (skipNode(n, host)) continue;
      var has = false;
      for (var k = 0; k < pairs.length; k++) {
        if (n.nodeValue.indexOf(pairs[k][0]) >= 0) {
          has = true;
          break;
        }
      }
      if (has) nodes.push(n);
    }
    for (var i = 0; i < nodes.length; i++) processTextNode(nodes[i], pairs);
  }

  function applyBadge(sel) {
    var host = document.getElementById("reportContent");
    if (!host) return;
    var lc = buildLabel(sel.level, sel.current);
    var lp = buildLabel(sel.level, sel.comparison);
    if (!lc) {
      var e0 = document.getElementById("lnPeriodDisplay");
      if (e0) e0.remove();
      return;
    }
    var text = "\u0641\u062a\u0631\u0629 \u0627\u0644\u062a\u0642\u0631\u064a\u0631: " + lc.ar + (lp ? "  \u2022  \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629: " + lp.ar : "");
    var el = document.getElementById("lnPeriodDisplay");
    if (
      el &&
      el.parentNode === host &&
      host.firstChild === el &&
      el.textContent === text
    )
      return;
    if (!el) {
      el = document.createElement("div");
      el.id = "lnPeriodDisplay";
    }
    if (el.textContent !== text) el.textContent = text;
    if (host.firstChild !== el) host.insertBefore(el, host.firstChild);
  }

  function applyToReport(sel) {
    applyBadge(sel);
    relabel(sel);
    applyCompareMode(sel);
  }

  var CMP_COL_RE =
    /(\u0627\u0644\u0633\u0627\u0628\u0642|previous|\u0627\u0644\u062a\u063a\u064a\u0631|\u062a\u063a\u064a\u0651\u0631|change|\u0646\u0633\u0628\u0629 \u0627\u0644\u062a\u063a\u064a\u0631|\u0627\u0644\u0641\u0631\u0642|variance|\u0394)/i;
  var CMP_TXT_RE =
    /(\u0627\u0644\u0633\u0627\u0628\u0642|previous|\u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629|comparison|\u0627\u0644\u0641\u062a\u0631\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629|\u0627\u0644\u0639\u0627\u0645 \u0627\u0644\u0633\u0627\u0628\u0642|\u0627\u0644\u0634\u0647\u0631 \u0627\u0644\u0633\u0627\u0628\u0642|\u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u0633\u0627\u0628\u0642)/i;
  var CUR_LABEL_RE = /^(\u0627\u0644\u062d\u0627\u0644\u064a|\u0627\u0644\u062d\u0627\u0644\u064a\u0629|\u0627\u0644\u062d\u0627\u0644\u0649|current)$/i;
  var PREV_LABEL_RE = /^(\u0627\u0644\u0633\u0627\u0628\u0642|\u0627\u0644\u0633\u0627\u0628\u0642\u0629|previous|prev)$/i;

  function injectCompareStyles() {
    if (document.getElementById("ln-nocompare-styles")) return;
    var css =
      "html.ln-no-compare #reportContent .kpi-change{display:none !important;}" +
      "html.ln-no-compare #reportContent .ln-cmp-col{display:none !important;}" +
      "html.ln-no-compare #reportContent .ln-cmp-hide{display:none !important;}";
    var s = document.createElement("style");
    s.id = "ln-nocompare-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function untagCompare() {
    var rc = document.getElementById("reportContent");
    if (!rc) return;
    var tagged = rc.querySelectorAll(".ln-cmp-col, .ln-cmp-hide");
    Array.prototype.forEach.call(tagged, function (el) {
      el.classList.remove("ln-cmp-col");
      el.classList.remove("ln-cmp-hide");
    });
  }

  function tagCompareColumns(rc, sel) {
    var m2 = document.getElementById("month2");
    var b2 = valParts(m2 && m2.value);
    var prevAr = b2 && b2.ar ? toEn(b2.ar) : "";
    var prevEn = b2 && b2.en ? toEn(b2.en).toLowerCase() : "";
    var tables = rc.querySelectorAll(".fin-table, table");
    Array.prototype.forEach.call(tables, function (tbl) {
      try {
        var headRow =
          (tbl.tHead && tbl.tHead.rows[0]) || tbl.querySelector("tr");
        if (!headRow) return;
        var cells = headRow.children;
        var hideIdx = [];
        for (var c = 0; c < cells.length; c++) {
          var txt = toEn((cells[c].textContent || "").trim());
          var matchPrev =
            CMP_COL_RE.test(txt) ||
            (prevAr && txt.indexOf(prevAr) >= 0) ||
            (prevEn && txt.toLowerCase().indexOf(prevEn) >= 0);
          if (matchPrev) hideIdx.push(c);
        }
        if (!hideIdx.length) return;
        var rows = tbl.querySelectorAll("tr");
        Array.prototype.forEach.call(rows, function (tr) {
          for (var h = 0; h < hideIdx.length; h++) {
            var cell = tr.children[hideIdx[h]];
            if (cell) cell.classList.add("ln-cmp-col");
          }
        });
      } catch (_e) {}
    });
  }

  function tagCompareBadges(rc, sel) {
    var m2 = document.getElementById("month2");
    var b2 = valParts(m2 && m2.value);
    var lc = buildLabel(sel.level, sel.current);
    var selectors = [
      ".report-period .period-badge",
      ".ln-cover-period",
      ".ln-period",
      ".period-badge",
    ];
    selectors.forEach(function (selector) {
      var nodes = rc.querySelectorAll(selector);
      Array.prototype.forEach.call(nodes, function (node) {
        try {
          var t = (node.textContent || "").trim();
          if (!t) return;
          var hasCur =
            lc &&
            ((lc.ar && t.indexOf(lc.ar) >= 0) ||
              (lc.en && t.indexOf(lc.en) >= 0));
          if (hasCur) return;
          var matchPrev =
            CMP_TXT_RE.test(t) ||
            (b2 && b2.ar && t.indexOf(b2.ar) >= 0) ||
            (b2 && b2.en && t.indexOf(b2.en) >= 0);
          if (matchPrev) node.classList.add("ln-cmp-hide");
        } catch (_e) {}
      });
    });
  }

  function adjustCoverPeriod(rc, sel) {
    try {
      var m2 = document.getElementById("month2");
      var b2 = valParts(m2 && m2.value);
      var prevAr = b2 && b2.ar ? toEn(b2.ar) : "";
      var prevEn = b2 && b2.en ? toEn(b2.en).toLowerCase() : "";
      var covers = rc.querySelectorAll(".ln-cover-period");
      Array.prototype.forEach.call(covers, function (cover) {
        var chips = cover.children;
        Array.prototype.forEach.call(chips, function (chip) {
          try {
            var chipTxt = toEn((chip.textContent || "").trim());
            var bare = chipTxt.replace(/[:\uff1a\u2022|]/g, " ").trim();
            var hasDigits = /\d/.test(chipTxt);
            var isPrev =
              CMP_TXT_RE.test(chipTxt) ||
              (prevAr && chipTxt.indexOf(prevAr) >= 0) ||
              (prevEn && chipTxt.toLowerCase().indexOf(prevEn) >= 0);
            var isPureCurLabel = !hasDigits && CUR_LABEL_RE.test(bare);
            var isPurePrevLabel = !hasDigits && PREV_LABEL_RE.test(bare);
            if (isPrev || isPurePrevLabel || isPureCurLabel) {
              chip.classList.add("ln-cmp-hide");
            } else {
              var lbl = chip.querySelector(".lbl");
              if (lbl) {
                var lblTxt = toEn((lbl.textContent || "").trim())
                  .replace(/[:\uff1a\u2022|]/g, " ")
                  .trim();
                if (CUR_LABEL_RE.test(lblTxt) || PREV_LABEL_RE.test(lblTxt)) {
                  lbl.classList.add("ln-cmp-hide");
                }
              }
            }
          } catch (_e) {}
        });
      });
    } catch (_e) {}
  }

  function adjustCharts(noCompare, sel) {
    try {
      if (!(window.Chart && typeof window.Chart.getChart === "function"))
        return;
      var rc = document.getElementById("reportContent");
      if (!rc) return;
      var m2 = document.getElementById("month2");
      var b2 = valParts(m2 && m2.value);
      var prevAr = b2 && b2.ar ? b2.ar : "";
      var prevEn = b2 && b2.en ? b2.en.toLowerCase() : "";
      var canvases = rc.querySelectorAll("canvas");
      Array.prototype.forEach.call(canvases, function (cv) {
        var ch = window.Chart.getChart(cv);
        if (!ch || !ch.data || !ch.data.datasets) return;
        var ds = ch.data.datasets;
        if (!ds.length) return;
        var hideSet = {};
        if (noCompare && ds.length > 1) {
          var matched = false;
          ds.forEach(function (d, idx) {
            var lbl = String(d.label || "");
            if (
              CMP_TXT_RE.test(lbl) ||
              (prevAr && lbl.indexOf(prevAr) >= 0) ||
              (prevEn && lbl.toLowerCase().indexOf(prevEn) >= 0)
            ) {
              hideSet[idx] = true;
              matched = true;
            }
          });
          if (!matched && ds.length === 2) hideSet[1] = true;
        }
        var changed = false;
        for (var i = 0; i < ds.length; i++) {
          var wantVisible = !hideSet[i];
          if (
            typeof ch.isDatasetVisible === "function" &&
            typeof ch.setDatasetVisibility === "function"
          ) {
            if (ch.isDatasetVisible(i) !== wantVisible) {
              ch.setDatasetVisibility(i, wantVisible);
              changed = true;
            }
          } else if (!!ds[i].hidden === wantVisible) {
            ds[i].hidden = !wantVisible;
            changed = true;
          }
        }
        if (changed) {
          try {
            ch.update("none");
          } catch (_e2) {
            try {
              ch.update();
            } catch (_e3) {}
          }
        }
      });
    } catch (_e) {}
  }

  function applyCompareMode(sel) {
    var rc = document.getElementById("reportContent");
    if (!rc) return;
    var noCompare = !!(sel && sel.noCompare);
    injectCompareStyles();
    document.documentElement.classList.toggle("ln-no-compare", noCompare);
    untagCompare();
    if (noCompare) {
      tagCompareColumns(rc, sel);
      tagCompareBadges(rc, sel);
      adjustCoverPeriod(rc, sel);
    }
    adjustCharts(noCompare, sel);
  }

  function clearCompareMode() {
    document.documentElement.classList.remove("ln-no-compare");
    untagCompare();
    adjustCharts(false);
  }

  function clearReport() {
    var host = document.getElementById("reportContent");
    if (host) {
      var spans = host.querySelectorAll(".ln-prd");
      for (var i = 0; i < spans.length; i++) {
        var sp = spans[i];
        sp.parentNode.replaceChild(
          document.createTextNode(
            sp.getAttribute("data-ln-orig") || sp.textContent,
          ),
          sp,
        );
      }
    }
    var b = document.getElementById("lnPeriodDisplay");
    if (b) b.remove();
    clearCompareMode();
  }

  function reapply() {
    var sel = loadSel();
    if (sel && sel.current) applyToReport(sel);
  }

  function injectStyles() {
    if (document.getElementById("ln-period-styles")) return;
    var css =
      "#lnPeriodBtn{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(37,99,235,.35);transition:transform .15s ease,box-shadow .15s ease;}" +
      "#lnPeriodBtn:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(37,99,235,.45);}" +
      "#lnPeriodDisplay{margin:0 0 14px;padding:10px 16px;border-radius:12px;background:linear-gradient(135deg,rgba(14,165,233,.12),rgba(37,99,235,.12));border:1px solid rgba(37,99,235,.25);color:#0f172a;font-weight:700;font-size:15px;text-align:center;}" +
      ".ln-period-overlay{position:fixed;inset:0;background:rgba(2,6,23,.55);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:99999;}" +
      ".ln-period-modal{width:min(460px,92vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:inherit;direction:rtl;}" +
      ".ln-period-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;position:sticky;top:0;}" +
      ".ln-period-head h3{margin:0;font-size:17px;font-weight:700;}" +
      ".ln-period-x{background:rgba(255,255,255,.2);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:16px;}" +
      ".ln-period-body{padding:20px;}" +
      ".ln-period-label{font-size:13px;color:#64748b;margin:0 0 8px;font-weight:600;}" +
      ".ln-period-sub{font-size:14px;font-weight:800;color:#0f172a;margin:4px 0 10px;display:flex;align-items:center;gap:6px;}" +
      ".ln-period-sub.cmp{color:#2563eb;}" +
      ".ln-period-div{height:1px;background:#e2e8f0;margin:18px 0;}" +
      ".ln-period-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;}" +
      ".ln-period-mgrid{max-height:190px;overflow:auto;padding:2px;}" +
      ".ln-period-opt{padding:12px 8px;border:2px solid #e2e8f0;border-radius:12px;background:#f8fafc;cursor:pointer;font-size:14px;font-weight:600;color:#334155;text-align:center;transition:all .15s ease;line-height:1.5;}" +
      ".ln-period-opt small{font-weight:500;color:#94a3b8;}" +
      ".ln-period-opt:hover{border-color:#93c5fd;}" +
      ".ln-period-opt.active{border-color:#2563eb;background:#2563eb;color:#fff;}" +
      ".ln-period-opt.active small{color:#dbeafe;}" +
      ".ln-period-foot{display:flex;gap:10px;justify-content:flex-start;padding:0 20px 20px;}" +
      ".ln-period-apply{flex:1;padding:11px;border:none;border-radius:12px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;font-weight:700;font-size:14px;cursor:pointer;}" +
      ".ln-period-clear{padding:11px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#64748b;font-weight:600;font-size:14px;cursor:pointer;}";
    var s = document.createElement("style");
    s.id = "ln-period-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  var draft = null;

  function openModal() {
    injectStyles();
    var months = getRecordedMonths();
    var years = recordedYears(months);

    var loaded = loadSel();
    if (loaded && loaded.current) {
      draft = loaded;
    } else {
      draft = { level: (loaded && loaded.level) || "month" };
    }
    if (typeof draft.noCompare !== "boolean")
      draft.noCompare = !!(loaded && loaded.noCompare);

    function ensureDefaults() {
      if (draft.level === "month") {
        if (!draft.current || draft.current.m == null) {
          draft.current = { m: months[0].m, y: months[0].y };
        }
        if (!draft.comparison || draft.comparison.m == null) {
          var c = months[1] || months[0];
          draft.comparison = { m: c.m, y: c.y };
        }
      } else if (draft.level === "quarter") {
        var cq = Math.floor(now.getMonth() / 3);
        if (!draft.current || draft.current.q == null)
          draft.current = { q: cq, y: years[0] };
        if (!draft.comparison || draft.comparison.q == null)
          draft.comparison = { q: (cq + 3) % 4, y: years[0] };
      } else {
        if (
          !draft.current ||
          draft.current.y == null ||
          draft.current.m != null ||
          draft.current.q != null
        ) {
          draft.current = { y: years[0] };
        }
        if (
          !draft.comparison ||
          draft.comparison.y == null ||
          draft.comparison.m != null ||
          draft.comparison.q != null
        ) {
          draft.comparison = { y: years[1] != null ? years[1] : years[0] - 1 };
        }
      }
      if (draft.noCompare) draft.comparison = null;
    }

    var overlay = document.createElement("div");
    overlay.className = "ln-period-overlay";
    overlay.innerHTML =
      '<div class="ln-period-modal" role="dialog" aria-modal="true">' +
      '<div class="ln-period-head"><h3>\ud83d\uddd3\ufe0f \u0645\u062f\u0629 \u0627\u0644\u062a\u0642\u0631\u064a\u0631</h3><button class="ln-period-x" type="button">\u2715</button></div>' +
      '<div class="ln-period-body">' +
      '<p class="ln-period-label">\u0646\u0648\u0639 \u0627\u0644\u0639\u0631\u0636</p>' +
      '<div class="ln-period-grid" data-row="cmpmode" style="grid-template-columns:repeat(2,1fr);">' +
      '<div class="ln-period-opt" data-cmp="with">\ud83d\udd01 \u0645\u0639 \u0645\u0642\u0627\u0631\u0646\u0629</div>' +
      '<div class="ln-period-opt" data-cmp="without">1\ufe0f\u20e3 \u0628\u062f\u0648\u0646 \u0645\u0642\u0627\u0631\u0646\u0629</div>' +
      "</div>" +
      '<p class="ln-period-label">\u0627\u0644\u0645\u0633\u062a\u0648\u0649</p>' +
      '<div class="ln-period-grid" data-row="level">' +
      '<div class="ln-period-opt" data-level="month">\u0634\u0647\u0631</div>' +
      '<div class="ln-period-opt" data-level="quarter">\u0631\u0628\u0639 \u0633\u0646\u0648\u064a</div>' +
      '<div class="ln-period-opt" data-level="year">\u0633\u0646\u0629</div>' +
      "</div>" +
      '<div data-row="detail"></div>' +
      "</div>" +
      '<div class="ln-period-foot">' +
      '<button class="ln-period-apply" type="button">\u062a\u0637\u0628\u064a\u0642</button>' +
      '<button class="ln-period-clear" type="button">\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062a\u062d\u062f\u064a\u062f</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
    }
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    overlay.querySelector(".ln-period-x").addEventListener("click", close);

    function pickerHtml(level, target) {
      if (level === "month") {
        return (
          '<div class="ln-period-grid ln-period-mgrid" data-target="' +
          target +
          '" data-kind="month">' +
          months
            .map(function (mo) {
              return (
                '<div class="ln-period-opt" data-m="' +
                mo.m +
                '" data-y="' +
                mo.y +
                '">' +
                AR_MONTHS[mo.m] +
                " " +
                mo.y +
                "</div>"
              );
            })
            .join("") +
          "</div>"
        );
      }
      if (level === "quarter") {
        var qs = "";
        for (var q = 0; q < 4; q++)
          qs +=
            '<div class="ln-period-opt" data-q="' +
            q +
            '">' +
            AR_QUARTERS[q] +
            "</div>";
        var ys = "";
        for (var i = 0; i < years.length; i++)
          ys +=
            '<div class="ln-period-opt" data-y="' +
            years[i] +
            '">' +
            years[i] +
            "</div>";
        return (
          '<div class="ln-period-grid" data-target="' +
          target +
          '" data-kind="q">' +
          qs +
          "</div>" +
          '<p class="ln-period-label">\u0627\u0644\u0633\u0646\u0629</p>' +
          '<div class="ln-period-grid" data-target="' +
          target +
          '" data-kind="qy">' +
          ys +
          "</div>"
        );
      }
      var yy = "";
      for (var j = 0; j < years.length; j++)
        yy +=
          '<div class="ln-period-opt" data-y="' +
          years[j] +
          '">' +
          years[j] +
          "</div>";
      return (
        '<div class="ln-period-grid" data-target="' +
        target +
        '" data-kind="y">' +
        yy +
        "</div>"
      );
    }

    function subLabel(target) {
      var solo = draft.noCompare && target === "current";
      if (draft.level === "month")
        return target === "current"
          ? solo
            ? "\u0627\u0644\u0634\u0647\u0631"
            : "\u0627\u0644\u0634\u0647\u0631 \u0627\u0644\u062d\u0627\u0644\u064a"
          : "\u0634\u0647\u0631 \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629";
      if (draft.level === "quarter")
        return target === "current"
          ? solo
            ? "\u0627\u0644\u0631\u0628\u0639"
            : "\u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u062d\u0627\u0644\u064a"
          : "\u0631\u0628\u0639 \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629";
      return target === "current"
        ? solo
          ? "\u0627\u0644\u0633\u0646\u0629"
          : "\u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629"
        : "\u0633\u0646\u0629 \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629";
    }

    function wirePickers(box) {
      var opts = box.querySelectorAll(".ln-period-opt");
      Array.prototype.forEach.call(opts, function (o) {
        var grid = o.parentNode;
        var target = grid.getAttribute("data-target");
        var kind = grid.getAttribute("data-kind");
        var cur = draft[target] || {};
        var active = false;
        if (kind === "month")
          active =
            parseInt(o.getAttribute("data-m"), 10) === cur.m &&
            parseInt(o.getAttribute("data-y"), 10) === cur.y;
        else if (kind === "q")
          active = parseInt(o.getAttribute("data-q"), 10) === cur.q;
        else if (kind === "qy")
          active = parseInt(o.getAttribute("data-y"), 10) === cur.y;
        else if (kind === "y")
          active = parseInt(o.getAttribute("data-y"), 10) === cur.y;
        if (active) o.classList.add("active");
        o.addEventListener("click", function () {
          var t = draft[target] || {};
          if (kind === "month") {
            t = {
              m: parseInt(o.getAttribute("data-m"), 10),
              y: parseInt(o.getAttribute("data-y"), 10),
            };
          } else if (kind === "q") {
            t.q = parseInt(o.getAttribute("data-q"), 10);
            if (t.y == null) t.y = years[0];
          } else if (kind === "qy") {
            t.y = parseInt(o.getAttribute("data-y"), 10);
            if (t.q == null) t.q = 0;
          } else if (kind === "y") {
            t = { y: parseInt(o.getAttribute("data-y"), 10) };
          }
          draft[target] = t;
          renderDetail();
        });
      });
    }

    function renderDetail() {
      ensureDefaults();
      var box = overlay.querySelector('[data-row="detail"]');
      var html =
        '<div class="ln-period-sub">\ud83d\udfe2 ' +
        subLabel("current") +
        "</div>" +
        pickerHtml(draft.level, "current");
      if (!draft.noCompare) {
        html +=
          '<div class="ln-period-div"></div>' +
          '<div class="ln-period-sub cmp">\ud83d\udd35 ' +
          subLabel("comparison") +
          "</div>" +
          pickerHtml(draft.level, "comparison");
      }
      box.innerHTML = html;
      wirePickers(box);
    }

    function renderCmpMode() {
      var opts = overlay.querySelectorAll(
        '[data-row="cmpmode"] .ln-period-opt',
      );
      Array.prototype.forEach.call(opts, function (o) {
        var val = o.getAttribute("data-cmp");
        o.classList.toggle("active", (val === "without") === !!draft.noCompare);
        o.onclick = function () {
          var nc = val === "without";
          if (draft.noCompare !== nc) {
            draft.noCompare = nc;
            if (nc) draft.comparison = null;
            renderCmpMode();
            renderDetail();
          }
        };
      });
    }

    function renderLevel() {
      var lvOpts = overlay.querySelectorAll(
        '[data-row="level"] .ln-period-opt',
      );
      Array.prototype.forEach.call(lvOpts, function (o) {
        o.classList.toggle(
          "active",
          o.getAttribute("data-level") === draft.level,
        );
        o.onclick = function () {
          if (draft.level !== o.getAttribute("data-level")) {
            draft.level = o.getAttribute("data-level");
            draft.current = null;
            draft.comparison = null;
          }
          renderLevel();
          renderDetail();
        };
      });
    }

    renderCmpMode();
    renderLevel();
    renderDetail();

    overlay
      .querySelector(".ln-period-apply")
      .addEventListener("click", function () {
        ensureDefaults();
        saveSel(draft);
        applyToReport(draft);
        close();
      });
    overlay
      .querySelector(".ln-period-clear")
      .addEventListener("click", function () {
        saveSel(null);
        clearReport();
        close();
      });
  }

  function ensureButton() {
    var actions = document.getElementById("reportActions");
    if (!actions) return;
    if (document.getElementById("lnPeriodBtn")) return;
    var btn = document.createElement("button");
    btn.id = "lnPeriodBtn";
    btn.type = "button";
    btn.innerHTML = "\ud83d\uddd3\ufe0f \u0645\u062f\u0629 \u0627\u0644\u062a\u0642\u0631\u064a\u0631";
    btn.addEventListener("click", openModal);
    actions.appendChild(btn);
  }

  function tick() {
    ensureButton();
    reapply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tick);
  } else {
    tick();
  }
  setInterval(tick, 1500);
  window.LN_openPeriodModal = openModal;
})();
