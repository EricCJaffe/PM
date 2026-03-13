import { getProject, getPhasesWithTasks, getRisks, getTasks } from "@/lib/queries";
import { StatsBar } from "@/components/StatsBar";
import { PhaseCard } from "@/components/PhaseCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ChatPanel } from "@/components/ChatPanel";
import { RiskTable } from "@/components/RiskTable";
import { TaskTable } from "@/components/TaskTable";
import { TabNav } from "@/components/TabNav";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  const [phases, risks, tasks] = await Promise.all([
    getPhasesWithTasks(project.id),
    getRisks(project.id),
    getTasks(project.id),
  ]);

  const completeTasks = tasks.filter((t) => t.status === "complete").length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;
  const progress = tasks.length > 0 ? Math.round((completeTasks / tasks.length) * 100) : 0;

  // Group phases by group (for SaaS template)
  const phaseGroups = new Map<string | null, typeof phases>();
  for (const phase of phases) {
    const group = phase.group;
    if (!phaseGroups.has(group)) phaseGroups.set(group, []);
    phaseGroups.get(group)!.push(phase);
  }

  return (
    <div className="flex h-screen">
      {/* Left Panel — AI Chat */}
      <div className="w-[400px] min-w-[360px] border-r border-pm-border flex flex-col bg-pm-bg">
        <div className="p-4 border-b border-pm-border">
          <h2 className="text-sm font-medium text-pm-muted">AI Assistant</h2>
        </div>
        <ChatPanel projectId={project.id} projectSlug={project.slug} />
      </div>

      {/* Right Panel — Project Board */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <Link href="/projects" className="text-sm text-pm-muted hover:text-pm-text mb-2 inline-block">
                &larr; Projects
              </Link>
              <h1 className="text-3xl font-bold text-pm-text">{project.name}</h1>
              <p className="text-pm-muted mt-1">{project.description}</p>
            </div>
            <StatusBadge status={project.status} />
          </div>

          {/* Stats */}
          <StatsBar
            stats={[
              { label: "Phases", value: phases.length },
              { label: "Total Tasks", value: tasks.length },
              { label: "In Progress", value: inProgressTasks, color: "text-pm-in-progress" },
              { label: "Completed", value: completeTasks, color: "text-pm-complete" },
              { label: "Blocked", value: blockedTasks, color: "text-pm-blocked" },
              { label: "Progress", value: `${progress}%` },
            ]}
          />

          {/* Tabs */}
          <TabNav
            tabs={[
              {
                id: "board",
                label: "Board",
                content: (
                  <div className="mt-6 space-y-8">
                    {Array.from(phaseGroups.entries()).map(([group, groupPhases]) => (
                      <div key={group ?? "ungrouped"}>
                        {group && (
                          <h2 className="text-sm font-semibold text-pm-muted uppercase tracking-wider mb-3">
                            {group}
                          </h2>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {groupPhases.map((phase) => (
                            <PhaseCard key={phase.id} phase={phase} />
                          ))}
                        </div>
                      </div>
                    ))}
                    {phases.length === 0 && (
                      <p className="text-pm-muted text-center py-8">No phases yet. Use the AI chat to generate project structure.</p>
                    )}
                  </div>
                ),
              },
              {
                id: "tasks",
                label: "Tasks",
                content: <TaskTable tasks={tasks} />,
              },
              {
                id: "risks",
                label: "Risks",
                content: <RiskTable risks={risks} />,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
