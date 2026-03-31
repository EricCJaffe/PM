"use client";

import { useState } from "react";
import Link from "next/link";
import type { Organization, ProjectWithStats, PhaseWithTasks } from "@/types/pm";
import { ProgressBar } from "../ProgressBar";
import { StatusBadge } from "../StatusBadge";
import { ClientTasksTab } from "./ClientTasksTab";

export function ProjectsTab({
  org,
  projects,
  allPhases,
}: {
  org: Organization;
  projects: ProjectWithStats[];
  allPhases: { project: ProjectWithStats; phases: PhaseWithTasks[] }[];
}) {
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | "all">("all");

  const filtered = selectedProject === "all"
    ? allPhases
    : allPhases.filter((p) => p.project.id === selectedProject);

  async function generateInsights() {
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/pm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Analyze the current state of all projects for org "${org.name}" and provide brief insights:
- Which projects are on track vs at risk?
- Any blocked tasks that need attention?
- Key milestones coming up
- Overall health assessment
Keep it concise — 3-5 bullet points max.`,
          }],
          org_id: org.id,
        }),
      });
      const data = await res.json();
      setInsights(data.reply || data.message || "Unable to generate insights.");
    } catch {
      setInsights("Failed to generate insights. Please try again.");
    } finally {
      setInsightsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* AI Project Insights */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-pm-text">Project Insights</h3>
          <button
            onClick={generateInsights}
            disabled={insightsLoading}
            className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {insightsLoading ? "Analyzing..." : insights ? "Refresh" : "Generate AI Insights"}
          </button>
        </div>
        {insights ? (
          <div className="text-sm text-pm-text prose prose-sm prose-invert max-w-none whitespace-pre-wrap">{insights}</div>
        ) : (
          <p className="text-sm text-pm-muted">Click &quot;Generate AI Insights&quot; for an AI analysis of project health, blockers, and priorities.</p>
        )}
      </div>

      {/* Project Cards */}
      <div>
        <h3 className="font-semibold text-pm-text mb-4">Projects</h3>
        {projects.length === 0 ? (
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

      {/* Implementation Plan */}
      {allPhases.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-pm-text">Implementation Plan</h3>
            {allPhases.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedProject("all")}
                  className={`px-3 py-1 rounded text-xs ${
                    selectedProject === "all" ? "bg-pm-accent text-white" : "text-pm-muted hover:text-pm-text border border-pm-border"
                  }`}
                >
                  All
                </button>
                {allPhases.map(({ project }) => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProject(project.id)}
                    className={`px-3 py-1 rounded text-xs ${
                      selectedProject === project.id ? "bg-pm-accent text-white" : "text-pm-muted hover:text-pm-text border border-pm-border"
                    }`}
                  >
                    {project.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {filtered.map(({ project, phases }) => (
              <div key={project.id}>
                {filtered.length > 1 && (
                  <div className="flex items-center justify-between mb-3">
                    <Link href={`/projects/${project.slug}`} className="font-medium text-pm-text hover:text-pm-accent text-sm">
                      {project.name} &rarr;
                    </Link>
                    <span className="text-xs text-pm-muted">{project.overall_progress}%</span>
                  </div>
                )}
                <div className="space-y-3">
                  {phases.map((phase) => {
                    const complete = phase.tasks.filter((t) => t.status === "complete").length;
                    const total = phase.tasks.length;
                    const progress = total > 0 ? Math.round((complete / total) * 100) : phase.progress;

                    return (
                      <div key={phase.id} className="card">
                        <div className="flex items-center gap-4">
                          <div className="w-48 shrink-0">
                            <span className="text-sm font-medium text-pm-text">{phase.name}</span>
                            {phase.owner && <div className="text-xs text-pm-muted mt-0.5">{phase.owner}</div>}
                          </div>
                          <div className="flex-1">
                            <ProgressBar value={progress} />
                          </div>
                          <span className="text-xs text-pm-muted w-10 text-right shrink-0">{progress}%</span>
                          <StatusBadge status={phase.status} />
                        </div>
                        {phase.tasks.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-pm-border/50 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {phase.tasks.map((task) => {
                              const dot: Record<string, string> = {
                                "complete": "bg-pm-complete",
                                "in-progress": "bg-pm-in-progress",
                                "blocked": "bg-pm-blocked",
                                "not-started": "bg-pm-not-started",
                              };
                              return (
                                <div key={task.id} className="flex items-center gap-1.5 text-xs">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${dot[task.status] ?? "bg-pm-not-started"}`} />
                                  <span className="text-pm-muted truncate">{task.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks */}
      <div>
        <h3 className="font-semibold text-pm-text mb-4">Tasks</h3>
        <ClientTasksTab org={org} />
      </div>
    </div>
  );
}
