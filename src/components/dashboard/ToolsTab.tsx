"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import type { Organization, SiteAudit, AuditVertical, AuditGrade, AuditScores } from "@/types/pm";

const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));

const VERTICALS: { value: AuditVertical; label: string; description: string }[] = [
  { value: "church", label: "Church / Ministry", description: "Church OS standards — worship, sermons, giving, groups" },
  { value: "agency", label: "Agency / Service Business", description: "Agency OS — portfolio, services, case studies, booking" },
  { value: "nonprofit", label: "Nonprofit", description: "Nonprofit OS — mission, impact, donate, volunteer" },
  { value: "general", label: "General Business", description: "General web standards — SEO, conversion, content" },
];

const GRADE_COLORS: Record<AuditGrade, string> = {
  A: "text-emerald-400 bg-emerald-400/10",
  B: "text-blue-400 bg-blue-400/10",
  C: "text-amber-400 bg-amber-400/10",
  D: "text-orange-400 bg-orange-400/10",
  F: "text-red-400 bg-red-400/10",
};

const DIMENSION_LABELS: Record<string, string> = {
  seo: "SEO",
  entity: "Entity Authority",
  ai_discoverability: "AI Discoverability",
  conversion: "Conversion",
  content: "Content",
  a2a_readiness: "A2A Readiness",
};

