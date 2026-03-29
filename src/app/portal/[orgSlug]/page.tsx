import { createServiceClient } from "@/lib/supabase/server";
import { getUserSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PortalDashboard } from "@/components/portal/PortalDashboard";

export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getUserSession();
  if (!session) redirect(`/portal/auth?org=${orgSlug}`);

  const supabase = createServiceClient();

  // Get org
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("id, name, slug")
    .eq("slug", orgSlug)
    .single();

  if (!org) redirect("/portal/auth");

  // Fetch portal settings for visibility control
  const { data: settings } = await supabase
    .from("pm_portal_settings")
    .select("*")
    .eq("org_id", org.id)
    .single();

  // Fetch active workflows for this org
  const { data: workflows } = await supabase
    .from("pm_audit_workflows")
    .select("id, workflow_type, status, target_scores, current_score, created_at")
    .eq("org_id", org.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(3);

  // Fetch shared documents (sent or signed)
  const showDocs = settings?.show_documents !== false;
  let documents: Array<Record<string, unknown>> = [];
  if (showDocs) {
    const { data } = await supabase
      .from("generated_documents")
      .select("id, title, status, esign_status, sent_at, signed_at, created_at, document_types(name)")
      .eq("org_id", org.id)
      .in("status", ["sent", "signed", "approved"])
      .order("created_at", { ascending: false })
      .limit(5);
    documents = data || [];
  }

  // Fetch tasks assigned to this user or client-facing tasks
  const showTasks = settings?.show_tasks !== false;
  let tasks: Array<Record<string, unknown>> = [];
  if (showTasks) {
    const { data } = await supabase
      .from("pm_tasks")
      .select("id, name, status, due_date, owner, phase_id, project_id")
      .eq("org_id", org.id)
      .in("status", ["not-started", "in-progress", "blocked", "pending"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(10);
    tasks = data || [];
  }

  const showWorkflow = settings?.show_workflow !== false;

  return (
    <PortalDashboard
      orgSlug={orgSlug}
      orgName={org.name}
      workflows={showWorkflow ? (workflows || []) : []}
      documents={documents}
      tasks={tasks}
      showWorkflow={showWorkflow}
      showDocuments={showDocs}
      showTasks={showTasks}
      welcomeMessage={settings?.welcome_message || `Welcome to your ${org.name} project portal.`}
    />
  );
}
