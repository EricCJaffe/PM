import type { PhaseWithTasks } from "@/types/pm";
import { StatusBadge } from "./StatusBadge";
import { ProgressBar } from "./ProgressBar";

export function PhaseCard({ phase }: { phase: PhaseWithTasks }) {
  const complete = phase.tasks.filter((t) => t.status === "complete").length;
  const total = phase.tasks.length;
  const progress = total > 0 ? Math.round((complete / total) * 100) : phase.progress;

  return (
    <div className="card hover:border-pm-muted/50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-xs text-pm-muted font-mono">
            P{String(phase.phase_order).padStart(2, "0")}
          </span>
          {phase.group && (
            <span className="text-xs text-pm-muted ml-2 uppercase tracking-wider">
              {phase.group}
            </span>
          )}
        </div>
        <StatusBadge status={phase.status} />
      </div>
      <h3 className="font-semibold text-pm-text mb-2">{phase.name}</h3>
      <ProgressBar value={progress} className="mb-2" />
      <div className="flex justify-between text-xs text-pm-muted">
        <span>{complete}/{total} tasks</span>
        <span>{progress}%</span>
      </div>
      {phase.tasks.length > 0 && (
        <div className="mt-3 space-y-1">
          {phase.tasks.slice(0, 5).map((task) => (
            <div key={task.id} className="flex items-center gap-2 text-sm">
              <span
                className={`w-2 h-2 rounded-full ${
                  task.status === "complete"
                    ? "bg-pm-complete"
                    : task.status === "in-progress"
                      ? "bg-pm-in-progress"
                      : task.status === "blocked"
                        ? "bg-pm-blocked"
                        : "bg-pm-not-started"
                }`}
              />
              <span className="text-pm-text/80 truncate">{task.name}</span>
            </div>
          ))}
          {phase.tasks.length > 5 && (
            <div className="text-xs text-pm-muted">
              +{phase.tasks.length - 5} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
