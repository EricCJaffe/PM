"use client";

import { useState, useEffect } from "react";
import type { Organization } from "@/types/pm";

interface DeptIntake {
  id: string;
  department_id: string;
  status: string;
  pillar_scores: Record<string, number>;
  ai_summary: string | null;
  pm_departments: { id: string; name: string; slug: string; head_name: string | null; playbook_document_id: string | null };
}

interface Opportunity {
  id: string;
  title: string;
  description: string | null;
  complexity: string;
  estimated_savings: number;
  savings_unit: string;
  priority_score: number;
  status: string;
  source: string | null;
}

interface Workflow {
  id: string;
  workflow_type: string;
  status: string;
  config: Record<string, unknown>;
  project_id: string | null;
}

const PILLAR_LABELS: Record<string, string> = {
  vision: "Vision",
  people: "People",
  data: "Data",
  processes: "Processes",
  meetings: "Meetings",
  issues: "Issues",
};

const STATUS_COLORS: Record<string, string> = {
  "not-started": "bg-gray-500/20 text-gray-400",
  "in-progress": "bg-blue-500/20 text-blue-400",
  complete: "bg-emerald-500/20 text-emerald-400",
  reviewed: "bg-purple-500/20 text-purple-400",
  approved: "bg-emerald-600/20 text-emerald-300",
  identified: "bg-gray-500/20 text-gray-400",
  "in-progress-opp": "bg-blue-500/20 text-blue-400",
  declined: "bg-red-500/20 text-red-400",
};

