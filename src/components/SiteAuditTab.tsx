"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  SiteAudit,
  AuditVertical,
  AuditQuickWin,
  AuditDimensionScore,
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

function gradeColor(grade: string | undefined): string {
  if (!grade) return "text-pm-muted";
  if (grade === "A" || grade === "B") return "text-green-400";
  if (grade === "C") return "text-yellow-400";
  return "text-red-400";
}

export function SiteAuditTab({ engagementId, orgId, defaultUrl }: Props) {
  const [audits, setAudits] = useState<SiteAudit[]>([]);
  const [activeAudit, setActiveAudit] = useState<SiteAudit | null>(null);
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [vertical, setVertical] = useState<AuditVertical>("church");
  const [running, setRunning] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [view, setView] = useState<"form" | "results" | "history">("form");

  // Load existing audits
  useEffect(() => {
    fetch(`/api/pm/site-audit?org_id=${orgId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAudits(data);
          // Auto-show latest complete audit if available
          const latest = data.find((a: SiteAudit) => a.status === "complete");
          if (latest) {
            setActiveAudit(latest);
            setView("results");
          }
        }
      })
      .catch(() => {});
  }, [orgId]);

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
            if (data.status === "complete") setView("results");
          }
        }
      } catch {
        /* retry on next tick */
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [activeAudit?.id, activeAudit?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAudit = useCallback(async () => {
    if (!url.trim()) return;
    setRunning(true);
    setView("results");
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

      // Trigger background processing (separate serverless invocation)
      fetch("/api/pm/site-audit/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_id: data.id,
          url: data.url,
          vertical,
          org_id: orgId,
          extra_context: null,
        }),
      }).catch(() => {
        // Processing errors are handled server-side (marks audit as failed)
      });
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-pm-text">{activeAudit.url}</h3>
          <p className="text-xs text-pm-muted mt-1">
            {activeAudit.vertical} &middot;{" "}
            {new Date(activeAudit.created_at).toLocaleDateString()}
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
            return (
              <div
                key={d.key}
                className="bg-pm-bg border border-pm-border rounded-lg p-3 text-center min-w-[80px]"
              >
                <div className={`text-xl font-bold ${gradeColor(dim?.grade)}`}>
                  {dim?.grade ?? "?"}
                </div>
                <div className="text-[10px] text-pm-muted mt-1">{d.label}</div>
                {dim?.score != null && (
                  <div className="text-[10px] text-pm-muted">{dim.score}%</div>
                )}
              </div>
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
          {pdfLoading ? "Generating..." : "Download Report"}
        </button>
        {activeAudit.document_id && (
          <button
            onClick={() =>
              window.open(`/api/pm/site-audit/${activeAudit.id}`, "_blank")
            }
            className="border border-pm-border text-pm-muted hover:text-pm-text px-4 py-2 rounded-lg text-sm transition-colors"
          >
            View Full Document
          </button>
        )}
      </div>
    </div>
  );
}
