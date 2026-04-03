import { getOrganizationBySlug, getProjects, getProcessMaps, getOpportunities, getKPIs, getDocuments, getProposals } from "@/lib/queries";
import { getPhasesWithTasks } from "@/lib/queries";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
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

  const [projects, processMaps, opportunities, kpis, documents, proposals] = await Promise.all([
    getProjects(org.id),
    getProcessMaps(org.id),
    getOpportunities(org.id),
    getKPIs(org.id),
    getDocuments(org.id),
    getProposals(org.id),
  ]);

  // Aggregate stats
  const totalTasks = projects.reduce((sum, p) => sum + p.task_count, 0);
  const completeTasks = projects.reduce((sum, p) => sum + p.complete_tasks, 0);
  const activeProjects = projects.filter((p) => p.status === "active").length;
  const openProposals = proposals.filter((p) => !["signed", "archived"].includes(p.status)).length;

  // Get phases for all projects in parallel (was sequential N+1, now concurrent)
  const allPhases = await Promise.all(
    projects.map(async (project) => {
      const phases = await getPhasesWithTasks(project.id);
      return { project, phases };
    })
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/clients" className="text-sm text-pm-muted hover:text-pm-text mb-2 inline-block">
          &larr; All Clients
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-pm-text">{org.name}</h1>
            <PipelineStatusBadge status={org.pipeline_status} />
          </div>
          {/* Primary Contact */}
          {(org.contact_name || org.contact_email || org.contact_phone) && (
            <div className="flex items-center gap-4 text-sm">
              {org.contact_name && (
                <span className="text-pm-text font-medium">{org.contact_name}</span>
              )}
              {org.contact_phone && (
                <a href={`tel:${org.contact_phone}`} className="text-pm-accent hover:underline flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {org.contact_phone}
                </a>
              )}
              {org.contact_email && (
                <a href={`mailto:${org.contact_email}`} className="text-pm-accent hover:underline flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {org.contact_email}
                </a>
              )}
            </div>
          )}
        </div>
        {org.referred_by && (
          <p className="text-sm text-pm-muted mt-2">Referred by: <span className="text-pm-text">{org.referred_by}</span></p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="text-2xl font-bold text-pm-text">{projects.length}</div>
          <div className="text-xs text-pm-muted mt-1">Projects</div>
          {activeProjects > 0 && (
            <div className="text-xs text-pm-in-progress mt-1">{activeProjects} active</div>
          )}
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-pm-text">{totalTasks}</div>
          <div className="text-xs text-pm-muted mt-1">Tasks</div>
          <div className="text-xs text-pm-complete mt-1">
            {completeTasks} completed
          </div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-pm-text">{proposals.length}</div>
          <div className="text-xs text-pm-muted mt-1">Proposals</div>
          {openProposals > 0 && (
            <div className="text-xs text-pm-in-progress mt-1">{openProposals} open</div>
          )}
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-pm-text">
            {totalTasks > 0 ? Math.round((completeTasks / totalTasks) * 100) : 0}%
          </div>
          <div className="text-xs text-pm-muted mt-1">Overall Progress</div>
          <div className="text-xs text-pm-muted mt-1">
            {completeTasks} of {totalTasks} tasks
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
