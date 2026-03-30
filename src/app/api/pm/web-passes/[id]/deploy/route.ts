import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// POST /api/pm/web-passes/[id]/deploy
// Marks go-live pass as complete, links a final audit, triggers before/after comparison.
// Body: { final_audit_id?: string, deployed_url?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { final_audit_id, deployed_url } = body as {
    final_audit_id?: string;
    deployed_url?: string;
  };

  const supabase = createServiceClient();

  const { data: pass, error: passError } = await supabase
    .from("pm_web_passes")
    .select("*")
    .eq("id", id)
    .single();

  if (passError || !pass) {
    return NextResponse.json({ error: "Pass not found" }, { status: 404 });
  }

  if (pass.pass_type !== "go-live") {
    return NextResponse.json({ error: "Only the go-live pass can be deployed" }, { status: 400 });
  }

  // Update pass: mark approved, link final audit, store deployed url in notes
  const updatePayload: Record<string, unknown> = {
    status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: "team",
  };
  if (final_audit_id) updatePayload.site_audit_id = final_audit_id;
  if (deployed_url) updatePayload.notes = deployed_url;

  const { data: updatedPass, error: updateError } = await supabase
    .from("pm_web_passes")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Mark the project complete
  await supabase
    .from("pm_projects")
    .update({ status: "complete" })
    .eq("id", pass.project_id);

  // Build before/after comparison if we have both audits
  let comparison: Record<string, unknown> | null = null;
  const beforeAuditId = pass.site_audit_id; // discovery audit (pass 0) linked here
  const afterAuditId = final_audit_id;

  if (beforeAuditId && afterAuditId) {
    // Load both audits for comparison data
    const [{ data: beforeAudit }, { data: afterAudit }] = await Promise.all([
      supabase.from("pm_site_audits").select("url, scores, overall").eq("id", beforeAuditId).single(),
      supabase.from("pm_site_audits").select("url, scores, overall").eq("id", afterAuditId).single(),
    ]);

    if (beforeAudit && afterAudit) {
      const DIMS = ["seo", "entity", "ai_discoverability", "conversion", "content", "a2a_readiness"] as const;
      const LABELS: Record<string, string> = {
        seo: "SEO", entity: "Entity Authority", ai_discoverability: "AI Discoverability",
        conversion: "Conversion", content: "Content", a2a_readiness: "A2A Readiness",
      };

      const dimensions: Record<string, { label: string; before_score: number; after_score: number; delta: number }> = {};
      for (const d of DIMS) {
        const bScore = (beforeAudit.scores?.[d] as { score?: number } | undefined)?.score ?? 0;
        const aScore = (afterAudit.scores?.[d] as { score?: number } | undefined)?.score ?? 0;
        dimensions[d] = {
          label: LABELS[d],
          before_score: bScore,
          after_score: aScore,
          delta: aScore - bScore,
        };
      }

      comparison = {
        before_url: beforeAudit.url,
        after_url: afterAudit.url ?? deployed_url ?? beforeAudit.url,
        before_overall: beforeAudit.overall,
        after_overall: afterAudit.overall,
        dimensions,
        generated_at: new Date().toISOString(),
      };

      // Save comparison into the pass scoring_results
      await supabase
        .from("pm_web_passes")
        .update({ scoring_results: { ...((pass.scoring_results as Record<string, unknown>) ?? {}), before_after: comparison } })
        .eq("id", id);
    }
  }

  return NextResponse.json({
    success: true,
    pass: updatedPass,
    comparison,
    project_marked_complete: true,
  });
}
