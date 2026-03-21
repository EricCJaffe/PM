"use client";
import Link from "next/link";
import type { Organization, ProjectWithStats, ProcessMap, Opportunity, PhaseWithTasks } from "@/types/pm";
import { ProgressBar } from "../ProgressBar";
import { StandupWidget } from "../StandupWidget";

export function OverviewTab({
  org,
  projects,
  processMaps,
  opportunities,
  allPhases,
}: {
  org: Organization;
  projects: ProjectWithStats[];
  processMaps: ProcessMap[];
  opportunities: Opportunity[];
  allPhases: { project: ProjectWithStats; phases: PhaseWithTasks[] }[];
}) {
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
    <div className="space-y-6">
      {/* Morning Standup */}
      <StandupWidget orgId={org.id} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Process Maps Preview */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-pm-text">Process Maps</h3>
          <span className="text-xs text-pm-muted">{processMaps.length} maps</span>
        </div>
        {processMaps.length === 0 ? (
          <p className="text-sm text-pm-muted py-4">No process maps yet.</p>
        ) : (
          <div className="space-y-4">
            {/* Department filters */}
            {(() => {
              const depts = [...new Set(processMaps.map((pm) => pm.department).filter(Boolean))] as string[];
              return depts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {depts.map((d) => (
                    <span key={d} className="px-2 py-0.5 bg-pm-surface border border-pm-border rounded text-xs text-pm-muted">{d}</span>
                  ))}
                </div>
              ) : null;
            })()}
            {/* First 3 process maps as flows */}
            {processMaps.slice(0, 3).map((pm) => (
              <div key={pm.id}>
                <div className="text-sm font-medium text-pm-text mb-2">{pm.name}</div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {pm.steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-1 shrink-0">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-pm-surface border border-pm-border rounded-full text-xs">
                        <span className={`w-2 h-2 rounded-full ${statusDot[step.status] ?? "bg-pm-not-started"}`} />
                        <span className="text-pm-text">{step.name}</span>
                      </div>
                      {i < pm.steps.length - 1 && (
                        <span className="text-pm-muted text-xs">&rarr;</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Opportunities by Savings */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-pm-text">Top Opportunities</h3>
          <span className="text-xs text-pm-muted">{opportunities.length} total</span>
        </div>
        {opportunities.length === 0 ? (
          <p className="text-sm text-pm-muted py-4">No opportunities identified yet.</p>
        ) : (
          <div className="space-y-3">
            {opportunities.slice(0, 5).map((opp) => (
              <div key={opp.id} className="flex items-center justify-between py-2 border-b border-pm-border/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-pm-text">{opp.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${complexityColors[opp.complexity]}`}>
                      {opp.complexity} complexity
                    </span>
                    {opp.estimated_timeline && (
                      <span className="text-xs text-pm-muted">~{opp.estimated_timeline}</span>
                    )}
                  </div>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <div className="text-sm font-semibold text-pm-text">
                    ${opp.estimated_savings >= 1000
                      ? `${Math.round(opp.estimated_savings / 1000)}K`
                      : opp.estimated_savings}
                    <span className="text-xs text-pm-muted font-normal">/{opp.savings_unit === "year" ? "yr" : opp.savings_unit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Cards */}
      <div className="lg:col-span-2">
        <h3 className="font-semibold text-pm-text mb-4">Projects</h3>
        {allPhases.length === 0 ? (
          <div className="card">
            <p className="text-sm text-pm-muted py-4">No projects yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allPhases.map(({ project, phases }) => {
              const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
              const completeTasks = phases.reduce((sum, p) => sum + p.tasks.filter((t) => t.status === "complete").length, 0);
              const blockedTasks = phases.reduce((sum, p) => sum + p.tasks.filter((t) => t.status === "blocked").length, 0);
              const progress = totalTasks > 0 ? Math.round((completeTasks / totalTasks) * 100) : 0;
              const statusLabel = progress === 100 ? "Complete" : progress > 0 ? "In Progress" : "Not Started";
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.slug}`}
                  className="card hover:border-pm-accent/50 transition-colors cursor-pointer block"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-pm-text">{project.name}</h4>
                      {project.description && (
                        <p className="text-xs text-pm-muted mt-1 line-clamp-2">{project.description}</p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2 ${
                      statusLabel === "Complete" ? "bg-pm-complete/20 text-pm-complete"
                        : statusLabel === "In Progress" ? "bg-pm-in-progress/20 text-pm-in-progress"
                          : "bg-pm-not-started/20 text-pm-muted"
                    }`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mb-3">
                    <ProgressBar value={progress} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="text-sm font-semibold text-pm-text">{phases.length}</div>
                      <div className="text-xs text-pm-muted">Phases</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-pm-text">{totalTasks}</div>
                      <div className="text-xs text-pm-muted">Tasks</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-pm-complete">{completeTasks}</div>
                      <div className="text-xs text-pm-muted">Done</div>
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${blockedTasks > 0 ? "text-pm-blocked" : "text-pm-text"}`}>{blockedTasks}</div>
                      <div className="text-xs text-pm-muted">Blocked</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-pm-border/50 flex items-center justify-between">
                    <span className="text-xs text-pm-muted">{project.owner || "Unassigned"}</span>
                    <span className="text-xs text-pm-accent font-medium">{progress}% complete &rarr;</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
