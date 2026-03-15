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
    <div className="min-h-screen overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <Link href="/projects" className="text-sm text-pm-muted hover:text-pm-text mb-4 inline-block">
          &larr; Projects
        </Link>

        {/* Compact AI Chat Card */}
        <div className="card mb-4">
          <ChatPanel projectId={project.id} projectSlug={project.slug} compact />
        </div>

        <EditProjectHeader project={project} orgId={project.org_id} />
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
              content: <PhaseBoard phases={phases} projectId={project.id} orgId={project.org_id} />,
            },
            {
              id: "tasks",
              label: `Tasks (${tasks.length})`,
              content: <EditableTaskTable tasks={tasks} phases={phases} projectId={project.id} orgId={project.org_id} />,
            },
            {
              id: "risks",
              label: `Risks (${risks.length})`,
              content: <EditableRiskTable risks={risks} projectId={project.id} orgId={project.org_id} />,
            },
          ]}
        />
      </div>
    </div>
  );
}
