"use client";

import { useState, useCallback } from "react";

interface DimComparison {
  label: string;
  before: { grade: string; score: number };
  after: { grade: string; score: number };
  delta: number;
  trend: "improved" | "declined" | "unchanged";
}

interface CompareResult {
  before: { id: string; date: string; overall: { grade: string; score: number } };
  after: { id: string; date: string; overall: { grade: string; score: number } };
  overall_delta: number;
  overall_trend: "improved" | "declined" | "unchanged";
  dimensions: Record<string, DimComparison>;
  ai_analysis: {
    executive_summary?: string;
    improvements?: Array<{ dimension: string; detail: string }>;
    declines?: Array<{ dimension: string; detail: string }>;
    still_needs_work?: Array<{ dimension: string; detail: string }>;
    next_steps?: string[];
    overall_assessment?: string;
  };
  org: { name: string; slug: string };
  url: string;
  agency_name: string;
}

interface AuditOption {
  id: string;
  date: string;
  grade: string;
  score: number;
}

interface Props {
  audits: AuditOption[];
  orgId: string;
  onClose: () => void;
}

function gradeColor(grade: string): string {
  if (grade === "A" || grade === "B") return "text-green-400";
  if (grade === "C") return "text-yellow-400";
  return "text-red-400";
}

function trendIcon(trend: string): string {
  if (trend === "improved") return "↑";
  if (trend === "declined") return "↓";
  return "→";
}

function trendColor(trend: string): string {
  if (trend === "improved") return "text-green-400";
  if (trend === "declined") return "text-red-400";
  return "text-pm-muted";
}

