import { getProjects } from "@/lib/queries";
import { ProjectCard } from "@/components/ProjectCard";
import { StatsBar } from "@/components/StatsBar";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await getProjects();

  const totalTasks = projects.reduce((s, p) => s + p.task_count, 0);
  const completeTasks = projects.reduce((s, p) => s + p.complete_tasks, 0);
  const blockedTasks = projects.reduce((s, p) => s + p.blocked_tasks, 0);
  const activeProjects = projects.filter((p) => p.status === "active").length;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-pm-text">Projects</h1>
          <p className="text-pm-muted mt-1">All active projects across your organization</p>
        </div>
        <Link
          href="/projects/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Project
        </Link>
      </div>

      <StatsBar
        stats={[
          { label: "Active Projects", value: activeProjects, color: "text-pm-in-progress" },
          { label: "Total Tasks", value: totalTasks },
          { label: "Completed", value: completeTasks, color: "text-pm-complete" },
          { label: "Blocked", value: blockedTasks, color: "text-pm-blocked" },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-16 text-pm-muted">
          <p className="text-lg mb-2">No projects yet</p>
          <p className="text-sm">Create your first project to get started.</p>
        </div>
      )}
    </div>
  );
}
