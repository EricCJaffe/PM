"use client";
import { useState } from "react";
import Link from "next/link";
import type { Organization, ProjectWithStats, ProcessMap, PhaseWithTasks, KPI } from "@/types/pm";
import { ProgressBar } from "../ProgressBar";
import { StatusBadge } from "../StatusBadge";
import { ProcessMapsTab } from "./ProcessMapsTab";
import { VocabTab } from "./VocabTab";
import { KPIsTab } from "./KPIsTab";
import { GapAnalysisTab } from "./GapAnalysisTab";

type SubTab = "implementation" | "process-maps" | "vocab" | "kpis" | "gap-analysis";

export function ProcessAnalyzerTab({
  org,
  allPhases,
  processMaps,
  projects,
  selectedProjectId,
  kpis,
  onBack,
}: {
  org: Organization;
  allPhases: { project: ProjectWithStats; phases: PhaseWithTasks[] }[];
  processMaps: ProcessMap[];
  projects: ProjectWithStats[];
  selectedProjectId: string | null;
  kpis: KPI[];
  onBack: () => void;
}) {
  const [subTab, setSubTab] = useState<SubTab>("implementation");

  const subTabs: { id: SubTab; label: string }[] = [
    { id: "implementation", label: "Implementation Plan" },
    { id: "process-maps", label: "Process Maps" },
    { id: "gap-analysis", label: "Gap Analysis" },
    { id: "vocab", label: "Vocabulary" },
    { id: "kpis", label: "KPIs" },
  ];

  return (
    <div>
      {/* Back button + title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-pm-muted hover:text-pm-accent transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Workflows
        </button>
        <div className="h-5 w-px bg-pm-border" />
        <h3 className="text-lg font-semibold text-pm-text">Process Analyzer</h3>
      </div>

      {/* Sub-tab selector */}
      <div className="flex gap-1 mb-6 border-b border-pm-border overflow-x-auto">
        {subTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              subTab === t.id
                ? "border-pm-accent text-pm-accent"
                : "border-transparent text-pm-muted hover:text-pm-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "implementation" && <ImplementationContent allPhases={allPhases} />}
      {subTab === "process-maps" && (
        <ProcessMapsTab
          org={org}
          processMaps={processMaps}
          projects={projects}
          selectedProjectId={selectedProjectId}
        />
      )}
      {subTab === "gap-analysis" && <GapAnalysisTab org={org} />}
      {subTab === "vocab" && <VocabTab org={org} />}
      {subTab === "kpis" && <KPIsTab org={org} kpis={kpis} projects={projects} selectedProjectId={selectedProjectId} />}
    </div>
  );
}

/* ── Implementation sub-tab ── */
function ImplementationContent({
  allPhases,
}: {
  allPhases: { project: ProjectWithStats; phases: PhaseWithTasks[] }[];
}) {
  const [selectedProject, setSelectedProject] = useState<string | "all">("all");

  const filtered =
    selectedProject === "all"
      ? allPhases
      : allPhases.filter((p) => p.project.id === selectedProject);

  return (
    <div>
      {allPhases.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-pm-muted">Project:</span>
          <button
            onClick={() => setSelectedProject("all")}
            className={`px-3 py-1 rounded text-sm ${
              selectedProject === "all"
                ? "bg-pm-accent text-white"
                : "text-pm-muted hover:text-pm-text border border-pm-border"
            }`}
          >
            All
          </button>
          {allPhases.map(({ project }) => (
            <button
              key={project.id}
              onClick={() => setSelectedProject(project.id)}
              className={`px-3 py-1 rounded text-sm ${
                selectedProject === project.id
                  ? "bg-pm-accent text-white"
                  : "text-pm-muted hover:text-pm-text border border-pm-border"
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
                <Link
                  href={`/projects/${project.slug}`}
                  className="font-semibold text-pm-text hover:text-pm-accent transition-colors"
                >
                  {project.name} &rarr;
                </Link>
                <span className="text-sm text-pm-muted">
                  {project.overall_progress}% complete
                </span>
              </div>
              <div className="space-y-3">
                {phases.map((phase) => {
                  const complete = phase.tasks.filter(
                    (t) => t.status === "complete"
                  ).length;
                  const total = phase.tasks.length;
                  const progress =
                    total > 0
                      ? Math.round((complete / total) * 100)
                      : phase.progress;

                  return (
                    <Link
                      key={phase.id}
                      href={`/projects/${project.slug}`}
                      className="card block hover:border-pm-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-64 shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-pm-text">
                              {phase.name}
                            </span>
                          </div>
                          {phase.owner && (
                            <div className="text-xs text-pm-muted mt-0.5">
                              Owner: {phase.owner}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <ProgressBar value={progress} />
                        </div>
                        <span className="text-sm text-pm-muted w-12 text-right shrink-0">
                          {progress}%
                        </span>
                        <StatusBadge status={phase.status} />
                      </div>
                      {phase.tasks.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-pm-border/50 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {phase.tasks.map((task) => {
                            const dot: Record<string, string> = {
                              complete: "bg-pm-complete",
                              "in-progress": "bg-pm-in-progress",
                              blocked: "bg-pm-blocked",
                              "not-started": "bg-pm-not-started",
                            };
                            return (
                              <div
                                key={task.id}
                                className="flex items-center gap-1.5 text-xs"
                              >
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    dot[task.status] ?? "bg-pm-not-started"
                                  }`}
                                />
                                <span className="text-pm-muted truncate">
                                  {task.name}
                                </span>
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
