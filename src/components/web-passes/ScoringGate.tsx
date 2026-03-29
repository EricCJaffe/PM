"use client";
import { useState } from "react";
import type { WebPass } from "@/types/pm";

const DIMENSION_LABELS: Record<string, string> = {
  seo: "SEO",
  conversion: "Conversion",
  ai_discoverability: "AI Discoverability",
  content: "Content Quality",
};

const THRESHOLDS: Record<string, number> = {
  seo: 70,
  conversion: 70,
  ai_discoverability: 60,
  content: 60,
};

interface ScoringDimension {
  score: number;
  grade: string;
  pass: boolean;
  notes: string[];
}

interface ScoringResults {
  scored_at: string;
  overall_score: number;
  overall_pass: boolean;
  dimensions: Record<string, ScoringDimension>;
  blocking_issues: string[];
  recommendations: string[];
}

function ScoreBar({ score, pass }: { score: number; pass: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-pm-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pass ? "bg-emerald-500" : "bg-red-500"}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-sm font-bold tabular-nums w-8 text-right ${pass ? "text-emerald-400" : "text-red-400"}`}>
        {score}
      </span>
    </div>
  );
}

export function ScoringGate({
  pass,
  onScored,
  onApprove,
}: {
  pass: WebPass;
  onScored: (updated: WebPass) => void;
  onApprove: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState(false);

  const results = pass.scoring_results as ScoringResults | null;

  const runScore = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/pm/web-passes/${pass.id}/score`, { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Refresh pass with scoring_results saved
      const refreshed = await fetch(`/api/pm/web-passes/${pass.id}`).then((r) => r.json());
      onScored(refreshed);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setRunning(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await onApprove();
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-pm-text">Quality Gate</h4>
          <p className="text-xs text-pm-muted mt-0.5">
            All dimensions must meet minimum thresholds before Go-Live is unlocked.
          </p>
        </div>
        <button
          onClick={runScore}
          disabled={running || !pass.deliverable_html}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {running ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Scoring…
            </span>
          ) : results ? "Re-run Scoring" : "Run Scoring Rubric"}
        </button>
      </div>

      {/* Threshold legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(THRESHOLDS).map(([dim, threshold]) => (
          <div key={dim} className="text-center p-2 rounded-lg bg-pm-bg border border-pm-border">
            <div className="text-xs text-pm-muted mb-0.5">{DIMENSION_LABELS[dim]}</div>
            <div className="text-sm font-semibold text-pm-text">Min {threshold}</div>
          </div>
        ))}
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Overall */}
          <div className={`flex items-center justify-between p-3 rounded-lg border ${
            results.overall_pass
              ? "bg-emerald-600/10 border-emerald-500/30"
              : "bg-red-600/10 border-red-500/30"
          }`}>
            <div>
              <span className={`text-sm font-semibold ${results.overall_pass ? "text-emerald-400" : "text-red-400"}`}>
                {results.overall_pass ? "PASSED — Ready for Go-Live" : "FAILED — Issues must be resolved"}
              </span>
              <span className="text-xs text-pm-muted ml-2">
                Last run {new Date(results.scored_at).toLocaleString()}
              </span>
            </div>
            <span className={`text-2xl font-bold tabular-nums ${results.overall_pass ? "text-emerald-400" : "text-red-400"}`}>
              {results.overall_score}
            </span>
          </div>

          {/* Per-dimension */}
          <div className="space-y-3">
            {Object.entries(results.dimensions).map(([dim, d]) => (
              <div key={dim}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${d.pass ? "bg-emerald-400" : "bg-red-400"}`} />
                    <span className="text-sm font-medium text-pm-text">{DIMENSION_LABELS[dim] ?? dim}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${d.pass ? "bg-emerald-600/20 text-emerald-400" : "bg-red-600/20 text-red-400"}`}>
                      {d.grade}
                    </span>
                  </div>
                  <span className="text-xs text-pm-muted">
                    {d.pass ? "✓ Pass" : `✗ Need ${THRESHOLDS[dim]}, got ${d.score}`}
                  </span>
                </div>
                <ScoreBar score={d.score} pass={d.pass} />
                {d.notes.length > 0 && !d.pass && (
                  <ul className="mt-1.5 space-y-0.5">
                    {d.notes.slice(0, 3).map((note, i) => (
                      <li key={i} className="text-xs text-pm-muted flex gap-1.5">
                        <span className="text-red-400 shrink-0">·</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {/* Blocking issues */}
          {results.blocking_issues.length > 0 && (
            <div className="p-3 rounded-lg bg-red-600/10 border border-red-500/30">
              <p className="text-xs font-semibold text-red-400 mb-1">Blocking Issues</p>
              <ul className="space-y-1">
                {results.blocking_issues.map((issue, i) => (
                  <li key={i} className="text-xs text-red-300 flex gap-1.5">
                    <span className="shrink-0">✗</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {results.recommendations.length > 0 && (
            <div className="p-3 rounded-lg bg-pm-bg border border-pm-border">
              <p className="text-xs font-semibold text-pm-muted mb-1">Quick Wins</p>
              <ul className="space-y-1">
                {results.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-pm-muted flex gap-1.5">
                    <span className="text-pm-accent shrink-0">→</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Approve gate */}
          {results.overall_pass && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {approving ? "Approving…" : "Approve Polish Pass → Unlock Go-Live"}
            </button>
          )}

          {!results.overall_pass && (
            <p className="text-xs text-center text-pm-muted">
              Fix the failing dimensions, apply feedback, re-generate, then re-run scoring.
            </p>
          )}
        </div>
      )}

      {!results && !pass.deliverable_html && (
        <p className="text-sm text-pm-muted text-center py-4">
          Generate the polished deliverable first, then run the scoring rubric.
        </p>
      )}
    </div>
  );
}
