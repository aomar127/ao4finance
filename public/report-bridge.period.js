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

  // Implicit previous period (the period immediately before `cur` at the given
  // level). Used in no-compare mode so the executive summary / analysis text and
  // the KPI increase/decrease indicators still read as "current vs previous"
  // (e.g. March vs February, Q1 vs Q4 of the prior year, year vs prior year)
  // even though the user did not explicitly pick a comparison period.
  function prevPeriod(level, cur) {
    if (!cur) return null;
    if (level === "month") {
      if (cur.m == null || cur.y == null) return null;
      var pm = cur.m - 1,
        py = cur.y;
      if (pm < 0) {
        pm = 11;
        py -= 1;
      }
      return { m: pm, y: py };
    }
    if (level === "quarter") {
      if (cur.q == null || cur.y == null) return null;
      var pq = cur.q - 1,
        qy = cur.y;
      if (pq < 0) {
        pq = 3;
        qy -= 1;
      }
      return { q: pq, y: qy };
    }
    if (cur.y == null) return null;
    return { y: cur.y - 1 };
  }
  // Effective comparison used only for relabeling narrative text. In with-compare
  // mode it is the user-selected comparison; in no-compare mode it falls back to
  // the implicit previous period so recommendations stay relative to it.
  function effComparison(sel) {
    if (!sel) return null;
    if (sel.comparison) return sel.comparison;
    return prevPeriod(sel.level, sel.current);
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
    var lp = buildLabel(sel.level, effComparison(sel));
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
      var span =