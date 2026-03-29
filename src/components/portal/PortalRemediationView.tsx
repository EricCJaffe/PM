"use client";

import { useState, useEffect } from "react";

interface RemediationTask {
  id: string;
  name: string;
  description: string | null;
  status: string;
  phase_name: string;
  phase_order: number;
}

interface ScoreSnapshot {
  overall_grade: string;
  overall_score: number;
  audit_date: string;
}

interface PortalRemediationViewProps {
  workflowId: string;
  orgSlug: string;
  targetScore: number;
  currentScore: number | null;
}

export function PortalRemediationView({
  workflowId,
  targetScore,
  currentScore,
}: PortalRemediationViewProps) {
  const [tasks, setTasks] = useState<RemediationTask[]>([]);
  const [snapshots, setSnapshots] = useState<ScoreSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/pm/site-audit/workflow/${workflowId}`)
      .then((r) => r.json())
      .then((data) => {
        // Flatten phases + tasks
        if (data.phases) {
          const allTasks: RemediationTask[] = [];
          for (const phase of data.phases) {
            if (phase.tasks) {
              for (const t of phase.tasks) {
                allTasks.push({
                  ...t,
                  phase_name: phase.name,
                  phase_order: phase.phase_order,
                });
              }
            }
          }
          setTasks(allTasks);
        }
      })
      .finally(() => setLoading(false));

    // Fetch snapshots for score history
    if (workflowId) {
      fetch(`/api/pm/site-audit/workflow/${workflowId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.snapshots) setSnapshots(data.snapshots);
        })
        .catch(() => {});
    }
  }, [workflowId]);

  const score = currentScore || 0;
  const progress = Math.min(100, Math.round((score / targetScore) * 100));
  const totalTasks = tasks.length;
  const completeTasks = tasks.filter((t) => t.status === "complete").length;
  const taskProgress = totalTasks > 0 ? Math.round((completeTasks / totalTasks) * 100) : 0;

  // Group tasks by phase
  const phaseGroups = tasks.reduce<Record<string, RemediationTask[]>>((acc, t) => {
    if (!acc[t.phase_name]) acc[t.phase_name] = [];
    acc[t.phase_name].push(t);
    return acc;
  }, {});

  if (loading) return <p className="text-pm-muted text-sm py-8">Loading remediation plan...</p>;

  return (
    <div className="space-y-6">
      {/* Score Progress */}
      <div className="bg-pm-card border border-pm-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-pm-muted uppercase tracking-wider mb-4">Score Progress</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-pm-muted mb-1">Current Score</p>
            <p className="text-3xl font-bold text-pm-text">{score}</p>
            <div className="w-full h-2 bg-pm-bg rounded-full mt-2">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: progress >= 100 ? "#22c55e" : "#3b82f6" }}
              />
            </div>
            <p className="text-xs text-pm-muted mt-1">Target: {targetScore}</p>
          </div>
          <div>
            <p className="text-xs text-pm-muted mb-1">Tasks Complete</p>
            <p className="text-3xl font-bold text-pm-text">{completeTasks} / {totalTasks}</p>
            <div className="w-full h-2 bg-pm-bg rounded-full mt-2">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${taskProgress}%` }}
              />
            </div>
            <p className="text-xs text-pm-muted mt-1">{taskProgress}% complete</p>
          </div>
        </div>
      </div>

      {/* Score History */}
      {snapshots.length > 1 && (
        <div className="bg-pm-card border border-pm-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-pm-muted uppercase tracking-wider mb-3">Score History</h3>
          <div className="space-y-2">
            {snapshots.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-pm-muted">{new Date(s.audit_date).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-pm-text">{s.overall_score}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-pm-bg text-pm-muted">{s.overall_grade}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Checklist by Phase */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-pm-muted uppercase tracking-wider">Remediation Tasks</h3>
        {Object.entries(phaseGroups).map(([phaseName, phaseTasks]) => {
          const phaseComplete = phaseTasks.every((t) => t.status === "complete");
          const phaseCount = phaseTasks.filter((t) => t.status === "complete").length;

          return (
            <div key={phaseName} className="bg-pm-card border border-pm-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-pm-bg/50 border-b border-pm-border">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${phaseComplete ? "bg-emerald-400" : "bg-blue-400"}`} />
                  <h4 className="text-sm font-medium text-pm-text">{phaseName}</h4>
                </div>
                <span className="text-xs text-pm-muted">{phaseCount} / {phaseTasks.length}</span>
              </div>
              <div className="divide-y divide-pm-border/50">
                {phaseTasks.map((t) => (
                  <div key={t.id} className="px-4 py-3 flex items-start gap-3">
                    <span className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${
                      t.status === "complete"
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                        : "border-pm-border"
                    }`}>
                      {t.status === "complete" && "✓"}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm ${t.status === "complete" ? "text-pm-muted line-through" : "text-pm-text"}`}>
                        {t.name}
                      </p>
                      {t.description && t.status !== "complete" && (
                        <p className="text-xs text-pm-muted mt-0.5 line-clamp-2">{t.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
