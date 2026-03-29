"use client";
import { useState } from "react";
import type { Organization, ProjectWithStats, ProcessMap, PhaseWithTasks, KPI } from "@/types/pm";
import { ToolsTab } from "./ToolsTab";
import { OnboardingTab } from "./OnboardingTab";
import { ProcessAnalyzerTab } from "./ProcessAnalyzerTab";

type ActiveView = "cards" | "site-audit" | "onboarding" | "process-analyzer";

const WORKFLOW_CARDS: {
  id: Exclude<ActiveView, "cards">;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}[] = [
  {
    id: "site-audit",
    title: "Site Audit",
    description:
      "Run a comprehensive website audit — SEO, Entity Authority, AI Discoverability, Conversion, Content, and A2A Readiness scoring with actionable recommendations.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    accent: "border-blue-500/30 hover:border-blue-500/60",
  },
  {
    id: "onboarding",
    title: "Onboarding",
    description:
      "Kick off the client onboarding process — discovery interviews, gap analysis, checklists, findings briefs, and handoff to the process project.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.25v3m0 0v3m0-3h3m-3 0H9" />
      </svg>
    ),
    accent: "border-emerald-500/30 hover:border-emerald-500/60",
  },
  {
    id: "process-analyzer",
    title: "Process Analyzer",
    description:
      "Analyze and optimize organizational processes — implementation plans, process maps, gap analysis, vocabulary standardization, and KPI tracking.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v-5.5m3 5.5V8.25m3 3v-2" />
      </svg>
    ),
    accent: "border-purple-500/30 hover:border-purple-500/60",
  },
];

export function WorkflowsTab({
  org,
  allPhases,
  processMaps,
  projects,
  selectedProjectId,
  kpis,
}: {
  org: Organization;
  allPhases: { project: ProjectWithStats; phases: PhaseWithTasks[] }[];
  processMaps: ProcessMap[];
  projects: ProjectWithStats[];
  selectedProjectId: string | null;
  kpis: KPI[];
}) {
  const [activeView, setActiveView] = useState<ActiveView>("cards");

  if (activeView === "site-audit") {
    return (
      <div>
        <BackButton onClick={() => setActiveView("cards")} label="Back to Workflows" />
        <ToolsTab org={org} />
      </div>
    );
  }

  if (activeView === "onboarding") {
    return (
      <div>
        <BackButton onClick={() => setActiveView("cards")} label="Back to Workflows" />
        <OnboardingTab org={org} />
      </div>
    );
  }

  if (activeView === "process-analyzer") {
    return (
      <ProcessAnalyzerTab
        org={org}
        allPhases={allPhases}
        processMaps={processMaps}
        projects={projects}
        selectedProjectId={selectedProjectId}
        kpis={kpis}
        onBack={() => setActiveView("cards")}
      />
    );
  }

  // ── Card launcher view ──
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {WORKFLOW_CARDS.map((card) => (
          <button
            key={card.id}
            onClick={() => setActiveView(card.id)}
            className={`card text-left transition-all cursor-pointer group ${card.accent}`}
          >
            <div className="flex items-start gap-4">
              <div className="text-pm-muted group-hover:text-pm-accent transition-colors shrink-0 mt-0.5">
                {card.icon}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-pm-text group-hover:text-pm-accent transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-pm-muted mt-1.5 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <span className="text-xs text-pm-muted group-hover:text-pm-accent transition-colors flex items-center gap-1">
                Open
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div className="mb-6">
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 text-sm text-pm-muted hover:text-pm-accent transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {label}
      </button>
    </div>
  );
}
