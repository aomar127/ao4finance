// Per-firm report design engine.
// Reskins the rendered financial report (#reportContent) inside the report
// iframe according to the firm's selected report_design, by injecting a single
// <style id="ln-design-theme"> into the iframe document head and toggling a
// data-ln-design attribute on its <html>. Purely presentational: it never
// touches saved report data. Kept DISTINCT from owner Design Mode
// (html.ln-design-mode) and single-period mode (html.ln-no-compare).
//
// Designs:
//   ln    = تصميم لغة الأرقام / Language of Numbers (default look, no overrides)
//   one   = التصميم الأول / Design One  (عصري ملوّن / modern colorful)
//   two   = التصميم الثاني / Design Two (كلاسيكي مؤسسي / classic institutional)
//   three = التصميم الثالث / Design Three (تنفيذي مختصر / executive minimal)

export type ReportDesignId = "ln" | "one" | "two" | "three";

const VALID: ReportDesignId[] = ["ln", "one", "two", "three"];

export function normalizeDesign(value: unknown): ReportDesignId {
  return VALID.indexOf(value as ReportDesignId) >= 0
    ? (value as ReportDesignId)
    : "ln";
}

const STYLE_ID = "ln-design-theme";

const THEME_CSS = `
/* ===== Design One — عصري ملوّن / Modern Colorful ===== */
html[data-ln-design="one"] #reportContent .report-header{
  background:linear-gradient(135deg,#6366f1,#0ea5e9)!important;color:#fff!important;
  border:none!important;border-radius:20px!important;padding:26px!important;
  box-shadow:0 14px 36px rgba(79,70,229,.30)!important;}
html[data-ln-design="one"] #reportContent .report-header *{color:#fff!important;}
html[data-ln-design="one"] #reportContent .kpi-card{
  border:none!important;border-radius:18px!important;
  background:linear-gradient(135deg,#ffffff,#eef2ff)!important;
  box-shadow:0 10px 26px rgba(99,102,241,.16)!important;
  border-top:4px solid #6366f1!important;}
html[data-ln-design="one"] #reportContent .kpi-card:nth-child(3n+2){
  border-top-color:#0ea5e9!important;background:linear-gradient(135deg,#fff,#ecfeff)!important;}
html[data-ln-design="one"] #reportContent .kpi-card:nth-child(3n){
  border-top-color:#10b981!important;background:linear-gradient(135deg,#fff,#ecfdf5)!important;}
html[data-ln-design="one"] #reportContent .kpi-value{color:#4338ca!important;font-weight:800!important;}
html[data-ln-design="one"] #reportContent .chart-card,
html[data-ln-design="one"] #reportContent .analysis-card,
html[data-ln-design="one"] #reportContent .cashflow-card{
  border:none!important;border-radius:18px!important;
  box-shadow:0 8px 24px rgba(2,6,23,.08)!important;}
html[data-ln-design="one"] #reportContent .fin-table th{
  background:linear-gradient(135deg,#6366f1,#0ea5e9)!important;color:#fff!important;}
html[data-ln-design="one"] #reportContent .dash-stat{
  border-radius:16px!important;background:linear-gradient(135deg,#eef2ff,#ecfeff)!important;}

/* ===== Design Two — كلاسيكي مؤسسي / Classic Institutional ===== */
html[data-ln-design="two"] #reportContent{
  font-family:Georgia,"Times New Roman",serif!important;}
html[data-ln-design="two"] #reportContent .report-header{
  background:#15406f!important;color:#fff!important;border-radius:0!important;
  border-bottom:4px solid #b8860b!important;padding:24px!important;}
html[data-ln-design="two"] #reportContent .report-header *{color:#fff!important;}
html[data-ln-design="two"] #reportContent .kpi-card,
html[data-ln-design="two"] #reportContent .chart-card,
html[data-ln-design="two"] #reportContent .analysis-card,
html[data-ln-design="two"] #reportContent .cashflow-card,
html[data-ln-design="two"] #reportContent .dash-stat{
  border:1px solid #15406f!important;border-radius:0!important;
  box-shadow:none!important;border-top:3px solid #b8860b!important;}
html[data-ln-design="two"] #reportContent .kpi-value{color:#15406f!important;font-weight:700!important;}
html[data-ln-design="two"] #reportContent .kpi-label{
  letter-spacing:.3px!important;color:#5b4a1e!important;}
html[data-ln-design="two"] #reportContent .fin-table{border:1px solid #15406f!important;}
html[data-ln-design="two"] #reportContent .fin-table th{
  background:#15406f!important;color:#fff!important;border-radius:0!important;}
html[data-ln-design="two"] #reportContent .fin-table td{border-color:#d8c9a3!important;}

/* ===== Design Three — تنفيذي مختصر / Executive Minimal ===== */
html[data-ln-design="three"] #reportContent{background:#fff!important;}
html[data-ln-design="three"] #reportContent .report-header{
  background:#0f172a!important;color:#fff!important;border:none!important;
  border-radius:10px!important;padding:22px!important;}
html[data-ln-design="three"] #reportContent .report-header *{color:#fff!important;}
html[data-ln-design="three"] #reportContent .kpi-card,
html[data-ln-design="three"] #reportContent .chart-card,
html[data-ln-design="three"] #reportContent .analysis-card,
html[data-ln-design="three"] #reportContent .cashflow-card{
  border:1px solid #e2e8f0!important;border-radius:10px!important;
  box-shadow:none!important;background:#fff!important;}
html[data-ln-design="three"] #reportContent .kpi-label{
  text-transform:uppercase!important;letter-spacing:1px!important;
  font-size:11px!important;color:#64748b!important;}
html[data-ln-design="three"] #reportContent .kpi-value{color:#0f172a!important;font-weight:700!important;}
html[data-ln-design="three"] #reportContent .dash-stat{
  background:#0f172a!important;color:#fff!important;border-radius:10px!important;border:none!important;}
html[data-ln-design="three"] #reportContent .dash-stat *{color:#fff!important;}
html[data-ln-design="three"] #reportContent .fin-table th{
  background:#0f172a!important;color:#fff!important;text-transform:uppercase!important;
  letter-spacing:.5px!important;font-size:12px!important;}
`;

export function applyReportTheme(
  iframe: HTMLIFrameElement | null | undefined,
  design: unknown,
): void {
  if (!iframe) return;
  let doc: Document | null = null;
  try {
    doc = iframe.contentDocument || iframe.contentWindow?.document || null;
  } catch (_e) {
    doc = null;
  }
  if (!doc || !doc.head || !doc.documentElement) return;
  const id = normalizeDesign(design);
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = THEME_CSS;
    doc.head.appendChild(style);
  }
  doc.documentElement.setAttribute("data-ln-design", id);
}
