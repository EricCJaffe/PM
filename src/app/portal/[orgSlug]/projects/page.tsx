import { createServiceClient } from "@/lib/supabase/server";
import { getUserSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function PortalProjectsPage({
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

  const { data: projects } = await supabase
    .from("pm_projects")
    .select("id, name, slug, status, start_date, target_date, description, template_slug")
    .eq("org_id", org.id)
    .eq("is_personal", false)
    .order("created_at", { ascending: false });

  // For each project get task counts
  const projectIds = (projects || []).map((p: { id: string }) => p.id);
  let tasksByProject: Record<string, { total: number; complete: number }> = {};

  if (projectIds.length > 0) {
    const { data: tasks } = await supabase
      .from("pm_tasks")
      .select("project_id, status")
      .in("project_id", projectIds);

    for (const t of tasks || []) {
      if (!t.project_id) continue;
      if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = { total: 0, complete: 0 };
      tasksByProject[t.project_id].total++;
      if (t.status === "complete") tasksByProject[t.project_id].complete++;
    }
  }

  const statusColor: Record<string, string> = {
    active: "bg-blue-500/20 text-blue-400",
    complete: "bg-emerald-500/20 text-emerald-400",
    "on-hold": "bg-purple-500/20 text-purple-400",
    cancelled: "bg-gray-500/20 text-gray-400",
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-pm-text">Projects</h2>

      {(!projects || projects.length === 0) ? (
        <div className="bg-pm-card border border-pm-border rounded-lg p-8 text-center">
          <p className="text-pm-muted text-sm">No active projects yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(projects as Array<{
            id: string; name: string; slug: string; status: string;
            start_date: string | null; target_date: string | null; description: string | null;
          }>).map((project) => {
            const counts = tasksByProject[project.id] || { total: 0, complete: 0 };
            const pct = counts.total > 0 ? Math.round((counts.complete / counts.total) * 100) : 0;

            return (
              <Link
                key={project.id}
                href={`/portal/${orgSlug}/projects/${project.slug}`}
                className="block bg-pm-card border border-pm-border rounded-lg p-5 hover:border-blue-500/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-pm-text">{project.name}</h3>
                    {project.description && (
                      <p className="text-xs text-pm-muted mt-0.5 line-clamp-2">{project.description}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColor[project.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                    {project.status}
                  </span>
                </div>

                {counts.total > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-pm-muted mb-1">
                      <span>{counts.complete} of {counts.total} tasks complete</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-pm-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-pm-muted">
                    {project.start_date && <span>Started {new Date(project.start_date).toLocaleDateString()}</span>}
                    {project.target_date && <span>Target {new Date(project.target_date).toLocaleDateString()}</span>}
                  </div>
                  <span className="text-xs text-blue-400">View &rarr;</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
