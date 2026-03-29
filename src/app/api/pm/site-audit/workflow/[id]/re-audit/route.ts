import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/pm/site-audit/workflow/[id]/re-audit
 * Triggers a new site audit for the same URL as the workflow's baseline audit.
 * Updates the workflow's current_score and latest_audit_id when the new audit completes.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Fetch workflow + original audit
    const { data: workflow, error: wfErr } = await supabase
      .from("pm_audit_workflows")
      .select("*, pm_site_audits!pm_audit_workflows_audit_id_fkey(url, vertical, org_id, prospect_name)")
      .eq("id", id)
      .single();

    if (wfErr || !workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const origAudit = workflow.pm_site_audits as {
      url: string;
      vertical: string;
      org_id: string | null;
      prospect_name: string | null;
    };

    if (!origAudit?.url) {
      return NextResponse.json({ error: "Original audit URL not found" }, { status: 400 });
    }

    // Create a new audit for the same URL
    const { data: newAudit, error: auditErr } = await supabase
      .from("pm_site_audits")
      .insert({
        url: origAudit.url,
        vertical: origAudit.vertical,
        org_id: origAudit.org_id || workflow.org_id,
        prospect_name: origAudit.prospect_name,
        workflow_id: id,
        status: "pending",
      })
      .select()
      .single();

    if (auditErr || !newAudit) {
      return NextResponse.json({ error: `Failed to create audit: ${auditErr?.message}` }, { status: 500 });
    }

    // Update workflow to point to new audit
    await supabase
      .from("pm_audit_workflows")
      .update({
        latest_audit_id: newAudit.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Trigger processing in the background (fire-and-forget)
    // The frontend will poll the audit status just like normal audit creation
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    if (appUrl) {
      fetch(`${appUrl}/api/pm/site-audit/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: newAudit.id }),
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      audit_id: newAudit.id,
      message: "Re-audit started. Poll the audit status for completion.",
    }, { status: 202 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
