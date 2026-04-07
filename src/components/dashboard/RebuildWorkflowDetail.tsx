"use client";

import { useState } from "react";
import type { Organization } from "@/types/pm";

interface WorkflowData {
  id: string;
  workflow_type: string;
  status: string;
  config: Record<string, unknown>;
  project_id: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  rebuild: "Website Rebuild",
  remediation: "Remediation",
  guided_rebuild: "Guided Rebuild (5-Pass)",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-500/20 text-blue-400",
  complete: "bg-green-500/20 text-green-400",
  paused: "bg-amber-500/20 text-amber-400",
  cancelled: "bg-red-500/20 text-red-400",
};

export function RebuildWorkflowDetail({
  org,
  workflow,
  onBack,
}: {
  org: Organization;
  workflow: WorkflowData;
  onBack: () => void;
}) {
  const [generatingContent, setGeneratingContent] = useState(false);
  const [contentDone, setContentDone] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [promptsDone, setPromptsDone] = useState(false);
  const [promptsError, setPromptsError] = useState<string | null>(null);

  const isRebuild = ["rebuild", "guided_rebuild"].includes(workflow.workflow_type);
  const config = workflow.config as Record<string, unknown>;
  const auditUrl = (config?.url as string) || (config?.audit_url as string) || null;
  const orgName = (config?.org_name as string) || org.name;

  const handleGenerateContent = async () => {
    if (!confirm("Generate AI page content drafts for this rebuild? This will update content-capture tasks with AI-drafted copy.")) return;
    setGeneratingContent(true);
    setContentError(null);
    try {
      const res = await fetch(`/api/pm/site-audit/workflow/${workflow.id}/generate-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: org.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Content generation failed");
      setContentDone(true);
    } catch (err) {
      setContentError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleBuildPrompts = async () => {
    if (!confirm("Generate Claude Code developer prompts and save to the Knowledge Base?")) return;
    setGeneratingPrompts(true);
    setPromptsError(null);
    try {
      const res = await fetch(`/api/pm/site-audit/workflow/${workflow.id}/build-prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: org.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Prompt generation failed");
      setPromptsDone(true);
    } catch (err) {
      setPromptsError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingPrompts(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-pm-muted hover:text-pm-accent transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Workflows
      </button>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-bold text-pm-text">
                {TYPE_LABELS[workflow.workflow_type] || workflow.workflow_type}
              </h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[workflow.status] || "bg-pm-surface text-pm-muted"}`}>
                {workflow.status}
              </span>
            </div>
            <p className="text-sm text-pm-muted">{orgName}</p>
            {auditUrl && (
              <p className="text-xs text-pm-muted mt-1">{auditUrl}</p>
            )}
          </div>
          {workflow.project_id && (
            <a
              href={`/projects`}
              className="px-3 py-1.5 text-xs border border-pm-border text-pm-text hover:bg-pm-card rounded transition-colors shrink-0"
            >
              View Project →
            </a>
          )}
        </div>
      </div>

      {/* AI Actions — rebuild/guided_rebuild only */}
      {isRebuild && (
        <div className="card space-y-4">
          <div>
            <h3 className="font-semibold text-pm-text mb-1">AI Actions</h3>
            <p className="text-sm text-pm-muted">
              Generate AI-drafted page content and developer build prompts for this rebuild workflow.
              Run content generation first, then build prompts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Generate Page Content */}
            <div className="bg-pm-bg border border-pm-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-indigo-600/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-pm-text">Generate Page Content</div>
                  <div className="text-xs text-pm-muted">AI drafts copy for each page using audit findings + intake</div>
                </div>
              </div>
              {contentError && <p className="text-xs text-red-400">{contentError}</p>}
              <button
                onClick={handleGenerateContent}
                disabled={generatingContent || contentDone}
                className="w-full px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                {contentDone ? "✓ Content Generated" : generatingContent ? "Generating..." : "Generate Page Content"}
              </button>
            </div>

            {/* Build Dev Prompts */}
            <div className="bg-pm-bg border border-pm-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-purple-600/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-pm-text">Build Dev Prompts → KB</div>
                  <div className="text-xs text-pm-muted">Generates Claude Code prompts, saves to Knowledge Base</div>
                </div>
              </div>
              {promptsError && <p className="text-xs text-red-400">{promptsError}</p>}
              <button
                onClick={handleBuildPrompts}
                disabled={generatingPrompts || promptsDone}
                className="w-full px-3 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                {promptsDone ? "✓ Prompts in KB" : generatingPrompts ? "Building..." : "Build Dev Prompts → KB"}
              </button>
            </div>
          </div>

          {(contentDone || promptsDone) && (
            <div className="p-3 bg-green-600/10 border border-green-600/30 rounded-lg text-sm text-green-400">
              {contentDone && promptsDone
                ? "Content generated and prompts saved to KB. Check the project tasks and Knowledge Base."
                : contentDone
                ? "Page content drafted. Run Build Dev Prompts next to prepare the development brief."
                : "Prompts saved to Knowledge Base. Share with your developer to begin the build."}
            </div>
          )}
        </div>
      )}

      {/* Remediation — no AI actions yet, show info card */}
      {!isRebuild && (
        <div className="card">
          <h3 className="font-semibold text-pm-text mb-2">Remediation Workflow</h3>
          <p className="text-sm text-pm-muted">
            This workflow drives remediation tasks from audit findings. Check the linked project for tasks organized by dimension.
            Use the Re-audit and Refresh Tasks actions from the site audit view to keep tasks up to date.
          </p>
        </div>
      )}
    </div>
  );
}
