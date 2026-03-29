"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import type {
  Organization, SiteAudit, AuditVertical, AuditGrade,
  AuditScores, AuditDimensionScore, AuditOverall,
} from "@/types/pm";
import { WebPassTab } from "@/components/web-passes/WebPassTab";

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
  "D-": "text-orange-400 bg-orange-400/10",
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

function GradeBadge({ grade, size = "sm" }: { grade: AuditGrade; size?: "sm" | "lg" }) {
  const cls = size === "lg"
    ? "w-12 h-12 rounded-xl text-xl"
    : "w-8 h-8 rounded-lg text-sm";
  return (
    <span className={`inline-flex items-center justify-center font-bold ${cls} ${GRADE_COLORS[grade] || GRADE_COLORS.F}`}>
      {grade}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 90 ? "bg-emerald-500" : score >= 80 ? "bg-blue-500"
    : score >= 70 ? "bg-amber-500" : score >= 60 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-pm-bg rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs text-pm-muted w-8 text-right">{score}%</span>
    </div>
  );
}

/** Backward compat: handle both old (letter-only) and new (object) score formats */
function normalizeDimensionScore(raw: unknown, key: string): AuditDimensionScore {
  if (typeof raw === "object" && raw !== null && "score" in (raw as Record<string, unknown>)) {
    return raw as AuditDimensionScore;
  }
  // Legacy format: just a letter grade
  const grade = (typeof raw === "string" ? raw : "F") as AuditGrade;
  const gradeToScore: Record<string, number> = { A: 95, B: 85, C: 75, D: 65, "D-": 55, F: 30 };
  const weights: Record<string, number> = {
    seo: 0.20, entity: 0.15, ai_discoverability: 0.20,
    conversion: 0.20, content: 0.15, a2a_readiness: 0.10,
  };
  return { grade, score: gradeToScore[grade] ?? 30, weight: weights[key] ?? 0.15, findings: [] };
}

function getOverall(audit: SiteAudit): AuditOverall {
  if (audit.overall) return audit.overall;
  // Compute from scores for backward compat
  if (!audit.scores) return { grade: "F", score: 0, rebuild_recommended: false, rebuild_reason: null };

  const dims = Object.entries(audit.scores).map(([k, v]) => normalizeDimensionScore(v, k));
  const weighted = dims.reduce((sum, d) => sum + d.score * d.weight, 0);
  const score = Math.round(weighted);
  const grade: AuditGrade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C"
    : score >= 60 ? "D" : score >= 50 ? "D-" : "F";
  return { grade, score, rebuild_recommended: score < 60, rebuild_reason: null };
}

// ─── Audit Results View ─────────────────────────────────────────────

