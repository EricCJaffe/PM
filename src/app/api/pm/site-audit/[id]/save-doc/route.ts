import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getBranding, buildPreparedBy } from "@/lib/branding";
import type { AuditDimensionScore } from "@/types/pm";

// POST /api/pm/site-audit/[id]/save-doc — Save PDF report + MD snapshot to client docs
// Accepts FormData with a "pdf" file blob from client-side PDF generation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Fetch the audit with org info
    const { data: audit, error } = await supabase
      .from("pm_site_audits")
      .select("*, pm_organizations(name, slug)")
      .eq("id", id)
      .single();

    if (error || !audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    if (audit.status !== "complete") {
      return NextResponse.json({ error: "Audit is not complete" }, { status: 400 });
    }

    if (audit.document_id) {
      return NextResponse.json({ error: "Report already saved to documents" }, { status: 409 });
    }

    const orgSlug = audit.pm_organizations?.slug || "org";
    const orgName = audit.pm_organizations?.name || "Organization";
    const domain = audit.url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const dateStr = new Date(audit.created_at).toISOString().split("T")[0];

    // ── 1. Get the PDF from the request FormData ──
    const formData = await request.formData();
    const pdfFile = formData.get("pdf") as File | null;

    if (!pdfFile) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

    // ── 2. Generate structured markdown snapshot for comparison ──
    const branding = await getBranding(audit.org_id);
    const overall = audit.overall || computeOverall(audit.scores || {});

    const mdContent = buildAuditMarkdown({
      orgName,
      domain,
      url: audit.url,
      date: dateStr,
      vertical: audit.vertical,
      overall,
      scores: audit.scores || {},
      gaps: audit.gaps || {},
      quickWins: audit.quick_wins || [],
      pagesToBuild: audit.pages_to_build || [],
      recommendations: audit.recommendations || [],
      rebuildTimeline: audit.rebuild_timeline || [],
      platformComparison: audit.platform_comparison || null,
      summary: audit.audit_summary || "",
      pagesFound: audit.pages_found || [],
      pagesMissing: audit.pages_missing || [],
    });

    // ── 3. Upload PDF + markdown to Supabase Storage ──
    const pdfFileName = `${orgSlug}-site-audit-${dateStr}.pdf`;
    const mdFileName = `${orgSlug}-site-audit-${dateStr}.md`;
    const pdfStoragePath = `documents/${orgSlug}/${pdfFileName}`;
    const mdStoragePath = `${orgSlug}/audits/${id}/${mdFileName}`;

    const mdBuffer = Buffer.from(mdContent, "utf-8");

    const [pdfUpload, mdUpload] = await Promise.all([
      supabase.storage.from("vault").upload(pdfStoragePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      }),
      supabase.storage.from("vault").upload(mdStoragePath, mdBuffer, {
        contentType: "text/markdown",
        upsert: true,
      }),
    ]);

    if (pdfUpload.error) {
      console.error("PDF upload error:", pdfUpload.error);
    }
    if (mdUpload.error) {
      console.error("MD upload error:", mdUpload.error);
    }

    // ── 4. Create pm_documents record (PDF report) ──
    const overallGrade = overall.grade || "?";
    const overallScore = overall.score || 0;
    const agencyName = buildPreparedBy(branding);

    const { data: doc, error: docErr } = await supabase
      .from("pm_documents")
      .insert({
        org_id: audit.org_id,
        slug: `site-audit-${dateStr}-${domain.replace(/\./g, "-")}-${id.slice(0, 8)}`,
        title: `Site Audit: ${domain} (${overallGrade} - ${overallScore}%)`,
        category: "report",
        description: `Full site audit report for ${audit.url} scored ${overallGrade} (${overallScore}/100). Prepared by ${agencyName}. ${audit.audit_summary?.slice(0, 200) || ""}`,
        storage_path: pdfStoragePath,
        file_name: pdfFileName,
        file_size: pdfBuffer.length,
        mime_type: "application/pdf",
      })
      .select("id")
      .single();

    if (docErr) {
      return NextResponse.json({ error: docErr.message }, { status: 500 });
    }

    // ── 5. Create audit snapshot record for comparison ──
    const dims = ["seo", "entity", "ai_discoverability", "conversion", "content", "a2a_readiness"];
    const dimensionScores: Record<string, number> = {};
    for (const d of dims) {
      const dim = (audit.scores || {})[d] as AuditDimensionScore | undefined;
      dimensionScores[d] = dim?.score ?? 0;
    }

    await supabase.from("pm_audit_snapshots").insert({
      audit_id: id,
      org_id: audit.org_id,
      html_storage_path: pdfStoragePath,
      md_storage_path: mdStoragePath,
      overall_grade: overallGrade,
      overall_score: overallScore,
      dimension_scores: dimensionScores,
      url: audit.url,
      vertical: audit.vertical,
      audit_date: dateStr,
    });

    // ── 6. Link document back to audit ──
    await supabase
      .from("pm_site_audits")
      .update({ document_id: doc.id })
      .eq("id", id);

    return NextResponse.json({ success: true, document_id: doc.id });
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
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C"
    : score >= 60 ? "D" : score >= 50 ? "D-" : "F";
  return { grade, score, rebuild_recommended: score < 60, rebuild_reason: null };
}

