import { getShareTokenData, getOrganizations, getProjects, getProcessMaps, getOpportunities, getKPIs, getPhasesWithTasks } from "@/lib/queries";
import { getBranding, buildPreparedBy } from "@/lib/branding";
import { notFound } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shareToken = await getShareTokenData(token);
  if (!shareToken) notFound();

  // Get org info
  const orgs = await getOrganizations();
  const org = orgs.find((o) => o.id === shareToken.org_id);
  if (!org) notFound();

  const [projects, processMaps, opportunities, kpis, branding] = await Promise.all([
    getProjects(org.id),
    getProcessMaps(org.id),
    getOpportunities(org.id),
    getKPIs(org.id),
    getBranding(org.id),
  ]);
  const preparedBy = buildPreparedBy(branding);

  // Filter to specific project if token is project-scoped
  const filteredProjects = shareToken.project_id
    ? projects.filter((p) => p.id === shareToken.project_id)
    : projects;

  const totalTasks = filteredProjects.reduce((sum, p) => sum + p.task_count, 0);
  const completeTasks = filteredProjects.reduce((sum, p) => sum + p.complete_tasks, 0);
  const overallProgress = totalTasks > 0 ? Math.round((completeTasks / totalTasks) * 100) : 0;
  const totalSavings = opportunities.filter((o) => o.status !== "declined").reduce((sum, o) => sum + (o.estimated_savings || 0), 0);

  // Get phases for implementation view
  const allPhases = [];
  for (const project of filteredProjects) {
    const phases = await getPhasesWithTasks(project.id);
    allPhases.push({ project, phases });
  }

  const statusDot: Record<string, string> = {
    "complete": "bg-pm-complete",
    "in-progress": "bg-pm-in-progress",
    "not-started": "bg-pm-not-started",
  };

  const complexityColors: Record<string, string> = {
    low: "bg-pm-complete/20 text-pm-complete",
    medium: "bg-pm-in-progress/20 text-pm-in-progress",
    high: "bg-pm-blocked/20 text-pm-blocked",
  };

  return (
    <div className="min-h-screen bg-pm-bg">
      {/* Header */}
      <div className="border-b border-pm-border bg-pm-card/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {branding.co_brand_mode !== "client-only" && branding.agency_logo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={branding.agency_logo_url} alt={branding.agency_name} className="h-8 object-contain" />
            )}
            {branding.co_brand_mode !== "agency-only" && branding.client_logo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={branding.client_logo_url} alt={branding.client_name ?? org.name} className="h-8 object-contain" />
            )}
            <div>
              <div className="text-sm text-pm-muted font-medium">{preparedBy}</div>
              <h1 className="text-2xl font-bold text-pm-text">{org.name}</h1>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-pm-complete/20 text-pm-complete text-xs rounded-full font-medium">
            Live
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <div className="text-2xl font-bold text-pm-text">
              ${totalSavings >= 1000 ? `${Math.round(totalSavings / 1000)}K` : totalSavings}
            </div>
            <div className="text-xs text-pm-muted mt-1">Projected Annual Savings</div>
          </div>
          <div className="card">
            <div className="text-2xl font-bold text-pm-text">{overallProgress}%</div>
            <div className="text-xs text-pm-muted mt-1">Implementation Complete</div>
          </div>
          <div className="card">
            <div className="text-2xl font-bold text-pm-text">{opportunities.length}</div>
            <div className="text-xs text-pm-muted mt-1">Automation Opportunities</div>
          </div>
          <div className="card">
            <div className="text-2xl font-bold text-pm-text">{processMaps.length}</div>
            <div className="text-xs text-pm-muted mt-1">Process Maps</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Process Maps */}
          {processMaps.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-pm-text mb-4">Process Maps</h3>
              <div className="space-y-4">
                {processMaps.map((pm) => (
                  <div key={pm.id}>
                    <div className="text-sm font-medium text-pm-text mb-2">{pm.name}</div>
                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                      {pm.steps.map((step, i) => (
                        <div key={step.id} className="flex items-center gap-1 shrink-0">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-pm-surface border border-pm-border rounded-full text-xs">
                            <span className={`w-2 h-2 rounded-full ${statusDot[step.status] ?? "bg-pm-not-started"}`} />
                            <span className="text-pm-text">{step.name}</span>
                          </div>
                          {i < pm.steps.length - 1 && <span className="text-pm-muted text-xs">&rarr;</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opportunities */}
          {opportunities.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-pm-text mb-4">Automation Opportunities</h3>
              <div className="space-y-3">
                {opportunities.slice(0, 6).map((opp) => (
                  <div key={opp.id} className="flex items-center justify-between py-2 border-b border-pm-border/50 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-pm-text">{opp.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${complexityColors[opp.complexity]}`}>{opp.complexity}</span>
                        {opp.estimated_timeline && <span className="text-xs text-pm-muted">~{opp.estimated_timeline}</span>}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-pm-text ml-4">
                      ${opp.estimated_savings >= 1000 ? `${Math.round(opp.estimated_savings / 1000)}K` : opp.estimated_savings}/yr
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Implementation Progress */}
        {allPhases.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-pm-text mb-4">Implementation Progress</h3>
            <div className="space-y-6">
              {allPhases.map(({ project, phases }) => (
                <div key={project.id}>
                  {allPhases.length > 1 && (
                    <div className="text-sm font-medium text-pm-text mb-3">{project.name}</div>
                  )}
                  <div className="space-y-2">
                    {phases.map((phase) => {
                      const complete = phase.tasks.filter((t) => t.status === "complete").length;
                      const total = phase.tasks.length;
                      const progress = total > 0 ? Math.round((complete / total) * 100) : phase.progress;
                      return (
                        <div key={phase.id} className="flex items-center gap-4">
                          <span className="text-sm text-pm-muted w-48 truncate shrink-0">{phase.name}</span>
                          <div className="flex-1"><ProgressBar value={progress} /></div>
                          <span className="text-sm text-pm-muted w-12 text-right shrink-0">{progress}%</span>
                          <StatusBadge status={phase.status} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPIs */}
        {kpis.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-pm-text mb-4">Key Performance Indicators</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpis.map((kpi) => {
                const trendIcon = kpi.trend === "up" ? "↑" : kpi.trend === "down" ? "↓" : "→";
                const trendColor = kpi.trend === "up" ? "text-pm-complete" : kpi.trend === "down" ? "text-pm-blocked" : "text-pm-muted";
                return (
                  <div key={kpi.id} className="card">
                    <div className="text-xs text-pm-muted mb-1">{kpi.name}</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-pm-text">{kpi.current_value}</span>
                      {kpi.unit && <span className="text-sm text-pm-muted">{kpi.unit}</span>}
                      <span className={`text-sm ${trendColor}`}>{trendIcon}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-pm-border text-center text-xs text-pm-muted">
          Powered by BusinessOS
        </div>
      </div>
    </div>
  );
}
