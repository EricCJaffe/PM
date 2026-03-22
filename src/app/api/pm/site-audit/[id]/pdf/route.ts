import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getBranding, buildPreparedBy } from "@/lib/branding";
import type { AuditDimensionScore, AuditGrade } from "@/types/pm";

// POST /api/pm/site-audit/[id]/pdf — Generate printable HTML report
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: audit, error } = await supabase
      .from("pm_site_audits")
      .select("*, pm_organizations(name, slug)")
      .eq("id", id)
      .single();

    if (error || !audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    if (audit.status !== "complete" || !audit.scores) {
      return NextResponse.json({ error: "Audit is not complete" }, { status: 400 });
    }

    const orgName = audit.pm_organizations?.name || "Organization";
    const orgSlug = audit.pm_organizations?.slug || "org";
    const domain = audit.url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const now = new Date();
    const monthYear = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const dateStr = now.toISOString().split("T")[0];

    // Resolve branding for this org
    const branding = await getBranding(audit.org_id);
    const agencyName = buildPreparedBy(branding);

    const html = buildAuditHTML({
      orgName,
      domain,
      url: audit.url,
      monthYear,
      vertical: audit.vertical,
      scores: audit.scores,
      overall: audit.overall || computeOverall(audit.scores),
      gaps: audit.gaps || {},
      quickWins: audit.quick_wins || [],
      pagesToBuild: audit.pages_to_build || [],
      recommendations: audit.recommendations || [],
      rebuildTimeline: audit.rebuild_timeline || [],
      platformComparison: audit.platform_comparison || null,
      summary: audit.audit_summary || "",
      agencyName,
      brandColors: {
        bgDark: branding.bg_dark,
        bgLight: branding.bg_light,
        accent: branding.accent_color,
        primary: branding.primary_color,
        textOnPrimary: branding.text_on_primary,
      },
    });

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${orgSlug}-site-audit-${dateStr}.html"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function computeOverall(scores: Record<string, unknown>) {
  const weights: Record<string, number> = {
    seo: 0.20, entity: 0.15, ai_discoverability: 0.20,
    conversion: 0.20, content: 0.15, a2a_readiness: 0.10,
  };
  let total = 0;
  for (const [k, w] of Object.entries(weights)) {
    const dim = scores[k] as AuditDimensionScore | undefined;
    total += (dim?.score ?? 0) * w;
  }
  const score = Math.round(total);
  const grade: AuditGrade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C"
    : score >= 60 ? "D" : score >= 50 ? "D-" : "F";
  return { grade, score, rebuild_recommended: score < 60, rebuild_reason: null };
}

