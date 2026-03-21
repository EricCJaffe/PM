"use client";

import { useState } from "react";

interface AIReportsPanelProps {
  projectId: string;
  orgSlug: string;
  projectSlug: string;
}

type ReportType = "standup" | "risk-radar";

export function AIReportsPanel({ projectId, orgSlug, projectSlug }: AIReportsPanelProps) {
  const [generating, setGenerating] = useState<ReportType | null>(null);
  const [report, setReport] = useState<{ type: ReportType; content: string; date: string } | null>(null);
  const [history, setHistory] = useState<Array<{ date: string; content: string }>>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (type: ReportType) => {
    setGenerating(type);
    setError(null);
    try {
      const endpoint = type === "standup" ? "/api/pm/reports/standup" : "/api/pm/reports/risk-radar";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, org_slug: orgSlug, project_slug: projectSlug }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReport({ type, content: data.report, date: data.date });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(null);
    }
  };

  const loadHistory = async () => {
    if (showHistory) { setShowHistory(false); return; }
    try {
      const res = await fetch(`/api/pm/reports/standup?project_id=${projectId}&limit=7`);
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
      setShowHistory(true);
    } catch {
      setHistory([]);
      setShowHistory(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          onClick={() => generate("standup")}
          disabled={generating !== null}
          className="card hover:border-blue-500/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-pm-text">
                {generating === "standup" ? "Generating..." : "Daily Standup"}
              </div>
              <div className="text-xs text-pm-muted">AI-generated standup from task activity</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => generate("risk-radar")}
          disabled={generating !== null}
          className="card hover:border-red-500/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-pm-text">
                {generating === "risk-radar" ? "Scanning..." : "Risk Radar"}
              </div>
              <div className="text-xs text-pm-muted">Scan for escalating risks and blockers</div>
            </div>
          </div>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-600/10 border border-red-600/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Generated Report */}
      {report && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-pm-text">
              {report.type === "standup" ? "Daily Standup" : "Risk Radar"} — {report.date}
            </h4>
            <button
              onClick={() => setReport(null)}
              className="text-xs text-pm-muted hover:text-pm-text"
            >
              Dismiss
            </button>
          </div>
          <div
            className="prose prose-sm prose-invert max-w-none text-pm-text [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-pm-text [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-pm-muted [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:space-y-1 [&_li]:text-sm [&_p]:text-sm [&_table]:text-xs [&_th]:text-left [&_th]:py-1 [&_th]:pr-3 [&_td]:py-1 [&_td]:pr-3"
            dangerouslySetInnerHTML={{
              __html: markdownToHtml(report.content),
            }}
          />
        </div>
      )}

      {/* Standup History */}
      <button
        onClick={loadHistory}
        className="text-xs text-pm-muted hover:text-pm-text"
      >
        {showHistory ? "Hide" : "Show"} standup history
      </button>

      {showHistory && (
        <div className="space-y-2">
          {history.length === 0 && (
            <p className="text-xs text-pm-muted">No previous standups found.</p>
          )}
          {history.map((log) => (
            <details key={log.date} className="card">
              <summary className="text-sm font-medium text-pm-text cursor-pointer">
                {log.date}
              </summary>
              <div
                className="mt-2 prose prose-sm prose-invert max-w-none text-pm-text [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:space-y-1 [&_li]:text-sm [&_p]:text-sm"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(log.content) }}
              />
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

// Simple markdown to HTML conversion for rendering reports
function markdownToHtml(md: string): string {
  return md
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Tables
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split("|").filter(Boolean).map((c) => c.trim());
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    })
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Horizontal rule
    .replace(/^---$/gm, "<hr>")
    // Paragraphs
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hultdop])/gm, "")
    // Clean up
    .replace(/<p><\/p>/g, "")
    .replace(/<ul><\/ul>/g, "");
}
