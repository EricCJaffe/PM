"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  SiteAudit,
  AuditVertical,
  AuditQuickWin,
  AuditDimensionScore,
  AuditGapItem,
} from "@/types/pm";

interface Props {
  engagementId?: string;
  orgId: string;
  defaultUrl?: string;
}

const DIMENSIONS: { key: string; label: string }[] = [
  { key: "seo", label: "SEO" },
  { key: "entity", label: "Entity Authority" },
  { key: "ai_discoverability", label: "AI Search" },
  { key: "conversion", label: "Conversion" },
  { key: "content", label: "Content" },
  { key: "a2a_readiness", label: "A2A" },
];

const DIMENSION_FULL: Record<string, string> = {
  seo: "SEO",
  entity: "Entity Authority",
  ai_discoverability: "AI Discoverability",
  conversion: "Conversion Architecture",
  content: "Content Inventory",
  a2a_readiness: "A2A Readiness",
};

function gradeColor(grade: string | undefined): string {
  if (!grade) return "text-pm-muted";
  if (grade === "A" || grade === "B") return "text-green-400";
  if (grade === "C") return "text-yellow-400";
  return "text-red-400";
}

function gradeBg(grade: string | undefined): string {
  if (!grade) return "border-pm-border";
  if (grade === "A" || grade === "B") return "border-green-700/30";
  if (grade === "C") return "border-yellow-700/30";
  return "border-red-700/30";
}