function gradeColor(grade: string): string {
  if (grade === "A" || grade === "B") return "#1e8449";
  if (grade === "C") return "#d68910";
  return "#c0392b";
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

// ─── HTML Builder ───────────────────────────────────────────────────

interface AuditHTMLParams {
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
  brandColors?: {
    bgDark: string;
    bgLight: string;
    accent: string;
    primary: string;
    textOnPrimary: string;
  };
}

function buildAuditHTML(p: AuditHTMLParams): string {
  const dims = ["seo", "entity", "ai_discoverability", "conversion", "content", "a2a_readiness"];
  const bc = p.brandColors ?? { bgDark: "#1c2b1e", bgLight: "#f5f0e8", accent: "#c4793a", primary: "#1B2A4A", textOnPrimary: "#ffffff" };

  // Build cover grade badges
  const gradeBadges = dims.map((d, i) => {
    const dim = p.scores[d] as AuditDimensionScore;
    const grade = dim?.grade || "F";
    return `<div class="grade-badge">
      <div class="grade-letter" style="color:${gradeColor(grade)}">${esc(grade)}</div>
      <div class="grade-label">${esc(DIMENSION_LABELS[d] || d)}</div>
    </div>`;
  }).join("\n");

  // Build executive summary score table
  const scoreTableRows = dims.map(d => {
    const dim = p.scores[d] as AuditDimensionScore;
    const grade = dim?.grade || "F";
    const findings = dim?.findings || [];
    const keyFinding = findings[0] || "—";
    return `<tr>
      <td style="font-weight:600">${esc(DIMENSION_FULL_LABELS[d] || d)}</td>
      <td style="text-align:center;font-weight:700;color:${gradeColor(grade)}">${esc(grade)}</td>
      <td>${esc(keyFinding)}</td>
    </tr>`;
  }).join("\n");

  // Build dimension pages
  const dimensionPages = dims.map((d, idx) => {
    const dim = p.scores[d] as AuditDimensionScore;
    const grade = dim?.grade || "F";
    const gapItems = p.gaps[d] || [];

    // Determine column structure based on dimension
    let tableHeader: string;
    let tableRows: string;

    if (d === "content") {
      tableHeader = `<tr><th>Page</th><th>Status</th><th>What's Missing</th></tr>`;
      tableRows = gapItems.map((g, i) => `<tr class="${i % 2 === 1 ? "alt" : ""}">
        <td>${esc(g.item || "")}</td>
        <td style="font-weight:600;color:${(g.current_state || "").toLowerCase().includes("missing") ? "#c0392b" : "#1a1a1a"}">${esc(g.current_state || "")}</td>
        <td>${esc(g.gap || g.standard || "")}</td>
      </tr>`).join("\n");
    } else if (d === "a2a_readiness") {
      tableHeader = `<tr><th>Item</th><th>Current State</th><th>Standard / Recommended</th></tr>`;
      tableRows = gapItems.map((g, i) => `<tr class="${i % 2 === 1 ? "alt" : ""}">
        <td>${esc(g.item || "")}</td>
        <td>${esc(g.current_state || "")}</td>
        <td>${esc(g.standard || "")}</td>
      </tr>`).join("\n");
    } else {
      tableHeader = `<tr><th>Item</th><th>Current State</th><th>Standard</th><th>Gap</th></tr>`;
      tableRows = gapItems.map((g, i) => `<tr class="${i % 2 === 1 ? "alt" : ""}">
        <td>${esc(g.item || "")}</td>
        <td>${esc(g.current_state || "")}</td>
        <td>${esc(g.standard || "")}</td>
        <td>${esc(g.gap || "")}</td>
      </tr>`).join("\n");
    }

    const findings = dim?.findings || [];
    const callout = findings.length > 0
      ? `<div class="callout"><p>${esc(findings[0])}</p></div>`
      : "";

    return `<div class="page">
      <div class="section-header">${idx + 1} &middot; ${esc(DIMENSION_FULL_LABELS[d] || d)}</div>
      <h3 class="dimension-grade">Overall Grade: ${esc(grade)}</h3>
      <table class="gap-table">
        <thead>${tableHeader}</thead>
        <tbody>${tableRows}</tbody>
      </table>
      ${callout}
    </div>`;
  }).join("\n");

  // Build rebuild recommendation page
  let rebuildPage = "";
  if (p.overall.rebuild_recommended || p.platformComparison || p.pagesToBuild.length > 0) {
    const platformSection = p.platformComparison ? `
      <h2>Platform</h2>
      <table class="comparison-table">
        <thead><tr><th class="current-col">Current</th><th class="recommended-col">Recommended</th></tr></thead>
        <tbody><tr>
          <td class="current-col">${esc(p.platformComparison.current)}</td>
          <td class="recommended-col">${esc(p.platformComparison.recommended)}</td>
        </tr></tbody>
      </table>` : "";

    const pagesSection = p.pagesToBuild.length > 0 ? `
      <h2>Pages to Build — Priority Order</h2>
      <table class="gap-table">
        <thead><tr><th style="width:40px">Pri</th><th>Page</th><th>URL</th><th>Notes</th></tr></thead>
        <tbody>${p.pagesToBuild.map((pg, i) => `<tr class="${i % 2 === 1 ? "alt" : ""}">
          <td style="font-weight:700">${esc(pg.priority || `P${i}`)}</td>
          <td>${esc(pg.title || "")}</td>
          <td style="font-family:monospace;font-size:8pt">${esc(pg.slug || "")}</td>
          <td>${esc(pg.notes || pg.reason || "")}</td>
        </tr>`).join("\n")}</tbody>
      </table>` : "";

    const timelineSection = p.rebuildTimeline.length > 0 ? `
      <h2>Rebuild Timeline</h2>
      <table class="gap-table">
        <thead><tr><th>Phase</th><th>Focus</th><th>Deliverables</th></tr></thead>
        <tbody>${p.rebuildTimeline.map((t, i) => `<tr class="${i % 2 === 1 ? "alt" : ""}">
          <td style="font-weight:600">${esc(t.phase || "")}</td>
          <td>${esc(t.focus || "")}</td>
          <td>${esc(t.deliverables || "")}</td>
        </tr>`).join("\n")}</tbody>
      </table>` : "";

    rebuildPage = `<div class="page">
      <div class="section-header">7 &middot; Rebuild Recommendation</div>
      ${platformSection}
      ${pagesSection}
      ${timelineSection}
    </div>`;
  }

  // Quick wins page
  let quickWinsPage = "";
  if (p.quickWins.length > 0) {
    quickWinsPage = `<div class="page">
      <div class="section-header">8 &middot; Quick Wins & Next Steps</div>
      <h2>Quick wins on the current platform</h2>
      <p class="subtitle">(if full rebuild not immediately approved)</p>
      <table class="gap-table">
        <thead><tr><th>Action</th><th style="width:80px">Time</th><th>Impact</th></tr></thead>
        <tbody>${p.quickWins.map((qw, i) => `<tr class="${i % 2 === 1 ? "alt" : ""}">
          <td>${esc(qw.action || qw.title || "")}</td>
          <td>${esc(qw.time_estimate || "—")}</td>
          <td>${esc(qw.impact || qw.description || "")}</td>
        </tr>`).join("\n")}</tbody>
      </table>
      <div class="callout"><p>We recommend starting with these quick wins while planning the full rebuild. Each one improves your site's visibility and conversion immediately.</p></div>
    </div>`;
  }

  // Build brand-specific CSS overrides
  const brandCss = `
:root {
  --audit-bg-dark: ${bc.bgDark};
  --audit-bg-light: ${bc.bgLight};
  --audit-accent: ${bc.accent};
  --audit-primary: ${bc.primary};
  --audit-text-on-primary: ${bc.textOnPrimary};
}
`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Site Audit — ${esc(p.orgName)}</title>
<style>
${brandCss}
${AUDIT_PDF_CSS}
</style>
</head>
<body>

<!-- Cover Page -->
<div class="cover-page">
  <div class="cover-eyebrow">WEBSITE AUDIT REPORT</div>
  <div class="cover-org">${esc(p.orgName)}</div>
  <div class="cover-domain">${esc(p.domain)}</div>
  <div class="cover-subtitle">Gap Analysis &middot; Refactor Plan &middot; Rebuild Recommendation</div>
  <div class="cover-badges">${gradeBadges}</div>
  <div class="cover-footer">${esc(p.monthYear)} &middot; Prepared by ${esc(p.agencyName)}</div>
</div>

<!-- Executive Summary -->
<div class="page">
  <h1>Executive Summary</h1>
  <hr class="divider">
  <p>${esc(p.summary)}</p>
  ${p.overall.rebuild_recommended ? `<div class="callout"><p>${esc(p.overall.rebuild_reason || "Based on the overall score, a significant rebuild or refactor is recommended.")}</p></div>` : ""}
  <h2>Overall Scores</h2>
  <table class="score-table">
    <thead><tr><th>Category</th><th style="width:60px;text-align:center">Grade</th><th>Key Finding</th></tr></thead>
    <tbody>${scoreTableRows}</tbody>
  </table>
  <div class="overall-badge">
    <span>Overall Grade:</span>
    <span class="overall-grade" style="color:${gradeColor(p.overall.grade)}">${esc(p.overall.grade)}</span>
    <span class="overall-score">(${p.overall.score}%)</span>
  </div>
</div>

<!-- Dimension Pages -->
${dimensionPages}

<!-- Rebuild Recommendation -->
${rebuildPage}

<!-- Quick Wins -->
${quickWinsPage}

</body>
</html>`;
}

// ─── CSS (AUDIT_PDF_SPEC design system) ─────────────────────────────

const AUDIT_PDF_CSS = `
@page {
  size: letter;
  margin: 0.5in;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: Helvetica, Arial, sans-serif;
  font-size: 10pt;
  line-height: 16pt;
  color: #1a1a1a;
  background: #fff;
}

/* ── Cover Page ── */
.cover-page {
  background: var(--audit-bg-dark, #1c2b1e);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2in 1in;
  page-break-after: always;
}

.cover-eyebrow {
  color: var(--audit-accent, #c4793a);
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 3px;
  margin-bottom: 24px;
}

.cover-org {
  color: var(--audit-text-on-primary, #f0ebe0);
  font-size: 38pt;
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: 12px;
}

.cover-domain {
  color: #9aaa90;
  font-size: 26pt;
  margin-bottom: 16px;
}

.cover-subtitle {
  color: #9aaa90;
  font-size: 11pt;
  margin-bottom: 48px;
}

.cover-badges {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 48px;
}

.grade-badge {
  width: 64px;
  height: 52px;
  background: color-mix(in srgb, var(--audit-bg-dark, #1c2b1e) 90%, white);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.grade-letter {
  font-size: 18pt;
  font-weight: 700;
}

.grade-label {
  font-size: 7pt;
  color: #9aaa90;
  margin-top: 2px;
}

.cover-footer {
  color: #7a8874;
  font-size: 9pt;
}

/* ── Content Pages ── */
.page {
  background: var(--audit-bg-light, #f5f0e8);
  padding: 44px 0.5in 30px;
  min-height: 100vh;
  page-break-after: always;
  position: relative;
}

.page::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 44px;
  background: var(--audit-bg-dark, #1c2b1e);
}

.page::after {
  content: '';
  position: absolute;
  top: 44px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--audit-accent, #c4793a);
}

h1 {
  font-size: 20pt;
  font-weight: 700;
  color: var(--audit-bg-dark, #1c2b1e);
  margin: 20px 0 8px;
}

h2 {
  font-size: 14pt;
  font-weight: 700;
  color: var(--audit-bg-dark, #1c2b1e);
  margin: 20px 0 10px;
}

h3.dimension-grade {
  font-size: 11pt;
  font-weight: 700;
  color: var(--audit-accent, #c4793a);
  margin: 12px 0;
}

.subtitle {
  font-size: 10pt;
  font-style: italic;
  color: #4a5e4c;
  margin-bottom: 12px;
}

hr.divider {
  border: none;
  border-top: 0.5px solid #ddd8cc;
  margin: 8px 0 16px;
}

/* ── Section Header Bar ── */
.section-header {
  background: var(--audit-bg-dark, #1c2b1e);
  color: #fff;
  font-size: 13pt;
  font-weight: 700;
  padding: 10px 16px;
  border-radius: 6px;
  margin: 16px 0 12px;
}

/* ── Tables ── */
.score-table, .gap-table, .comparison-table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 9pt;
}

.score-table thead tr, .gap-table thead tr {
  background: color-mix(in srgb, var(--audit-bg-dark, #1c2b1e) 80%, white);
}

.score-table th, .gap-table th {
  color: #fff;
  font-size: 8pt;
  font-weight: 700;
  padding: 6px 8px;
  text-align: left;
}

.score-table td, .gap-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #ddd8cc;
  vertical-align: top;
}

.score-table tr:nth-child(even), .gap-table tr.alt {
  background: #f5f3ee;
}

/* ── Comparison Table ── */
.comparison-table {
  border: 1px solid #ddd8cc;
}

.comparison-table th, .comparison-table td {
  padding: 10px 14px;
  width: 50%;
  vertical-align: top;
}

.comparison-table .current-col {
  background: #fef5f5;
}

.comparison-table .recommended-col {
  background: #f0f8f0;
}

.comparison-table th {
  font-weight: 700;
  font-size: 9pt;
  border-bottom: 2px solid #ddd8cc;
}

/* ── Callout Box ── */
.callout {
  border-left: 3px solid var(--audit-accent, #c4793a);
  background: color-mix(in srgb, var(--audit-accent, #c4793a) 15%, white);
  padding: 10px 14px;
  margin: 16px 0;
  border-radius: 0 4px 4px 0;
}

.callout p {
  font-style: italic;
  font-size: 10pt;
  color: var(--audit-bg-dark, #1c2b1e);
  margin: 0;
}

/* ── Overall Badge ── */
.overall-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 12pt;
}

.overall-grade {
  font-size: 24pt;
  font-weight: 700;
}

.overall-score {
  font-size: 12pt;
  color: #4a5e4c;
}

/* ── Print ── */
@media print {
  body { background: #fff; }
  .page { min-height: auto; page-break-inside: avoid; }
}

@media screen {
  body { background: #333; }
  .cover-page, .page {
    max-width: 8.5in;
    margin: 20px auto;
    box-shadow: 0 2px 20px rgba(0,0,0,0.3);
  }
}
`;
