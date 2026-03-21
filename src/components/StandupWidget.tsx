"use client";

import { useState, useEffect, useCallback } from "react";

interface StandupLog {
  id: string;
  date: string;
  content: string;
  generated_by: string;
  created_at: string;
}

interface Props {
  orgId: string;
  adminEmail?: string;
}

export function StandupWidget({ orgId, adminEmail }: Props) {
  const [today, setToday] = useState<StandupLog | null>(null);
  const [history, setHistory] = useState<StandupLog[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];

  const loadStandups = useCallback(async () => {
    try {
      const res = await fetch(`/api/pm/standup?org_id=${orgId}&limit=7`);
      if (!res.ok) return;
      const data: StandupLog[] = await res.json();
      const todayLog = data.find((d) => d.date === todayStr) ?? null;
      setToday(todayLog);
      setHistory(data.filter((d) => d.date !== todayStr));
    } catch {
      /* ignore */
    }
  }, [orgId, todayStr]);

  useEffect(() => {
    loadStandups();
  }, [loadStandups]);

  const [error, setError] = useState<string | null>(null);

  const generateStandup = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/pm/standup/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          send_email: sendEmail,
          email_to: sendEmail ? adminEmail : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate standup");
      }
      await loadStandups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate standup");
    } finally {
      setGenerating(false);
    }
  };

  const renderMarkdown = (md: string) => {
    return md
      .replace(
        /^## (.+)$/gm,
        '<h3 class="text-pm-text font-semibold text-sm mt-4 mb-2">$1</h3>'
      )
      .replace(
        /^- (.+)$/gm,
        '<div class="flex gap-2 text-pm-text/80 text-sm py-0.5"><span class="text-orange-400 mt-0.5 shrink-0">&#8594;</span><span>$1</span></div>'
      )
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-pm-text">$1</strong>');
  };

  return (
    <div className="bg-pm-card rounded-xl border border-pm-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-pm-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-pm-text font-medium text-sm">Morning Standup</span>
          <span className="text-pm-muted text-xs">{todayStr}</span>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-pm-muted hover:text-pm-text text-xs"
            >
              {showHistory ? "Hide history" : `${history.length} previous`}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {today ? (
          <div
            dangerouslySetInnerHTML={{ __html: renderMarkdown(today.content) }}
            className="space-y-1"
          />
        ) : (
          <div className="text-center py-6">
            <p className="text-pm-muted text-sm mb-4">
              No standup generated yet today
            </p>
            {error && (
              <p className="text-red-400 text-sm mb-3">{error}</p>
            )}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {adminEmail && (
                <label className="flex items-center gap-2 text-pm-muted text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="rounded border-pm-border"
                  />
                  Email to {adminEmail}
                </label>
              )}
              <button
                onClick={generateStandup}
                disabled={generating}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {generating ? "Generating..." : "Generate Standup"}
              </button>
            </div>
          </div>
        )}

        {/* Regenerate option */}
        {today && (
          <div className="mt-4 pt-4 border-t border-pm-border flex items-center justify-between">
            <span className="text-pm-muted text-xs">
              Generated {new Date(today.created_at).toLocaleTimeString()}
            </span>
            <button
              onClick={generateStandup}
              disabled={generating}
              className="text-pm-muted hover:text-pm-text text-xs disabled:opacity-50"
            >
              {generating ? "Regenerating..." : "Regenerate"}
            </button>
          </div>
        )}
      </div>

      {/* History */}
      {showHistory && history.length > 0 && (
        <div className="border-t border-pm-border divide-y divide-pm-border/50">
          {history.map((log) => (
            <details key={log.id} className="group">
              <summary className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-pm-bg/50">
                <span className="text-pm-muted text-sm">{log.date}</span>
                <span className="text-pm-muted text-xs group-open:rotate-180 transition-transform">
                  &#9662;
                </span>
              </summary>
              <div
                className="px-5 pb-4 space-y-1"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(log.content) }}
              />
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
