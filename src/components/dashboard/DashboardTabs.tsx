"use client";
import { useState, useMemo } from "react";
import type { Organization, ProjectWithStats, ProcessMap, Opportunity, KPI, PMDocument, PhaseWithTasks } from "@/types/pm";
import { OverviewTab } from "./OverviewTab";
import { ProcessMapsTab } from "./ProcessMapsTab";
import { OpportunitiesTab } from "./OpportunitiesTab";
import { ImplementationTab } from "./ImplementationTab";
import { KPIsTab } from "./KPIsTab";
import { DocsTab } from "./DocsTab";
import { UsersTab } from "./UsersTab";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "process-maps", label: "Process Maps" },
  { id: "opportunities", label: "Opportunities" },
  { id: "implementation", label: "Implementation Plan" },
  { id: "kpis", label: "KPIs" },
  { id: "docs", label: "Docs & SOPs" },
];

function matchesProject<T extends { project_id?: string | null }>(item: T, projectId: string | null): boolean {
  if (!projectId) return true; // "All Projects"
  return item.project_id === projectId || item.project_id === null;
}

export function DashboardTabs({
  org,
  projects,
  processMaps,
  opportunities,
  kpis,
  documents,
  allPhases,
}: {
  org: Organization;
  projects: ProjectWithStats[];
  processMaps: ProcessMap[];
  opportunities: Opportunity[];
  kpis: KPI[];
  documents: PMDocument[];
  allPhases: { project: ProjectWithStats; phases: PhaseWithTasks[] }[];
}) {
  const [active, setActive] = useState("overview");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const filteredProcessMaps = useMemo(
    () => processMaps.filter((pm) => matchesProject(pm, selectedProjectId)),
    [processMaps, selectedProjectId]
  );
  const filteredOpportunities = useMemo(
    () => opportunities.filter((o) => matchesProject(o, selectedProjectId)),
    [opportunities, selectedProjectId]
  );
  const filteredKpis = useMemo(
    () => kpis.filter((k) => matchesProject(k, selectedProjectId)),
    [kpis, selectedProjectId]
  );
  const filteredDocs = useMemo(
    () => documents.filter((d) => matchesProject(d, selectedProjectId)),
    [documents, selectedProjectId]
  );
  const filteredPhases = useMemo(
    () => selectedProjectId
      ? allPhases.filter((p) => p.project.id === selectedProjectId)
      : allPhases,
    [allPhases, selectedProjectId]
  );

  return (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-pm-border mb-6 overflow-x-auto">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                active === tab.id
                  ? "border-pm-accent text-pm-accent"
                  : "border-transparent text-pm-muted hover:text-pm-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {projects.length > 1 && (
          <select
            value={selectedProjectId || ""}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            className="bg-pm-bg border border-pm-border rounded-lg px-3 py-1.5 text-sm text-pm-text shrink-0"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {active === "users" && <UsersTab org={org} />}
      {active === "overview" && (
        <OverviewTab
          org={org}
          projects={projects}
          processMaps={filteredProcessMaps}
          opportunities={filteredOpportunities}
          allPhases={filteredPhases}
        />
      )}
      {active === "process-maps" && <ProcessMapsTab org={org} processMaps={filteredProcessMaps} projects={projects} selectedProjectId={selectedProjectId} />}
      {active === "opportunities" && <OpportunitiesTab org={org} opportunities={filteredOpportunities} projects={projects} selectedProjectId={selectedProjectId} />}
      {active === "implementation" && <ImplementationTab allPhases={filteredPhases} />}
      {active === "kpis" && <KPIsTab org={org} kpis={filteredKpis} projects={projects} selectedProjectId={selectedProjectId} />}
      {active === "docs" && <DocsTab org={org} documents={filteredDocs} projects={projects} selectedProjectId={selectedProjectId} />}
    </>
  );
}
