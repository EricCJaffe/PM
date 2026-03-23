import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { getBranding, buildPreparedBy } from "@/lib/branding";
import type { AuditDimensionScore } from "@/types/pm";

const DIMS = ["seo", "entity", "ai_discoverability", "conversion", "content", "a2a_readiness"] as const;
const DIMENSION_LABELS: Record<string, string> = {
  seo: "SEO",
  entity: "Entity Authority",
  ai_discoverability: "AI Discoverability",
  conversion: "Conversion Architecture",
  content: "Content Inventory",
  a2a_readiness: "A2A Readiness",
};

// POST /api/pm/site-audit/compare/export — Generate printable HTML comparison report
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audit_id_before, audit_id_after } = body;

    if (!audit_id_before || !audit_id_after) {
      return NextResponse.json({ error: "audit_id_before and audit_id_after required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const [beforeRes, afterRes] = await Promise.all([
      supabase.from("pm_site_audits").select("*, pm_organizations(name, slug)").eq("id", audit_id_before).single(),
      supabase.from("pm_site_audits").select("*, pm_organizations(name, slug)").eq("id", audit_id_after).single(),
    ]);

    if (beforeRes.error || !beforeRes.data || afterRes.error || !afterRes.data) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    const before = beforeRes.data;
    const after = afterRes.data;
    const orgName = after.pm_organizations?.name || "Organization";
    const orgSlug = after.pm_organizations?.slug || "org";
    const domain = after.url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const beforeDate = new Date(before.created_at).toISOString().split("T")[0];
    const afterDate = new Date(after.created_at).toISOString().split("T")[0];

    const branding = await getBranding(after.org_id);
    const agencyName = buildPreparedBy(branding);
    const bc = {
      navy: branding.primary_color,
      accent: branding.secondary_color,
      gold: branding.accent_color,
    };

    // Build dimension comparison data
    const dimData = DIMS.map((d) => {
      const bDim = (before.scores || {})[d] as AuditDimensionScore | undefined;
      const aDim = (after.scores || {})[d] as AuditDimensionScore | undefined;
      const bScore = bDim?.score ?? 0;
      const aScore = aDim?.score ?? 0;
      const delta = aScore - bScore;
      return {
        key: d,
        label: DIMENSION_LABELS[d],
        before: { grade: bDim?.grade || "F", score: bScore },
        after: { grade: aDim?.grade || "F", score: aScore },
        delta,
        trend: delta > 0 ? "improved" : delta < 0 ? "declined" : "unchanged",
      };
    });

    const overallBefore = before.overall || { grade: "F", score: 0 };
    const overallAfter = after.overall || { grade: "F", score: 0 };
    const overallDelta = (overallAfter.score || 0) - (overallBefore.score || 0);

    // AI analysis
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert website analyst. Compare two site audits and provide a professional, client-facing analysis. Be specific and actionable. Return JSON.`,
        },
        {
          role: "user",
          content: `Compare these two site audits for ${after.url}:

BEFORE (${beforeDate}): Overall ${overallBefore.grade} (${overallBefore.score}%)
Scores: ${JSON.stringify(before.scores)}
Gaps: ${JSON.stringify(before.gaps)}

AFTER (${afterDate}): Overall ${overallAfter.grade} (${overallAfter.score}%)
Scores: ${JSON.stringify(after.scores)}
Gaps: ${JSON.stringify(after.gaps)}

Return JSON:
{
  "executive_summary": "2-3 sentence overview",
  "improvements": [{ "dimension": "...", "detail": "..." }],
  "declines": [{ "dimension": "...", "detail": "..." }],
  "still_needs_work": [{ "dimension": "...", "detail": "..." }],
  "next_steps": ["step1", "step2"],
  "overall_assessment": "1-2 sentence verdict"
}
Return ONLY valid JSON, no markdown fences.`,
        },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    let aiAnalysis: Record<string, unknown> = {};
    const aiContent = completion.choices[0]?.message?.content;
    if (aiContent) {
      try { aiAnalysis = JSON.parse(aiContent); } catch { /* ignore */ }
    }

    const html = buildComparisonHTML({
      orgName,
      domain,
      agencyName,
      agencyFullName: branding.agency_name,
      agencyTagline: branding.agency_tagline,
      agencyLocation: branding.location,
      agencyLogoUrl: branding.agency_logo_url,
      bc,
      beforeDate,
      afterDate,
      overallBefore,
      overallAfter,
      overallDelta,
      dimData,
      aiAnalysis,
    });

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${orgSlug}-audit-comparison-${afterDate}.html"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// ─── HTML Builder ────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function gradeColor(grade: string): string {
  if (grade === "A" || grade === "B") return "#1e8449";
  if (grade === "C") return "#d68910";
  return "#c0392b";
}

function trendArrow(trend: string): string {
  if (trend === "improved") return "&#x2191;";
  if (trend === "declined") return "&#x2193;";
  return "&#x2192;";
}

function trendCssColor(trend: string): string {
  if (trend === "improved") return "#1e8449";
  if (trend === "declined") return "#c0392b";
  return "#6B7280";
}

function deltaLabel(d: number): string {
  return d > 0 ? `+${d}` : `${d}`;
}

interface ComparisonHTMLParams {
  orgName: string;
  domain: string;
  agencyName: string;
  agencyFullName: string;
  agencyTagline: string | null;
  agencyLocation: string | null;
  agencyLogoUrl: string | null;
  bc: { navy: string; accent: string; gold: string };
  beforeDate: string;
  afterDate: string;
  overallBefore: { grade: string; score: number };
  overallAfter: { grade: string; score: number };
  overallDelta: number;
  dimData: Array<{
    key: string;
    label: string;
    before: { grade: string; score: number };
    after: { grade: string; score: number };
    delta: number;
    trend: string;
  }>;
  aiAnalysis: Record<string, unknown>;
}

function buildComparisonHTML(p: ComparisonHTMLParams): string {
  const overallTrend = p.overallDelta > 0 ? "improved" : p.overallDelta < 0 ? "declined" : "unchanged";

  // Score table rows
  const scoreRows = p.dimData.map((d, i) => `
    <tr class="${i % 2 === 1 ? "alt" : ""}">
      <td class="td-bold">${esc(d.label)}</td>
      <td class="td-center" style="color:${gradeColor(d.before.grade)}">${esc(d.before.grade)}</td>
      <td class="td-center">${d.before.score}%</td>
      <td class="td-center" style="color:${gradeColor(d.after.grade)}">${esc(d.after.grade)}</td>
      <td class="td-center">${d.after.score}%</td>
      <td class="td-center" style="color:${trendCssColor(d.trend)};font-weight:700">${deltaLabel(d.delta)} ${trendArrow(d.trend)}</td>
    </tr>`).join("\n");

  // Bar chart rows (SVG-like using divs)
  const barChartRows = p.dimData.map((d) => `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
      <div style="width:140px;font-size:9pt;color:#1A1A2E;font-weight:600;">${esc(d.label)}</div>
      <div style="flex:1;position:relative;height:22px;background:#F0F4F8;border-radius:3px;overflow:hidden;">
        <div style="position:absolute;top:0;bottom:0;left:0;width:${d.before.score}%;background:${p.bc.navy}30;border-right:2px dashed ${p.bc.navy}80;"></div>
        <div style="position:absolute;top:0;bottom:0;left:0;width:${d.after.score}%;background:${d.trend === "improved" ? "#1e844940" : d.trend === "declined" ? "#c0392b30" : `${p.bc.accent}40`};"></div>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 6px;font-size:7.5pt;font-family:monospace;">
          <span style="color:${p.bc.navy}">${d.before.score}%</span>
          <span style="color:${trendCssColor(d.trend)}">${d.after.score}% (${deltaLabel(d.delta)})</span>
        </div>
      </div>
      <div style="width:18px;text-align:center;font-weight:700;color:${trendCssColor(d.trend)}">${trendArrow(d.trend)}</div>
    </div>`).join("\n");

  // AI analysis sections
  const ai = p.aiAnalysis as Record<string, unknown>;
  const execSummary = (ai.executive_summary as string) || "";
  const improvements = (ai.improvements as Array<{ dimension: string; detail: string }>) || [];
  const declines = (ai.declines as Array<{ dimension: string; detail: string }>) || [];
  const stillNeedsWork = (ai.still_needs_work as Array<{ dimension: string; detail: string }>) || [];
  const nextSteps = (ai.next_steps as string[]) || [];
  const overallAssessment = (ai.overall_assessment as string) || "";

  const improvementRows = improvements.map((item) => `
    <tr><td class="td-bold" style="color:#1e8449">${esc(item.dimension)}</td><td>${esc(item.detail)}</td></tr>`).join("\n");
  const declineRows = declines.map((item) => `
    <tr><td class="td-bold" style="color:#c0392b">${esc(item.dimension)}</td><td>${esc(item.detail)}</td></tr>`).join("\n");
  const needsWorkRows = stillNeedsWork.map((item) => `
    <tr><td class="td-bold" style="color:#d68910">${esc(item.dimension)}</td><td>${esc(item.detail)}</td></tr>`).join("\n");

  const footerLeft = `Confidential  |  ${esc(p.agencyFullName)}${p.agencyLocation ? `  |  ${esc(p.agencyLocation)}` : ""}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Audit Comparison — ${esc(p.orgName)}</title>
<style>
:root { --navy: ${p.bc.navy}; --accent: ${p.bc.accent}; --gold: ${p.bc.gold}; }
@page { size: letter; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 14.5pt; color: #1A1A2E; background: #fff; }

.cover-page { background: var(--navy); min-height: 100vh; display: flex; flex-direction: column; page-break-after: always; }
.cover-accent { height: 8px; background: var(--accent); width: 100%; }
.cover-header { display: flex; justify-content: space-between; padding: 16px 55px 12px; color: #B0C4DE; font-size: 10pt; }
.cover-divider { height: 0.5px; background: #3D5A80; margin: 0 55px; }
.cover-content { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 20px 55px 40px; }
.cover-label { color: var(--accent); font-size: 14pt; letter-spacing: 1px; margin-bottom: 10px; }
.cover-title { color: #fff; font-size: 30pt; font-weight: 700; line-height: 1.15; margin-bottom: 8px; }
.cover-subtitle { color: var(--accent); font-size: 18pt; margin-bottom: 6px; }
.cover-desc { color: #90A4BE; font-size: 11pt; margin-bottom: 24px; }
.cover-big-delta { text-align: center; margin: 20px 0 30px; }
.cover-big-delta .grade { font-size: 42pt; font-weight: 700; }
.cover-big-delta .arrow { font-size: 28pt; color: #90A4BE; margin: 0 16px; }
.cover-big-delta .delta-label { font-size: 16pt; font-weight: 700; margin-top: 8px; }
.cover-prepared { display: flex; gap: 60px; color: #90A4BE; font-size: 11pt; line-height: 17pt; }
.cover-prepared strong { color: #B0C4DE; }
.cover-footer { display: flex; justify-content: space-between; padding: 10px 55px 16px; color: #6B7F99; font-size: 8pt; }

.page { background: #fff; padding: 55px 55px 50px; min-height: 100vh; position: relative; page-break-after: always; }
.page::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--navy); }
.page::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: var(--accent); }

.sdiv { background: var(--navy); color: #fff; font-size: 12pt; font-weight: 700; padding: 8px 12px; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 16px; }
.sub-heading { font-size: 11pt; font-weight: 700; color: #3D5A80; margin: 18px 0 8px; }
.body-text { font-size: 10pt; line-height: 14.5pt; margin-bottom: 12px; text-align: justify; }

.data-table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 9pt; border: 0.5px solid #D1D5DB; }
.data-table thead tr { background: var(--navy); }
.data-table th { color: #fff; font-size: 9pt; font-weight: 700; padding: 6px 8px; text-align: left; }
.data-table td { padding: 6px 8px; border-bottom: 0.3px solid #D1D5DB; vertical-align: top; }
.data-table tr.alt { background: #F8FAFC; }
.td-bold { font-weight: 600; }
.td-center { text-align: center; }

.callout { border: 0.5px solid #D1D5DB; padding: 10px 14px; margin: 14px 0; }
.callout p { font-size: 10pt; line-height: 14pt; margin: 0; }
.callout-green { background: #F0FDF4; }
.callout-warm { background: #FFFBEB; }

@media print { body { background: #fff; } .page { min-height: auto; page-break-inside: avoid; } .cover-page { min-height: 100vh; } }
@media screen { body { background: #444; } .cover-page, .page { max-width: 8.5in; margin: 20px auto; box-shadow: 0 2px 20px rgba(0,0,0,0.4); } }
</style>
</head>
<body>

<!-- Cover Page -->
<div class="cover-page">
  <div class="cover-accent"></div>
  <div class="cover-header">
    <span>${esc(p.agencyFullName.toUpperCase())}</span>
    <span>Audit Comparison Report</span>
  </div>
  <div class="cover-divider"></div>
  ${p.agencyLogoUrl ? `<div style="padding:24px 55px 0"><img src="${p.agencyLogoUrl}" style="height:100px;width:auto;object-fit:contain" /></div>` : `<div style="height:60px"></div>`}
  <div class="cover-content">
    <div class="cover-label">AUDIT COMPARISON</div>
    <div class="cover-title">${esc(p.orgName)}</div>
    <div class="cover-subtitle">${esc(p.domain)}</div>
    <div class="cover-desc">${esc(p.beforeDate)} vs ${esc(p.afterDate)} &middot; Progress Report</div>
    <div class="cover-big-delta">
      <span class="grade" style="color:${gradeColor(p.overallBefore.grade)}">${esc(p.overallBefore.grade)}</span>
      <span class="arrow">&rarr;</span>
      <span class="grade" style="color:${gradeColor(p.overallAfter.grade)}">${esc(p.overallAfter.grade)}</span>
      <div class="delta-label" style="color:${trendCssColor(overallTrend)}">${deltaLabel(p.overallDelta)} points ${trendArrow(overallTrend)}</div>
    </div>
    <div class="cover-prepared">
      <div><strong>Client</strong><br/>${esc(p.orgName)}<br/>${esc(p.domain)}</div>
      <div><strong>Prepared By</strong><br/>${esc(p.agencyName)}<br/>${esc(p.afterDate)}</div>
    </div>
  </div>
  <div class="cover-accent" style="height:4px"></div>
  <div class="cover-footer">
    <span>${footerLeft}</span>
    <span>${p.agencyTagline ? esc(p.agencyTagline) : ""}</span>
  </div>
</div>

<!-- Score Comparison -->
<div class="page">
  <div class="sdiv">Score Comparison</div>
  <p class="body-text">Side-by-side comparison of all six audit dimensions between ${esc(p.beforeDate)} and ${esc(p.afterDate)}.</p>
  <table class="data-table">
    <thead><tr>
      <th>Dimension</th>
      <th style="text-align:center">Before Grade</th>
      <th style="text-align:center">Before Score</th>
      <th style="text-align:center">After Grade</th>
      <th style="text-align:center">After Score</th>
      <th style="text-align:center">Change</th>
    </tr></thead>
    <tbody>
      ${scoreRows}
      <tr style="background:#E8F0FE;font-weight:700">
        <td>OVERALL</td>
        <td class="td-center" style="color:${gradeColor(p.overallBefore.grade)}">${esc(p.overallBefore.grade)}</td>
        <td class="td-center">${p.overallBefore.score}%</td>
        <td class="td-center" style="color:${gradeColor(p.overallAfter.grade)}">${esc(p.overallAfter.grade)}</td>
        <td class="td-center">${p.overallAfter.score}%</td>
        <td class="td-center" style="color:${trendCssColor(overallTrend)}">${deltaLabel(p.overallDelta)} ${trendArrow(overallTrend)}</td>
      </tr>
    </tbody>
  </table>

  <div class="sub-heading">Visual Trend</div>
  ${barChartRows}
  <div style="margin-top:8px;font-size:7.5pt;color:#6B7280;">
    Dashed line = baseline (${esc(p.beforeDate)}) &middot; Solid = current (${esc(p.afterDate)})
  </div>
</div>

<!-- AI Analysis -->
<div class="page">
  <div class="sdiv">Analysis &amp; Recommendations</div>
  ${execSummary ? `<p class="body-text">${esc(execSummary)}</p>` : ""}

  ${improvements.length > 0 ? `
  <div class="sub-heading" style="color:#1e8449">What Improved</div>
  <table class="data-table">
    <thead><tr><th>Dimension</th><th>Detail</th></tr></thead>
    <tbody>${improvementRows}</tbody>
  </table>` : ""}

  ${declines.length > 0 ? `
  <div class="sub-heading" style="color:#c0392b">What Declined</div>
  <table class="data-table">
    <thead><tr><th>Dimension</th><th>Detail</th></tr></thead>
    <tbody>${declineRows}</tbody>
  </table>` : ""}

  ${stillNeedsWork.length > 0 ? `
  <div class="sub-heading" style="color:#d68910">Still Needs Work</div>
  <table class="data-table">
    <thead><tr><th>Dimension</th><th>Detail</th></tr></thead>
    <tbody>${needsWorkRows}</tbody>
  </table>` : ""}

  ${nextSteps.length > 0 ? `
  <div class="sub-heading">Recommended Next Steps</div>
  <ol style="padding-left:20px;margin:8px 0;">
    ${nextSteps.map((s) => `<li style="margin-bottom:4px;font-size:10pt;">${esc(s)}</li>`).join("\n")}
  </ol>` : ""}

  ${overallAssessment ? `
  <div class="callout callout-green">
    <p><strong>Overall Assessment:</strong> ${esc(overallAssessment)}</p>
  </div>` : ""}
</div>

</body>
</html>`;
}
