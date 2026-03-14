"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectWithStats } from "@/types/pm";
import { StatusBadge } from "./StatusBadge";
import { ProgressBar } from "./ProgressBar";

export function ProjectCard({ project }: { project: ProjectWithStats }) {
  const router = useRouter();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;

    const res = await fetch(`/api/pm/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const { error } = await res.json();
      alert(`Delete failed: ${error}`);
    }
  }

  return (
    <div className="relative group">
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
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded z-10"
      >
        Delete
      </button>
    </div>
  );
}
