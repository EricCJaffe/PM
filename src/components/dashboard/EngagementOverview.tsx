"use client";

import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import Link from "next/link";
import type { Organization, Engagement, DealStage } from "@/types/pm";
import { StatusBadge } from "@/components/StatusBadge";

const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));

interface EngagementTask {
  id: string;
  name: string;
  status: string;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
}

interface AssignableMember {
  slug: string;
  display_name: string;
}

const STAGES: { value: DealStage; label: string; color: string; dotColor: string }[] = [
  { value: "lead", label: "Lead", color: "text-slate-300", dotColor: "bg-slate-400" },
  { value: "qualified", label: "Qualified", color: "text-blue-400", dotColor: "bg-blue-400" },
  { value: "discovery_complete", label: "Discovery", color: "text-cyan-400", dotColor: "bg-cyan-400" },
  { value: "proposal_sent", label: "Proposal Sent", color: "text-purple-400", dotColor: "bg-purple-400" },
  { value: "negotiation", label: "Negotiation", color: "text-amber-400", dotColor: "bg-amber-400" },
  { value: "closed_won", label: "Closed Won", color: "text-emerald-400", dotColor: "bg-emerald-400" },
  { value: "closed_lost", label: "Closed Lost", color: "text-red-400", dotColor: "bg-red-400" },
];

const STAGE_ORDER = STAGES.map((s) => s.value);

const SERVICE_LINES = [
  { value: "process_audit", label: "Process Audit" },
  { value: "ai_automation", label: "AI / Automation" },
  { value: "marketing", label: "Marketing" },
  { value: "business_consulting", label: "Business Consulting" },
  { value: "website_dev", label: "Website Development" },
  { value: "other", label: "Other" },
];

