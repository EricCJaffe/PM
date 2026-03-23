import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getBranding, buildPreparedBy } from "@/lib/branding";
import { buildAuditHTML } from "@/lib/audit-html";
import type { AuditDimensionScore, AuditGrade } from "@/types/pm";

// POST /api/pm/site-audit/[id]/pdf — Generate printable HTML report (FSA branded)
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
      agencyFullName: branding.agency_name,
      agencyShortName: branding.agency_short_name,
      agencyTagline: branding.agency_tagline,
      agencyLocation: branding.location,
      agencyLogoUrl: branding.agency_logo_url,
      brandColors: {
        navy: branding.primary_color,
        accent: branding.secondary_color,
        gold: branding.accent_color,
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
