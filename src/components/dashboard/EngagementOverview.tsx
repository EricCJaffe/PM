"use client";

import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import Link from "next/link";
import type { Organization, Engagement, DealStage, EngagementAttachment } from "@/types/pm";
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

const ATTACHMENT_CATEGORIES = [
  { value: "discovery", label: "Discovery" },
  { value: "proposal", label: "Proposal" },
  { value: "contract", label: "Contract" },
  { value: "intake", label: "Intake" },
  { value: "project-files", label: "Project Files" },
  { value: "general", label: "General" },
  { value: "other", label: "Other" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

  // Discovery notes state — tracks dirty/saved independently from engagement state
  const [notesContent, setNotesContent] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesRef = useRef(notesContent);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Attachments state
  const [attachments, setAttachments] = useState<EngagementAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("discovery");
  const [generatingProjectFiles, setGeneratingProjectFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Load attachments for active engagement
  useEffect(() => {
    if (!activeEngId) { setAttachments([]); return; }
    setAttachmentsLoading(true);
    fetch(`/api/pm/engagements/${activeEngId}/attachments`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { if (Array.isArray(data)) setAttachments(data); })
      .catch(() => setAttachments([]))
      .finally(() => setAttachmentsLoading(false));
  }, [activeEngId]);

  const activeEng = useMemo(
    () => engagements.find((e) => e.id === activeEngId) || null,
    [engagements, activeEngId]
  );

  // Sync discovery notes when active engagement changes
  useEffect(() => {
    if (activeEng) {
      setNotesContent(activeEng.discovery_notes || "");
      notesRef.current = activeEng.discovery_notes || "";
      setNotesDirty(false);
      setNotesSaved(false);
    }
  }, [activeEng?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentStageIdx = activeEng ? STAGE_ORDER.indexOf(activeEng.deal_stage) : -1;

  const nextStage = currentStageIdx >= 0 && currentStageIdx < STAGE_ORDER.length - 2
    ? STAGE_ORDER[currentStageIdx + 1]
    : null;

  // Save discovery notes to the API
  const saveNotes = useCallback(async (content: string) => {
    if (!activeEngId) return;
    setNotesSaving(true);
    setNotesSaved(false);
    try {
      const res = await fetch(`/api/pm/engagements/${activeEngId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discovery_notes: content || null }),
      });
      const data = await res.json();
      if (!data.error) {
        setEngagements((prev) => prev.map((e) => e.id === activeEngId ? data : e));
        setNotesDirty(false);
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      }
    } catch {
      // Silent fail — user can retry with Save button
    } finally {
      setNotesSaving(false);
    }
  }, [activeEngId]);

  // Handle notes change with debounced auto-save
  const handleNotesChange = useCallback((html: string) => {
    setNotesContent(html);
    notesRef.current = html;
    setNotesDirty(true);
    setNotesSaved(false);

    // Debounce auto-save: 3 seconds after last keystroke
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveNotes(notesRef.current);
    }, 3000);
  }, [saveNotes]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Save on engagement switch (flush pending notes)
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        // We can't await here but the save fires
      }
    };
  }, [activeEngId]);

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

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeEngId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", uploadCategory);
      const res = await fetch(`/api/pm/engagements/${activeEngId}/attachments`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAttachments((prev) => [data, ...prev]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadAttachment = async (att: EngagementAttachment) => {
    try {
      const res = await fetch(
        `/api/pm/engagements/${activeEngId}/attachments/download?attachment_id=${att.id}`
      );
      const data = await res.json();
      if (data.download_url) {
        window.open(data.download_url, "_blank");
      }
    } catch {}
  };

  const deleteAttachment = async (attId: string) => {
    if (!activeEngId || !confirm("Delete this file?")) return;
    try {
      await fetch(`/api/pm/engagements/${activeEngId}/attachments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachment_id: attId }),
      });
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
    } catch {}
  };

  const regenProjectFiles = async () => {
    if (!activeEngId) return;
    setGeneratingProjectFiles(true);
    try {
      const res = await fetch(`/api/pm/engagements/${activeEngId}/project-files`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Add new attachment to list
      if (data.attachment) {
        setAttachments((prev) => [data.attachment, ...prev]);
      }
      // Trigger download
      if (data.download_url) {
        window.open(data.download_url, "_blank");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate project files");
    } finally {
      setGeneratingProjectFiles(false);
    }
  };

  // Memoized computed values (must be before early returns)
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
                  : "\u2014"}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-pm-muted mb-1">Expected Close</div>
              <div className="text-xl font-bold text-pm-text">
                {activeEng.expected_close_date
                  ? new Date(activeEng.expected_close_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : "\u2014"}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-pm-muted mb-1">Service Line</div>
              <div className="text-sm font-semibold text-pm-text capitalize">
                {activeEng.engagement_type
                  ? SERVICE_LINES.find((s) => s.value === activeEng.engagement_type)?.label || activeEng.engagement_type
                  : "\u2014"}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-pm-muted mb-1">Assigned To</div>
              <div className="text-sm font-semibold text-pm-text">
                {activeEng.assigned_to
                  ? members.find((m) => m.slug === activeEng.assigned_to)?.display_name || activeEng.assigned_to
                  : "\u2014"}
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
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-pm-text">Discovery Notes</h4>
              <div className="flex items-center gap-2">
                {notesSaved && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
                {notesDirty && !notesSaving && !notesSaved && (
                  <span className="text-xs text-amber-400">Unsaved changes</span>
                )}
                <button
                  onClick={() => {
                    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                    saveNotes(notesRef.current);
                  }}
                  disabled={notesSaving || !notesDirty}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  {notesSaving ? "Saving..." : "Save Notes"}
                </button>
              </div>
            </div>
            <Suspense fallback={<div className="h-[150px] bg-pm-bg border border-pm-border rounded-lg flex items-center justify-center text-pm-muted text-sm">Loading editor...</div>}>
              <RichTextEditor
                value={notesContent}
                onChange={handleNotesChange}
                placeholder="Notes from discovery calls, meetings, client requirements..."
              />
            </Suspense>
          </div>

          {/* ── Documents & Attachments ── */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-pm-text">Documents & Attachments</h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={regenProjectFiles}
                  disabled={generatingProjectFiles}
                  className="px-3 py-1.5 border border-pm-accent/40 text-pm-accent hover:bg-pm-accent/10 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                >
                  {generatingProjectFiles ? "Generating..." : "Re-download Project Files"}
                </button>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="bg-pm-bg border border-pm-border rounded-lg px-2 py-1.5 text-xs text-pm-text"
                >
                  {ATTACHMENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  {uploading ? "Uploading..." : "+ Upload File"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            {attachmentsLoading ? (
              <div className="text-sm text-pm-muted py-4">Loading attachments...</div>
            ) : attachments.length === 0 ? (
              <div className="text-sm text-pm-muted py-4">
                No files attached yet. Upload discovery documents, proposals, contracts, or other supporting material.
              </div>
            ) : (
              <div className="space-y-1">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-pm-bg/50 transition-colors group">
                    {/* File icon */}
                    <div className="w-8 h-8 bg-pm-bg border border-pm-border rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-pm-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => downloadAttachment(att)}
                        className="text-sm text-blue-400 hover:text-blue-300 truncate block text-left"
                      >
                        {att.file_name}
                      </button>
                      <div className="flex items-center gap-2 text-xs text-pm-muted">
                        <span className="capitalize">{att.category.replace("-", " ")}</span>
                        <span>&middot;</span>
                        <span>{formatFileSize(att.file_size)}</span>
                        <span>&middot;</span>
                        <span>{new Date(att.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAttachment(att.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-all"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
