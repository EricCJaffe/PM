import { getProject, getPhasesWithTasks, getRisks, getTasks } from "@/lib/queries";
import { StatsBar } from "@/components/StatsBar";
import { ChatPanel } from "@/components/ChatPanel";
import { TabNav } from "@/components/TabNav";
import { EditProjectHeader } from "@/components/EditProjectHeader";
import { PhaseBoard } from "@/components/PhaseBoard";
import { EditableTaskTable } from "@/components/EditableTaskTable";
import { EditableRiskTable } from "@/components/EditableRiskTable";
import { SaveAsTemplateButton } from "@/components/SaveAsTemplateButton";
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
          <Link href="/projects" className="text-sm text-pm-muted hover:text-pm-text mb-4 inline-block">
            &larr; Projects
          </Link>

          <EditProjectHeader project={project} />
          <div className="flex justify-end -mt-4 mb-4">
            <SaveAsTemplateButton project={project} />
          </div>

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

          <TabNav
            tabs={[
              {
                id: "board",
                label: "Board",
                content: <PhaseBoard phases={phases} projectId={project.id} />,
              },
              {
                id: "tasks",
                label: `Tasks (${tasks.length})`,
                content: <EditableTaskTable tasks={tasks} phases={phases} projectId={project.id} />,
              },
              {
                id: "risks",
                label: `Risks (${risks.length})`,
                content: <EditableRiskTable risks={risks} projectId={project.id} />,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
