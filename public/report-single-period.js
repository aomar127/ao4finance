// Single-period report: opens the current report for one period only in a new
// browser tab, with an auto-generated Arabic executive summary built from the
// numbers shown in the report. Self-contained; loaded by report-bridge.js.
(function lnSinglePeriodModule() {
  if (window.__lnSPInit) return;
  window.__lnSPInit = true;

  var AR_MONTHS = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
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
    "الربع الأول",
    "الربع الثاني",
    "الربع الثالث",
    "الربع الرابع",
  ];

  function toEn(s) {
    return String(s == null ? "" : s)
      .replace(/[\u0660-\u0669]/g, function (d) {
        return String(d.charCodeAt(0) - 0x0660);
      })
      .replace(/[\u06F0-\u06F9]/g, function (d) {
        return String(d.charCodeAt(0) - 0x06f0);
      });
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

  function spNum(txt) {
    var raw = toEn(txt == null ? "" : String(txt));
    var neg = raw.indexOf("(") >= 0 && raw.indexOf(")") >= 0;
    var c = raw.replace(/[^0-9.-]/g, "");
    if (!c || c === "-" || c === ".") return null;
    var n = parseFloat(c);
    if (isNaN(n)) return null;
    return neg ? -Math.abs(n) : n;
  }
  function spFmt(n) {
    try {
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
    } catch (e) {
      return String(n);
    }
  }
  function spPct(a, b) {
    return Math.round((a / b) * 1000) / 10;
  }
  function spEsc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function spKind(label) {
    var t = toEn(String(label || "")).toLowerCase();
    function h() {
      for (var i = 0; i < arguments.length; i++)
        if (t.indexOf(arguments[i]) >= 0) return true;
      return false;
    }
    if (h("صافي الربح", "صافي الدخل", "net profit", "net income")) return "net";
    if (h("مجمل الربح", "gross profit")) return "gross";
    if (h("الإيراد", "الايراد", "المبيعات", "revenue", "sales")) return "rev";
    if (h("المصروف", "المصاريف", "التكاليف", "التكلفة", "expense", "cost")) return "exp";
    if (h("النقد", "التدفق", "cash", "flow")) return "cash";
    if (h("الأصول", "الاصول", "asset")) return "assets";
    if (h("الالتزام", "الخصوم", "liab")) return "liab";
    if (h("حقوق", "equity")) return "eq";
    return "other";
  }
  function spKpis(root) {
    if (!root) return [];
    var out = [];
    var seen = {};
    function add(card) {
      if (
        !card ||
        (card.classList &&
          (card.classList.contains("ln-hidden") ||
            card.classList.contains("ln-cmp-hide")))
      )
        return;
      var txt = (card.innerText || "").trim();
      if (!txt) return;
      var lines = txt
        .split("\n")
        .map(function (l) {
          return l.trim();
        })
        .filter(Boolean);
      if (!lines.length) return;
      var val = null;
      var lab = "";
      for (var i = 0; i < lines.length; i++) {
        var isNum = /\d/.test(toEn(lines[i])) && spNum(lines[i]) != null;
        if (val == null && isNum) val = lines[i];
        else if (!lab && !isNum) lab = lines[i];
      }
      if (val == null) return;
      if (!lab) lab = lines[0];
      var k = lab + "=" + val;
      if (seen[k]) return;
      seen[k] = true;
      out.push({ label: lab, value: val, kind: spKind(lab) });
    }
    var cards = root.querySelectorAll(".kpi-card");
    if (cards.length < 2)
      cards = root.querySelectorAll(
        ".kpi-card, .dash-stat, .stat-card, .summary-card",
      );
    Array.prototype.forEach.call(cards, add);
    return out;
  }
  function spInsights(kpis, per) {
    var by = {};
    var lines = [];
    kpis.forEach(function (k) {
      if (by[k.kind] == null) by[k.kind] = spNum(k.value);
    });
    var rev = by.rev;
    var np = by.net;
    var gp = by.gross;
    var exp = by.exp;
    var cash = by.cash;
    if (rev != null)
      lines.push(
        "بلغت الإيرادات خلال " +
          per +
          " ما قيمته " +
          spFmt(rev) +
          "، وهي الأساس الذي تُقاس عليه كفاءة التشغيل والربحية.",
      );
    if (gp != null && rev)
      lines.push(
        "بلغ مجمل الربح " +
          spFmt(gp) +
          " بهامش إجمالي يقارب " +
          spPct(gp, rev) +
          "%، ما يعكس قدرة النشاط على تغطية تكاليفه المباشرة.",
      );
    if (np != null)
      lines.push(
        "بلغ صافي الربح " +
          spFmt(np) +
          (rev ? " بهامش صافٍ يقارب " + spPct(np, rev) + "%" : "") +
          (np >= 0
            ? "، وهو مؤشر إيجابي على الربحية النهائية للنشاط."
            : "، ما يستدعي مراجعة هيكل التكاليف والمصروفات لتحسين النتيجة."),
      );
    if (exp != null)
      lines.push(
        "بلغت المصروفات " +
          spFmt(exp) +
          (rev ? " أي نحو " + spPct(exp, rev) + "% من الإيرادات" : "") +
          "، ويُنصح بمتابعتها للحفاظ على هوامش الربح.",
      );
    if (cash != null)
      lines.push(
        "بلغ صافي التدفق النقدي " +
          spFmt(cash) +
          (cash >= 0
            ? "، ما يدل على قدرة جيدة على توليد السيولة."
            : "، ما يستوجب متابعة إدارة السيولة والالتزامات قصيرة الأجل."),
      );
    if (!lines.length)
      lines.push(
        "يعرض هذا الملخص أبرز المؤشرات المالية المتاحة عن " +
          per +
          " بأسلوب تحليلي موجز.",
      );
    var closing =
      np != null && np >= 0
        ? "بوجهٍ عام، تُظهر مؤشرات " +
          per +
          " أداءً مالياً متماسكاً، ويُوصى بالحفاظ على ضبط التكاليف ومواصلة تنمية الإيرادات."
        : np != null && np < 0
          ? "بوجهٍ عام، تشير نتائج " +
            per +
            " إلى ضغوط على الربحية تستدعي مراجعة هيكل التكاليف وتعزيز مصادر الإيراد."
          : "بوجهٍ عام، تعكس مؤشرات " +
            per +
            " صورة متوازنة مع أهمية المتابعة الدورية للإيرادات والمصروفات والسيولة.";
    return { lines: lines, closing: closing };
  }
  function spSummaryHtml(kpis, label) {
    var per = label && label.ar ? label.ar : "";
    var ins = spInsights(kpis, per || "الفترة");
    var h = '<section class="sp-exec"><h2>الملخص التنفيذي | Executive Summary</h2>';
    h +=
      '<p class="sp-intro">يقدّم هذا التقرير تحليلاً مالياً موجزاً' +
      (per ? " عن " + spEsc(per) : "") +
      "، استناداً إلى الأرقام والمؤشرات المعروضة في التقرير.</p>";
    if (kpis.length) {
      h += '<div class="sp-kpi-grid">';
      kpis.forEach(function (k) {
        h +=
          '<div class="sp-kpi"><div class="sp-kpi-label">' +
          spEsc(k.label) +
          '</div><div class="sp-kpi-value">' +
          spEsc(k.value) +
          "</div></div>";
      });
      h += "</div>";
    }
    h += '<ul class="sp-insights">';
    ins.lines.forEach(function (l) {
      h += "<li>" + spEsc(l) + "</li>";
    });
    h += '</ul><p class="sp-closing">' + spEsc(ins.closing) + "</p></section>";
    return h;
  }
  function spCss() {
    return "*{box-sizing:border-box}body{margin:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f1f5f9;color:#0f172a}.sp-toolbar{position:sticky;top:0;display:flex;gap:10px;justify-content:flex-end;padding:12px 20px;background:#0f172a;z-index:10}.sp-toolbar button{background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;border:none;border-radius:10px;padding:9px 18px;font-size:14px;font-weight:700;cursor:pointer}.sp-wrap{max-width:1000px;margin:0 auto;padding:24px}.sp-exec{background:#fff;border-radius:16px;padding:24px 28px;margin-bottom:24px;box-shadow:0 6px 24px rgba(2,6,23,.08);border:1px solid #e2e8f0;direction:rtl}.sp-exec h2{margin:0 0 14px;font-size:22px;color:#1e3a8a;border-bottom:2px solid #bfdbfe;padding-bottom:10px}.sp-intro{font-size:15px;line-height:1.9;color:#334155;margin:0 0 16px}.sp-kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin:16px 0}.sp-kpi{background:linear-gradient(135deg,rgba(14,165,233,.1),rgba(37,99,235,.1));border:1px solid rgba(37,99,235,.2);border-radius:12px;padding:12px;text-align:center}.sp-kpi-label{font-size:12px;color:#64748b;font-weight:600;margin-bottom:6px}.sp-kpi-value{font-size:18px;font-weight:800}.sp-insights{margin:16px 0;padding-inline-start:22px;line-height:2;font-size:15px;direction:rtl}.sp-insights li{margin-bottom:8px}.sp-closing{background:#f0f9ff;border-right:4px solid #2563eb;border-radius:8px;padding:14px 16px;font-size:15px;font-weight:600;line-height:1.9;margin-top:16px;direction:rtl}.sp-report{background:#fff;border-radius:16px;padding:20px;box-shadow:0 6px 24px rgba(2,6,23,.08);border:1px solid #e2e8f0}.sp-report img{max-width:100%;height:auto}@media print{.sp-toolbar{display:none}body{background:#fff}.sp-exec,.sp-report{box-shadow:none;border:none}}";
  }
  function openSinglePeriodReport(sel) {
    sel = sel || {};
    var rc = document.getElementById("reportContent");
    if (!rc) {
      alert("لا يوجد محتوى تقرير لعرضه.");
      return;
    }
    var label = buildLabel(sel.level, sel.current);
    var live = rc.querySelectorAll("canvas");
    Array.prototype.forEach.call(live, function (cv) {
      try {
        cv.setAttribute("data-sp-img", cv.toDataURL("image/png"));
      } catch (e) {}
    });
    var clone = rc.cloneNode(true);
    Array.prototype.forEach.call(live, function (cv) {
      cv.removeAttribute("data-sp-img");
    });
    Array.prototype.forEach.call(
      clone.querySelectorAll(
        ".ln-cmp-col, .ln-cmp-hide, .kpi-change, .ln-hidden, #lnPeriodDisplay",
      ),
      function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
      },
    );
    Array.prototype.forEach.call(
      clone.querySelectorAll("canvas"),
      function (cv) {
        var d = cv.getAttribute("data-sp-img");
        if (d) {
          var img = document.createElement("img");
          img.src = d;
          img.style.maxWidth = "100%";
          if (cv.parentNode) cv.parentNode.replaceChild(img, cv);
        }
      },
    );
    var kpis = spKpis(rc);
    var execHtml = spSummaryHtml(kpis, label);
    var cn = document.getElementById("companyName");
    var company = cn && cn.value ? cn.value : "";
    var headStyles = "";
    Array.prototype.forEach.call(
      document.querySelectorAll("style, link[rel=stylesheet]"),
      function (node) {
        if (node.id === "ln-period-styles" || node.id === "ln-nocompare-styles")
          return;
        headStyles += node.outerHTML;
      },
    );
    var win = window.open("", "_blank");
    if (!win) {
      alert("يرجى السماح بالنوافذ المنبثقة لعرض التقرير في تبويب جديد.");
      return;
    }
    var title =
      (company ? company + " \u2014 " : "") +
      "تقرير " +
      (label && label.ar ? label.ar : "");
    var doc = win.document;
    doc.open();
    doc.write(
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
        spEsc(title) +
        "</title>" +
        headStyles +
        "<style>" +
        spCss() +
        '</style></head><body><div class="sp-toolbar"><button type="button" onclick="window.print()">تصدير / طباعة PDF</button></div><div class="sp-wrap">' +
        execHtml +
        '<div class="sp-report">' +
        clone.innerHTML +
        "</div></div></body></html>",
    );
    doc.close();
  }

  window.LN_openSinglePeriodReport = openSinglePeriodReport;
})();
