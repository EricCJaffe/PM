import { createServiceClient } from "@/lib/supabase/server";
import { getUserSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getProject, getPhasesWithTasks, getRisks, getTasks, getMemberNameMap } from "@/lib/queries";
import { StatsBar } from "@/components/StatsBar";
import { ChatPanel } from "@/components/ChatPanel";
import { TabNav } from "@/components/TabNav";
import { EditProjectHeader } from "@/components/EditProjectHeader";
import { PhaseBoard } from "@/components/PhaseBoard";
import { EditableTaskTable } from "@/components/EditableTaskTable";
import { EditableRiskTable } from "@/components/EditableRiskTable";
import { AIReportsPanel } from "@/components/AIReportsPanel";
import { ClientUpdateTab } from "@/components/ClientUpdateTab";
import { TimelineTab } from "@/components/TimelineTab";
import { BudgetTab } from "@/components/BudgetTab";
import { ProjectNotesDocsTab } from "@/components/ProjectNotesDocsTab";
import { ExportMenu } from "@/components/ExportMenu";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PortalProjectDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
  const { orgSlug, projectSlug } = await params;
  const session = await getUserSession();
  if (!session) redirect(`/portal/auth?org=${orgSlug}`);

  const supabase = createServiceClient();

  // Resolve org and verify user access
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("id, name, slug")
    .eq("slug", orgSlug)
    .single();

  if (!org) redirect("/portal/auth");

  if (session.system_role === "external" && !session.org_ids?.includes(org.id)) {
    redirect(`/portal/auth?org=${orgSlug}`);
  }

  // Load the project and verify it belongs to this org
  const project = await getProject(projectSlug);
  if (!project || project.org_id !== org.id) notFound();

  const [phases, risks, tasks, memberMap] = await Promise.all([
    getPhasesWithTasks(project.id),
    getRisks(project.id),
    getTasks(project.id),
    getMemberNameMap(project.org_id),
  ]);

  const completeTasks = tasks.filter((t) => t.status === "complete").length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;
  const progress = tasks.length > 0 ? Math.round((completeTasks / tasks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <Link
        href={`/portal/${orgSlug}/projects`}
        className="text-sm text-pm-muted hover:text-pm-text inline-block"
      >
        &larr; Projects
      </Link>

      {/* AI Chat */}
      <div className="card">
        <ChatPanel projectId={project.id} projectSlug={project.slug} compact />
      </div>

      <EditProjectHeader
        project={project}
        orgId={project.org_id}
        memberMap={memberMap}
        hideDelete
      />

      {/* Export + AI Insights — no Save as Template */}
      <div className="flex justify-end">
        <ExportMenu
          project={project}
          phases={phases}
          tasks={tasks}
          risks={risks}
          memberMap={memberMap}
        />
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
            content: (
              <PhaseBoard
                phases={phases}
                projectId={project.id}
                orgId={project.org_id}
                memberMap={memberMap}
              />
            ),
          },
          {
            id: "tasks",
            label: `Tasks (${tasks.length})`,
            content: (
              <EditableTaskTable
                tasks={tasks}
                phases={phases}
                projectId={project.id}
                orgId={project.org_id}
                memberMap={memberMap}
              />
            ),
          },
          {
            id: "risks",
            label: `Risks (${risks.length})`,
            content: (
              <EditableRiskTable
                risks={risks}
                projectId={project.id}
                orgId={project.org_id}
                memberMap={memberMap}
              />
            ),
          },
          {
            id: "ai-reports",
            label: "AI Reports",
            content: (
              <AIReportsPanel
                projectId={project.id}
                orgSlug={orgSlug}
                projectSlug={project.slug}
              />
            ),
          },
          {
            id: "timeline",
            label: "Timeline",
            content: (
              <TimelineTab
                phases={phases}
                projectStart={project.start_date}
                projectTarget={project.target_date}
              />
            ),
          },
          {
            id: "budget",
            label: "Budget",
            content: (
              <BudgetTab
                phases={phases}
                projectBudget={project.budget}
                projectId={project.id}
              />
            ),
          },
          {
            id: "client-updates",
            label: "Client Updates",
            content: <ClientUpdateTab projectId={project.id} orgId={project.org_id} />,
          },
          {
            id: "notes-docs",
            label: "Notes & Docs",
            content: (
              <ProjectNotesDocsTab
                projectId={project.id}
                orgId={project.org_id}
                portalMode
              />
            ),
          },
        ]}
      />
    </div>
  );
}
