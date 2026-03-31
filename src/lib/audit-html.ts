import type { AuditDimensionScore } from "@/types/pm";


function gradeColor(grade: string): string {
  if (grade === "A" || grade === "B") return "#1e8449";
  if (grade === "C") return "#d68910";
  return "#c0392b";
}

function gradeBgColor(grade: string): string {
  if (grade === "A" || grade === "B") return "#F0FDF4";
  if (grade === "C") return "#FFFBEB";
  return "#FEF2F2";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const DIMENSION_LABELS: Record<string, string> = {
  seo: "SEO",
  entity: "Entity Authority",
  ai_discoverability: "AI Search",
  conversion: "Conversion",
  content: "Content",
  a2a_readiness: "A2A",
};

const DIMENSION_FULL_LABELS: Record<string, string> = {
  seo: "SEO",
  entity: "Entity Authority",
  ai_discoverability: "AI Discoverability",
  conversion: "Conversion Architecture",
  content: "Content Inventory",
  a2a_readiness: "A2A Readiness",
};

// ─── HTML Builder (FSA Design System) ────────────────────────────────

export interface AuditHTMLParams {
  orgName: string;
  domain: string;
  url: string;
  monthYear: string;
  vertical: string;
  scores: Record<string, AuditDimensionScore | unknown>;
  overall: { grade: string; score: number; rebuild_recommended: boolean; rebuild_reason: string | null };
  gaps: Record<string, Array<Record<string, string>>>;
  quickWins: Array<Record<string, string>>;
  pagesToBuild: Array<Record<string, string>>;
  recommendations: Array<Record<string, string>>;
  rebuildTimeline: Array<Record<string, string>>;
  platformComparison: { current: string; recommended: string } | null;
  summary: string;
  agencyName: string;
  agencyFullName: string;
  agencyShortName: string;
  agencyTagline: string | null;
  agencyLocation: string | null;
  agencyLogoUrl: string | null;
  brandColors: {
    navy: string;
    accent: string;
    gold: string;
    textOnPrimary: string;
  };
}

export function buildAuditHTML(p: AuditHTMLParams): string {
  const dims = ["seo", "entity", "ai_discoverability", "conversion", "content", "a2a_readiness"];
  const bc = p.brandColors;

  // Build cover grade badges (horizontal row)
  const gradeBadges = dims.map((d) => {
    const dim = p.scores[d] as AuditDimensionScore;
    const grade = dim?.grade || "F";
    const score = dim?.score ?? 0;
    return `<div class="cover-badge">
      <div class="cover-badge-grade" style="color:${gradeColor(grade)}">${esc(grade)}</div>
      <div class="cover-badge-label">${esc(DIMENSION_LABELS[d] || d)}</div>
      <div class="cover-badge-score">${score}%</div>
    </div>`;
  }).join("\n");

  // Build executive summary score table
  const scoreTableRows = dims.map((d, i) => {
    const dim = p.scores[d] as AuditDimensionScore;
    const grade = dim?.grade || "F";
    const score = dim?.score ?? 0;
    const findings = dim?.findings || [];
    const keyFinding = findings[0] || "—";
    return `<tr class="${i % 2 === 0 ? "" : "alt"}">
      <td class="td-bold">${esc(DIMENSION_FULL_LABELS[d] || d)}</td>
      <td class="td-center td-bold" style="color:${gradeColor(grade)}">${esc(grade)}</td>
      <td class="td-center">${score}%</td>
      <td>${esc(keyFinding)}</td>
    </tr>`;
  }).join("\n");

  // Build dimension pages
  const dimensionPages = dims.map((d, idx) => {
    const dim = p.scores[d] as AuditDimensionScore;
    const grade = dim?.grade || "F";
    const score = dim?.score ?? 0;
    const gapItems = p.gaps[d] || [];

    let tableHeader: string;
    let tableRows: string;

    if (d === "content") {
      tableHeader = `<tr><th>Page</th><th>Status</th><th>What's Missing</th></tr>`;
      tableRows = gapItems.map((g, i) => `<tr class="${i % 2 === 1 ? "alt" : ""}">
        <td class="td-bold">${esc(g.item || "")}</td>
        <td style="color:${(g.current_state || "").toLowerCase().includes("missing") ? "#c0392b" : "#1A1A2E"}">${esc(g.current_state || "")}</td>
        <td>${esc(g.gap || g.standard || "")}</td>
      </tr>`).join("\n");
    } else if (d === "a2a_readiness") {
      tableHeader = `<tr><th>Item</th><th>Current State</th><th>Standard / Recommended</th></tr>`;
      tableRows = gapItems.map((g, i) => `<tr class="${i % 2 === 1 ? "alt" : ""}">
        <td class="td-bold">${esc(g.item || "")}</td>
        <td>${esc(g.current_state || "")}</td>
        <td>${esc(g.standard || "")}</td>
      </tr>`).join("\n");
    } else {
      tableHeader = `<tr><th>Item</th><th>Current State</th><th>Standard</th><th>Gap</th></tr>`;
      tableRows = gapItems.map((g, i) => `<tr class="${i % 2 === 1 ? "alt" : ""}">
        <td class="td-bold">${esc(g.item || "")}</td>
        <td>${esc(g.current_state || "")}</td>
        <td>${esc(g.standard || "")}</td>
        <td>${esc(g.gap || "")}</td>
      </tr>`).join("\n");
    }

    const findings = dim?.findings || [];
    const criteriaBreakdown = (dim as unknown as Record<string, unknown>)?.criteria_breakdown as Array<{
      criterion: string; points_possible: number; points_earned: number; status: string; detail: string;
    }> | undefined;

    // Build criteria scorecard if available
    let criteriaSection = "";
    if (criteriaBreakdown && criteriaBreakdown.length > 0) {
      const criteriaRows = criteriaBreakdown.map((c, i) => {
        const statusColor = c.status === "pass" ? "#1e8449" : c.status === "partial" ? "#d68910" : "#c0392b";
        const statusLabel = c.status === "pass" ? "PASS" : c.status === "partial" ? "PARTIAL" : "FAIL";
        return `<tr class="${i % 2 === 1 ? "alt" : ""}">
          <td class="td-bold">${esc(c.criterion)}</td>
          <td class="td-center" style="color:${statusColor};font-weight:700">${statusLabel}</td>
          <td class="td-center">${c.points_earned}/${c.points_possible}</td>
          <td>${esc(c.detail)}</td>
        </tr>`;
      }).join("\n");

      criteriaSection = `
        <div class="sub-heading">Criterion-by-Criterion Scorecard</div>
        <table class="data-table">
          <thead><tr><th>Criterion</th><th style="width:55px;text-align:center">Status</th><th style="width:50px;text-align:center">Pts</th><th>Detail</th></tr></thead>
          <tbody>${criteriaRows}</tbody>
        </table>`;
    }

    // Build findings list
    let findingsSection = "";
    if (findings.length > 0) {
      findingsSection = `
        <div class="sub-heading">Key Findings</div>
        <div style="margin-bottom:12px;">
          ${findings.map(f => `<p class="body-text" style="margin-bottom:4px;padding-left:12px;border-left:2px solid var(--accent);">${esc(f)}</p>`).join("\n")}
        </div>`;
    }

    return `<div class="page">
      <div class="sdiv">${idx + 1}. ${esc(DIMENSION_FULL_LABELS[d] || d)}</div>
      <div class="dim-header">
        <span class="dim-grade" style="color:${gradeColor(grade)}">Grade: ${esc(grade)}</span>
        <span class="dim-score">(${score}%)</span>
      </div>
      ${criteriaSection}
      ${gapItems.length > 0 ? `
      <div class="sub-heading">Gap Analysis</div>
      <table class="data-table">
        <thead>${tableHeader}</thead>
        <tbody>${tableRows}</tbody>
      </table>` : ""}
      ${findingsSection}
    </div>`;
  }).join("\n");

  // Build rebuild recommendation page
  let rebuildPage = "";
  if (p.overall.rebuild_recommended || p.platformComparison || p.pagesToBuild.length > 0) {
    const platformSection = p.platformComparison ? `
      <div class="sub-heading">Platform Recommendation</div>
      <div class="platform-compare">
        <div class="platform-col platform-current">
          <div class="platform-label">Current</div>
          <div class="platform-value">${esc(p.platformComparison.current)}</div>
        </div>
        <div class="platform-arrow">&rarr;</div>
        <div class="platform-col platform-recommended">
          <div class="platform-label">Recommended</div>
          <div class="platform-value">${esc(p.platformComparison.recommended)}</div>
        </div>
      </div>` : "";

    const pagesSection = p.pagesToBuild.length > 0 ? `
      <div class="sub-heading">Pages to Build — Priority Order</div>
      <table class="data-table">
        <thead><tr><th style="width:40px">Pri</th><th>Page</th><th>URL</th><th>Notes</th></tr></thead>
        <tbody>${p.pagesToBuild.map((pg, i) => `<tr class="${i % 2 === 1 ? "alt" : ""}">
          <td class="td-bold">${esc(pg.priority || `P${i}`)}</td>
          <td>${esc(pg.title || "")}</td>
          <td class="td-mono">${esc(pg.slug || "")}</td>
          <td>${esc(pg.notes || pg.reason || "")}</td>
        </tr>`).join("\n")}</tbody>
      </table>` : "";

    const timelineSection = p.rebuildTimeline.length > 0 ? `
      <div class="sub-heading">Rebuild Timeline</div>
      <table class="data-table">
        <thead><tr><th>Phase</th><th>Focus</th><th>Deliverables</th></tr></thead>
        <tbody>${p.rebuildTimeline.map((t, i) => `<tr class="${i % 2 === 1 ? "alt" : ""}">
          <td class="td-bold">${esc(t.phase || "")}</td>
          <td>${esc(t.focus || "")}</td>
          <td>${esc(t.deliverables || "")}</td>
        </tr>`).join("\n")}</tbody>
      </table>` : "";

    rebuildPage = `<div class="page">
      <div class="sdiv">7. Rebuild Recommendation</div>
      ${p.overall.rebuild_reason ? `<div class="callout callout-warm"><p><strong>Recommendation:</strong> ${esc(p.overall.rebuild_reason)}</p></div>` : ""}
      ${platformSection}
      ${pagesSection}
      ${timelineSection}
    </div>`;
  }

  // Quick wins page
  let quickWinsPage = "";
  if (p.quickWins.length > 0) {
    quickWinsPage = `<div class="page">
      <div class="sdiv">8. Quick Wins &amp; Next Steps</div>
      <p class="body-text" style="margin-bottom:12px;color:#6B7280;font-style:italic;">Actions available on the current platform if a full rebuild is not immediately approved.</p>
      <table class="data-table">
        <thead><tr><th>Action</th><th style="width:80px">Time</th><th>Impact</th></tr></thead>
        <tbody>${p.quickWins.map((qw, i) => `<tr class="${i % 2 === 1 ? "alt" : ""}">
          <td>${esc(qw.action || qw.title || "")}</td>
          <td>${esc(qw.time_estimate || "—")}</td>
          <td>${esc(qw.impact || qw.description || "")}</td>
        </tr>`).join("\n")}</tbody>
      </table>
      <div class="callout callout-green"><p><strong>Bottom Line:</strong> We recommend starting with these quick wins while planning the full rebuild. Each one improves your site's visibility and conversion immediately.</p></div>
    </div>`;
  }

  // Closing callout
  const closingSection = `<div class="page page-closing">
    <div class="closing-box">
      <div class="closing-title">${esc(p.agencyFullName)}</div>
      ${p.agencyTagline ? `<div class="closing-tagline">${esc(p.agencyTagline)}</div>` : ""}
      ${p.agencyLocation ? `<div class="closing-location">${esc(p.agencyLocation)}</div>` : ""}
    </div>
  </div>`;

  // Footer lines
  const footerLeft = `Confidential  |  ${esc(p.agencyFullName)}${p.agencyLocation ? `  |  ${esc(p.agencyLocation)}` : ""}`;
  const taglineRight = p.agencyTagline ? esc(p.agencyTagline) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Site Audit — ${esc(p.orgName)}</title>
<style>
:root {
  --navy: ${bc.navy};
  --slate: #3D5A80;
  --accent: ${bc.accent};
  --gold: ${bc.gold};
  --light-bg: #F0F4F8;
  --dark-text: #1A1A2E;
  --light-text: #6B7280;
  --border-gray: #D1D5DB;
  --row-alt: #F8FAFC;
  --highlight: #E8F0FE;
  --green-bg: #F0FDF4;
  --blue-bg: #EFF6FF;
  --warm-bg: #FFFBEB;
}
${AUDIT_FSA_CSS}
</style>
</head>
<body>

<!-- Cover Page -->
<div class="cover-page">
  <!-- Top accent bar -->
  <div class="cover-accent-top"></div>
  <!-- Header row -->
  <div class="cover-header">
    <span class="cover-header-left">${esc(p.agencyFullName.toUpperCase())}</span>
    <span class="cover-header-right">${esc(p.monthYear)}  |  Website Audit</span>
  </div>
  <div class="cover-divider"></div>

  ${p.agencyLogoUrl ? `<div class="cover-logo"><img src="${p.agencyLogoUrl}" alt="${esc(p.agencyFullName)}" /></div>` : `<div class="cover-logo-spacer"></div>`}

  <!-- Cover content -->
  <div class="cover-content">
    <div class="cover-label">WEBSITE AUDIT</div>
    <div class="cover-title">${esc(p.orgName)}</div>
    <div class="cover-subtitle">${esc(p.domain)}</div>
    <div class="cover-desc">Gap Analysis &middot; Refactor Plan &middot; Rebuild Recommendation</div>

    <div class="cover-badges">${gradeBadges}</div>

    <div class="cover-prepared">
      <div class="cover-prep-block">
        <strong>Prepared For</strong><br/>
        ${esc(p.orgName)}<br/>
        ${esc(p.domain)}
      </div>
      <div class="cover-prep-block">
        <strong>Prepared By</strong><br/>
        ${esc(p.agencyName)}<br/>
        ${esc(p.monthYear)}
      </div>
    </div>
  </div>

  <!-- Bottom accent bar -->
  <div class="cover-accent-bottom"></div>
  <div class="cover-footer">
    <span>${footerLeft}</span>
    <span>${taglineRight}</span>
  </div>
</div>

<!-- Executive Summary -->
<div class="page">
  <div class="sdiv">Executive Summary</div>
  <p class="body-text">${esc(p.summary)}</p>
  ${p.overall.rebuild_recommended ? `<div class="callout callout-warm"><p><strong>Rebuild Recommended:</strong> ${esc(p.overall.rebuild_reason || "Based on the overall score, a significant rebuild or refactor is recommended.")}</p></div>` : ""}
  <div class="sub-heading">Overall Scores</div>
  <table class="data-table">
    <thead><tr><th>Category</th><th style="width:50px;text-align:center">Grade</th><th style="width:50px;text-align:center">Score</th><th>Key Finding</th></tr></thead>
    <tbody>${scoreTableRows}</tbody>
  </table>
  <div class="overall-badge-row">
    <div class="overall-badge" style="background:${gradeBgColor(p.overall.grade)}">
      <span class="overall-label">Overall Grade:</span>
      <span class="overall-grade" style="color:${gradeColor(p.overall.grade)}">${esc(p.overall.grade)}</span>
      <span class="overall-score">(${p.overall.score}%)</span>
    </div>
  </div>
</div>

<!-- Dimension Pages -->
${dimensionPages}

<!-- Rebuild Recommendation -->
${rebuildPage}

<!-- Quick Wins -->
${quickWinsPage}

<!-- Closing -->
${closingSection}

<!-- Floating Save-as-PDF button (hidden in print) -->
<div class="print-fab">
  <button onclick="window.print()">&#8595; Save as PDF</button>
</div>

<script>
  // Auto-open the print dialog after content renders.
  // User selects "Save as PDF" in their print dialog.
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 600);
  });