function deltaLabel(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

export function AuditCompare({ audits, orgId, onClose }: Props) {
  const [beforeId, setBeforeId] = useState(audits.length >= 2 ? audits[audits.length - 2].id : "");
  const [afterId, setAfterId] = useState(audits.length >= 1 ? audits[audits.length - 1].id : "");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const runComparison = useCallback(async () => {
    if (!beforeId || !afterId || beforeId === afterId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/pm/site-audit/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id_before: beforeId, audit_id_after: afterId }),
      });
      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  }, [beforeId, afterId]);

  // Fetch comparison HTML (shared between export and save)
  const fetchComparisonHtml = useCallback(async (): Promise<string> => {
    const res = await fetch("/api/pm/site-audit/compare/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audit_id_before: beforeId, audit_id_after: afterId }),
    });
    if (!res.ok) throw new Error("Export failed");
    return res.text();
  }, [beforeId, afterId]);

  const exportReport = useCallback(async () => {
    if (!result) return;
    setExportLoading(true);
    try {
      const html = await fetchComparisonHtml();
      const blob = new Blob([html], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportLoading(false);
    }
  }, [result, fetchComparisonHtml]);

  const saveToClientDocs = useCallback(async () => {
    if (!result) return;
    setSaveLoading(true);
    setSaveSuccess(false);
    try {
      // 1. Fetch the comparison HTML
      const html = await fetchComparisonHtml();

      // 2. Convert to PDF client-side
      const { htmlToPdfBlob } = await import("@/lib/html-to-pdf");
      const pdfBlob = await htmlToPdfBlob(html);

      // 3. Upload to save-doc endpoint
      const formData = new FormData();
      formData.append("pdf", pdfBlob, "comparison.pdf");
      formData.append("audit_id_before", beforeId);
      formData.append("audit_id_after", afterId);

      const res = await fetch("/api/pm/site-audit/compare/save-doc", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save document");
      }
      setSaveSuccess(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save comparison");
    } finally {
      setSaveLoading(false);
    }
  }, [result, fetchComparisonHtml, beforeId, afterId]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-pm-text">Compare Audits</h3>
        <button onClick={onClose} className="text-sm text-pm-muted hover:text-pm-text">
          Back
        </button>
      </div>

      {/* Selector */}
      <div className="flex gap-4 items-end mb-6">
        <div className="flex-1">
          <label className="text-xs text-pm-muted block mb-1">Before (baseline)</label>
          <select
            value={beforeId}
            onChange={(e) => setBeforeId(e.target.value)}
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm"
          >
            <option value="">Select audit...</option>
            {audits.map((a) => (
              <option key={a.id} value={a.id}>
                {a.date} — {a.grade} ({a.score}%)
              </option>
            ))}
          </select>
        </div>
        <div className="text-pm-muted text-lg pb-2">→</div>
        <div className="flex-1">
          <label className="text-xs text-pm-muted block mb-1">After (latest)</label>
          <select
            value={afterId}
            onChange={(e) => setAfterId(e.target.value)}
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm"
          >
            <option value="">Select audit...</option>
            {audits.map((a) => (
              <option key={a.id} value={a.id}>
                {a.date} — {a.grade} ({a.score}%)
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={runComparison}
          disabled={!beforeId || !afterId || beforeId === afterId || loading}
          className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
        >
          {loading ? "Comparing..." : "Compare"}
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-pm-muted text-sm">Running AI comparison analysis...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6">
          {/* Overall trend header */}
          <div className="bg-pm-bg border border-pm-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-pm-muted uppercase tracking-wider mb-1">Overall Score Change</div>
                <div className="flex items-baseline gap-3">
                  <span className={`text-3xl font-bold ${gradeColor(result.before.overall.grade)}`}>
                    {result.before.overall.grade}
                  </span>
                  <span className="text-pm-muted text-lg">→</span>
                  <span className={`text-3xl font-bold ${gradeColor(result.after.overall.grade)}`}>
                    {result.after.overall.grade}
                  </span>
                  <span className={`text-lg font-bold ${trendColor(result.overall_trend)}`}>
                    {trendIcon(result.overall_trend)} {deltaLabel(result.overall_delta)} pts
                  </span>
                </div>
              </div>
              <div className="text-right text-xs text-pm-muted">
                <div>{result.before.date} → {result.after.date}</div>
                <div>{result.before.overall.score}% → {result.after.overall.score}%</div>
              </div>
            </div>

            {/* Bar chart visualization */}
            <div className="space-y-2">
              {Object.entries(result.dimensions).map(([key, dim]) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-36 text-xs text-pm-muted truncate">{dim.label}</div>
                  <div className="flex-1 relative h-6 bg-pm-card rounded overflow-hidden">
                    {/* Before bar (semi-transparent) */}
                    <div
                      className="absolute inset-y-0 left-0 bg-blue-900/40 border-r border-blue-500/50"
                      style={{ width: `${dim.before.score}%` }}
                    />
                    {/* After bar */}
                    <div
                      className={`absolute inset-y-0 left-0 ${
                        dim.trend === "improved" ? "bg-green-600/50" :
                        dim.trend === "declined" ? "bg-red-600/50" :
                        "bg-blue-600/50"
                      }`}
                      style={{ width: `${dim.after.score}%` }}
                    />
                    {/* Score labels */}
                    <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-mono">
                      <span className="text-blue-300">{dim.before.score}%</span>
                      <span className={trendColor(dim.trend)}>{dim.after.score}% ({deltaLabel(dim.delta)})</span>
                    </div>
                  </div>
                  <div className={`w-6 text-center font-bold ${trendColor(dim.trend)}`}>
                    {trendIcon(dim.trend)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Analysis */}
          {result.ai_analysis.executive_summary && (
            <div className="bg-pm-bg border border-pm-border rounded-lg p-4">
              <h4 className="text-sm font-semibold text-pm-text mb-2">AI Analysis</h4>
              <p className="text-sm text-pm-text leading-relaxed">
                {result.ai_analysis.executive_summary}
              </p>
            </div>
          )}

          {/* Improvements */}
          {result.ai_analysis.improvements && result.ai_analysis.improvements.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-green-400 mb-2">What Improved</h4>
              <div className="space-y-2">
                {result.ai_analysis.improvements.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-400 shrink-0 mt-0.5">↑</span>
                    <div>
                      <span className="text-pm-text font-medium">{item.dimension}:</span>{" "}
                      <span className="text-pm-muted">{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Declines */}
          {result.ai_analysis.declines && result.ai_analysis.declines.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-red-400 mb-2">What Declined</h4>
              <div className="space-y-2">
                {result.ai_analysis.declines.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-red-400 shrink-0 mt-0.5">↓</span>
                    <div>
                      <span className="text-pm-text font-medium">{item.dimension}:</span>{" "}
                      <span className="text-pm-muted">{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Still needs work */}
          {result.ai_analysis.still_needs_work && result.ai_analysis.still_needs_work.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-yellow-400 mb-2">Still Needs Work</h4>
              <div className="space-y-2">
                {result.ai_analysis.still_needs_work.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-yellow-400 shrink-0 mt-0.5">→</span>
                    <div>
                      <span className="text-pm-text font-medium">{item.dimension}:</span>{" "}
                      <span className="text-pm-muted">{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next steps */}
          {result.ai_analysis.next_steps && result.ai_analysis.next_steps.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-pm-text mb-2">Recommended Next Steps</h4>
              <ol className="list-decimal list-inside space-y-1">
                {result.ai_analysis.next_steps.map((step, i) => (
                  <li key={i} className="text-sm text-pm-muted">{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Overall assessment */}
          {result.ai_analysis.overall_assessment && (
            <div className="bg-pm-bg border border-pm-border rounded-lg p-4">
              <p className="text-sm text-pm-text italic">
                {result.ai_analysis.overall_assessment}
              </p>
            </div>
          )}

          {/* Export + Save buttons */}
          <div className="flex gap-3 items-center">
            <button
              onClick={exportReport}
              disabled={exportLoading}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {exportLoading ? "Generating..." : "Export Comparison Report"}
            </button>
            <button
              onClick={saveToClientDocs}
              disabled={saveLoading || saveSuccess}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {saveLoading ? "Saving..." : saveSuccess ? "Saved" : "Save to Client Docs"}
            </button>
            {saveSuccess && (
              <span className="text-green-400 text-sm">Saved to client documents</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
