"use client";

import { useState, useEffect } from "react";

interface Phase {
  id: string;
  name: string;
  slug: string;
  status: string;
  phase_order: number;
}

interface Task {
  id: string;
  name: string;
  description: string | null;
  status: string;
  phase_id: string;
}

interface PortalRebuildWizardProps {
  workflowId: string;
  orgSlug: string;
  primaryColor: string;
}

const STEP_MAP: Record<string, number> = {
  "client-intake": 0,
  "admin-discovery": 1,
  "design-direction": 1,
  "site-architecture": 1,
  "content-capture": 2,
  "build": 2,
  "review": 2,
  "launch": 3,
};

const STEPS = [
  { label: "Tell Us About You", description: "Share your basics so we can get started." },
  { label: "Review Site Plan", description: "Approve the sitemap and design direction." },
  { label: "Review Drafts", description: "Review page content and provide feedback." },
  { label: "Launch", description: "Final checks and go live." },
];

export function PortalRebuildWizard({
  workflowId,
  primaryColor,
}: PortalRebuildWizardProps) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/pm/site-audit/workflow/${workflowId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.phases) setPhases(data.phases);
        // Flatten tasks from all phases
        const allTasks: Task[] = [];
        if (data.phases) {
          for (const p of data.phases) {
            if (p.tasks) {
              for (const t of p.tasks) {
                allTasks.push({ ...t, phase_id: p.id });
              }
            }
          }
        }
        setTasks(allTasks);
      })
      .finally(() => setLoading(false));
  }, [workflowId]);

  // Determine current step based on phase statuses
  const currentStep = (() => {
    for (const phase of [...phases].reverse()) {
      if (phase.status === "in-progress" || phase.status === "not-started") {
        return STEP_MAP[phase.slug] ?? 0;
      }
    }
    // All complete
    return 3;
  })();

  if (loading) return <p className="text-pm-muted text-sm py-8">Loading project...</p>;

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                  i < currentStep
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                    : i === currentStep
                    ? "text-white"
                    : "border-pm-border text-pm-muted"
                }`}
                style={i === currentStep ? { borderColor: primaryColor, backgroundColor: `${primaryColor}33`, color: primaryColor } : {}}
              >
                {i < currentStep ? "✓" : i + 1}
              </div>
              <span className={`text-xs mt-1 text-center ${
                i === currentStep ? "text-pm-text font-medium" : "text-pm-muted"
              }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 -mt-4 ${i < currentStep ? "bg-emerald-500" : "bg-pm-border"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Current Step Content */}
      <div className="bg-pm-card border border-pm-border rounded-lg p-5">
        <h3 className="text-lg font-semibold text-pm-text mb-1">{STEPS[currentStep].label}</h3>
        <p className="text-sm text-pm-muted mb-4">{STEPS[currentStep].description}</p>

        {/* Show tasks for current step's phases */}
        <div className="space-y-3">
          {phases
            .filter((p) => (STEP_MAP[p.slug] ?? -1) === currentStep)
            .map((phase) => {
              const phaseTasks = tasks.filter((t) => t.phase_id === phase.id);
              return (
                <div key={phase.id}>
                  {phaseTasks.map((t) => (
                    <div key={t.id} className="flex items-start gap-3 py-2 border-b border-pm-border/30 last:border-0">
                      <span className={`mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center text-xs ${
                        t.status === "complete"
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                          : t.status === "in-progress"
                          ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                          : "border-pm-border"
                      }`}>
                        {t.status === "complete" && "✓"}
                        {t.status === "in-progress" && "●"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${t.status === "complete" ? "text-pm-muted line-through" : "text-pm-text"}`}>
                          {t.name}
                        </p>
                        {t.description && t.status !== "complete" && (
                          <p className="text-xs text-pm-muted mt-0.5">{t.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
        </div>
      </div>

      {/* All Phases Overview */}
      <div className="bg-pm-card border border-pm-border rounded-lg p-5">
        <h4 className="text-sm font-semibold text-pm-muted uppercase tracking-wider mb-3">Project Phases</h4>
        <div className="space-y-2">
          {phases.map((p) => {
            const phaseTasks = tasks.filter((t) => t.phase_id === p.id);
            const done = phaseTasks.filter((t) => t.status === "complete").length;
            const total = phaseTasks.length;
            return (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    p.status === "complete" ? "bg-emerald-400" :
                    p.status === "in-progress" ? "bg-blue-400" :
                    "bg-gray-500"
                  }`} />
                  <span className="text-pm-text">{p.name}</span>
                </div>
                <span className="text-xs text-pm-muted">{done}/{total}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
