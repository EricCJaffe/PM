import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  generatePhases,
  generateGapItemsFromAudit,
  mapAuditToTargetScores,
} from "@/lib/workflow-generator";
import type { SiteAudit, WorkflowType } from "@/types/pm";

/**
 * POST /api/pm/site-audit/workflow — Create a new workflow from a completed audit.
 *
 * Creates: pm_audit_workflows row, pm_projects, pm_phases, pm_tasks, pm_gap_analysis rows.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audit_id, workflow_type, target_scores, config } = body as {
      audit_id: string;
      workflow_type: WorkflowType;
      target_scores?: Record<string, number>;
      config?: Record<string, unknown>;
    };

    if (!audit_id || !workflow_type) {
      return NextResponse.json(
        { error: "audit_id and workflow_type are required" },
        { status: 400 }
      );
    }

    if (!["remediation", "rebuild"].includes(workflow_type)) {
      return NextResponse.json(
        { error: "workflow_type must be 'remediation' or 'rebuild'" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch the audit
    const { data: audit, error: auditErr } = await supabase
      .from("pm_site_audits")
      .select("*")
      .eq("id", audit_id)
      .single();

    if (auditErr || !audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    if (audit.status !== "complete") {
      return NextResponse.json(
        { error: "Audit must be complete before starting a workflow" },
        { status: 400 }
      );
    }

    const siteAudit = audit as unknown as SiteAudit;
    const targets = target_scores || mapAuditToTargetScores(siteAudit);
    const orgId = audit.org_id;

    // Get org slug for naming
    let orgName = "Project";
    if (orgId) {
      const { data: org } = await supabase
        .from("pm_organizations")
        .select("name, slug")
        .eq("id", orgId)
        .single();
      if (org) orgName = org.name;
    }

    // Create the project
    const projectName = workflow_type === "remediation"
      ? `${orgName} — Site Remediation`
      : `${orgName} — Website Rebuild`;

    const projectSlug = `${workflow_type}-${audit_id.slice(0, 8)}`;

    const { data: project, error: projErr } = await supabase
      .from("pm_projects")
      .insert({
        name: projectName,
        slug: projectSlug,
        org_id: orgId,
        project_type: workflow_type,
        status: "active",
      })
      .select()
      .single();

    if (projErr) {
      return NextResponse.json({ error: `Failed to create project: ${projErr.message}` }, { status: 500 });
    }

    // Create the workflow record
    const { data: workflow, error: wfErr } = await supabase
      .from("pm_audit_workflows")
      .insert({
        audit_id,
        org_id: orgId,
        project_id: project.id,
        workflow_type,
        target_scores: targets,
        current_score: siteAudit.overall?.score || null,
        config: config || {},
      })
      .select()
      .single();

    if (wfErr) {
      return NextResponse.json({ error: `Failed to create workflow: ${wfErr.message}` }, { status: 500 });
    }

    // Link audit to workflow
    await supabase
      .from("pm_site_audits")
      .update({ workflow_id: workflow.id })
      .eq("id", audit_id);

    // Generate phases and tasks from audit data
    const phaseDefs = generatePhases(siteAudit, workflow_type);

    let totalTasks = 0;
    for (const phaseDef of phaseDefs) {
      // Insert phase
      const { data: phase } = await supabase
        .from("pm_phases")
        .insert({
          project_id: project.id,
          name: phaseDef.name,
          slug: phaseDef.slug,
          status: phaseDef.status,
          phase_order: phaseDef.order,
          phase_group: phaseDef.group,
          progress: 0,
        })
        .select()
        .single();

      if (!phase) continue;

      // Insert tasks for this phase
      if (phaseDef.tasks.length > 0) {
        const taskRows = phaseDef.tasks.map((t) => ({
          project_id: project.id,
          phase_id: phase.id,
          org_id: orgId,
          name: t.name,
          description: t.description,
          slug: t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
          status: t.status,
          sort_order: t.sort_order,
        }));

        await supabase.from("pm_tasks").insert(taskRows);
        totalTasks += taskRows.length;
      }
    }

    // Generate gap analysis items from audit
    const gapItems = generateGapItemsFromAudit(siteAudit);
    if (gapItems.length > 0 && orgId) {
      const gapRows = gapItems.map((g) => ({
        org_id: orgId,
        audit_id,
        category: g.category,
        title: g.title,
        current_state: g.current_state,
        desired_state: g.desired_state,
        gap_description: g.gap_description,
        severity: g.severity,
        source: g.source,
        status: "identified",
      }));

      await supabase.from("pm_gap_analysis").insert(gapRows);
    }

    return NextResponse.json({
      workflow,
      project_id: project.id,
      phases_created: phaseDefs.length,
      tasks_created: totalTasks,
      gaps_created: gapItems.length,
    }, { status: 201 });
  } catch (err) {
    console.error("Workflow creation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pm/site-audit/workflow?org_id=... — List workflows for an org.
 */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org_id");

  if (!orgId) {
    return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("pm_audit_workflows")
    .select(`
      *,
      pm_projects(id, name, slug, status),
      pm_site_audits!pm_audit_workflows_audit_id_fkey(id, url, overall, scores, created_at)
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
