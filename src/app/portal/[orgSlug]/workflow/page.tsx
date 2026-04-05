import { createServiceClient } from "@/lib/supabase/server";
import { getUserSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PortalRemediationView } from "@/components/portal/PortalRemediationView";
import { PortalRebuildWizard } from "@/components/portal/PortalRebuildWizard";
import { PortalProcessDiscoveryView } from "@/components/portal/PortalProcessDiscoveryView";

export default async function PortalWorkflowPage({
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

  // Fetch portal settings for primary color
  const { data: settings } = await supabase
    .from("pm_portal_settings")
    .select("primary_color")
    .eq("org_id", org.id)
    .single();

  const primaryColor = settings?.primary_color || "#5B9BD5";

  // Fetch workflows for this org
  const { data: workflows } = await supabase
    .from("pm_audit_workflows")
    .select("id, workflow_type, status, target_scores, current_score, created_at, updated_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  const activeWorkflow = workflows?.find((w: { id: string; workflow_type: string; status: string; target_scores: unknown; current_score: unknown; created_at: string; updated_at: string }) => w.status === "active") || workflows?.[0] || null;

  if (!activeWorkflow) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-pm-text">Workflow</h2>
        <div className="bg-pm-card border border-pm-border rounded-lg p-8 text-center">
          <p className="text-pm-muted text-sm">No active workflows yet.</p>
          <p className="text-pm-muted text-xs mt-1">Your team will set up a workflow once your project begins.</p>
        </div>
      </div>
    );
  }

  const target = (activeWorkflow.target_scores as Record<string, number>)?.overall || 80;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-pm-text">
          {activeWorkflow.workflow_type === "process_discovery" ? "Process Discovery" :
           activeWorkflow.workflow_type === "rebuild" || activeWorkflow.workflow_type === "guided_rebuild" ? "Website Rebuild" :
           "Site Remediation"}
        </h2>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          activeWorkflow.status === "complete" ? "bg-emerald-500/20 text-emerald-400" :
          activeWorkflow.status === "paused" ? "bg-amber-500/20 text-amber-400" :
          "bg-blue-500/20 text-blue-400"
        }`}>
          {activeWorkflow.status}
        </span>
      </div>

      {activeWorkflow.workflow_type === "process_discovery" ? (
        <PortalProcessDiscoveryView workflowId={activeWorkflow.id} />
      ) : activeWorkflow.workflow_type === "remediation" ? (
        <PortalRemediationView
          workflowId={activeWorkflow.id}
          orgSlug={orgSlug}
          targetScore={target}
          currentScore={activeWorkflow.current_score as number | null}
        />
      ) : (
        <PortalRebuildWizard
          workflowId={activeWorkflow.id}
          orgSlug={orgSlug}
          primaryColor={primaryColor}
        />
      )}
    </div>
  );
}
