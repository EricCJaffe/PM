"use client";
import { useState } from "react";
import Link from "next/link";
import type { ProjectWithStats, PhaseWithTasks } from "@/types/pm";
import { ProgressBar } from "../ProgressBar";
import { StatusBadge } from "../StatusBadge";

export function ImplementationTab({
  allPhases,
}: {
  allPhases: { project: ProjectWithStats; phases: PhaseWithTasks[] }[];
}) {
  const [selectedProject, setSelectedProject] = useState<string | "all">("all");

  const filtered = selectedProject === "all"
    ? allPhases
    : allPhases.filter((p) => p.project.id === selectedProject);

  return (
    <div>
      {/* Project filter */}
      {allPhases.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-pm-muted">Project:</span>
          <button
            onClick={() => setSelectedProject("all")}
            className={`px-3 py-1 rounded text-sm ${
              selectedProject === "all" ? "bg-pm-accent text-white" : "text-pm-muted hover:text-pm-text border border-pm-border"
            }`}
          >
            All
          </button>
          {allPhases.map(({ project }) => (
            <button
              key={project.id}
              onClick={() => setSelectedProject(project.id)}
              className={`px-3 py-1 rounded text-sm ${
                selectedProject === project.id ? "bg-pm-accent text-white" : "text-pm-muted hover:text-pm-text border border-pm-border"
              }`}
            >
              {project.name}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-pm-muted">No projects to show.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {filtered.map(({ project, phases }) => (
            <div key={project.id}>
              <div className="flex items-center justify-between mb-4">
                <Link href={`/projects/${project.slug}`} className="font-semibold text-pm-text hover:text-pm-accent transition-colors">
                  {project.name} &rarr;
                </Link>
                <span className="text-sm text-pm-muted">{project.overall_progress}% complete</span>
              </div>
              <div className="space-y-3">
                {phases.map((phase) => {
                  const complete = phase.tasks.filter((t) => t.status === "complete").length;
                  const total = phase.tasks.length;
                  const progress = total > 0 ? Math.round((complete / total) * 100) : phase.progress;

                  return (
                    <Link
                      key={phase.id}
                      href={`/projects/${project.slug}`}
                      className="card block hover:border-pm-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-64 shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-pm-text">{phase.name}</span>
                          </div>
                          {phase.owner && <div className="text-xs text-pm-muted mt-0.5">Owner: {phase.owner}</div>}
                        </div>
                        <div className="flex-1">
                          <ProgressBar value={progress} />
                        </div>
                        <span className="text-sm text-pm-muted w-12 text-right shrink-0">{progress}%</span>
                        <StatusBadge status={phase.status} />
                      </div>
                      {/* Task breakdown */}
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
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
