"use client";
import { useState } from "react";
import type { Organization, ProjectWithStats, ProcessMap, Opportunity, KPI, PMDocument, PhaseWithTasks } from "@/types/pm";
import { OverviewTab } from "./OverviewTab";
import { ProcessMapsTab } from "./ProcessMapsTab";
import { OpportunitiesTab } from "./OpportunitiesTab";
import { ImplementationTab } from "./ImplementationTab";
import { KPIsTab } from "./KPIsTab";
import { DocsTab } from "./DocsTab";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "process-maps", label: "Process Maps" },
  { id: "opportunities", label: "Opportunities" },
  { id: "implementation", label: "Implementation Plan" },
  { id: "kpis", label: "KPIs" },
  { id: "docs", label: "Docs & SOPs" },
];

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

  return (
    <>
      <div className="flex gap-1 border-b border-pm-border mb-6 overflow-x-auto">
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

      {active === "overview" && (
        <OverviewTab
          org={org}
          projects={projects}
          processMaps={processMaps}
          opportunities={opportunities}
          allPhases={allPhases}
        />
      )}
      {active === "process-maps" && <ProcessMapsTab org={org} processMaps={processMaps} />}
      {active === "opportunities" && <OpportunitiesTab org={org} opportunities={opportunities} />}
      {active === "implementation" && <ImplementationTab allPhases={allPhases} />}
      {active === "kpis" && <KPIsTab org={org} kpis={kpis} />}
      {active === "docs" && <DocsTab org={org} documents={documents} />}
    </>
  );
}
