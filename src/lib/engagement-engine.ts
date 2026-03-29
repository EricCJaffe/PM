/**
 * Engagement Engine
 * Handles automated actions triggered by engagement stage changes.
 * Called from the engagements PATCH route after a deal_stage update.
 */

import { SupabaseClient } from "@supabase/supabase-js";

const PASS_TYPES = ["discovery", "foundation", "content", "polish", "go-live"] as const;

/**
 * Auto-create a website-build project + 5 web passes when a
 * website_build engagement transitions to closed_won.
 */
export async function onEngagementStageChange(
  supabase: SupabaseClient,
  engagementId: string,
  fromStage: string,
  toStage: string
) {
  if (toStage !== "closed_won") return;

  // Load the engagement
  const { data: eng } = await supabase
    .from("pm_engagements")
    .select("id, org_id, title, engagement_type, website_url")
    .eq("id", engagementId)
    .single();

  if (!eng || eng.engagement_type !== "website_build") return;

  // Check if web passes already exist for this org (avoid duplicates)
  const { data: existing } = await supabase
    .from("pm_web_passes")
    .select("id")
    .eq("org_id", eng.org_id)
    .limit(1);

  if (existing && existing.length > 0) return; // already seeded

  // Look up the website-build template
  const { data: template } = await supabase
    .from("pm_project_templates")
    .select("id")
    .eq("slug", "website-build")
    .single();

  if (!template) return;

  // Load the org for slug/name
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("id, slug, name")
    .eq("id", eng.org_id)
    .single();

  if (!org) return;

  // Create the project via the seed endpoint (reuse existing logic)
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

  // Find the most recent site audit for this org to pre-link
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
