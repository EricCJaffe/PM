import { createServiceClient } from "@/lib/supabase/server";
import { getUserSession } from "@/lib/auth";
import { redirect } from "next/navigation";

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

  // Fetch workflows for this org
  const { data: workflows } = await supabase
    .from("pm_audit_workflows")
    .select("id, workflow_type, status, target_scores, current_score, latest_audit_id, created_at, updated_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-pm-text">Workflows</h2>

      {(!workflows || workflows.length === 0) ? (
        <div className="bg-pm-card border border-pm-border rounded-lg p-8 text-center">
          <p className="text-pm-muted text-sm">No active workflows yet.</p>
          <p className="text-pm-muted text-xs mt-1">Your team will set up a workflow once your project begins.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((w) => {
            const target = (w.target_scores as Record<string, number>)?.overall || 80;
            const progress = w.current_score ? Math.min(100, Math.round((w.current_score / target) * 100)) : 0;

            return (
              <div key={w.id} className="bg-pm-card border border-pm-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      w.workflow_type === "rebuild"
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}>
                      {w.workflow_type === "rebuild" ? "Website Rebuild" : "Remediation"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      w.status === "complete" ? "bg-emerald-500/20 text-emerald-400" :
                      w.status === "paused" ? "bg-amber-500/20 text-amber-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>
                      {w.status}
                    </span>
                  </div>
                  <span className="text-xs text-pm-muted">
                    Started {new Date(w.created_at).toLocaleDateString()}
                  </span>
                </div>

                {w.current_score != null && (
                  <div>
                    <div className="flex items-center justify-between text-xs text-pm-muted mb-1">
                      <span>Score: {w.current_score} / {target}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-pm-bg rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          background: progress >= 100 ? "#22c55e" : "#3b82f6",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