</script>

</body>
</html>`;
}

// ─── CSS (FSA Design System — matches COMPONENTS.md) ─────────────────

const AUDIT_FSA_CSS = `
@page {
  size: letter;
  margin: 0;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: Helvetica, Arial, sans-serif;
  font-size: 10pt;
  line-height: 14.5pt;
  color: var(--dark-text);
  background: #fff;
}

/* ── Cover Page ── */
.cover-page {
  background: var(--navy);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 0;
  page-break-after: always;
}

.cover-accent-top {
  height: 8px;
  background: var(--accent);
  width: 100%;
  flex-shrink: 0;
}

.cover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 55px 12px;
  flex-shrink: 0;
}

.cover-header-left {
  color: #B0C4DE;
  font-size: 10pt;
  font-weight: 400;
  letter-spacing: 0.5px;
}

.cover-header-right {
  color: #8899AA;
  font-size: 9pt;
}

.cover-divider {
  height: 0.5px;
  background: var(--slate);
  margin: 0 55px;
  flex-shrink: 0;
}

.cover-logo {
  padding: 24px 55px 0;
  flex-shrink: 0;
}

.cover-logo img {
  height: 120px;
  width: auto;
  object-fit: contain;
}

.cover-logo-spacer {
  height: 60px;
  flex-shrink: 0;
}

