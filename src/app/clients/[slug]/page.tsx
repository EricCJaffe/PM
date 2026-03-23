import { getOrganizationBySlug, getProjects, getProcessMaps, getOpportunities, getKPIs, getDocuments } from "@/lib/queries";
import { getPhasesWithTasks } from "@/lib/queries";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { ShareButton } from "@/components/dashboard/ShareButton";
import { ClientActions } from "@/components/dashboard/ClientActions";
import { getUserOrgFilter } from "@/lib/auth";
import type { PipelineStatus } from "@/types/pm";

const PIPELINE_COLORS: Record<string, string> = {
  lead: "bg-slate-500/20 text-slate-300",
  qualified: "bg-blue-500/20 text-blue-400",
  discovery_complete: "bg-cyan-500/20 text-cyan-400",
  proposal_sent: "bg-purple-500/20 text-purple-400",
  negotiation: "bg-amber-500/20 text-amber-400",
  closed_won: "bg-emerald-500/20 text-emerald-400",
  closed_lost: "bg-red-500/20 text-red-400",
};

const PIPELINE_LABELS: Record<string, string> = {
  lead: "Lead", qualified: "Qualified", discovery_complete: "Discovery",
  proposal_sent: "Proposal Sent", negotiation: "Negotiation",
  closed_won: "Closed Won", closed_lost: "Closed Lost",
};

function PipelineStatusBadge({ status }: { status: PipelineStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PIPELINE_COLORS[status] || PIPELINE_COLORS.lead}`}>
      {PIPELINE_LABELS[status] || status}
    </span>
  );
}

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org) notFound();

  // Access check: external users can only view their assigned org
  const orgFilter = await getUserOrgFilter();
  if (orgFilter !== null && !orgFilter.includes(org.id)) {
    notFound();
  }

  const [projects, processMaps, opportunities, kpis, documents] = await Promise.all([
    getProjects(org.id),
    getProcessMaps(org.id),
    getOpportunities(org.id),
    getKPIs(org.id),
    getDocuments(org.id),
  ]);

  // Aggregate stats across all projects
  const totalTasks = projects.reduce((sum, p) => sum + p.task_count, 0);
  const completeTasks = projects.reduce((sum, p) => sum + p.complete_tasks, 0);
  const overallProgress = totalTasks > 0 ? Math.round((completeTasks / totalTasks) * 100) : 0;
  const totalSavings = opportunities
    .filter((o) => o.status !== "declined")
    .reduce((sum, o) => sum + (o.estimated_savings || 0), 0);
  const activeOpps = opportunities.filter((o) => !["complete", "declined"].includes(o.status)).length;

  // Get phases for all projects (for implementation tab)
  const allPhases = [];
  for (const project of projects) {
    const phases = await getPhasesWithTasks(project.id);
    allPhases.push({ project, phases });
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/clients" className="text-sm text-pm-muted hover:text-pm-text mb-2 inline-block">
            &larr; All Clients
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-pm-text">{org.name}</h1>
            <PipelineStatusBadge status={org.pipeline_status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ClientActions clientId={org.id} clientSlug={org.slug} />
          <Link
            href={`/projects/new?org=${org.id}`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Project
          </Link>
          <ShareButton org={org} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="text-2xl font-bold text-pm-text">
            ${totalSavings >= 1000 ? `${Math.round(totalSavings / 1000)}K` : totalSavings}
          </div>
          <div className="text-xs text-pm-muted mt-1">Projected Annual Savings</div>
          {opportunities.filter((o) => o.status === "complete").length > 0 && (
            <div className="text-xs text-pm-complete mt-1">
              {opportunities.filter((o) => o.status === "complete").length} confirmed
            </div>
          )}
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-pm-text">{overallProgress}%</div>
          <div className="text-xs text-pm-muted mt-1">Implementation Complete</div>
          <div className="text-xs text-pm-muted mt-1">
            {completeTasks} of {totalTasks} tasks
          </div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-pm-text">{opportunities.length}</div>
          <div className="text-xs text-pm-muted mt-1">Automation Opportunities</div>
          {activeOpps > 0 && (
            <div className="text-xs text-pm-in-progress mt-1">{activeOpps} remaining</div>
          )}
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-pm-text">{processMaps.length}</div>
          <div className="text-xs text-pm-muted mt-1">Process Maps</div>
          <div className="text-xs text-pm-muted mt-1">
            {[...new Set(processMaps.map((pm) => pm.department).filter(Boolean))].length} departments
          </div>
        </div>
      </div>

      {/* Tabs */}
      <DashboardTabs
        org={org}
        projects={projects}
        processMaps={processMaps}
        opportunities={opportunities}
        kpis={kpis}
        documents={documents}
        allPhases={allPhases}
      />
    </div>
  );
}
