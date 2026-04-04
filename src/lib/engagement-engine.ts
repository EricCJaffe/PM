/**
 * Engagement Engine
 * Handles automated actions triggered by engagement stage changes.
 * Called from the engagements PATCH route after a deal_stage update.
 */

import { SupabaseClient } from "@supabase/supabase-js";

const PASS_TYPES = ["discovery", "foundation", "content", "polish", "go-live"] as const;

/**
 * Main entry point — called after every deal_stage change.
 * Spawns task templates for the new stage AND runs service-line
 * specific automation (e.g. auto-create web project on closed_won).
 */
export async function onEngagementStageChange(
  supabase: SupabaseClient,
  engagementId: string,
  fromStage: string,
  toStage: string
) {
  // Load engagement
  const { data: eng } = await supabase
    .from("pm_engagements")
    .select("id, org_id, title, engagement_type, website_url")
    .eq("id", engagementId)
    .single();

  if (!eng) return;

  // 1. Spawn tasks from matching templates for this stage + service line
  await spawnStageTasks(supabase, eng, toStage);

  // 2. Service-line specific automation
  if (eng.engagement_type === "website_build" && toStage === "closed_won") {
    await autoCreateWebProject(supabase, eng);
  }

  // 3. Auto-draft SOW when stage moves to proposal_sent
  if (toStage === "proposal_sent") {
    await autoCreateSOWDraft(supabase, eng);
  }
}

/**
 * Spawn pm_tasks from pm_engagement_task_templates that match
 * the new stage and the engagement's service line.
 */
async function spawnStageTasks(
  supabase: SupabaseClient,
  eng: { id: string; org_id: string; engagement_type: string | null },
  toStage: string
) {
  // Build filter: templates with no service_line (universal) OR matching this engagement's type
  let query = supabase
    .from("pm_engagement_task_templates")
    .select("*")
    .eq("trigger_stage", toStage)
    .eq("is_active", true);

  if (eng.engagement_type) {
    query = query.or(`service_line.is.null,service_line.eq.${eng.engagement_type}`);
  } else {
    query = query.is("service_line", null);
  }

  const { data: templates } = await query.order("sort_order");

  if (!templates || templates.length === 0) return;

  const today = new Date();
  const taskInserts = templates.map((t: {
    id: string;
    title: string;
    description: string | null;
    due_offset_days: number;
    nudge_after_days: number | null;
  }) => {
    const due = new Date(today);
    due.setDate(due.getDate() + (t.due_offset_days ?? 0));
    return {
      org_id: eng.org_id,
      engagement_id: eng.id,
      name: t.title,
      description: t.description ?? null,
      status: "not-started",
      due_date: due.toISOString().slice(0, 10),
      nudge_after_days: t.nudge_after_days ?? null,
      sort_order: 0,
    };
  });

  await supabase.from("pm_tasks").insert(taskInserts);
}

/**
 * Auto-create a website-build project + 5 web passes when
 * a website_build engagement transitions to closed_won.
 */
async function autoCreateWebProject(
  supabase: SupabaseClient,
  eng: { id: string; org_id: string; title: string; website_url: string | null }
) {
  // Avoid duplicates — check if passes already exist for this org
  const { data: existing } = await supabase
    .from("pm_web_passes")
    .select("id")
    .eq("org_id", eng.org_id)
    .limit(1);

  if (existing && existing.length > 0) return;

  // Look up website-build template
  const { data: template } = await supabase
    .from("pm_project_templates")
    .select("id")
    .eq("slug", "website-build")
    .single();

  if (!template) return;

  // Load org
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("id, slug, name")
    .eq("id", eng.org_id)
    .single();

  if (!org) return;

  // Create project
  const projectSlug = `${org.slug}-website-${Date.now()}`;
  const { data: project, error: projectError } = await supabase
    .from("pm_projects")
    .insert({
      org_id: org.id,
      template_id: template.id,
      name: `${org.name} — Website Build`,
      slug: projectSlug,
      status: "in-progress",
      owner: null,
    })
    .select()
    .single();

  if (projectError || !project) return;

  // Pre-link to most recent site audit if available
  const { data: audit } = await supabase
    .from("pm_site_audits")
    .select("id")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Create all 5 passes
  const passInserts = PASS_TYPES.map((passType, i) => ({
    project_id: project.id,
    org_id: org.id,
    pass_number: i,
    pass_type: passType,
    status: i === 0 ? "active" : "locked",
    share_token: crypto.randomUUID(),
    site_audit_id: i === 0 && audit ? audit.id : null,
    form_data: i === 0 && eng.website_url ? { website_url: eng.website_url } : {},
  }));

  await supabase.from("pm_web_passes").insert(passInserts);
}

/**
 * Auto-draft an SOW when a deal moves to proposal_sent.
 * Skips if an SOW already exists for this engagement.
 */
async function autoCreateSOWDraft(
  supabase: SupabaseClient,
  eng: { id: string; org_id: string; title: string }
) {
  // Check if an SOW already exists for this engagement
  const { count } = await supabase
    .from("generated_documents")
    .select("id", { count: "exact", head: true })
    .eq("org_id", eng.org_id)
    .ilike("title", `%${eng.title.slice(0, 30)}%`);

  if ((count ?? 0) > 0) return; // already has a doc — skip

  // Look up the SOW document type
  const { data: sowType } = await supabase
    .from("document_types")
    .select("id")
    .eq("slug", "sow")
    .eq("is_active", true)
    .single();

  if (!sowType) return;

  // Load org for pre-fill
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("name, billing_contact_name, billing_contact_email")
    .eq("id", eng.org_id)
    .single();

  // Create draft SOW pre-filled with engagement data
  const { data: doc } = await supabase
    .from("generated_documents")
    .insert({
      document_type_id: sowType.id,
      org_id: eng.org_id,
      title: `${eng.title} — Statement of Work`,
      status: "draft",
      intake_data: {
        client_name: org?.name ?? "",
        client_contact_name: org?.billing_contact_name ?? "",
        client_contact_email: org?.billing_contact_email ?? "",
        project_title: eng.title,
      },
    })
    .select("id")
    .single();

  if (!doc) return;

  // Log creation
  await supabase.from("document_activity").insert({
    document_id: doc.id,
    action: "created",
    details: { auto_created: true, trigger: "proposal_sent", engagement_id: eng.id },
  });
}