export function EngagementOverview({ org }: { org: Organization }) {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEngId, setActiveEngId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<EngagementTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    title: "",
    type: "new_prospect" as "new_prospect" | "existing_client",
    assigned_to: "",
    estimated_value: "",
    expected_close_date: "",
    engagement_type: "",
    referral_source: "",
  });

  // Load engagements
  useEffect(() => {
    fetch(`/api/pm/engagements?org_id=${org.id}`)
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setEngagements(data);
          if (data.length > 0) setActiveEngId(data[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch(`/api/pm/members/assignable?org_id=${org.id}`)
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((data) => { if (Array.isArray(data)) setMembers(data); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id]);

  // Load tasks for active engagement
  useEffect(() => {
    if (!activeEngId) { setTasks([]); return; }
    setTasksLoading(true);
    fetch(`/api/pm/tasks/my?org_id=${org.id}`)
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setTasks(data.filter((t: { engagement_id?: string }) => t.engagement_id === activeEngId));
        }
      })
      .catch(() => setTasks([]))
      .finally(() => setTasksLoading(false));
  }, [activeEngId, org.id]);

  const activeEng = useMemo(
    () => engagements.find((e) => e.id === activeEngId) || null,
    [engagements, activeEngId]
  );

  const currentStageIdx = activeEng ? STAGE_ORDER.indexOf(activeEng.deal_stage) : -1;

  // Next stage (skip closed_lost as a forward step)
  const nextStage = currentStageIdx >= 0 && currentStageIdx < STAGE_ORDER.length - 2
    ? STAGE_ORDER[currentStageIdx + 1]
    : null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    setCreating(true);
    try {
      const res = await fetch("/api/pm/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: org.id,
          title: form.title,
          type: form.type,
          assigned_to: form.assigned_to || null,
          estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
          expected_close_date: form.expected_close_date || null,
          engagement_type: form.engagement_type || null,
          referral_source: form.referral_source || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEngagements((prev) => [data, ...prev]);
      setActiveEngId(data.id);
      setShowCreate(false);
      setForm({ title: "", type: "new_prospect", assigned_to: "", estimated_value: "", expected_close_date: "", engagement_type: "", referral_source: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const advanceStage = async (targetStage: string) => {
    if (!activeEngId) return;
    setAdvancing(true);
    try {
      const res = await fetch(`/api/pm/engagements/${activeEngId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_stage: targetStage }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEngagements((prev) => prev.map((e) => e.id === activeEngId ? data : e));
      // Reload tasks (new tasks may have been spawned)
      const tasksRes = await fetch(`/api/pm/tasks/my?org_id=${org.id}`);
      const tasksData = await tasksRes.json();
      if (Array.isArray(tasksData)) {
        setTasks(tasksData.filter((t: { engagement_id?: string }) => t.engagement_id === activeEngId));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to advance stage");
    } finally {
      setAdvancing(false);
    }
  };

  const quickCompleteTask = async (taskId: string, done: boolean) => {
    const newStatus = done ? "complete" : "not-started";
    try {
      await fetch(`/api/pm/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, completed_at: done ? new Date().toISOString() : null }),
      });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus, completed_at: done ? new Date().toISOString() : null } : t));
    } catch {}
  };

  const updateEngagementField = async (field: string, value: unknown) => {
    if (!activeEngId) return;
    try {
      const res = await fetch(`/api/pm/engagements/${activeEngId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!data.error) {
        setEngagements((prev) => prev.map((e) => e.id === activeEngId ? data : e));
      }
    } catch {}
  };

  // Group tasks by stage (must be before any early returns to satisfy rules of hooks)
  const stageTasks = useMemo(() => {
    const grouped: Record<string, EngagementTask[]> = {};
    for (const t of tasks) grouped[t.status] = [...(grouped[t.status] || []), t];
    return grouped;
  }, [tasks]);

  const completedTasks = tasks.filter((t) => t.status === "complete").length;
  const totalTasks = tasks.length;

  if (loading) return <div className="text-pm-muted py-8">Loading engagements...</div>;

  return (
    <div className="space-y-6">
      {/* Engagement selector + create */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {engagements.length > 1 && (
            <select
              value={activeEngId || ""}
              onChange={(e) => setActiveEngId(e.target.value)}
              className="bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text"
            >
              {engagements.map((eng) => (
                <option key={eng.id} value={eng.id}>{eng.title}</option>
              ))}
            </select>
          )}
          {engagements.length === 1 && (
            <h3 className="text-lg font-semibold text-pm-text">{engagements[0].title}</h3>
          )}
          {activeEng && (
            <span className="text-xs text-pm-muted capitalize">
              {activeEng.type.replace("_", " ")}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showCreate ? "Cancel" : "+ New Engagement"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <div className="text-sm font-semibold text-pm-text">New Engagement</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-pm-muted mb-1">Title *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="e.g. Initial MSA + SOW"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-pm-muted mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "new_prospect" | "existing_client" }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text"
              >
                <option value="new_prospect">New Prospect</option>
                <option value="existing_client">Existing Client (New SOW)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-pm-muted mb-1">Service Line</label>
              <select
                value={form.engagement_type}
                onChange={(e) => setForm((f) => ({ ...f, engagement_type: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text"
              >
                <option value="">Select...</option>
                {SERVICE_LINES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-pm-muted mb-1">Assigned To</label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.slug} value={m.slug}>{m.display_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-pm-muted mb-1">Estimated Value</label>
              <input
                type="number"
                step="0.01"
                value={form.estimated_value}
                onChange={(e) => setForm((f) => ({ ...f, estimated_value: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text"
                placeholder="$0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-pm-muted mb-1">Expected Close</label>
              <input
                type="date"
                value={form.expected_close_date}
                onChange={(e) => setForm((f) => ({ ...f, expected_close_date: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-pm-muted mb-1">Referral Source</label>
              <input
                value={form.referral_source}
                onChange={(e) => setForm((f) => ({ ...f, referral_source: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text"
                placeholder="e.g. Website, Referral, LinkedIn"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || !form.title}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {creating ? "Creating..." : "Create Engagement"}
          </button>
        </form>
      )}

      {/* No engagements state */}
      {engagements.length === 0 && !showCreate && (
        <div className="text-center py-12 text-pm-muted">
          <p className="text-lg mb-2">No engagements yet</p>
          <p className="text-sm">Create an engagement to start tracking the sales pipeline for this client.</p>
        </div>
      )}

      {/* Active engagement view */}
      {activeEng && (
        <>
          {/* ── Stage Stepper ── */}
          <div className="card">
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {STAGES.filter((s) => s.value !== "closed_lost").map((stage, i) => {
                const stageIdx = STAGE_ORDER.indexOf(stage.value);
                const isActive = stageIdx === currentStageIdx;
                const isComplete = stageIdx < currentStageIdx;
                const isFuture = stageIdx > currentStageIdx;

                return (
                  <div key={stage.value} className="flex items-center shrink-0">
                    <div
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-pm-accent/20 text-pm-accent border border-pm-accent/40 ring-1 ring-pm-accent/20"
                          : isComplete
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-pm-bg text-pm-muted border border-pm-border"
                      }`}
                    >
                      {isComplete ? (
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className={`w-2 h-2 rounded-full ${isActive ? "bg-pm-accent" : "bg-pm-muted/40"}`} />
                      )}
                      {stage.label}
                    </div>
                    {i < 5 && (
                      <svg className={`w-5 h-5 mx-1 ${isComplete ? "text-emerald-500/40" : "text-pm-border"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Advance / Close Lost buttons */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-pm-border">
              <div className="text-sm text-pm-muted">
                {completedTasks}/{totalTasks} tasks complete in this engagement
              </div>
              <div className="flex gap-2">
                {activeEng.deal_stage !== "closed_lost" && activeEng.deal_stage !== "closed_won" && (
                  <button
                    onClick={() => advanceStage("closed_lost")}
                    disabled={advancing}
                    className="px-3 py-1.5 border border-red-600/30 text-red-400 hover:bg-red-600/10 rounded-lg text-xs font-medium"
                  >
                    Mark Lost
                  </button>
                )}
                <Link
                  href={`/projects/intake?engagement_id=${activeEng.id}&org_id=${org.id}`}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Convert to project
                </Link>
                <button
                  onClick={() => {
                    // Switch to Tools tab via parent DashboardTabs
                    const toolsBtn = document.querySelector<HTMLButtonElement>('[data-tab-id="tools"]');
                    if (toolsBtn) toolsBtn.click();
                  }}
                  className="px-3 py-1.5 border border-pm-accent/40 text-pm-accent hover:bg-pm-accent/10 rounded-lg text-xs font-medium transition-colors"
                >
                  Run Site Audit
                </button>
                {nextStage && (
                  <button
                    onClick={() => advanceStage(nextStage)}
                    disabled={advancing}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {advancing ? "Advancing..." : `Advance to ${STAGES.find((s) => s.value === nextStage)?.label}`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card">
              <div className="text-xs text-pm-muted mb-1">Deal Value</div>
              <div className="text-xl font-bold text-pm-text">
                {activeEng.estimated_value
                  ? `$${Number(activeEng.estimated_value).toLocaleString()}`
                  : "—"}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-pm-muted mb-1">Expected Close</div>
              <div className="text-xl font-bold text-pm-text">
                {activeEng.expected_close_date
                  ? new Date(activeEng.expected_close_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : "—"}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-pm-muted mb-1">Service Line</div>
              <div className="text-sm font-semibold text-pm-text capitalize">
                {activeEng.engagement_type
                  ? SERVICE_LINES.find((s) => s.value === activeEng.engagement_type)?.label || activeEng.engagement_type
                  : "—"}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-pm-muted mb-1">Assigned To</div>
              <div className="text-sm font-semibold text-pm-text">
                {activeEng.assigned_to
                  ? members.find((m) => m.slug === activeEng.assigned_to)?.display_name || activeEng.assigned_to
                  : "—"}
              </div>
            </div>
          </div>

          {/* ── Engagement Tasks Checklist ── */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-pm-text">Engagement Tasks</h4>
              <span className="text-xs text-pm-muted">{completedTasks}/{totalTasks} done</span>
            </div>
            {tasksLoading ? (
              <div className="text-sm text-pm-muted py-4">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="text-sm text-pm-muted py-4">No tasks for this engagement yet.</div>
            ) : (
              <div className="space-y-1">
                {tasks.map((task) => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "complete";
                  const isDone = task.status === "complete";
                  return (
                    <div key={task.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-pm-bg/50 transition-colors">
                      <button
                        onClick={() => quickCompleteTask(task.id, !isDone)}
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isDone ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-pm-border hover:border-pm-accent"
                        }`}
                      >
                        {isDone && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className={`flex-1 text-sm ${isDone ? "text-pm-muted line-through" : "text-pm-text"}`}>
                        {task.name}
                      </div>
                      {task.assigned_to && (
                        <span className="text-xs text-pm-muted">{task.assigned_to}</span>
                      )}
                      {task.due_date && (
                        <span className={`text-xs ${isOverdue ? "text-red-400 font-medium" : "text-pm-muted"}`}>
                          {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <StatusBadge status={task.status as "not-started" | "in-progress" | "complete" | "blocked" | "pending" | "on-hold"} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Discovery Notes ── */}
          <div className="card">
            <h4 className="font-semibold text-pm-text mb-3">Discovery Notes</h4>
            <div onBlur={() => updateEngagementField("discovery_notes", activeEng.discovery_notes || null)}>
              <Suspense fallback={<div className="h-[150px] bg-pm-bg border border-pm-border rounded-lg flex items-center justify-center text-pm-muted text-sm">Loading editor...</div>}>
                <RichTextEditor
                  value={activeEng.discovery_notes || ""}
                  onChange={(html) => {
                    setEngagements((prev) =>
                      prev.map((eng) => eng.id === activeEngId ? { ...eng, discovery_notes: html } : eng)
                    );
                  }}
                  placeholder="Notes from discovery calls, meetings, client requirements..."
                />
              </Suspense>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