function GradeBadge({ grade }: { grade: AuditGrade }) {
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${GRADE_COLORS[grade]}`}>
      {grade}
    </span>
  );
}

function overallGrade(scores: AuditScores): AuditGrade {
  const gradeValues: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  const values = Object.values(scores).map((g) => gradeValues[g] ?? 0);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg >= 3.5) return "A";
  if (avg >= 2.5) return "B";
  if (avg >= 1.5) return "C";
  if (avg >= 0.5) return "D";
  return "F";
}

// ─── Audit Results View ─────────────────────────────────────────────

function AuditResults({
  audit,
  onBack,
  onGenerateDoc,
}: {
  audit: SiteAudit;
  onBack: () => void;
  onGenerateDoc: () => void;
}) {
  const [generatingDoc, setGeneratingDoc] = useState(false);

  const handleGenerateDoc = async () => {
    setGeneratingDoc(true);
    onGenerateDoc();
  };

  if (audit.status === "failed") {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-pm-muted hover:text-pm-text">&larr; Back to audits</button>
        <div className="card border-red-600/30 text-center py-8">
          <p className="text-red-400 font-medium mb-2">Audit Failed</p>
          <p className="text-sm text-pm-muted">{audit.audit_summary || "Unknown error occurred during analysis."}</p>
        </div>
      </div>
    );
  }

  if (audit.status !== "complete" || !audit.scores) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-pm-muted hover:text-pm-text">&larr; Back to audits</button>
        <div className="card text-center py-8">
          <div className="animate-pulse text-pm-muted">Audit is processing...</div>
        </div>
      </div>
    );
  }

  const scores = audit.scores;
  const gaps = audit.gaps || {};
  const recommendations = audit.recommendations || [];
  const quickWins = audit.quick_wins || [];
  const pagesToBuild = audit.pages_to_build || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-pm-muted hover:text-pm-text">&larr; Back to audits</button>
        <div className="flex gap-2">
          {!audit.document_id && (
            <button
              onClick={handleGenerateDoc}
              disabled={generatingDoc}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {generatingDoc ? "Generating..." : "Generate Report Document"}
            </button>
          )}
          {audit.document_id && (
            <a
              href={`/documents/${audit.document_id}`}
              className="px-4 py-2 bg-pm-accent hover:bg-pm-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
            >
              View Report Document
            </a>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-pm-text text-lg">{audit.url}</h3>
            <p className="text-sm text-pm-muted mt-1">
              {VERTICALS.find((v) => v.value === audit.vertical)?.label} Audit
              &nbsp;&middot;&nbsp; {new Date(audit.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="text-center">
            <div className="text-xs text-pm-muted mb-1">Overall</div>
            <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-xl font-bold ${GRADE_COLORS[overallGrade(scores)]}`}>
              {overallGrade(scores)}
            </span>
          </div>
        </div>
        {audit.audit_summary && (
          <p className="text-sm text-pm-muted">{audit.audit_summary}</p>
        )}
      </div>

      {/* Score Card */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(scores).map(([key, grade]) => (
          <div key={key} className="card text-center">
            <GradeBadge grade={grade as AuditGrade} />
            <div className="text-xs text-pm-muted mt-2">{DIMENSION_LABELS[key] || key}</div>
          </div>
        ))}
      </div>

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <div className="card">
          <h4 className="font-semibold text-pm-text mb-3">Quick Wins</h4>
          <div className="space-y-2">
            {quickWins.map((qw, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">&#x2713;</span>
                <div>
                  <span className="text-sm font-medium text-pm-text">{qw.title}</span>
                  <p className="text-xs text-pm-muted">{qw.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gap Analysis */}
      <div className="card">
        <h4 className="font-semibold text-pm-text mb-4">Gap Analysis</h4>
        <div className="space-y-6">
          {Object.entries(gaps).map(([dimension, items]) => (
            <div key={dimension}>
              <div className="flex items-center gap-2 mb-2">
                <GradeBadge grade={(scores as unknown as Record<string, AuditGrade>)[dimension] || "C"} />
                <span className="text-sm font-medium text-pm-text">{DIMENSION_LABELS[dimension] || dimension}</span>
              </div>
              <div className="space-y-1.5 ml-10">
                {(items as Array<{ issue: string; severity: string; recommendation: string }>).map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5 ${
                      item.severity === "critical" ? "bg-red-600/20 text-red-400" :
                      item.severity === "major" ? "bg-amber-600/20 text-amber-400" :
                      "bg-slate-600/20 text-pm-muted"
                    }`}>
                      {item.severity}
                    </span>
                    <div>
                      <span className="text-sm text-pm-text">{item.issue}</span>
                      <p className="text-xs text-pm-muted">{item.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="card">
          <h4 className="font-semibold text-pm-text mb-3">Recommendations</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border">
                  <th className="text-left py-2 text-pm-muted font-medium">Recommendation</th>
                  <th className="text-center py-2 text-pm-muted font-medium w-20">Priority</th>
                  <th className="text-center py-2 text-pm-muted font-medium w-24">Effort</th>
                  <th className="text-center py-2 text-pm-muted font-medium w-20">Impact</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec, i) => (
                  <tr key={i} className="border-b border-pm-border/50">
                    <td className="py-2">
                      <span className="font-medium text-pm-text">{rec.title}</span>
                      <p className="text-xs text-pm-muted mt-0.5">{rec.description}</p>
                    </td>
                    <td className="text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        rec.priority === "high" ? "bg-red-600/20 text-red-400" :
                        rec.priority === "medium" ? "bg-amber-600/20 text-amber-400" :
                        "bg-slate-600/20 text-pm-muted"
                      }`}>{rec.priority}</span>
                    </td>
                    <td className="text-center text-xs text-pm-muted">{rec.effort}</td>
                    <td className="text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        rec.impact === "high" ? "bg-emerald-600/20 text-emerald-400" :
                        rec.impact === "medium" ? "bg-blue-600/20 text-blue-400" :
                        "bg-slate-600/20 text-pm-muted"
                      }`}>{rec.impact}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pages to Build */}
      {pagesToBuild.length > 0 && (
        <div className="card">
          <h4 className="font-semibold text-pm-text mb-3">Recommended Pages to Build</h4>
          <div className="space-y-2">
            {pagesToBuild.map((page, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-pm-border/50 last:border-0">
                <code className="text-xs text-pm-accent bg-pm-bg px-2 py-0.5 rounded shrink-0">{page.slug}</code>
                <div>
                  <span className="text-sm font-medium text-pm-text">{page.title}</span>
                  <p className="text-xs text-pm-muted">{page.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Tools Tab ─────────────────────────────────────────────────

export function ToolsTab({
  org,
  initialEngagementId,
}: {
  org: Organization;
  initialEngagementId?: string | null;
}) {
  const [audits, setAudits] = useState<SiteAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAudit, setActiveAudit] = useState<SiteAudit | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [running, setRunning] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formVertical, setFormVertical] = useState<AuditVertical>("general");
  const [formExtraContext, setFormExtraContext] = useState("");
  const [formEngagementId] = useState(initialEngagementId || "");

  useEffect(() => {
    fetch(`/api/pm/site-audit?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAudits(data); })
      .finally(() => setLoading(false));
  }, [org.id]);

  const runAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUrl) return;
    setRunning(true);

    try {
      const res = await fetch("/api/pm/site-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: org.id,
          url: formUrl.startsWith("http") ? formUrl : `https://${formUrl}`,
          vertical: formVertical,
          engagement_id: formEngagementId || null,
          extra_context: formExtraContext || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setAudits((prev) => [data, ...prev]);
      setActiveAudit(data);
      setShowForm(false);
      setFormUrl("");
      setFormExtraContext("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setRunning(false);
    }
  };

  const handleGenerateDoc = async (audit: SiteAudit) => {
    try {
      const res = await fetch(`/api/pm/site-audit/${audit.id}`, { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Update audit with document_id
      const updatedAudit = { ...audit, document_id: data.document_id };
      setActiveAudit(updatedAudit);
      setAudits((prev) => prev.map((a) => (a.id === audit.id ? updatedAudit : a)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate document");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this audit?")) return;
    const res = await fetch(`/api/pm/site-audit/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setAudits((prev) => prev.filter((a) => a.id !== id));
    if (activeAudit?.id === id) setActiveAudit(null);
  };

  if (loading) return <div className="text-pm-muted py-8">Loading tools...</div>;

  // Show audit results if one is selected
  if (activeAudit) {
    return (
      <AuditResults
        audit={activeAudit}
        onBack={() => setActiveAudit(null)}
        onGenerateDoc={() => handleGenerateDoc(activeAudit)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-pm-text">Tools</h3>
          <p className="text-sm text-pm-muted">Audit and analysis tools for client onboarding</p>
        </div>
      </div>

      {/* Tool Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Site Audit Tool */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-pm-text">Site Audit</h4>
              <p className="text-xs text-pm-muted">Analyze a website against industry standards</p>
            </div>
          </div>
          <p className="text-sm text-pm-muted mb-4">
            Enter a URL to automatically analyze SEO, entity authority, AI discoverability, conversion optimization, content quality, and A2A readiness. Generates a scored gap analysis with recommendations.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Run New Audit
          </button>
        </div>

        {/* Process Analyzer Placeholder */}
        <div className="card opacity-60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-pm-text">Process Analyzer</h4>
              <p className="text-xs text-pm-muted">Analyze and reshape client processes</p>
            </div>
          </div>
          <p className="text-sm text-pm-muted mb-4">
            Evaluate current client processes against your methodology and generate a transformation roadmap. Coming soon.
          </p>
          <button disabled className="w-full px-4 py-2 bg-pm-surface text-pm-muted rounded-lg text-sm font-medium cursor-not-allowed">
            Coming Soon
          </button>
        </div>
      </div>

      {/* Audit Form */}
      {showForm && (
        <form onSubmit={runAudit} className="card space-y-4">
          <div className="text-sm font-semibold text-pm-text">New Site Audit</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-pm-muted mb-1">Website URL *</label>
              <input
                type="text"
                required
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="https://example.com"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Vertical / Standards</label>
              <select
                value={formVertical}
                onChange={(e) => setFormVertical(e.target.value as AuditVertical)}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
              >
                {VERTICALS.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
              <p className="text-xs text-pm-muted mt-1">{VERTICALS.find((v) => v.value === formVertical)?.description}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Additional Context</label>
              <p className="text-xs text-pm-muted mb-1">Paste Google Business info, analytics data, or other context</p>
            </div>
            <div className="md:col-span-2">
              <Suspense fallback={<div className="h-[120px] bg-pm-bg border border-pm-border rounded-lg flex items-center justify-center text-pm-muted text-sm">Loading editor...</div>}>
                <RichTextEditor
                  value={formExtraContext}
                  onChange={setFormExtraContext}
                  placeholder="Paste any additional context here — Google Business profile info, analytics data, competitor sites, specific concerns..."
                />
              </Suspense>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={running || !formUrl}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {running ? "Analyzing..." : "Run Audit"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-pm-muted hover:text-pm-text text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Past Audits */}
      {audits.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-pm-muted uppercase tracking-wider mb-3">
            Past Audits ({audits.length})
          </h4>
          <div className="space-y-2">
            {audits.map((audit) => (
              <div key={audit.id} className="card flex items-center justify-between">
                <button
                  onClick={() => setActiveAudit(audit)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-3">
                    {audit.status === "complete" && audit.scores ? (
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${GRADE_COLORS[overallGrade(audit.scores)]}`}>
                        {overallGrade(audit.scores)}
                      </span>
                    ) : audit.status === "running" ? (
                      <span className="w-8 h-8 rounded-lg bg-pm-surface flex items-center justify-center">
                        <span className="animate-pulse text-pm-muted text-xs">...</span>
                      </span>
                    ) : (
                      <span className="w-8 h-8 rounded-lg bg-red-600/10 flex items-center justify-center text-red-400 text-xs">!</span>
                    )}
                    <div>
                      <span className="text-sm font-medium text-pm-text">{audit.url}</span>
                      <div className="flex gap-2 text-xs text-pm-muted mt-0.5">
                        <span>{VERTICALS.find((v) => v.value === audit.vertical)?.label}</span>
                        <span>&middot;</span>
                        <span>{new Date(audit.created_at).toLocaleDateString()}</span>
                        {audit.document_id && (
                          <>
                            <span>&middot;</span>
                            <span className="text-pm-accent">Report generated</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(audit.id); }}
                  className="p-1.5 text-pm-muted hover:text-red-400 transition-colors ml-2"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
