"use client";

import { useState, useEffect } from "react";
import type { AgentJob, AgentJobType } from "@/types/pm";

const JOB_TYPE_LABELS: Record<AgentJobType, string> = {
  engagement_risk_scan: "Engagement Risk Scan",
  weekly_rollup: "Weekly Rollup",
  audit_follow_up: "Audit Follow-Up",
  document_draft: "Document Draft",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-400 bg-amber-400/10",
  running: "text-blue-400 bg-blue-400/10 animate-pulse",
  complete: "text-emerald-400 bg-emerald-400/10",
  failed: "text-red-400 bg-red-400/10",
  skipped: "text-pm-muted bg-pm-surface",
};

function elapsed(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = e - s;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

export default function AgentJobsPage() {
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [triggerOrg, setTriggerOrg] = useState("");
  const [triggerType, setTriggerType] = useState<AgentJobType>("engagement_risk_scan");

  useEffect(() => {
    Promise.all([
      fetch("/api/pm/agent-jobs?limit=50").then((r) => r.json()),
      fetch("/api/pm/organizations").then((r) => r.json()),
    ]).then(([jobData, orgData]) => {
      if (Array.isArray(jobData)) setJobs(jobData);
      if (Array.isArray(orgData)) setOrgs(orgData);
    }).finally(() => setLoading(false));
  }, []);

  async function refresh() {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (statusFilter) params.set("status", statusFilter);
    const data = await fetch(`/api/pm/agent-jobs?${params}`).then((r) => r.json());
    if (Array.isArray(data)) setJobs(data);
    setLoading(false);
  }

  async function handleTrigger() {
    setTriggering(true);
    try {
      const res = await fetch("/api/pm/agent-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: triggerOrg || null,
          job_type: triggerType,
          payload: {},
        }),
      });
      if (res.ok) await refresh();
    } finally {
      setTriggering(false);
    }
  }

  const filtered = statusFilter ? jobs.filter((j) => j.status === statusFilter) : jobs;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-1">
        <a href="/settings" className="text-sm text-pm-muted hover:text-pm-text">&larr; Settings</a>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-pm-text">Agent Job Queue</h1>
          <p className="text-sm text-pm-muted mt-1">Background AI jobs — run hourly by the agent runner cron</p>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-1.5 text-sm border border-pm-border rounded-lg text-pm-muted hover:text-pm-text"
        >
          Refresh
        </button>
      </div>

      {/* Trigger panel */}
      <div className="card mb-6">
        <h2 className="font-semibold text-pm-text mb-3 text-sm">Trigger a Job Manually</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-pm-muted mb-1">Job Type</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as AgentJobType)}
              className="bg-pm-bg border border-pm-border rounded-lg px-3 py-1.5 text-sm text-pm-text focus:outline-none focus:border-blue-500"
            >
              {(Object.keys(JOB_TYPE_LABELS) as AgentJobType[]).map((t) => (
                <option key={t} value={t}>{JOB_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-pm-muted mb-1">Organization (optional)</label>
            <select
              value={triggerOrg}
              onChange={(e) => setTriggerOrg(e.target.value)}
              className="bg-pm-bg border border-pm-border rounded-lg px-3 py-1.5 text-sm text-pm-text focus:outline-none focus:border-blue-500"
            >
              <option value="">All orgs</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            {triggering ? "Enqueuing..." : "Enqueue Now"}
          </button>
        </div>
        <p className="text-xs text-pm-muted mt-2">
          Job will be picked up by the hourly runner. Check back in a few minutes.
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-4">
        {["", "pending", "running", "complete", "failed", "skipped"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              statusFilter === s
                ? "bg-blue-600/20 text-blue-400"
                : "text-pm-muted hover:text-pm-text hover:bg-pm-card"
            }`}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Job list */}
      {loading ? (
        <div className="text-pm-muted text-sm py-10 text-center">Loading jobs...</div>
      ) : filtered.length === 0 ? (
        <div className="text-pm-muted text-sm py-10 text-center">No jobs found</div>
      ) : (
        <div className="bg-pm-card border border-pm-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pm-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-pm-muted uppercase">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-pm-muted uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-pm-muted uppercase">Scheduled</th>
                <th className="px-4 py-3 text-xs font-medium text-pm-muted uppercase">Duration</th>
                <th className="px-4 py-3 text-xs font-medium text-pm-muted uppercase">Result</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr key={job.id} className="border-b border-pm-border last:border-0 hover:bg-pm-bg/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-pm-text">
                      {JOB_TYPE_LABELS[job.job_type as AgentJobType] ?? job.job_type}
                    </div>
                    {job.payload && Object.keys(job.payload).length > 0 && (
                      <div className="text-xs text-pm-muted mt-0.5 font-mono">
                        {JSON.stringify(job.payload).slice(0, 60)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[job.status] ?? ""}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-pm-muted">
                    {new Date(job.scheduled_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-pm-muted font-mono">
                    {elapsed(job.started_at, job.completed_at)}
                  </td>
                  <td className="px-4 py-3 text-xs text-pm-muted max-w-xs">
                    {job.status === "failed" && job.error ? (
                      <span className="text-red-400">{job.error.slice(0, 80)}</span>
                    ) : job.result ? (
                      <span className="font-mono">{JSON.stringify(job.result).slice(0, 80)}</span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