.cover-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 20px 55px 40px;
}

.cover-label {
  color: var(--accent);
  font-size: 14pt;
  font-weight: 400;
  letter-spacing: 1px;
  margin-bottom: 10px;
}

.cover-title {
  color: #ffffff;
  font-size: 32pt;
  font-weight: 700;
  line-height: 1.15;
  margin-bottom: 8px;
}

.cover-subtitle {
  color: var(--accent);
  font-size: 20pt;
  font-weight: 400;
  line-height: 1.3;
  margin-bottom: 6px;
}

.cover-desc {
  color: #90A4BE;
  font-size: 11pt;
  margin-bottom: 30px;
}

.cover-badges {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 30px;
}

.cover-badge {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  padding: 8px 14px;
  text-align: center;
  min-width: 72px;
}

.cover-badge-grade {
  font-size: 20pt;
  font-weight: 700;
  line-height: 1.2;
}

.cover-badge-label {
  font-size: 7.5pt;
  color: #90A4BE;
  margin-top: 2px;
}

.cover-badge-score {
  font-size: 7pt;
  color: #6B7F99;
  margin-top: 1px;
}

.cover-prepared {
  display: flex;
  gap: 60px;
  color: #90A4BE;
  font-size: 11pt;
  line-height: 17pt;
}

