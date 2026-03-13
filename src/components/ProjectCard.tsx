import Link from "next/link";
import type { ProjectWithStats } from "@/types/pm";
import { StatusBadge } from "./StatusBadge";
import { ProgressBar } from "./ProgressBar";

export function ProjectCard({ project }: { project: ProjectWithStats }) {
  return (
    <Link href={`/projects/${project.slug}`}>
      <div className="card hover:border-pm-muted/50 transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg text-pm-text">{project.name}</h3>
            <p className="text-sm text-pm-muted mt-0.5">{project.description}</p>
          </div>
          <StatusBadge status={project.status} />
        </div>
        <ProgressBar value={project.overall_progress} className="mb-3" />
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <div className="font-medium text-pm-text">{project.phase_count}</div>
            <div className="text-pm-muted">Phases</div>
          </div>
          <div>
            <div className="font-medium text-pm-text">{project.task_count}</div>
            <div className="text-pm-muted">Tasks</div>
          </div>
          <div>
            <div className="font-medium text-pm-complete">{project.complete_tasks}</div>
            <div className="text-pm-muted">Done</div>
          </div>
          <div>
            <div className="font-medium text-pm-blocked">{project.blocked_tasks}</div>
            <div className="text-pm-muted">Blocked</div>
          </div>
        </div>
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-pm-border text-xs text-pm-muted">
          <span>Owner: {project.owner || "Unassigned"}</span>
          <span>{project.overall_progress}% complete</span>
        </div>
      </div>
    </Link>
  );
}
