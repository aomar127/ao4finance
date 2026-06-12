// Bridge between parent React shell and the report editor iframe.
// Provides postMessage import/export of full editor state.
// + Owner Design Mode: hide/delete report elements and edit/delete/add rows,
//   for both the main report and the comparison report, persisted into state.
(function () {
  const DRAFT_PREFIX = "report-editor-draft:";
  let activeReportId = null;

  function getSectionsRegistry() {
    if (typeof SECTIONS !== "undefined") return SECTIONS;
    return window.SECTIONS || {};
  }

  function getLogoData() {
    if (typeof logoDataURL !== "undefined") return logoDataURL;
    return window.logoDataURL || null;
  }

  function setLogoData(value) {
    if (typeof logoDataURL !== "undefined") {
      logoDataURL = value;
    } else {
      window.logoDataURL = value;
    }
  }

  function getInsertedImages() {
    if (typeof insertedImages !== "undefined" && Array.isArray(insertedImages))
      return insertedImages;
    return Array.isArray(window.insertedImages) ? window.insertedImages : [];
  }

  function setInsertedImages(value) {
    if (typeof insertedImages !== "undefined") {
      insertedImages = value;
    } else {
      window.insertedImages = value;
    }
  }

  function getRowsForSection(section) {
    if (typeof getRows === "function") return getRows(section);
    if (typeof window.getRows === "function") return window.getRows(section);
    return [];
  }

  function addRowToSection(section, name, c, p) {
    if (typeof addRow === "function") return addRow(section, name, c, p);
    if (typeof window.addRow === "function")
      return window.addRow(section, name, c, p);
  }

  function getDraftKey() {
    return DRAFT_PREFIX + (activeReportId || "default");
  }

  function persistDraft(state) {
    try {
      sessionStorage.setItem(getDraftKey(), JSON.stringify(state));
    } catch (_e) {}
  }

  function loadDraft() {
    try {
      const raw = sessionStorage.getItem(getDraftKey());
      return raw ? JSON.parse(raw) : null;
    } catch (_e) {
      return null;
    }
  }

  function isViewOnlyByUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("mode") === "view";
    } catch (_e) {
      return false;
    }
  }

  function applyViewOnlyMode() {
    document.documentElement.classList.add("view-only");
    document.getElementById("editor-panel")?.classList.add("hidden");
    document.getElementById("report")?.classList.add("visible");
    const style = document.createElement("style");
    style.textContent = `
      #editor-panel { display:none !important; }
      #report { display:block !important; }
      .report-actions .btn[onclick*="backToEditor"],
      #editModeBtn { display:none !important; }
    `;
    document.head.appendChild(style);
    document.querySelectorAll("[contenteditable]").forEach((el) => {
      el.contentEditable = "false";
      el.removeAttribute("draggable");
    });
  }

  function allInputs() {
    return Array.from(
      document.querySelectorAll("#editor-panel input, #editor-panel select"),
    );
  }

  function allBlobs() {
    return Array.from(document.querySelectorAll("[data-state-blob]"));
  }

  function normalizeNumericValue(value) {
    return String(value ?? "")
      .replace(/[\u0660-\u0669]/g, (d) =>
        "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(
          d,
        ),
      )
      .replace(/[\u066c,\s]/g, "");
  }

  function exportState() {
    const values = {};
    allInputs().forEach((el) => {
      if (!el.id) return;
      if (el.type === "file") return;
      if (el.type === "checkbox" || el.type === "radio") {
        values[el.id] = el.checked;
      } else {
        values[el.id] =
          el.type === "number" ? normalizeNumericValue(el.value) : el.value;
      }
    });
    const sections = {};
    Object.keys(getSectionsRegistry()).forEach((k) => {
      sections[k] = getRowsForSection(k);
    });
    const visibility = { sections: {}, charts: {}, items: {} };
    document.querySelectorAll(".vis-section").forEach((cb) => {
      visibility.sections[cb.dataset.key] = cb.checked;
    });
    document.querySelectorAll(".vis-chart").forEach((cb) => {
      visibility.charts[cb.dataset.id] = cb.checked;
    });
    document.querySelectorAll(".vis-item").forEach((cb) => {
      visibility.items[cb.dataset.id] = cb.checked;
    });
    const blobs = {};
    allBlobs().forEach((el) => {
      if (!el.id) return;
      blobs[el.id] = el.value || "";
    });
    return {
      v: 1,
      values,
      sections,
      visibility,
      blobs,
      logoDataURL: getLogoData(),
      insertedImages: getInsertedImages(),
      designOverrides: getDesignOverrides(),
    };
  }

  function importState(state) {
    if (!state) return;
    if (state.values) {
      Object.entries(state.values).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === "checkbox" || el.type === "radio") el.checked = !!val;
        else {
          if (
            el.tagName === "SELECT" &&
            val != null &&
            val !== "" &&
            !Array.from(el.options).some((o) => o.value === val)
          ) {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = val;
            el.appendChild(opt);
          }
          el.value = el.type === "number" ? normalizeNumericValue(val) : val;
        }
      });
    }
    if (state.logoDataURL) {
      setLogoData(state.logoDataURL);
      const img = document.getElementById("logoPreviewImg");
      const wrap = document.getElementById("logoPreviewContainer");
      if (img) img.src = state.logoDataURL;
      if (wrap) wrap.style.display = "block";
    }
    if (Array.isArray(state.insertedImages)) {
      setInsertedImages(state.insertedImages);
    }
    if (state.sections) {
      Object.keys(getSectionsRegistry()).forEach((k) => {
        const tb = document.getElementById(k + "-body");
        if (tb) tb.innerHTML = "";
        const rows = state.sections[k] || [];
        rows.forEach((r) =>
          addRowToSection(
            k,
            r.name || "",
            normalizeNumericValue(r.c),
            normalizeNumericValue(r.p),
          ),
        );
      });
    }
    if (state.visibility) {
      Object.entries(state.visibility.sections || {}).forEach(([key, on]) => {
        const cb = document.querySelector(`.vis-section[data-key="${key}"]`);
        if (cb) cb.checked = !!on;
      });
      Object.entries(state.visibility.charts || {}).forEach(([id, on]) => {
        const cb = document.querySelector(`.vis-chart[data-id="${id}"]`);
        if (cb) cb.checked = !!on;
      });
      Object.entries(state.visibility.items || {}).forEach(([id, on]) => {
        const cb = document.querySelector(`.vis-item[data-id="${id}"]`);
        if (cb) cb.checked = !!on;
      });
    }
    if (state.blobs) {
      Object.entries(state.blobs).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el && "value" in el) {
          el.value = val || "";
          el.dispatchEvent(new Event("blob-restored", { bubbles: true }));
        }
      });
    }
    setDesignOverrides(state.designOverrides);
    if (typeof window.applyDesignVars === "function") window.applyDesignVars();
  }

  function send(type, payload) {
    try {
      window.parent.postMessage({ source: "report-frame", type, payload }, "*");
    } catch (e) {}
  }

  function applyOwnerAccess(isOwnerAllowed) {
    const allowed = Boolean(isOwnerAllowed);
    document.documentElement.classList.toggle("owner-allowed", allowed);
    document.documentElement.classList.toggle("owner-denied", !allowed);
    window.__lnCmpOwnerAllowed = allowed;

    const designBox = document.getElementById("lnCmpDesignBox");
    if (!allowed && designBox) designBox.remove();
    if (!allowed && typeof window.LN_applyCmpOwnerLock === "function")
      window.LN_applyCmpOwnerLock();
    if (
      allowed &&
      !designBox &&
      typeof window.LN_cmpDesignBoxMarkup === "function"
    ) {
      const body = document.querySelector("#lnCmpSidebar .ln-cmp-body");
      if (body && !document.documentElement.classList.contains("view-only")) {
        body.insertAdjacentHTML("beforeend", window.LN_cmpDesignBoxMarkup());
        if (typeof window.LN_buildCmpDesignList === "function")
          window.LN_buildCmpDesignList();
      }
    }

    try {
      if (!allowed) setDesignModeActive(false);
      updateDesignModeButton();
    } catch (_e) {}
  }

  function wrapGenerateReportForCloudSave() {
    if (
      typeof window.generateReport !== "function" ||
      window.__cloudSaveGenerateWrapped
    )
      return;
    const originalGenerateReport = window.generateReport;
    window.generateReport = function (...args) {
      const result = originalGenerateReport.apply(this, args);
      setTimeout(() => {
        try {
          applyDesignOverrides();
        } catch (_e) {}
        try {
          if (designModeActive) decorateDesignTargets();
        } catch (_e) {}
        send("generated", exportState());
      }, 0);
      return result;
    };
    window.__cloudSaveGenerateWrapped = true;
  }

  window.addEventListener("message", (ev) => {
    const msg = ev.data || {};
    if (!msg || msg.target !== "report-frame") return;
    if (msg.reportId) activeReportId = String(msg.reportId);

    if (msg.type === "import") {
      const stateToImport = msg.state || loadDraft();
      importState(stateToImport);
      if (msg.autoGenerate && typeof window.generateReport === "function") {
        setTimeout(() => window.generateReport(), 120);
      }
      if (stateToImport) persistDraft(stateToImport);
      setTimeout(() => {
        try {
          applyDesignOverrides();
        } catch (_e) {}
      }, 200);
      send("imported");
    } else if (msg.type === "export") {
      const state = exportState();
      persistDraft(state);
      send("state", state);
    } else if (msg.type === "view-only") {
      applyViewOnlyMode();
    } else if (msg.type === "set-owner-access") {
      applyOwnerAccess(msg.isAllowed);
    } else if (msg.type === "generate") {
      if (typeof window.generateReport === "function") window.generateReport();
    }
  });

  applyOwnerAccess(false);
  if (isViewOnlyByUrl()) applyViewOnlyMode();

  window.addEventListener("load", () => {
    injectFluidEditorStyles();
    injectDesignModeStyles();
    wrapGenerateReportForCloudSave();
    ensureDesignModeButton();
    send("ready");
    attachChangeNotify();
  });

  if (document.readyState === "complete") {
    injectFluidEditorStyles();
    injectDesignModeStyles();
    wrapGenerateReportForCloudSave();
    ensureDesignModeButton();
    send("ready");
    attachChangeNotify();
  }

  function attachChangeNotify() {
    const root = document.getElementById("editor-panel");
    if (!root) return;
    const notify = () => {
      const state = exportState();
      persistDraft(state);
      send("changed");
    };
    root.addEventListener("input", notify, true);
    root.addEventListener("change", notify, true);
    window.addEventListener("report-data-changed", notify);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") persistDraft(exportState());
    });
    window.addEventListener("beforeunload", () => persistDraft(exportState()));
  }

  let designOverrides = freshOverrides();
  let designModeActive = false;

  function freshOverrides() {
    return { hidden: {}, removedRows: {}, rowEdits: {}, addedRows: {} };
  }

  function getDesignOverrides() {
    return designOverrides || freshOverrides();
  }

  function setDesignOverrides(ov) {
    const base = freshOverrides();
    if (ov && typeof ov === "object") {
      base.hidden = ov.hidden || {};
      base.removedRows = ov.removedRows || {};
      base.rowEdits = ov.rowEdits || {};
      base.addedRows = ov.addedRows || {};
    }
    designOverrides = base;
    setTimeout(() => {
      try {
        applyDesignOverrides();
      } catch (_e) {}
    }, 60);
  }

  function ownerEditable() {
    return (
      !!window.__lnCmpOwnerAllowed &&
      !document.documentElement.classList.contains("view-only")
    );
  }

  function designScopes() {
    const scopes = [];
    const root = document.getElementById("reportContent");
    if (root) scopes.push({ el: root, prefix: "r" });
    const cmp = document.getElementById("lnCmpSidebar");
    if (cmp) scopes.push({ el: cmp, prefix: "c" });
    return scopes;
  }

  function tagGroup(scope, selector, prefix, filter) {
    let i = 0;
    scope.querySelectorAll(selector).forEach((el) => {
      if (filter && !filter(el)) return;
      el.setAttribute("data-ln-key", prefix + ":" + i);
      i++;
    });
  }

  function tagDesignTargets() {
    designScopes().forEach(({ el: scope, prefix }) => {
      tagGroup(scope, ".kpi-card", prefix + ":kpi");
      tagGroup(scope, ".chart-card", prefix + ":chart");
      tagGroup(scope, ".dash-stat", prefix + ":dash");
      tagGroup(scope, ".analysis-card", prefix + ":analysis");
      tagGroup(scope, ".cashflow-card", prefix + ":cashflow");
      tagGroup(scope, ".card", prefix + ":card", (e) => {
        const p = e.parentElement;
        return !(p && p.closest && p.closest(".card"));
      });
      let ti = 0;
      scope.querySelectorAll(".fin-table, .items-table").forEach((tbl) => {
        tbl.setAttribute("data-ln-table", prefix + ":table:" + ti);
        ti++;
      });
    });
  }

  function applyDesignOverrides() {
    tagDesignTargets();
    document.querySelectorAll("[data-ln-key]").forEach((el) => {
      const k = el.getAttribute("data-ln-key");
      el.classList.toggle("ln-hidden", !!designOverrides.hidden[k]);
    });
    document.querySelectorAll("[data-ln-table]").forEach((tbl) => {
      applyTableOverrides(tbl);
    });
  }

  function tableBody(tbl) {
    return tbl.querySelector("tbody") || tbl;
  }

  function applyTableOverrides(tbl) {
    const key = tbl.getAttribute("data-ln-table");
    const body = tableBody(tbl);
    body
      .querySelectorAll(':scope > tr[data-ln-added="1"]')
      .forEach((r) => r.remove());
    const rows = Array.from(body.querySelectorAll(":scope > tr")).filter(
      (tr) => tr.getAttribute("data-ln-added") !== "1",
    );
    const removed = designOverrides.removedRows[key] || [];
    const edits = designOverrides.rowEdits[key] || {};
    rows.forEach((tr, idx) => {
      tr.setAttribute("data-ln-row", String(idx));
      tr.classList.toggle("ln-hidden", removed.indexOf(idx) >= 0);
      const re = edits[idx];
      if (re) {
        const cells = tr.querySelectorAll(":scope > td");
        Object.entries(re).forEach(([ci, txt]) => {
          const c = cells[Number(ci)];
          if (c) c.textContent = txt;
        });
      }
    });
    const added = designOverrides.addedRows[key] || [];
    const template = rows[rows.length - 1] || rows[0];
    added.forEach((cellTexts, ai) => {
      const tr = buildAddedRow(template, cellTexts);
      tr.setAttribute("data-ln-added", "1");
      tr.setAttribute("data-ln-added-index", String(ai));
      body.appendChild(tr);
    });
  }

  function buildAddedRow(template, cellTexts) {
    const tr = document.createElement("tr");
    tr.className = "ln-added-row";
    let cellCount = 3;
    if (template) {
      const tds = template.querySelectorAll(":scope > td");
      if (tds.length) cellCount = tds.length;
    }
    for (let i = 0; i < cellCount; i++) {
      const td = document.createElement("td");
      td.textContent = cellTexts && cellTexts[i] != null ? cellTexts[i] : "";
      tr.appendChild(td);
    }
    return tr;
  }

  function markChanged() {
    try {
      window.dispatchEvent(new Event("report-data-changed"));
    } catch (_e) {}
  }

  function hideElement(key) {
    if (!key) return;
    designOverrides.hidden[key] = true;
    applyDesignOverrides();
    decorateDesignTargets();
    markChanged();
  }
  function restoreElement(key) {
    if (!key) return;
    delete designOverrides.hidden[key];
    applyDesignOverrides();
    decorateDesignTargets();
    markChanged();
  }
  function deleteRow(tableKey, rowIdx) {
    const arr =
      designOverrides.removedRows[tableKey] ||
      (designOverrides.removedRows[tableKey] = []);
    if (arr.indexOf(rowIdx) < 0) arr.push(rowIdx);
    applyDesignOverrides();
    decorateDesignTargets();
    markChanged();
  }
  function addRowToTable(tableKey) {
    const arr =
      designOverrides.addedRows[tableKey] ||
      (designOverrides.addedRows[tableKey] = []);
    arr.push([]);
    applyDesignOverrides();
    decorateDesignTargets();
    markChanged();
  }
  function captureRowEdit(tableKey, rowIdx, cellIdx, text) {
    const t =
      designOverrides.rowEdits[tableKey] ||
      (designOverrides.rowEdits[tableKey] = {});
    const r = t[rowIdx] || (t[rowIdx] = {});
    r[cellIdx] = text;
    markChanged();
  }
  function captureAddedRowEdit(tableKey, addedIdx, cellIdx, text) {
    const arr =
      designOverrides.addedRows[tableKey] ||
      (designOverrides.addedRows[tableKey] = []);
    if (!arr[addedIdx]) arr[addedIdx] = [];
    arr[addedIdx][cellIdx] = text;
    markChanged();
  }

  let designToolbar = null;
  let designBanner = null;
  let currentHover = null;

  function setDesignModeActive(on) {
    designModeActive = !!on && ownerEditable();
    document.documentElement.classList.toggle(
      "ln-design-mode",
      designModeActive,
    );
    updateDesignModeButton();
    if (designModeActive) {
      applyDesignOverrides();
      decorateDesignTargets();
      showBanner();
    } else {
      undecorateDesignTargets();
      hideToolbar();
      if (designBanner) designBanner.style.display = "none";
    }
  }

  function ensureDesignModeButton() {
    try {
      const actions = document.getElementById("reportActions");
      if (!actions || document.getElementById("lnDesignModeBtn")) return;
      const btn = document.createElement("button");
      btn.id = "lnDesignModeBtn";
      btn.className = "btn";
      btn.type = "button";
      btn.textContent = "\ud83c\udfa8 \u0648\u0636\u0639 \u0627\u0644\u062a\u0635\u0645\u064a\u0645";
      btn.addEventListener("click", () =>
        setDesignModeActive(!designModeActive),
      );
      actions.appendChild(btn);
      updateDesignModeButton();
    } catch (_e) {}
  }

  function updateDesignModeButton() {
    const btn = document.getElementById("lnDesignModeBtn");
    if (!btn) return;
    btn.style.display = ownerEditable() ? "inline-flex" : "none";
    btn.classList.toggle("ln-design-on", designModeActive);
    btn.textContent = designModeActive
      ? "\u2705 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062a\u0635\u0645\u064a\u0645"
      : "\ud83c\udfa8 \u0648\u0636\u0639 \u0627\u0644\u062a\u0635\u0645\u064a\u0645";
  }

  function showBanner() {
    if (!designBanner) {
      designBanner = document.createElement("div");
      designBanner.id = "lnDesignBanner";
      designBanner.innerHTML =
        '<span class="ln-db-dot"></span>' +
        '<span class="ln-db-text">\u0648\u0636\u0639 \u0627\u0644\u062a\u0635\u0645\u064a\u0645 \u0645\u064f\u0641\u0651\u0644 \u2014 \u0645\u0631\u0651\u0631 \u0627\u0644\u0645\u0624\u0634\u0631 \u0641\u0648\u0642 \u0623\u064a \u0639\u0646\u0635\u0631 \u0644\u0644\u062a\u062d\u0643\u0645 \u0628\u0647</span>' +
        '<button type="button" class="ln-db-restore">\u21ba \u0625\u0638\u0647\u0627\u0631 \u0627\u0644\u0643\u0644</button>' +
        '<button type="button" class="ln-db-close">\u2715 \u0625\u0646\u0647\u0627\u0621</button>';
      document.body.appendChild(designBanner);
      designBanner
        .querySelector(".ln-db-restore")
        .addEventListener("click", restoreAll);
      designBanner
        .querySelector(".ln-db-close")
        .addEventListener("click", () => setDesignModeActive(false));
    }
    designBanner.style.display = "flex";
  }

  function restoreAll() {
    designOverrides = freshOverrides();
    applyDesignOverrides();
    decorateDesignTargets();
    markChanged();
  }

  function decorateDesignTargets() {
    if (!designModeActive) return;
    tagDesignTargets();
    ensureToolbar();
  }

  function undecorateDesignTargets() {
    document
      .querySelectorAll(".ln-row-editing")
      .forEach((tr) => exitRowEdit(tr, false));
  }

  function ensureToolbar() {
    if (designToolbar) return;
    designToolbar = document.createElement("div");
    designToolbar.id = "lnDesignToolbar";
    designToolbar.style.display = "none";
    document.body.appendChild(designToolbar);
    designToolbar.addEventListener("mouseenter", () => {
      designToolbar.__hover = true;
    });
    designToolbar.addEventListener("mouseleave", () => {
      designToolbar.__hover = false;
      setTimeout(maybeHideToolbar, 200);
    });

    document.addEventListener("mouseover", onDesignHover, true);
  }

  function maybeHideToolbar() {
    if (designToolbar && !designToolbar.__hover && !designToolbar.__targetHover)
      hideToolbar();
  }

  function hideToolbar() {
    if (designToolbar) designToolbar.style.display = "none";
    currentHover = null;
  }

  function onDesignHover(ev) {
    if (!designModeActive) return;
    const t = ev.target;
    if (!t || !t.closest) return;
    if (t.closest("#lnDesignToolbar") || t.closest("#lnDesignBanner")) return;

    const row = t.closest('tr[data-ln-row], tr[data-ln-added="1"]');
    const tableEl = t.closest("[data-ln-table]");
    if (row && tableEl) {
      showRowToolbar(row, tableEl);
      return;
    }
    const el = t.closest("[data-ln-key]");
    if (el) {
      showElementToolbar(el);
      return;
    }
  }

  function positionToolbar(target) {
    const rect = target.getBoundingClientRect();
    designToolbar.style.display = "flex";
    const top = Math.max(6, rect.top + window.scrollY - 6);
    designToolbar.style.top = top + "px";
    let left = rect.left + window.scrollX + 6;
    designToolbar.style.left = left + "px";
  }

  function clearToolbar() {
    while (designToolbar.firstChild)
      designToolbar.removeChild(designToolbar.firstChild);
  }

  function tbBtn(label, title, handler, cls) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ln-tb-btn" + (cls ? " " + cls : "");
    b.textContent = label;
    if (title) b.title = title;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handler();
    });
    return b;
  }

  function showElementToolbar(el) {
    ensureToolbar();
    currentHover = el;
    clearToolbar();
    const key = el.getAttribute("data-ln-key");
    const isHidden = !!designOverrides.hidden[key];
    if (isHidden) {
      designToolbar.appendChild(
        tbBtn(
          "\u21ba \u0625\u0638\u0647\u0627\u0631",
          "\u0625\u0638\u0647\u0627\u0631 \u0627\u0644\u0639\u0646\u0635\u0631",
          () => restoreElement(key),
          "ln-tb-ok",
        ),
      );
    } else {
      designToolbar.appendChild(
        tbBtn(
          "\ud83d\udc41 \u0625\u062e\u0641\u0627\u0621",
          "\u0625\u062e\u0641\u0627\u0621 \u0627\u0644\u0639\u0646\u0635\u0631",
          () => hideElement(key),
        ),
      );
      designToolbar.appendChild(
        tbBtn(
          "\ud83d\uddd1 \u062d\u0630\u0641",
          "\u062d\u0630\u0641 \u0627\u0644\u0639\u0646\u0635\u0631",
          () => hideElement(key),
          "ln-tb-danger",
        ),
      );
    }
    designToolbar.__targetHover = true;
    el.addEventListener(
      "mouseleave",
      () => {
        designToolbar.__targetHover = false;
        setTimeout(maybeHideToolbar, 200);
      },
      { once: true },
    );
    positionToolbar(el);
  }

  function showRowToolbar(row, tableEl) {
    ensureToolbar();
    currentHover = row;
    clearToolbar();
    const tableKey = tableEl.getAttribute("data-ln-table");
    const isAdded = row.getAttribute("data-ln-added") === "1";
    designToolbar.appendChild(
      tbBtn(
        "\u270f\ufe0f \u062a\u0639\u062f\u064a\u0644",
        "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0633\u0637\u0631",
        () => enterRowEdit(row, tableEl),
      ),
    );
    designToolbar.appendChild(
      tbBtn(
        "\u2795 \u0633\u0637\u0631",
        "\u0625\u0636\u0627\u0641\u0629 \u0633\u0637\u0631",
        () => addRowToTable(tableKey),
        "ln-tb-ok",
      ),
    );
    if (isAdded) {
      const ai = Number(row.getAttribute("data-ln-added-index"));
      designToolbar.appendChild(
        tbBtn(
          "\ud83d\uddd1 \u062d\u0630\u0641",
          "\u062d\u0630\u0641 \u0627\u0644\u0633\u0637\u0631",
          () => removeAddedRow(tableKey, ai),
          "ln-tb-danger",
        ),
      );
    } else {
      const rowIdx = Number(row.getAttribute("data-ln-row"));
      designToolbar.appendChild(
        tbBtn(
          "\ud83d\uddd1 \u062d\u0630\u0641",
          "\u062d\u0630\u0641 \u0627\u0644\u0633\u0637\u0631",
          () => deleteRow(tableKey, rowIdx),
          "ln-tb-danger",
        ),
      );
    }
    designToolbar.__targetHover = true;
    row.addEventListener(
      "mouseleave",
      () => {
        designToolbar.__targetHover = false;
        setTimeout(maybeHideToolbar, 200);
      },
      { once: true },
    );
    positionToolbar(row);
  }

  function removeAddedRow(tableKey, ai) {
    const arr = designOverrides.addedRows[tableKey];
    if (arr && ai >= 0 && ai < arr.length) {
      arr.splice(ai, 1);
      applyDesignOverrides();
      decorateDesignTargets();
      markChanged();
    }
  }

  function enterRowEdit(row, tableEl) {
    hideToolbar();
    const tableKey = tableEl.getAttribute("data-ln-table");
    const isAdded = row.getAttribute("data-ln-added") === "1";
    row.classList.add("ln-row-editing");
    const cells = row.querySelectorAll(":scope > td");
    cells.forEach((td, ci) => {
      td.setAttribute("contenteditable", "true");
      td.classList.add("ln-cell-edit");
      const handler = () => {
        const text = td.textContent;
        if (isAdded) {
          captureAddedRowEdit(
            tableKey,
            Number(row.getAttribute("data-ln-added-index")),
            ci,
            text,
          );
        } else {
          captureRowEdit(
            tableKey,
            Number(row.getAttribute("data-ln-row")),
            ci,
            text,
          );
        }
      };
      td.addEventListener("input", handler);
      td.__lnHandler = handler;
    });
    if (cells[0]) cells[0].focus();
    row.addEventListener("keydown", rowEditKey);
  }

  function rowEditKey(ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      exitRowEdit(ev.currentTarget, true);
    } else if (ev.key === "Escape") {
      exitRowEdit(ev.currentTarget, true);
    }
  }

  function exitRowEdit(row, save) {
    if (!row || !row.classList.contains("ln-row-editing")) return;
    row.classList.remove("ln-row-editing");
    row.querySelectorAll(":scope > td").forEach((td) => {
      td.removeAttribute("contenteditable");
      td.classList.remove("ln-cell-edit");
      if (td.__lnHandler) {
        td.removeEventListener("input", td.__lnHandler);
        td.__lnHandler = null;
      }
    });
    row.removeEventListener("keydown", rowEditKey);
    if (save) markChanged();
  }

  document.addEventListener(
    "click",
    (ev) => {
      if (!designModeActive) return;
      const editing = document.querySelector(".ln-row-editing");
      if (
        editing &&
        !ev.target.closest(".ln-row-editing") &&
        !ev.target.closest("#lnDesignToolbar")
      ) {
        exitRowEdit(editing, true);
      }
    },
    true,
  );

  function injectDesignModeStyles() {
    if (document.getElementById("ln-design-mode-styles")) return;
    const st = document.createElement("style");
    st.id = "ln-design-mode-styles";
    st.textContent = `
      .ln-hidden { display:none !important; }
      html.ln-design-mode .ln-hidden {
        display:revert !important;
        opacity:0.32 !important;
        outline:2px dashed var(--secondary,#C8392E) !important;
        outline-offset:2px;
        position:relative;
      }
      html.ln-design-mode tr.ln-hidden { opacity:0.32 !important; }
      html.ln-design-mode [data-ln-key]:hover,
      html.ln-design-mode tr[data-ln-row]:hover,
      html.ln-design-mode tr[data-ln-added="1"]:hover {
        outline:2px solid var(--primary,#1E5392);
        outline-offset:2px;
        cursor:pointer;
      }
      html.ln-design-mode .ln-row-editing { outline:2px solid var(--accent,#1E8449) !important; background:#fffdf3 !important; }
      .ln-cell-edit { background:#fffbe6 !important; cursor:text !important; }
      tr.ln-added-row td { background:#f4fff7; }
      #lnDesignToolbar {
        position:absolute; z-index:99999; display:none; gap:4px;
        background:rgba(15,28,46,0.97); padding:5px; border-radius:10px;
        box-shadow:0 8px 26px rgba(0,0,0,0.4); border:1px solid rgba(201,162,39,0.35);
        transform:translateY(-100%);
      }
      .ln-tb-btn {
        border:none; background:#2d6bb0; color:#fff; font-family:inherit;
        font-size:12px; font-weight:700; padding:6px 10px; border-radius:7px; cursor:pointer;
        white-space:nowrap; transition:filter .15s;
      }
      .ln-tb-btn:hover { filter:brightness(1.15); }
      .ln-tb-btn.ln-tb-danger { background:#C8392E; }
      .ln-tb-btn.ln-tb-ok { background:#1E8449; }
      #lnDesignBanner {
        position:fixed; top:14px; left:50%; transform:translateX(-50%);
        z-index:99999; display:none; align-items:center; gap:12px;
        background:rgba(15,28,46,0.97); color:#fff; padding:9px 16px; border-radius:30px;
        box-shadow:0 10px 30px rgba(0,0,0,0.4); border:1px solid rgba(201,162,39,0.4);
        font-family:var(--font-main,sans-serif); font-size:13px;
      }
      #lnDesignBanner .ln-db-dot { width:9px; height:9px; border-radius:50%; background:#1E8449; box-shadow:0 0 0 0 rgba(30,132,73,0.6); animation:lnPulse 1.6s infinite; }
      @keyframes lnPulse { 0%{box-shadow:0 0 0 0 rgba(30,132,73,0.55);} 70%{box-shadow:0 0 0 8px rgba(30,132,73,0);} 100%{box-shadow:0 0 0 0 rgba(30,132,73,0);} }
      #lnDesignBanner button { border:none; cursor:pointer; font-family:inherit; font-size:12px; font-weight:700; padding:6px 12px; border-radius:20px; }
      #lnDesignBanner .ln-db-restore { background:#2d6bb0; color:#fff; }
      #lnDesignBanner .ln-db-close { background:#C8392E; color:#fff; }
      #lnDesignModeBtn.ln-design-on { background:#1E8449 !important; color:#fff !important; }
      @media print {
        #lnDesignToolbar, #lnDesignBanner, #lnDesignModeBtn { display:none !important; }
        html.ln-design-mode .ln-hidden { display:none !important; }
      }
    `;
    document.head.appendChild(st);
  }

  function injectFluidEditorStyles() {
    if (document.getElementById("ln-fluid-editor-styles")) return;
    const st = document.createElement("style");
    st.id = "ln-fluid-editor-styles";
    st.textContent = `
      #editor-panel { scroll-behavior:smooth; }
      .editor-header {
        background:linear-gradient(135deg, var(--primary-dark,#15406F), var(--primary,#1E5392)) !important;
        box-shadow:0 6px 24px rgba(0,0,0,0.35);
      }
      .editor-content { max-width:1120px; margin:0 auto; width:100%; }
      .editor-tabs { gap:8px; padding:14px 24px; }
      .tab-btn { border-radius:11px; padding:9px 18px; transition:all .18s ease; }
      .tab-btn:hover:not(.active) { transform:translateY(-1px); }
      .tab-btn.active { background:linear-gradient(135deg, var(--primary,#1E5392), var(--primary-light,#2D6BB0)) !important; box-shadow:0 4px 14px rgba(30,83,146,0.4); }
      .tab-content.active { animation:lnFadeIn .28s ease; }
      @keyframes lnFadeIn { from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:translateY(0);} }
      .section-card {
        border-radius:16px !important;
        box-shadow:0 2px 14px rgba(0,0,0,0.22);
        transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease;
      }
      .section-card:hover { transform:translateY(-2px); box-shadow:0 10px 28px rgba(0,0,0,0.32); border-color:rgba(201,162,39,0.35) !important; }
      .section-title { font-size:15.5px; letter-spacing:.2px; }
      .form-grid { gap:16px; }
      #tab-company .form-grid { grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); }
      .form-group label { letter-spacing:.6px; opacity:.9; }
      .form-group input, .form-group select {
        border-radius:11px !important;
        padding:11px 14px !important;
        background:#0b0f15 !important;
        transition:border-color .16s ease, box-shadow .16s ease, transform .12s ease;
      }
      .form-group input:hover, .form-group select:hover { border-color:#3d4654 !important; }
      .form-group input:focus, .form-group select:focus {
        border-color:var(--secondary,#C8392E) !important;
        box-shadow:0 0 0 3px rgba(200,57,46,0.18) !important;
      }
      .items-table input { border-radius:8px !important; padding:8px 11px !important; transition:border-color .15s, box-shadow .15s; }
      .items-table input:focus { box-shadow:0 0 0 2px rgba(200,57,46,0.18) !important; }
      .items-table tbody tr { transition:background .15s; }
      .items-table tbody tr:hover td { background:rgba(45,107,176,0.10); }
      .btn { border-radius:11px !important; transition:transform .12s ease, filter .15s ease, box-shadow .15s ease; }
      .btn:hover { transform:translateY(-1px); filter:brightness(1.05); }
      .btn:active { transform:translateY(0); }
      .editor-footer { backdrop-filter:blur(4px); }
    `;
    document.head.appendChild(st);
  }

  window.LN_setDesignMode = setDesignModeActive;
  window.LN_applyDesignOverrides = applyDesignOverrides;
})();

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