.cover-prep-block strong {
  color: #B0C4DE;
}

.cover-accent-bottom {
  height: 4px;
  background: var(--accent);
  width: 100%;
  flex-shrink: 0;
}

.cover-footer {
  display: flex;
  justify-content: space-between;
  padding: 10px 55px 16px;
  color: #6B7F99;
  font-size: 8pt;
  flex-shrink: 0;
}

/* ── Body Pages ── */
.page {
  background: #ffffff;
  padding: 60px 55px 55px;
  min-height: 100vh;
  position: relative;
  page-break-after: always;
}

/* Top navy line */
.page::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--navy);
}

/* Bottom accent line */
.page::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
}

.page-closing {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Section Divider (sdiv) — Navy bar ── */
.sdiv {
  background: var(--navy);
  color: #ffffff;
  font-size: 12pt;
  font-weight: 700;
  padding: 8px 12px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 16px;
}

/* ── Typography ── */
.body-text {
  font-size: 10pt;
  line-height: 14.5pt;
  color: var(--dark-text);
  margin-bottom: 12px;
  text-align: justify;
}

.sub-heading {
  font-size: 11pt;
  font-weight: 700;
  color: var(--slate);
  margin: 18px 0 8px;
}

.dim-header {
  margin: 8px 0 12px;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.dim-grade {
  font-size: 12pt;
  font-weight: 700;
}

.dim-score {
  font-size: 10pt;
  color: var(--light-text);
}

/* ── Data Tables (FSA style) ── */
.data-table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0 16px;
  font-size: 9pt;
  border: 0.5px solid var(--border-gray);
}

.data-table thead tr {
  background: var(--navy);
}

.data-table th {
  color: #ffffff;
  font-size: 9pt;
  font-weight: 700;
  padding: 6px 8px;
  text-align: left;
  line-height: 12pt;
}

.data-table td {
  padding: 6px 8px;
  border-bottom: 0.3px solid var(--border-gray);
  vertical-align: top;
  line-height: 12.5pt;
  color: var(--dark-text);
}

.data-table tr.alt {
  background: var(--row-alt);
}

.td-bold { font-weight: 600; }
.td-center { text-align: center; }
.td-mono { font-family: monospace; font-size: 8pt; }

/* ── Callout Boxes (FSA style) ── */
.callout {
  border: 0.5px solid var(--border-gray);
  padding: 10px 14px;
  margin: 14px 0;
  border-radius: 0;
}

.callout p {
  font-size: 10pt;
  line-height: 14pt;
  color: var(--dark-text);
  margin: 0;
}

.callout-blue { background: var(--highlight); }
.callout-green { background: var(--green-bg); }
.callout-warm { background: var(--warm-bg); }

/* ── Overall Badge ── */
.overall-badge-row {
  margin-top: 16px;
}

.overall-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: 0.5px solid var(--border-gray);
}