function AuditResults({
  audit,
  orgId,
  onBack,
  onGenerateDoc,
  onGeneratePDF,
  onStartWebPass,
}: {
  audit: SiteAudit;
  orgId: string;
  onBack: () => void;
  onGenerateDoc: () => void;
  onGeneratePDF: () => void;
  onStartWebPass: () => void;
}) {
  const router = useRouter();
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [creatingWorkflow, setCreatingWorkflow] = useState<"remediation" | "rebuild" | null>(null);

  const handleGenerateDoc = async () => {
    setGeneratingDoc(true);
    onGenerateDoc();
  };

  const handleGeneratePDF = async () => {
    setGeneratingPDF(true);
    onGeneratePDF();
  };

  const overall = audit.status === "complete" && audit.scores ? getOverall(audit) : null;
  const isRebuildRecommended = overall?.rebuild_recommended ?? false;

  const handleStartWorkflow = async (type: "remediation" | "rebuild") => {
    setCreatingWorkflow(type);
    try {
      const siteName = audit.url.replace(/https?:\/\//, "").replace(/\/$/, "");
      const name = type === "rebuild"
        ? `Website Rebuild — ${siteName}`
        : `Site Remediation — ${siteName}`;
      const slug = `${type}-${siteName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now().toString(36)}`;

      const res = await fetch("/api/pm/projects/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description: type === "rebuild"
            ? `Full website rebuild based on site audit of ${audit.url}. Overall score: ${overall?.score ?? "N/A"}%. Build a new site from scratch using rubric best practices.`
            : `Remediation project based on site audit of ${audit.url}. Overall score: ${overall?.score ?? "N/A"}%. Fix gaps and issues identified by the audit.`,
          template_slug: "custom",
          org_id: orgId,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      router.push(`/projects/${data.slug || slug}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreatingWorkflow(null);
    }
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
  const ov = overall!;
  const gaps = audit.gaps || {};
  const recommendations = audit.recommendations || [];
  const quickWins = audit.quick_wins || [];
  const pagesToBuild = audit.pages_to_build || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-pm-muted hover:text-pm-text">&larr; Back to audits</button>
        <div className="flex gap-2">
          <button
            onClick={handleGeneratePDF}
            disabled={generatingPDF}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {generatingPDF ? "Generating..." : "Download PDF"}
          </button>
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

      {/* Start a Workflow */}
      <div className="card">
        <h3 className="font-semibold text-pm-text mb-1">Start a Workflow</h3>
        <p className="text-sm text-pm-muted mb-4">
          Use this audit to create a structured project with tasks generated from the findings.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Remediation */}
          <button
            onClick={() => handleStartWorkflow("remediation")}
            disabled={creatingWorkflow !== null}
            className="card text-left hover:border-pm-muted/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-slate-600/30 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h4 className="font-semibold text-pm-text">Remediation</h4>
            </div>
            <p className="text-sm text-pm-muted leading-relaxed">
              Keep the current site. Fix gaps and issues identified by the audit. Re-audit to track improvement.
            </p>
            {creatingWorkflow === "remediation" && (
              <div className="mt-3 text-xs text-pm-accent animate-pulse">Creating project...</div>
            )}
          </button>

          {/* Website Rebuild */}
          <button
            onClick={() => handleStartWorkflow("rebuild")}
            disabled={creatingWorkflow !== null}
            className={`card text-left transition-all cursor-pointer group ${
              isRebuildRecommended ? "border-amber-500/30 hover:border-amber-500/60" : "hover:border-pm-muted/50"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-amber-600/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-pm-text">Website Rebuild</h4>
                {isRebuildRecommended && (
                  <span className="px-2 py-0.5 bg-emerald-600/20 text-emerald-400 text-[10px] font-bold rounded uppercase tracking-wider">
                    Recommended
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-pm-muted leading-relaxed">
              Build a new site from scratch using rubric best practices. Guided discovery, design, content, and review process.
            </p>
            {creatingWorkflow === "rebuild" && (
              <div className="mt-3 text-xs text-pm-accent animate-pulse">Creating project...</div>
            )}
          </button>

          {/* 5-Pass Guided Rebuild */}
          <button
            onClick={onStartWebPass}
            disabled={creatingWorkflow !== null}
            className="card text-left border-emerald-500/30 hover:border-emerald-500/60 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-600/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-pm-text">Guided Rebuild</h4>
                <span className="px-2 py-0.5 bg-emerald-600/20 text-emerald-400 text-[10px] font-bold rounded uppercase tracking-wider">
                  5-Pass
                </span>
              </div>
            </div>
            <p className="text-sm text-pm-muted leading-relaxed">
              Structured discovery → design → content → polish → go-live workflow with client review at each pass.
            </p>
          </button>
        </div>
      </div>

      {/* Header with Overall Score */}
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
            <GradeBadge grade={ov.grade} size="lg" />
            <div className="text-xs text-pm-muted mt-1">{ov.score}%</div>
          </div>
        </div>
        {audit.audit_summary && (
          <p className="text-sm text-pm-muted">{audit.audit_summary}</p>
        )}
        {ov.rebuild_recommended && (
          <div className="mt-3 p-3 bg-red-600/10 border border-red-600/30 rounded-lg">
            <span className="text-sm font-medium text-red-400">Rebuild Recommended</span>
            {ov.rebuild_reason && (
              <p className="text-xs text-red-300 mt-1">{ov.rebuild_reason}</p>
            )}
          </div>
        )}
      </div>

      {/* Score Card with Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(scores).map(([key, rawVal]) => {
          const dim = normalizeDimensionScore(rawVal, key);
          return (
            <div key={key} className="card">
              <div className="flex items-center gap-3 mb-2">
                <GradeBadge grade={dim.grade} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-pm-text">{DIMENSION_LABELS[key] || key}</div>
                  <div className="text-xs text-pm-muted">{Math.round(dim.weight * 100)}% weight</div>
                </div>
              </div>
              <ScoreBar score={dim.score} />
              {dim.findings.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {dim.findings.slice(0, 3).map((f, i) => (
                    <li key={i} className="text-xs text-pm-muted flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5 text-pm-muted">&bull;</span>
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <div className="card">
          <h4 className="font-semibold text-pm-text mb-3">Quick Wins</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border">
                  <th className="text-left py-2 text-pm-muted font-medium">Action</th>
                  <th className="text-center py-2 text-pm-muted font-medium w-24">Time</th>
                  <th className="text-left py-2 text-pm-muted font-medium w-40">Impact</th>
                </tr>
              </thead>
              <tbody>
                {quickWins.map((qw, i) => (
                  <tr key={i} className="border-b border-pm-border/50">
                    <td className="py-2 text-pm-text">
                      {"action" in qw ? (qw as { action: string }).action : (qw as { title?: string }).title || ""}
                    </td>
                    <td className="py-2 text-center text-pm-muted">
                      {"time_estimate" in qw ? (qw as { time_estimate: string }).time_estimate : "—"}
                    </td>
                    <td className="py-2 text-pm-muted">
                      {"impact" in qw ? (qw as { impact: string }).impact : (qw as { description?: string }).description || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gap Analysis */}
      <div className="card">
        <h4 className="font-semibold text-pm-text mb-4">Gap Analysis</h4>
        <div className="space-y-6">
          {Object.entries(gaps).map(([dimension, items]) => {
            const dim = normalizeDimensionScore(
              (scores as unknown as Record<string, unknown>)[dimension],
              dimension
            );
            return (
              <div key={dimension}>
                <div className="flex items-center gap-2 mb-3">
                  <GradeBadge grade={dim.grade} />
                  <span className="text-sm font-medium text-pm-text">{DIMENSION_LABELS[dimension] || dimension}</span>
                  <span className="text-xs text-pm-muted">({dim.score}%)</span>
                </div>
                <div className="overflow-x-auto ml-10">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-pm-border">
                        <th className="text-left py-1.5 text-pm-muted font-medium">Item</th>
                        <th className="text-left py-1.5 text-pm-muted font-medium">Current State</th>
                        <th className="text-left py-1.5 text-pm-muted font-medium">Standard</th>
                        <th className="text-left py-1.5 text-pm-muted font-medium">Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(items as unknown as Array<Record<string, string>>).map((item, i) => (
                        <tr key={i} className="border-b border-pm-border/30">
                          <td className="py-1.5 text-pm-text font-medium">
                            {item.item || item.issue || ""}
                          </td>
                          <td className="py-1.5 text-pm-muted">
                            {item.current_state || ""}
                          </td>
                          <td className="py-1.5 text-pm-muted">
                            {item.standard || ""}
                          </td>
                          <td className="py-1.5 text-pm-muted">
                            {item.gap || item.recommendation || ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
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
          <h4 className="font-semibold text-pm-text mb-3">Pages to Build — Priority Order</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border">
                  <th className="text-center py-2 text-pm-muted font-medium w-12">Pri</th>
                  <th className="text-left py-2 text-pm-muted font-medium">Page</th>
                  <th className="text-left py-2 text-pm-muted font-medium w-28">URL</th>
                  <th className="text-left py-2 text-pm-muted font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {pagesToBuild.map((page, i) => (
                  <tr key={i} className="border-b border-pm-border/50">
                    <td className="py-2 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                        ("priority" in page && page.priority === "P0") ? "bg-red-600/20 text-red-400" :
                        ("priority" in page && page.priority === "P1") ? "bg-amber-600/20 text-amber-400" :
                        "bg-slate-600/20 text-pm-muted"
                      }`}>
                        {"priority" in page ? page.priority : `P${i}`}
                      </span>
                    </td>
                    <td className="py-2 font-medium text-pm-text">{page.title}</td>
                    <td className="py-2">
                      <code className="text-xs text-pm-accent bg-pm-bg px-1.5 py-0.5 rounded">{page.slug}</code>
                    </td>
                    <td className="py-2 text-xs text-pm-muted">
                      {page.notes || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Platform Comparison */}
      {audit.platform_comparison && (
        <div className="card">
          <h4 className="font-semibold text-pm-text mb-3">Platform Comparison</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-red-600/5 border border-red-600/20 rounded-lg">
              <div className="text-xs text-red-400 font-medium mb-1">Current</div>
              <p className="text-sm text-pm-text">{audit.platform_comparison.current}</p>
            </div>
            <div className="p-3 bg-emerald-600/5 border border-emerald-600/20 rounded-lg">
              <div className="text-xs text-emerald-400 font-medium mb-1">Recommended</div>
              <p className="text-sm text-pm-text">{audit.platform_comparison.recommended}</p>
            </div>
          </div>
        </div>
      )}

      {/* Rebuild Timeline */}
      {audit.rebuild_timeline && audit.rebuild_timeline.length > 0 && (
        <div className="card">
          <h4 className="font-semibold text-pm-text mb-3">Rebuild Timeline</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border">
                  <th className="text-left py-2 text-pm-muted font-medium w-36">Phase</th>
                  <th className="text-left py-2 text-pm-muted font-medium w-36">Focus</th>
                  <th className="text-left py-2 text-pm-muted font-medium">Deliverables</th>
                </tr>
              </thead>
              <tbody>
                {audit.rebuild_timeline.map((phase, i) => (
                  <tr key={i} className="border-b border-pm-border/50">
                    <td className="py-2 font-medium text-pm-text">{phase.phase}</td>
                    <td className="py-2 text-pm-muted">{phase.focus}</td>
                    <td className="py-2 text-xs text-pm-muted">{phase.deliverables}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  const [webPassAudit, setWebPassAudit] = useState<SiteAudit | null>(null);

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

      const updatedAudit = { ...audit, document_id: data.document_id };
      setActiveAudit(updatedAudit);
      setAudits((prev) => prev.map((a) => (a.id === audit.id ? updatedAudit : a)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate document");
    }
  };

  const handleGeneratePDF = async (audit: SiteAudit) => {
    try {
      const res = await fetch(`/api/pm/site-audit/${audit.id}/pdf`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `site-audit-${audit.url.replace(/https?:\/\//, "").replace(/[^a-z0-9]/gi, "-")}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate PDF");
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

  if (webPassAudit) {
    return <WebPassTab org={org} audit={webPassAudit} onBack={() => setWebPassAudit(null)} />;
  }

  if (activeAudit) {
    return (
      <AuditResults
        audit={activeAudit}
        orgId={org.id}
        onBack={() => setActiveAudit(null)}
        onGenerateDoc={() => handleGenerateDoc(activeAudit)}
        onGeneratePDF={() => handleGeneratePDF(activeAudit)}
        onStartWebPass={() => setWebPassAudit(activeAudit)}
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
            {audits.map((audit) => {
              const ov = getOverall(audit);
              return (
                <div key={audit.id} className="card flex items-center justify-between">
                  <button
                    onClick={() => setActiveAudit(audit)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {audit.status === "complete" && audit.scores ? (
                        <div className="text-center">
                          <GradeBadge grade={ov.grade} />
                          <div className="text-[10px] text-pm-muted mt-0.5">{ov.score}%</div>
                        </div>
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
                          {ov.rebuild_recommended && (
                            <>
                              <span>&middot;</span>
                              <span className="text-red-400">Rebuild recommended</span>
                            </>
                          )}
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
