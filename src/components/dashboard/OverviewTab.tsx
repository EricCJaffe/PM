"use client";
import Link from "next/link";
import type { Organization, ProjectWithStats, ProcessMap, Opportunity, PhaseWithTasks } from "@/types/pm";
import { ProgressBar } from "../ProgressBar";

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

      {/* Implementation Progress */}
      <div className="card lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-pm-text">Implementation Progress</h3>
        </div>
        {allPhases.length === 0 ? (
          <p className="text-sm text-pm-muted py-4">No projects yet.</p>
        ) : (
          <div className="space-y-6">
            {allPhases.map(({ project, phases }) => (
              <div key={project.id}>
                <Link
                  href={`/projects/${project.slug}`}
                  className="text-sm font-medium text-pm-text hover:text-pm-accent transition-colors mb-3 inline-block"
                >
                  {project.name} &rarr;
                </Link>
                <div className="space-y-2">
                  {phases.map((phase) => {
                    const complete = phase.tasks.filter((t) => t.status === "complete").length;
                    const total = phase.tasks.length;
                    const progress = total > 0 ? Math.round((complete / total) * 100) : phase.progress;
                    const statusLabel = progress === 100
                      ? "Complete"
                      : progress > 0
                        ? "In Progress"
                        : phase.status === "not-started"
                          ? "Upcoming"
                          : phase.status;
                    return (
                      <Link
                        key={phase.id}
                        href={`/projects/${project.slug}`}
                        className="flex items-center gap-4 rounded-lg px-2 py-1 -mx-2 hover:bg-pm-surface transition-colors cursor-pointer"
                      >
                        <span className="text-sm text-pm-muted w-48 truncate shrink-0">{phase.name}</span>
                        <div className="flex-1">
                          <ProgressBar value={progress} />
                        </div>
                        <span className="text-sm text-pm-muted w-12 text-right shrink-0">{progress}%</span>
                        <span className={`text-xs w-20 text-right shrink-0 ${
                          statusLabel === "Complete" ? "text-pm-complete"
                            : statusLabel === "In Progress" ? "text-pm-in-progress"
                              : "text-pm-muted"
                        }`}>
                          {statusLabel}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