.overall-label {
  font-size: 11pt;
  font-weight: 600;
  color: var(--dark-text);
}

.overall-grade {
  font-size: 24pt;
  font-weight: 700;
}

.overall-score {
  font-size: 12pt;
  color: var(--light-text);
}

/* ── Platform Compare ── */
.platform-compare {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 10px 0 20px;
}

.platform-col {
  flex: 1;
  padding: 14px 16px;
  border: 0.5px solid var(--border-gray);
  text-align: center;
}

.platform-current { background: #FEF2F2; }
.platform-recommended { background: var(--green-bg); }

.platform-label {
  font-size: 8pt;
  font-weight: 700;
  color: var(--light-text);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.platform-value {
  font-size: 13pt;
  font-weight: 700;
  color: var(--dark-text);
}

.platform-arrow {
  font-size: 18pt;
  color: var(--light-text);
  flex-shrink: 0;
}

/* ── Closing Box ── */
.closing-box {
  text-align: center;
  padding: 40px;
  background: var(--blue-bg);
  border: 0.5px solid var(--border-gray);
  max-width: 400px;
}

.closing-title {
  font-size: 14pt;
  font-weight: 700;
  color: var(--navy);
  margin-bottom: 6px;
}

.closing-tagline {
  font-size: 10pt;
  color: var(--slate);
  font-style: italic;
  margin-bottom: 4px;
}

.closing-location {
  font-size: 9pt;
  color: var(--light-text);
}

/* ── Print ── */
@media print {
  /* Force ALL backgrounds and colors to print exactly as shown on screen */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  body { background: #fff; }
  .page { min-height: auto; page-break-inside: avoid; }
  .cover-page { min-height: 100vh; }
  .print-fab { display: none !important; }
}

@media screen {
  body { background: #444; }
  .cover-page, .page {
    max-width: 8.5in;
    margin: 20px auto;
    box-shadow: 0 2px 20px rgba(0,0,0,0.4);
  }
}

/* ── Floating Save-as-PDF button (screen only) ── */
.print-fab {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 9999;
}
.print-fab button {
  background: var(--navy);
  color: #fff;
  border: none;
  padding: 13px 24px;
  font-size: 11pt;
  font-weight: 700;
  cursor: pointer;
  border-radius: 4px;
  box-shadow: 0 3px 12px rgba(0,0,0,0.35);
  letter-spacing: 0.3px;
}
.print-fab button:hover {
  background: var(--slate);
}
`;
