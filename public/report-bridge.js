// Bridge between parent React shell and the report editor iframe.
// Provides postMessage import/export of full editor state.
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
    if (typeof insertedImages !== "undefined" && Array.isArray(insertedImages)) return insertedImages;
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
    if (typeof window.addRow === "function") return window.addRow(section, name, c, p);
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
    document.documentElement.classList.add('view-only');
    document.getElementById('editor-panel')?.classList.add('hidden');
    document.getElementById('report')?.classList.add('visible');
    const style = document.createElement('style');
    style.textContent = `
      #editor-panel { display:none !important; }
      #report { display:block !important; }
      .report-actions .btn[onclick*="backToEditor"],
      #editModeBtn { display:none !important; }
    `;
    document.head.appendChild(style);
    document.querySelectorAll('[contenteditable]').forEach((el) => {
      el.contentEditable = 'false';
      el.removeAttribute('draggable');
    });
  }

  function allInputs() {
    return Array.from(document.querySelectorAll('#editor-panel input, #editor-panel select'));
  }

  function allBlobs() {
    return Array.from(document.querySelectorAll('[data-state-blob]'));
  }

  function normalizeNumericValue(value) {
    return String(value ?? '')
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[٬,\s]/g, '');
  }

  function exportState() {
    const values = {};
    allInputs().forEach((el) => {
      if (!el.id) return;
      if (el.type === 'file') return;
      if (el.type === 'checkbox' || el.type === 'radio') {
        values[el.id] = el.checked;
      } else {
        values[el.id] = el.type === 'number' ? normalizeNumericValue(el.value) : el.value;
      }
    });
    const sections = {};
    Object.keys(getSectionsRegistry()).forEach((k) => {
      sections[k] = getRowsForSection(k);
    });
    const visibility = { sections: {}, charts: {}, items: {} };
    document.querySelectorAll('.vis-section').forEach((cb) => {
      visibility.sections[cb.dataset.key] = cb.checked;
    });
    document.querySelectorAll('.vis-chart').forEach((cb) => {
      visibility.charts[cb.dataset.id] = cb.checked;
    });
    document.querySelectorAll('.vis-item').forEach((cb) => {
      visibility.items[cb.dataset.id] = cb.checked;
    });
    const blobs = {};
    allBlobs().forEach((el) => {
      if (!el.id) return;
      blobs[el.id] = el.value || '';
    });
    return {
      v: 1,
      values,
      sections,
      visibility,
      blobs,
      logoDataURL: getLogoData(),
      insertedImages: getInsertedImages(),
    };
  }

  function importState(state) {
    if (!state) return;
    if (state.values) {
      Object.entries(state.values).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!val;
        else {
          if (el.tagName === 'SELECT' && val != null && val !== '' && !Array.from(el.options).some(o => o.value === val)) {
            const opt = document.createElement('option');
            opt.value = val; opt.textContent = val;
            el.appendChild(opt);
          }
          el.value = el.type === 'number' ? normalizeNumericValue(val) : val;
        }
      });
    }
    if (state.logoDataURL) {
      setLogoData(state.logoDataURL);
      const img = document.getElementById('logoPreviewImg');
      const wrap = document.getElementById('logoPreviewContainer');
      if (img) img.src = state.logoDataURL;
      if (wrap) wrap.style.display = 'block';
    }
    if (Array.isArray(state.insertedImages)) {
      setInsertedImages(state.insertedImages);
    }
    if (state.sections) {
      Object.keys(getSectionsRegistry()).forEach((k) => {
        const tb = document.getElementById(k + '-body');
        if (tb) tb.innerHTML = '';
        const rows = state.sections[k] || [];
        rows.forEach((r) => addRowToSection(k, r.name || '', normalizeNumericValue(r.c), normalizeNumericValue(r.p)));
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
        if (el && 'value' in el) {
          el.value = val || '';
          el.dispatchEvent(new Event('blob-restored', { bubbles: true }));
        }
      });
    }
    if (typeof window.applyDesignVars === 'function') window.applyDesignVars();
  }

  function send(type, payload) {
    try {
      window.parent.postMessage({ source: 'report-frame', type, payload }, '*');
    } catch (e) {}
  }

  // تصحيح أمني: الاعتماد على متغير من الخادم/مكون React بدلاً من الإيميل المكشوف
  function applyOwnerAccess(isOwnerAllowed) {
    const allowed = Boolean(isOwnerAllowed);
    document.documentElement.classList.toggle('owner-allowed', allowed);
    document.documentElement.classList.toggle('owner-denied', !allowed);
    window.__lnCmpOwnerAllowed = allowed;

    const designBox = document.getElementById('lnCmpDesignBox');
    if (!allowed && designBox) designBox.remove();
    if (!allowed && typeof window.LN_applyCmpOwnerLock === 'function') window.LN_applyCmpOwnerLock();
    if (allowed && !designBox && typeof window.LN_cmpDesignBoxMarkup === 'function') {
      const body = document.querySelector('#lnCmpSidebar .ln-cmp-body');
      if (body && !document.documentElement.classList.contains('view-only')) {
        body.insertAdjacentHTML('beforeend', window.LN_cmpDesignBoxMarkup());
        if (typeof window.LN_buildCmpDesignList === 'function') window.LN_buildCmpDesignList();
      }
    }
  }

  function wrapGenerateReportForCloudSave() {
    if (typeof window.generateReport !== 'function' || window.__cloudSaveGenerateWrapped) return;
    const originalGenerateReport = window.generateReport;
    window.generateReport = function (...args) {
      const result = originalGenerateReport.apply(this, args);
      setTimeout(() => send('generated', exportState()), 0);
      return result;
    };
    window.__cloudSaveGenerateWrapped = true;
  }

  window.addEventListener('message', (ev) => {
    const msg = ev.data || {};
    if (!msg || msg.target !== 'report-frame') return;
    if (msg.reportId) activeReportId = String(msg.reportId);

    if (msg.type === 'import') {
      const stateToImport = msg.state || loadDraft();
      importState(stateToImport);
      if (msg.autoGenerate && typeof window.generateReport === 'function') {
        setTimeout(() => window.generateReport(), 120);
      }
      if (stateToImport) persistDraft(stateToImport);
      send('imported');
    } else if (msg.type === 'export') {
      const state = exportState();
      persistDraft(state);
      send('state', state);
    } else if (msg.type === 'view-only') {
      applyViewOnlyMode();
    } else if (msg.type === 'set-owner-access') {
      // استقبال الصلاحية الموثقة من بيئة React
      applyOwnerAccess(msg.isAllowed);
    } else if (msg.type === 'generate') {
      if (typeof window.generateReport === 'function') window.generateReport();
    }
  });

  // افتراضياً، نمنع الصلاحيات حتى يتم تأكيدها من الـ Parent React App
  applyOwnerAccess(false);
  if (isViewOnlyByUrl()) applyViewOnlyMode();

  window.addEventListener('load', () => {
    wrapGenerateReportForCloudSave();
    send('ready');
    attachChangeNotify();
  });

  if (document.readyState === 'complete') {
    wrapGenerateReportForCloudSave();
    send('ready');
    attachChangeNotify();
  }

  function attachChangeNotify() {
    const root = document.getElementById('editor-panel');
    if (!root) return;
    const notify = () => {
      const state = exportState();
      persistDraft(state);
      send('changed');
    };
    root.addEventListener('input', notify, true);
    root.addEventListener('change', notify, true);
    window.addEventListener('report-data-changed', notify);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistDraft(exportState());
    });
    window.addEventListener('beforeunload', () => persistDraft(exportState()));
  }
})();