export function SiteAuditTab({ engagementId, orgId, defaultUrl }: Props) {
  const [audits, setAudits] = useState<SiteAudit[]>([]);
  const [activeAudit, setActiveAudit] = useState<SiteAudit | null>(null);
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [vertical, setVertical] = useState<AuditVertical>("church");
  const [running, setRunning] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [view, setView] = useState<"form" | "results" | "history">("form");
  const [expandedDim, setExpandedDim] = useState<string | null>(null);

  // Load existing audits
  const loadAudits = useCallback(async () => {
    try {
      const res = await fetch(`/api/pm/site-audit?org_id=${orgId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAudits(data);
        return data;
      }
    } catch { /* ignore */ }
    return [];
  }, [orgId]);

  useEffect(() => {
    loadAudits().then((data) => {
      // Auto-show latest complete audit if available
      const latest = data.find((a: SiteAudit) => a.status === "complete");
      if (latest) {
        setActiveAudit(latest);
        setView("results");
      }
    });
  }, [loadAudits]);

  // Poll for audit completion (max ~3 minutes before giving up)
  useEffect(() => {
    if (!activeAudit || activeAudit.status !== "running") return;
    let pollCount = 0;
    const MAX_POLLS = 72; // 72 * 2.5s = 3 minutes
    const interval = setInterval(async () => {
      pollCount++;
      if (pollCount > MAX_POLLS) {
        clearInterval(interval);
        setRunning(false);
        setActiveAudit((prev) =>
          prev ? { ...prev, status: "failed" as const, audit_summary: "Audit timed out — please try again" } : prev
        );
        return;
      }
      try {
        const res = await fetch(`/api/pm/site-audit/${activeAudit.id}`);
        const data = await res.json();
        if (data.id) {
          setActiveAudit(data);
          if (data.status === "complete" || data.status === "failed") {
            clearInterval(interval);
            setRunning(false);
            if (data.status === "complete") {
              setView("results");
              // Refresh the audits list so history is up to date
              loadAudits();
            }
          }
        }
      } catch {
        /* retry on next tick */
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [activeAudit?.id, activeAudit?.status, loadAudits]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAudit = useCallback(async () => {
    if (!url.trim()) return;
    setRunning(true);
    setView("results");
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/pm/site-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          vertical,
          org_id: orgId,
          engagement_id: engagementId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start audit");

      // POST returns immediately with status "running" — polling takes over
      setActiveAudit(data);

      // Trigger processing
      try {
        const processRes = await fetch("/api/pm/site-audit/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audit_id: data.id,
            url: data.url,
            vertical,
            org_id: orgId,
            extra_context: null,
          }),
        });
        if (!processRes.ok) {
          const errData = await processRes.json().catch(() => ({}));
          setActiveAudit((prev) =>
            prev && prev.id === data.id
              ? { ...prev, status: "failed" as const, audit_summary: errData.error || "Audit processing failed" }
              : prev
          );
          setRunning(false);
        }
      } catch {
        setActiveAudit((prev) =>
          prev && prev.id === data.id
            ? { ...prev, status: "failed" as const, audit_summary: "Processing failed — please try again" }
            : prev
        );
        setRunning(false);
      }
    } catch (err) {
      setRunning(false);
      setView("form");
      alert(err instanceof Error ? err.message : "Failed to start audit");
    }
  }, [url, vertical, orgId, engagementId]);

  const downloadReport = useCallback(async (auditId: string) => {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/pm/site-audit/${auditId}/pdf`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate report");

      const contentType = res.headers.get("Content-Type") || "";
      if (contentType.includes("text/html")) {
        // HTML report — open in new tab
        const html = await res.text();
        const blob = new Blob([html], { type: "text/html" });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
      } else {
        // JSON with signed URL
        const data = await res.json();
        if (data.pdf_url) window.open(data.pdf_url, "_blank");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setPdfLoading(false);
    }
  }, []);

  const saveToClientDocs = useCallback(async (auditId: string) => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/pm/site-audit/${auditId}/save-doc`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save document");
      }
      setSaveSuccess(true);
      // Refresh audit to get document_id
      const auditRes = await fetch(`/api/pm/site-audit/${auditId}`);
      const auditData = await auditRes.json();
      if (auditData.id) setActiveAudit(auditData);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save document");
    } finally {
      setSaving(false);
    }
  }, []);

  // ── Form View ──
  if (view === "form") {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-pm-text">Run Site Audit</h3>
          {audits.length > 0 && (
            <button
              onClick={() => setView("history")}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View past audits ({audits.length})
            </button>
          )}
        </div>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="text-sm text-pm-muted block mb-1">Website URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.example.com"
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => e.key === "Enter" && runAudit()}
            />
          </div>
          <div>
            <label className="text-sm text-pm-muted block mb-1">Organization type</label>
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value as AuditVertical)}
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="church">Church / Ministry</option>
              <option value="agency">Agency / Professional services</option>
              <option value="nonprofit">Nonprofit / Community org</option>
              <option value="general">General / Other</option>
            </select>
          </div>
          <button
            onClick={runAudit}
            disabled={!url.trim() || running}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {running ? "Running audit..." : "Run Site Audit"}
          </button>
        </div>
      </div>
    );
  }

  // ── History View ──
  if (view === "history") {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-pm-text">Past Audits</h3>
          <button
            onClick={() => setView("form")}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            New audit
          </button>
        </div>
        {audits.length === 0 ? (
          <p className="text-pm-muted text-sm">No audits yet.</p>
        ) : (
          <div className="space-y-2">
            {audits.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setActiveAudit(a);
                  setView(a.status === "complete" ? "results" : "form");
                }}
                className="w-full text-left bg-pm-bg border border-pm-border rounded-lg p-3 hover:border-blue-500/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-pm-text font-medium truncate">
                    {a.url}
                  </span>
                  <span className="text-xs text-pm-muted ml-2 shrink-0">
                    {a.overall?.grade && (
                      <span className={`font-bold mr-2 ${gradeColor(a.overall.grade)}`}>
                        {a.overall.grade}
                      </span>
                    )}
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-xs text-pm-muted mt-1">
                  {a.vertical} &middot; {a.status}
                  {a.document_id && <span className="ml-2 text-green-400">Saved to docs</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Running State ──
  if (activeAudit?.status === "running" || running) {
    return (
      <div className="p-6 text-center py-16">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-pm-muted text-sm">
          Analyzing {activeAudit?.url ?? url}... this takes about 15-30 seconds
        </p>
        <p className="text-pm-muted text-xs mt-2">
          Fetching multiple pages and scoring against rubric
        </p>
      </div>
    );
  }

  // ── Failed State ──
  if (activeAudit?.status === "failed") {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-400 text-sm">
            Audit failed: {activeAudit.audit_summary || "Unknown error"}
          </p>
        </div>
        <button
          onClick={() => {
            setActiveAudit(null);
            setView("form");
          }}
          className="mt-4 text-pm-muted text-sm hover:text-pm-text"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Results State ──
  if (!activeAudit || activeAudit.status !== "complete") {
    return (
      <div className="p-6">
        <p className="text-pm-muted text-sm">No audit results to display.</p>
        <button
          onClick={() => setView("form")}
          className="mt-2 text-sm text-blue-400 hover:text-blue-300"
        >
          Run a new audit
        </button>
      </div>
    );
  }

  const scores = activeAudit.scores as Record<string, AuditDimensionScore> | null;
  const overall = activeAudit.overall;
  const quickWins = (activeAudit.quick_wins ?? []) as AuditQuickWin[];
  const gaps = (activeAudit.gaps ?? {}) as Record<string, AuditGapItem[]>;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-pm-text">{activeAudit.url}</h3>
          <p className="text-xs text-pm-muted mt-1">
            {activeAudit.vertical} &middot;{" "}
            {new Date(activeAudit.created_at).toLocaleDateString()}
            {activeAudit.document_id && (
              <span className="ml-2 text-green-400">Saved to client docs</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView("history")}
            className="text-sm text-pm-muted hover:text-pm-text"
          >
            History
          </button>
          <button
            onClick={() => {
              setActiveAudit(null);
              setView("form");
            }}
            className="border border-pm-border text-pm-muted hover:text-pm-text px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            New Audit
          </button>
        </div>
      </div>

      {/* Score badges */}
      {scores && (
        <div className="flex gap-3 flex-wrap mb-6">
          {DIMENSIONS.map((d) => {
            const dim = scores[d.key];
            const isExpanded = expandedDim === d.key;
            return (
              <button
                key={d.key}
                onClick={() => setExpandedDim(isExpanded ? null : d.key)}
                className={`bg-pm-bg border ${gradeBg(dim?.grade)} rounded-lg p-3 text-center min-w-[80px] transition-colors hover:border-blue-500/50 cursor-pointer`}
              >
                <div className={`text-xl font-bold ${gradeColor(dim?.grade)}`}>
                  {dim?.grade ?? "?"}
                </div>
                <div className="text-[10px] text-pm-muted mt-1">{d.label}</div>
                {dim?.score != null && (
                  <div className="text-[10px] text-pm-muted">{dim.score}%</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Overall */}
      {overall && (
        <div className="flex items-center gap-4 mb-6">
          <div className="text-pm-muted text-sm">
            Overall:{" "}
            <span className={`font-bold ${gradeColor(overall.grade)}`}>
              {overall.grade} ({overall.score}/100)
            </span>
          </div>
          {overall.rebuild_recommended && (
            <span className="bg-red-900/30 text-red-400 text-xs px-3 py-1 rounded-full border border-red-800">
              Rebuild recommended
            </span>
          )}
        </div>
      )}

      {/* Summary */}
      {activeAudit.audit_summary && (
        <div className="bg-pm-bg border border-pm-border rounded-lg p-4 mb-6">
          <p className="text-sm text-pm-text leading-relaxed">{activeAudit.audit_summary}</p>
        </div>
      )}

      {/* Expanded dimension detail */}
      {expandedDim && scores && (
        <DimensionDetail
          dimKey={expandedDim}
          dim={scores[expandedDim]}
          gaps={gaps[expandedDim] || []}
          onClose={() => setExpandedDim(null)}
        />
      )}

      {/* Quick wins */}
      {quickWins.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-pm-text mb-3">Quick Wins</h4>
          <div className="space-y-2">
            {quickWins.map((w, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-orange-400 mt-0.5 shrink-0">&#8594;</span>
                <div>
                  <span className="text-pm-text">{w.action}</span>
                  <span className="text-pm-muted ml-2">({w.time_estimate})</span>
                  <span className="text-pm-muted ml-1">&middot; {w.impact}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {activeAudit.recommendations && activeAudit.recommendations.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-pm-text mb-3">Recommendations</h4>
          <div className="space-y-2">
            {(activeAudit.recommendations as Array<{ title: string; priority: string; effort: string; impact: string; description: string }>).map((r, i) => (
              <div key={i} className="bg-pm-bg border border-pm-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    r.priority === "high" ? "bg-red-900/30 text-red-400" :
                    r.priority === "medium" ? "bg-yellow-900/30 text-yellow-400" :
                    "bg-blue-900/30 text-blue-400"
                  }`}>{r.priority}</span>
                  <span className="text-sm font-medium text-pm-text">{r.title}</span>
                </div>
                <p className="text-xs text-pm-muted">{r.description}</p>
                <div className="text-xs text-pm-muted mt-1">
                  Effort: {r.effort} &middot; Impact: {r.impact}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pages to build */}
      {activeAudit.pages_to_build && activeAudit.pages_to_build.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-pm-text mb-3">Pages to Build</h4>
          <div className="bg-pm-bg border border-pm-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border text-pm-muted text-xs">
                  <th className="text-left p-2 font-medium">Priority</th>
                  <th className="text-left p-2 font-medium">Page</th>
                  <th className="text-left p-2 font-medium">URL</th>
                  <th className="text-left p-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {activeAudit.pages_to_build.map((p, i) => (
                  <tr key={i} className="border-b border-pm-border last:border-0">
                    <td className="p-2 font-bold text-orange-400">{p.priority}</td>
                    <td className="p-2 text-pm-text">{p.title}</td>
                    <td className="p-2 text-pm-muted font-mono text-xs">{p.slug}</td>
                    <td className="p-2 text-pm-muted">{p.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pages found vs missing */}
      {(activeAudit.pages_found?.length || activeAudit.pages_missing?.length) ? (
        <div className="mb-6 grid grid-cols-2 gap-4">
          {activeAudit.pages_found && activeAudit.pages_found.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-pm-text mb-2">Pages Found ({activeAudit.pages_found.length})</h4>
              <div className="bg-pm-bg border border-pm-border rounded-lg p-3">
                {activeAudit.pages_found.map((p, i) => (
                  <div key={i} className="text-xs text-green-400 font-mono py-0.5">{p}</div>
                ))}
              </div>
            </div>
          )}
          {activeAudit.pages_missing && activeAudit.pages_missing.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-pm-text mb-2">Pages Missing ({activeAudit.pages_missing.length})</h4>
              <div className="bg-pm-bg border border-pm-border rounded-lg p-3">
                {activeAudit.pages_missing.map((p, i) => (
                  <div key={i} className="text-xs text-red-400 font-mono py-0.5">{p}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Rebuild reason */}
      {overall?.rebuild_recommended && overall.rebuild_reason && (
        <div className="bg-red-900/10 border border-red-800/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-400">{overall.rebuild_reason}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => downloadReport(activeAudit.id)}
          disabled={pdfLoading}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {pdfLoading ? "Generating..." : "Open Report"}
        </button>
        {!activeAudit.document_id && (
          <button
            onClick={() => saveToClientDocs(activeAudit.id)}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save to Client Docs"}
          </button>
        )}
        {saveSuccess && (
          <span className="text-green-400 text-sm self-center">Saved to client documents</span>
        )}
        {activeAudit.document_id && (
          <span className="text-green-400 text-xs self-center">Report saved in client documents</span>
        )}
      </div>
    </div>
  );
}

// ── Dimension Detail Expandable Panel ──
function DimensionDetail({
  dimKey,
  dim,
  gaps,
  onClose,
}: {
  dimKey: string;
  dim: AuditDimensionScore;
  gaps: AuditGapItem[];
  onClose: () => void;
}) {
  const label = DIMENSION_FULL[dimKey] || dimKey;

  return (
    <div className="mb-6 bg-pm-bg border border-pm-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-pm-border">
        <div className="flex items-center gap-3">
          <span className={`text-lg font-bold ${gradeColor(dim?.grade)}`}>{dim?.grade ?? "?"}</span>
          <span className="text-sm font-semibold text-pm-text">{label}</span>
          <span className="text-xs text-pm-muted">({dim?.score ?? 0}%)</span>
        </div>
        <button onClick={onClose} className="text-pm-muted hover:text-pm-text text-xs">Close</button>
      </div>

      {/* Findings */}
      {dim?.findings && dim.findings.length > 0 && (
        <div className="p-3 border-b border-pm-border">
          <h5 className="text-xs font-semibold text-pm-muted mb-2 uppercase">Findings</h5>
          <ul className="space-y-1">
            {dim.findings.map((f, i) => (
              <li key={i} className="text-sm text-pm-text flex items-start gap-2">
                <span className="text-pm-muted shrink-0 mt-0.5">&#8226;</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gap items */}
      {gaps.length > 0 && (
        <div className="p-3">
          <h5 className="text-xs font-semibold text-pm-muted mb-2 uppercase">Gap Analysis</h5>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-pm-muted border-b border-pm-border">
                <th className="text-left p-1.5 font-medium">Item</th>
                <th className="text-left p-1.5 font-medium">Current State</th>
                <th className="text-left p-1.5 font-medium">Standard</th>
                <th className="text-left p-1.5 font-medium">Gap</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g, i) => (
                <tr key={i} className="border-b border-pm-border/50 last:border-0">
                  <td className="p-1.5 text-pm-text font-medium">{g.item}</td>
                  <td className="p-1.5 text-pm-muted">{g.current_state}</td>
                  <td className="p-1.5 text-pm-muted">{g.standard}</td>
                  <td className="p-1.5 text-orange-400">{g.gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {gaps.length === 0 && (!dim?.findings || dim.findings.length === 0) && (
        <div className="p-3 text-pm-muted text-xs">No detailed findings for this dimension.</div>
      )}
    </div>
  );
}
