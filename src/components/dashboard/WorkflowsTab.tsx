"use client";
import { useState } from "react";
import type { Organization } from "@/types/pm";
import { ToolsTab } from "./ToolsTab";
import { OnboardingTab } from "./OnboardingTab";
import { ProcessAnalyzerTab } from "./ProcessAnalyzerTab";

type ActiveView = "cards" | "site-audit" | "onboarding" | "process-analyzer";

const WORKFLOW_CARDS: {
  id: Exclude<ActiveView, "cards">;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  buttonLabel: string;
  buttonColor: string;
}[] = [
  {
    id: "site-audit",
    title: "Site Audit & Web Project",
    subtitle: "Analyze, remediate, or rebuild a website",
    description:
      "Run a rubric-based audit, then start a remediation or full rebuild workflow with auto-generated tasks.",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-slate-600/30 flex items-center justify-center">
        <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
    ),
    buttonLabel: "Run New Audit",
    buttonColor: "bg-red-600 hover:bg-red-700",
  },
  {
    id: "onboarding",
    title: "Client Onboarding",
    subtitle: "Discovery, gap analysis, and project setup",
    description:
      "Structured discovery process: kickoff, interviews, gap analysis, and onboarding checklist for new clients.",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
    ),
    buttonLabel: "Start Onboarding",
    buttonColor: "bg-emerald-600 hover:bg-emerald-700",
  },
  {
    id: "process-analyzer",
    title: "Process Analyzer",
    subtitle: "Scan documents and score against your standards",
    description:
      "Upload client SOPs and business documents. AI ingests and scores them against your methodology, identifies automation opportunities, and generates a ranked action list.",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      </div>
    ),
    buttonLabel: "Analyze Processes",
    buttonColor: "bg-purple-600 hover:bg-purple-700",
  },
];

export function WorkflowsTab({ org }: { org: Organization }) {
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
        onBack={() => setActiveView("cards")}
      />
    );
  }

  // ── Card launcher view ──
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-pm-text">Workflows</h2>
        <p className="text-sm text-pm-muted">Site audits, remediation plans, and website rebuild projects</p>
      </div>

      {/* Workflow Cards — 2-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {WORKFLOW_CARDS.map((card) => (
          <div key={card.id} className="card">
            <div className="flex items-center gap-3 mb-3">
              {card.icon}
              <div>
                <h3 className="font-semibold text-pm-text">{card.title}</h3>
                <p className="text-xs text-pm-muted">{card.subtitle}</p>
              </div>
            </div>
            <p className="text-sm text-pm-muted mb-4">{card.description}</p>
            <button
              onClick={() => setActiveView(card.id)}
              className={`w-full px-4 py-2.5 text-white rounded-lg text-sm font-medium transition-colors ${card.buttonColor}`}
            >
              {card.buttonLabel}
            </button>
          </div>
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