export function ProcessDiscoveryDetail({
  org,
  workflow,
  onBack,
}: {
  org: Organization;
  workflow: Workflow;
  onBack: () => void;
}) {
  const [intakes, setIntakes] = useState<DeptIntake[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; title: string; category: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/pm/department-intake?workflow_id=${workflow.id}`).then((r) => r.json()),
      fetch(`/api/pm/opportunities?org_id=${org.id}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/pm/documents?org_id=${org.id}`).then((r) => r.json()).catch(() => []),
    ]).then(([intakeData, oppData, docData]) => {
      if (Array.isArray(intakeData)) setIntakes(intakeData);
      if (Array.isArray(oppData)) setOpportunities(oppData);
      if (Array.isArray(docData)) setDocuments(docData);
    }).finally(() => setLoading(false));
  }, [workflow.id, org.id]);

  const completedIntakes = intakes.filter((i) => ["complete", "reviewed", "approved"].includes(i.status)).length;
  const totalIntakes = intakes.length;
  const playbooksGenerated = intakes.filter((i) => i.pm_departments?.playbook_document_id).length;

  // ── Action handlers ──

  async function handleScanAndPrefill(intakeId: string) {
    const sopDocs = documents.filter((d) => ["sop", "document", "policy"].includes(d.category));
    if (sopDocs.length === 0) {
      alert("No SOP documents uploaded yet. Upload documents in the Docs & SOPs tab first.");
      return;
    }
    setAction(`prefill-${intakeId}`);
    try {
      const res = await fetch(`/api/pm/department-intake/${intakeId}/prefill-from-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: sopDocs.map((d) => d.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionResult(`Pre-filled ${data.fields_prefilled} fields (confidence: ${data.confidence})`);
      // Refresh intakes
      const refreshed = await fetch(`/api/pm/department-intake?workflow_id=${workflow.id}`).then((r) => r.json());
      if (Array.isArray(refreshed)) setIntakes(refreshed);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Prefill failed");
    } finally {
      setAction(null);
    }
  }

  async function handleGeneratePlaybook(intakeId: string) {
    setAction(`playbook-${intakeId}`);
    setActionResult(null);
    try {
      const res = await fetch(`/api/pm/department-intake/${intakeId}/generate-playbook`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionResult(`Playbook generated: ${data.sections_created} sections for ${data.department}`);
      // Refresh intakes
      const refreshed = await fetch(`/api/pm/department-intake?workflow_id=${workflow.id}`).then((r) => r.json());
      if (Array.isArray(refreshed)) setIntakes(refreshed);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setAction(null);
    }
  }

  async function handleCompileMaster() {
    setAction("compile");
    setActionResult(null);
    try {
      const res = await fetch(`/api/pm/process-discovery/${workflow.id}/compile-playbook`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionResult(`Master playbook compiled: ${data.departments_compiled} departments, ${data.opportunities_included} opportunities`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Compilation failed");
    } finally {
      setAction(null);
    }
  }

  async function handleOpportunityAction(oppId: string, oppAction: "approve" | "decline") {
    setAction(`opp-${oppId}`);
    try {
      const res = await fetch(`/api/pm/process-discovery/${workflow.id}/approve-opportunity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunity_id: oppId,
          action: oppAction,
          create_project: oppAction === "approve",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.project_name) {
        setActionResult(`Project created: ${data.project_name}`);
      }
      // Refresh opportunities
      const refreshed = await fetch(`/api/pm/opportunities?org_id=${org.id}`).then((r) => r.json()).catch(() => []);
      if (Array.isArray(refreshed)) setOpportunities(refreshed);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setAction(null);
    }
  }

  async function handleApproveIntake(intakeId: string) {
    try {
      await fetch(`/api/pm/department-intake/${intakeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved", approved_by: "admin", approved_at: new Date().toISOString() }),
      });
      const refreshed = await fetch(`/api/pm/department-intake?workflow_id=${workflow.id}`).then((r) => r.json());
      if (Array.isArray(refreshed)) setIntakes(refreshed);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Approval failed");
    }
  }

  if (loading) return <p className="text-pm-muted text-sm py-8">Loading workflow detail...</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-sm text-pm-muted hover:text-pm-text mb-2 block">&larr; Back to Workflows</button>
          <h2 className="text-lg font-bold text-pm-text">Process Discovery — {org.name}</h2>
          <p className="text-sm text-pm-muted">
            Template: {(workflow.config as Record<string, string>)?.template_name || "—"} &middot;
            Vertical: {(workflow.config as Record<string, string>)?.vertical || "—"}
          </p>
        </div>
      </div>

      {actionResult && (
        <div className="card border-emerald-500/30 bg-emerald-500/5 text-sm text-emerald-400">{actionResult}</div>
      )}

      {/* ── Stage Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-pm-text">{totalIntakes}</div>
          <div className="text-xs text-pm-muted">Departments</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-400">{completedIntakes}/{totalIntakes}</div>
          <div className="text-xs text-pm-muted">Intake Complete</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-purple-400">{playbooksGenerated}</div>
          <div className="text-xs text-pm-muted">Playbooks Generated</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-amber-400">{opportunities.length}</div>
          <div className="text-xs text-pm-muted">Opportunities</div>
        </div>
      </div>

      {/* ── Stage 3: SOP Upload & Scan ── */}
      <div className="card">
        <h3 className="font-semibold text-pm-text mb-2">Stage 3: Document Scan & Pre-Fill</h3>
        <p className="text-sm text-pm-muted mb-3">
          Upload SOPs and documents to the Docs & SOPs tab, then scan them to auto-fill department intake forms.
          {documents.filter((d) => ["sop", "document", "policy"].includes(d.category)).length} scannable documents available.
        </p>
      </div>

      {/* ── Stage 4: Department Intake Forms ── */}
      <div>
        <h3 className="font-semibold text-pm-text mb-3">Stage 4: Department Discovery</h3>
        <div className="space-y-3">
          {intakes.map((intake) => {
            const dept = intake.pm_departments;
            const scores = intake.pillar_scores || {};
            const hasPlaybook = !!dept?.playbook_document_id;

            return (
              <div key={intake.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-pm-text">{dept?.name || "Department"}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[intake.status] || STATUS_COLORS["not-started"]}`}>
                      {intake.status.replace("-", " ")}
                    </span>
                    {hasPlaybook && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">Playbook</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Scan & Pre-fill */}
                    <button
                      onClick={() => handleScanAndPrefill(intake.id)}
                      disabled={action === `prefill-${intake.id}`}
                      className="px-3 py-1 text-xs border border-pm-border text-pm-muted hover:text-pm-text rounded-lg transition-colors disabled:opacity-50"
                    >
                      {action === `prefill-${intake.id}` ? "Scanning..." : "Scan & Pre-fill"}
                    </button>
                    {/* Generate Playbook */}
                    {(intake.status === "complete" || intake.status === "in-progress") && (
                      <button
                        onClick={() => handleGeneratePlaybook(intake.id)}
                        disabled={action === `playbook-${intake.id}`}
                        className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        {action === `playbook-${intake.id}` ? "Generating..." : hasPlaybook ? "Regenerate Playbook" : "Generate Playbook"}
                      </button>
                    )}
                    {/* Approve */}
                    {intake.status === "complete" && (
                      <button
                        onClick={() => handleApproveIntake(intake.id)}
                        className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    {/* View playbook */}
                    {hasPlaybook && (
                      <a
                        href={`/documents/${dept.playbook_document_id}`}
                        className="px-3 py-1 text-xs text-pm-accent hover:text-pm-accent-hover rounded-lg transition-colors"
                      >
                        View Playbook
                      </a>
                    )}
                  </div>
                </div>

                {/* Pillar scores */}
                {Object.keys(scores).length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(PILLAR_LABELS).map(([key, label]) => {
                      const score = scores[key];
                      if (score == null) return null;
                      const color = score >= 4 ? "text-emerald-400" : score >= 3 ? "text-blue-400" : score >= 2 ? "text-amber-400" : "text-red-400";
                      return (
                        <span key={key} className="text-xs text-pm-muted">
                          {label}: <span className={`font-medium ${color}`}>{score}/5</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                {intake.ai_summary && (
                  <p className="text-xs text-pm-muted mt-2 line-clamp-2">{intake.ai_summary}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Stage 6: Master Playbook ── */}
      {playbooksGenerated >= 2 && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-pm-text">Stage 6: Compile Master Playbook</h3>
              <p className="text-sm text-pm-muted">{playbooksGenerated} department playbooks ready to compile.</p>
            </div>
            <button
              onClick={handleCompileMaster}
              disabled={action === "compile"}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {action === "compile" ? "Compiling..." : "Compile Master Playbook"}
            </button>
          </div>
        </div>
      )}

      {/* ── Stage 7: Automation Opportunities ── */}
      {opportunities.length > 0 && (
        <div>
          <h3 className="font-semibold text-pm-text mb-3">Stage 7: Automation Opportunities</h3>
          <div className="space-y-2">
            {opportunities
              .sort((a: Opportunity, b: Opportunity) => b.priority_score - a.priority_score)
              .map((opp: Opportunity) => (
              <div key={opp.id} className="card flex items-center justify-between">
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-pm-text">{opp.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      opp.complexity === "low" ? "bg-emerald-500/20 text-emerald-400" :
                      opp.complexity === "high" ? "bg-red-500/20 text-red-400" :
                      "bg-amber-500/20 text-amber-400"
                    }`}>
                      {opp.complexity}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[opp.status] || STATUS_COLORS["identified"]}`}>
                      {opp.status}
                    </span>
                  </div>
                  {opp.description && (
                    <p className="text-xs text-pm-muted mt-0.5 line-clamp-1">{opp.description}</p>
                  )}
                  <p className="text-xs text-pm-muted mt-0.5">
                    Est. savings: ${opp.estimated_savings?.toLocaleString() || 0}/{opp.savings_unit} &middot; Priority: {opp.priority_score}
                  </p>
                </div>
                {opp.status === "identified" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleOpportunityAction(opp.id, "approve")}
                      disabled={action === `opp-${opp.id}`}
                      className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg"
                    >
                      {action === `opp-${opp.id}` ? "..." : "Approve & Create Project"}
                    </button>
                    <button
                      onClick={() => handleOpportunityAction(opp.id, "decline")}
                      disabled={action === `opp-${opp.id}`}
                      className="px-3 py-1 text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-lg"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
