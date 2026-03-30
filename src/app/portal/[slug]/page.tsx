import { createServiceClient } from "@/lib/supabase/server";
import { getBranding, buildPreparedBy } from "@/lib/branding";
import { notFound } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createServiceClient();

  // Resolve org by slug
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("id, name, slug, website")
    .eq("slug", slug)
    .single();

  if (!org) notFound();

  // Load portal settings
  const { data: settings } = await supabase
    .from("pm_portal_settings")
    .select("*")
    .eq("org_id", org.id)
    .single();

  // Default settings if none configured
  const s = settings ?? {
    show_projects: true, show_phases: true, show_tasks: true,
    show_risks: false, show_kpis: true, show_proposals: true,
    show_documents: true, show_reports: false,
    portal_title: null, welcome_message: null, primary_color: null,
  };

  // Load data in parallel based on settings
  const [branding, { data: projects }, { data: kpis }, { data: proposals }] = await Promise.all([
    getBranding(org.id),
    supabase.from("pm_projects").select("id, name, slug, status, task_count, complete_tasks, target_date").eq("org_id", org.id).neq("status", "archived").order("created_at", { ascending: false }),
    s.show_kpis
      ? supabase.from("pm_kpis").select("*").eq("org_id", org.id).order("sort_order")
      : Promise.resolve({ data: [] }),
    s.show_proposals
      ? supabase.from("pm_proposals").select("id, title, status, total_value, created_at, share_token").eq("org_id", org.id).neq("status", "draft").order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  type ProjectRow = { id: string; name: string; slug: string; status: string; task_count: number; complete_tasks: number; target_date: string | null };
  const allProjects: ProjectRow[] = (projects ?? []) as ProjectRow[];
  const activeProjects = allProjects.filter((p) => p.status !== "complete");
  const completedProjects = allProjects.filter((p) => p.status === "complete");
  const preparedBy = buildPreparedBy(branding);
  const portalTitle = s.portal_title ?? `${org.name} — Client Portal`;
  const accentColor = s.primary_color ?? branding.accent_color ?? "#2563eb";

  // Load phases for active projects if show_phases
  const projectPhases: Record<string, { id: string; name: string; status: string; progress: number }[]> = {};
  if (s.show_phases && activeProjects.length > 0) {
    for (const project of activeProjects.slice(0, 5)) {
      const { data: phases } = await supabase
        .from("pm_phases")
        .select("id, name, status, progress")
        .eq("project_id", project.id)
        .order("order");
      projectPhases[project.id] = phases ?? [];
    }
  }

  const statusColors: Record<string, string> = {
    "not-started": "bg-slate-400",
    "in-progress": "bg-blue-400",
    complete: "bg-emerald-400",
    blocked: "bg-red-400",
    pending: "bg-amber-400",
    "on-hold": "bg-slate-500",
    active: "bg-blue-400",
    paused: "bg-amber-400",
  };

  const proposalStatusColors: Record<string, string> = {
    sent: "bg-blue-400/20 text-blue-400",
    accepted: "bg-emerald-400/20 text-emerald-400",
    declined: "bg-red-400/20 text-red-400",
    expired: "bg-slate-400/20 text-slate-400",
  };

  return (
    <div className="min-h-screen bg-pm-bg">
      {/* Header */}
      <div className="border-b border-pm-border bg-pm-card/80 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {branding.co_brand_mode !== "client-only" && branding.agency_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.agency_logo_url} alt={branding.agency_name} className="h-7 object-contain" />
            )}
            {branding.co_brand_mode !== "agency-only" && branding.client_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.client_logo_url} alt={org.name} className="h-7 object-contain" />
            )}
            <div>
              <p className="text-xs text-pm-muted">{preparedBy}</p>
              <h1 className="text-base font-semibold text-pm-text">{portalTitle}</h1>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
            Live
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Welcome message */}
        {s.welcome_message && (
          <div
            className="card border-l-4 text-sm text-pm-muted"
            style={{ borderLeftColor: accentColor }}
          >
            {s.welcome_message}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <div className="text-2xl font-bold text-pm-text">{activeProjects.length}</div>
            <div className="text-xs text-pm-muted mt-1">Active Projects</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-pm-text">{completedProjects.length}</div>
            <div className="text-xs text-pm-muted mt-1">Completed</div>
          </div>
          {s.show_proposals && (
            <div className="card text-center">
              <div className="text-2xl font-bold text-pm-text">{(proposals ?? []).length}</div>
              <div className="text-xs text-pm-muted mt-1">Proposals</div>
            </div>
          )}
          {s.show_kpis && (
            <div className="card text-center">
              <div className="text-2xl font-bold text-pm-text">{(kpis ?? []).length}</div>
              <div className="text-xs text-pm-muted mt-1">KPIs Tracked</div>
            </div>
          )}
        </div>

        {/* Active Projects */}
        {s.show_projects && activeProjects.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-pm-text text-lg">Active Projects</h2>
            {activeProjects.map((project) => {
              const progress = project.task_count > 0
                ? Math.round((project.complete_tasks / project.task_count) * 100)
                : 0;
              const phases = projectPhases[project.id] ?? [];
              return (
                <div key={project.id} className="card space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusColors[project.status] ?? "bg-pm-muted"}`} />
                        <h3 className="font-semibold text-pm-text">{project.name}</h3>
                        <StatusBadge status={project.status as Parameters<typeof StatusBadge>[0]["status"]} />
                      </div>
                      {project.target_date && (
                        <p className="text-xs text-pm-muted ml-5">
                          Target: {new Date(project.target_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold text-pm-text">{progress}%</div>
                      <div className="text-xs text-pm-muted">complete</div>
                    </div>
                  </div>

                  <ProgressBar value={progress} />

                  {/* Phase breakdown */}
                  {s.show_phases && phases.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-pm-border/50">
                      {phases.map((phase) => (
                        <div key={phase.id} className="flex items-center gap-3">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColors[phase.status] ?? "bg-pm-muted"}`} />
                          <span className="text-sm text-pm-muted flex-1 truncate">{phase.name}</span>
                          <div className="w-24 shrink-0">
                            <ProgressBar value={phase.progress} />
                          </div>
                          <span className="text-xs text-pm-muted w-8 text-right">{phase.progress}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* KPIs */}
        {s.show_kpis && (kpis ?? []).length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-pm-text text-lg">Key Performance Indicators</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(kpis ?? []).map((kpi: {
                id: string; name: string; current_value: string | number;
                unit?: string | null; trend?: string | null;
              }) => {
                const trendIcon = kpi.trend === "up" ? "↑" : kpi.trend === "down" ? "↓" : "→";
                const trendColor = kpi.trend === "up" ? "text-emerald-400" : kpi.trend === "down" ? "text-red-400" : "text-pm-muted";
                return (
                  <div key={kpi.id} className="card">
                    <div className="text-xs text-pm-muted mb-1 truncate">{kpi.name}</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-pm-text">{kpi.current_value}</span>
                      {kpi.unit && <span className="text-sm text-pm-muted">{kpi.unit}</span>}
                      <span className={`text-sm ml-1 ${trendColor}`}>{trendIcon}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Proposals */}
        {s.show_proposals && (proposals ?? []).length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-pm-text text-lg">Proposals</h2>
            <div className="card divide-y divide-pm-border/50">
              {(proposals ?? []).map((proposal: {
                id: string; title: string; status: string;
                total_value?: number | null; created_at: string; share_token?: string | null;
              }) => (
                <div key={proposal.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-pm-text">{proposal.title}</p>
                    <p className="text-xs text-pm-muted mt-0.5">
                      {new Date(proposal.created_at).toLocaleDateString()}
                      {proposal.total_value ? ` · $${proposal.total_value.toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${proposalStatusColors[proposal.status] ?? "bg-pm-border text-pm-muted"}`}>
                      {proposal.status}
                    </span>
                    {proposal.share_token && (
                      <a
                        href={`/proposals/share/${proposal.share_token}`}
                        className="text-xs text-pm-accent hover:underline"
                      >
                        View →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Projects */}
        {s.show_projects && completedProjects.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-pm-text text-lg">Completed</h2>
            <div className="card divide-y divide-pm-border/50">
              {completedProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <p className="text-sm text-pm-muted">{project.name}</p>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                    Complete
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {activeProjects.length === 0 && completedProjects.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-pm-muted text-sm">No projects yet. Check back soon.</p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-pm-border text-center text-xs text-pm-muted">
          {preparedBy} · Client Portal
        </div>
      </div>
    </div>
  );
}
