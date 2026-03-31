import { createServiceClient } from "@/lib/supabase/server";
import { getUserSession } from "@/lib/auth";
import { redirect } from "next/navigation";

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

  // Fetch tasks for this org
  const { data: tasks } = await supabase
    .from("pm_tasks")
    .select("id, name, description, status, due_date, owner, assigned_to, phase_id, project_id, subtasks")
    .eq("org_id", org.id)
    .in("status", ["not-started", "in-progress", "blocked", "pending", "complete"])
    .order("status")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(50);

  const statusOrder = ["in-progress", "not-started", "pending", "blocked", "complete"];
  const sorted = (tasks || []).sort((a: { id: string; name: string; description: string | null; status: string; due_date: string | null; owner: string | null; assigned_to: string | null; phase_id: string | null; project_id: string | null; subtasks: unknown }, b: { id: string; name: string; description: string | null; status: string; due_date: string | null; owner: string | null; assigned_to: string | null; phase_id: string | null; project_id: string | null; subtasks: unknown }) => {
    const ai = statusOrder.indexOf(a.status);
    const bi = statusOrder.indexOf(b.status);
    return ai - bi;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-pm-text">Tasks</h2>

      {sorted.length === 0 ? (
        <div className="bg-pm-card border border-pm-border rounded-lg p-8 text-center">
          <p className="text-pm-muted text-sm">No tasks assigned yet.</p>
        </div>
      ) : (
        <div className="bg-pm-card border border-pm-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pm-border bg-pm-bg/50">
                <th className="text-left px-4 py-2 text-pm-muted font-medium">Task</th>
                <th className="text-left px-4 py-2 text-pm-muted font-medium w-28">Status</th>
                <th className="text-left px-4 py-2 text-pm-muted font-medium w-28">Due</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t: { id: string; name: string; description: string | null; status: string; due_date: string | null }) => (
                <tr key={t.id} className="border-b border-pm-border/50 last:border-0">
                  <td className="px-4 py-3">
                    <p className="text-pm-text font-medium">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-pm-muted mt-0.5 line-clamp-1">{t.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.status === "complete" ? "bg-emerald-500/20 text-emerald-400" :
                      t.status === "in-progress" ? "bg-blue-500/20 text-blue-400" :
                      t.status === "blocked" ? "bg-red-500/20 text-red-400" :
                      t.status === "pending" ? "bg-amber-500/20 text-amber-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>
                      {t.status.replace("-", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-pm-muted">
                    {t.due_date || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
