// report-bridge core (module 1 of 3): React shell <-> iframe state bridge + owner design mode.
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