const DIMENSION_LABELS: Record<string, string> = {
  seo: "SEO",
  entity: "Entity Authority",
  ai_discoverability: "AI Discoverability",
  conversion: "Conversion Architecture",
  content: "Content Inventory",
  a2a_readiness: "A2A Readiness",
};

// ─── Structured Markdown Snapshot ───────────────────────────────────

interface AuditMdParams {
  orgName: string;
  domain: string;
  url: string;
  date: string;
  vertical: string;
  overall: { grade: string; score: number; rebuild_recommended: boolean; rebuild_reason: string | null };
  scores: Record<string, unknown>;
  gaps: Record<string, Array<Record<string, string>>>;
  quickWins: Array<Record<string, string>>;
  pagesToBuild: Array<Record<string, string>>;
  recommendations: Array<Record<string, string>>;
  rebuildTimeline: Array<Record<string, string>>;
  platformComparison: { current: string; recommended: string } | null;
  summary: string;
  pagesFound: string[];
  pagesMissing: string[];
}

function buildAuditMarkdown(p: AuditMdParams): string {
  const dims = ["seo", "entity", "ai_discoverability", "conversion", "content", "a2a_readiness"];
  const lines: string[] = [];

  lines.push("---");
  lines.push(`title: "Site Audit: ${p.domain}"`);
  lines.push(`org: "${p.orgName}"`);
  lines.push(`url: "${p.url}"`);
  lines.push(`date: "${p.date}"`);
  lines.push(`vertical: "${p.vertical}"`);
  lines.push(`overall_grade: "${p.overall.grade}"`);
  lines.push(`overall_score: ${p.overall.score}`);
  lines.push(`rebuild_recommended: ${p.overall.rebuild_recommended}`);
  for (const d of dims) {
    const dim = p.scores[d] as AuditDimensionScore | undefined;
    lines.push(`${d}_grade: "${dim?.grade || "F"}"`);
    lines.push(`${d}_score: ${dim?.score ?? 0}`);
  }
  lines.push("---");
  lines.push("");

  lines.push(`# Site Audit: ${p.domain}`);
  lines.push(`**Organization:** ${p.orgName}  `);
  lines.push(`**URL:** ${p.url}  `);
  lines.push(`**Date:** ${p.date}  `);
  lines.push(`**Vertical:** ${p.vertical}  `);
  lines.push(`**Overall Grade:** ${p.overall.grade} (${p.overall.score}%)  `);
  if (p.overall.rebuild_recommended) {
    lines.push(`**Rebuild Recommended:** Yes  `);
    if (p.overall.rebuild_reason) {
      lines.push(`**Rebuild Reason:** ${p.overall.rebuild_reason}  `);
    }
  }
  lines.push("");

  lines.push("## Executive Summary");
  lines.push(p.summary || "_No summary available._");
  lines.push("");

  lines.push("## Score Card");
  lines.push("| Dimension | Grade | Score | Key Finding |");
  lines.push("|-----------|-------|-------|-------------|");
  for (const d of dims) {
    const dim = p.scores[d] as AuditDimensionScore | undefined;
    const grade = dim?.grade || "F";
    const score = dim?.score ?? 0;
    const finding = dim?.findings?.[0] || "—";
    lines.push(`| ${DIMENSION_LABELS[d] || d} | ${grade} | ${score}% | ${finding} |`);
  }
  lines.push("");

  lines.push("## Gap Analysis");
  for (const d of dims) {
    const gapItems = p.gaps[d] || [];
    if (gapItems.length === 0) continue;

    lines.push(`### ${DIMENSION_LABELS[d] || d}`);
    const dim = p.scores[d] as AuditDimensionScore | undefined;
    lines.push(`Grade: ${dim?.grade || "?"} (${dim?.score ?? 0}%)`);
    lines.push("");

    if (dim?.findings && dim.findings.length > 0) {
      lines.push("**Findings:**");
      for (const f of dim.findings) {
        lines.push(`- ${f}`);
      }
      lines.push("");
    }

    lines.push("| Item | Current State | Standard | Gap |");
    lines.push("|------|---------------|----------|-----|");
    for (const g of gapItems) {
      lines.push(`| ${g.item || ""} | ${g.current_state || ""} | ${g.standard || ""} | ${g.gap || ""} |`);
    }
    lines.push("");
  }

  if (p.recommendations.length > 0) {
    lines.push("## Recommendations");
    for (const r of p.recommendations) {
      lines.push(`### ${r.title || "Recommendation"}`);
      lines.push(`- **Priority:** ${r.priority || "—"}`);
      lines.push(`- **Effort:** ${r.effort || "—"}`);
      lines.push(`- **Impact:** ${r.impact || "—"}`);
      if (r.description) lines.push(`- ${r.description}`);
      lines.push("");
    }
  }

  if (p.quickWins.length > 0) {
    lines.push("## Quick Wins");
    lines.push("| Action | Time Estimate | Impact |");
    lines.push("|--------|--------------|--------|");
    for (const qw of p.quickWins) {
      lines.push(`| ${qw.action || qw.title || ""} | ${qw.time_estimate || "—"} | ${qw.impact || qw.description || ""} |`);
    }
    lines.push("");
  }

  if (p.pagesToBuild.length > 0) {
    lines.push("## Pages to Build");
    lines.push("| Priority | Page | URL | Notes |");
    lines.push("|----------|------|-----|-------|");
    for (const pg of p.pagesToBuild) {
      lines.push(`| ${pg.priority || "—"} | ${pg.title || ""} | ${pg.slug || ""} | ${pg.notes || pg.reason || ""} |`);
    }
    lines.push("");
  }

  if (p.pagesFound.length > 0) {
    lines.push("## Pages Found");
    for (const pg of p.pagesFound) {
      lines.push(`- ${pg}`);
    }
    lines.push("");
  }
  if (p.pagesMissing.length > 0) {
    lines.push("## Pages Missing");
    for (const pg of p.pagesMissing) {
      lines.push(`- ${pg}`);
    }
    lines.push("");
  }

  if (p.platformComparison) {
    lines.push("## Platform Comparison");
    lines.push(`- **Current:** ${p.platformComparison.current}`);
    lines.push(`- **Recommended:** ${p.platformComparison.recommended}`);
    lines.push("");
  }

  if (p.rebuildTimeline.length > 0) {
    lines.push("## Rebuild Timeline");
    lines.push("| Phase | Focus | Deliverables |");
    lines.push("|-------|-------|--------------|");
    for (const t of p.rebuildTimeline) {
      lines.push(`| ${t.phase || ""} | ${t.focus || ""} | ${t.deliverables || ""} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
