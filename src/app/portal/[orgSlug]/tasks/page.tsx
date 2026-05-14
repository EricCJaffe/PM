import { createServiceClient } from "@/lib/supabase/server";
import { getUserSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PortalTasksClient } from "@/components/portal/PortalTasksClient";

export default async function PortalTasksPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getUserSession();
  if (!session) redirect(`/portal/auth?org=${orgSlug}`);

  const supabase = createServiceClient();

  const { data: org } = await supabase
    .from("pm_organizations")
    .select("id, name")
    .eq("slug", orgSlug)
    .single();

  if (!org) redirect("/portal/auth");

  const { data: settings } = await supabase
    .from("pm_portal_settings")
    .select("allow_task_comments, allow_task_create")
    .eq("org_id", org.id)
    .single();

  const { data: tasks } = await supabase
    .from("pm_tasks")
    .select("id, name, description, status, due_date, owner, assigned_to, phase_id, project_id")
    .eq("org_id", org.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  // Fetch project names for context
  const projectIds = [...new Set((tasks || []).map((t: { project_id: string | null }) => t.project_id).filter(Boolean))];
  let projectNames: Record<string, string> = {};
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("pm_projects")
      .select("id, name")
      .in("id", projectIds as string[]);
    for (const p of projects || []) projectNames[p.id] = p.name;
  }

  return (
    <PortalTasksClient
      orgId={org.id}
      orgSlug={orgSlug}
      tasks={tasks || []}
      projectNames={projectNames}
      allowCreate={settings?.allow_task_create === true}
    />
  );
}
