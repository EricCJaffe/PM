"use client";

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Modal, Field, Input, Select, Textarea } from "./Modal";

const RichTextEditor = lazy(() => import("./RichTextEditor"));
import { RecurrencePicker, type RecurrenceConfig } from "./RecurrencePicker";
import { FilePreviewModal } from "./FilePreviewModal";
import type { PMStatus, Subtask, TaskComment, TaskAttachment } from "@/types/pm";

const STATUSES: PMStatus[] = ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"];

interface TaskLike {
  id: string;
  name: string;
  description: string | null;
  status: PMStatus;
  owner: string | null;
  assigned_to?: string | null;
  due_date: string | null;
  subtasks: Subtask[];
  project_id?: string | null;
  phase_id?: string | null;
  series_id?: string | null;
  series_occurrence_date?: string | null;
  is_exception?: boolean;
}

interface PhaseOption {
  id: string;
  name: string;
}

interface CreateContext {
  project_id?: string;
  phase_id?: string;
  org_id?: string;
  default_owner?: string;
}

/**
 * Unified task modal — handles BOTH creating new tasks and editing existing ones.
 *
 * Create mode: pass `task` as undefined/null and provide `createContext`.
 * Edit mode:   pass an existing `task` object.
 *
 * Both modes show the full tabbed interface (Details, Subtasks, Comments, Files)
 * with recurrence support.
 */
export function TaskDetailModal({
  task,
  memberMap,
  onClose,
  onDelete,
  phases,
  orgId,
  createContext,
}: {
  task?: TaskLike | null;
  memberMap: Record<string, string>;
  onClose: () => void;
  onDelete?: () => void;
  phases?: PhaseOption[];
  orgId?: string;
  createContext?: CreateContext;
}) {
  const isCreate = !task;
  const [activeTab, setActiveTab] = useState<"details" | "subtasks" | "comments" | "files">("details");
  const [saving, setSaving] = useState(false);

  // Detail form
  const [form, setForm] = useState({
    name: task?.name ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "not-started",
    due_date: task?.due_date ?? "",
    owner: task?.owner ?? createContext?.default_owner ?? "",
    phase_id: task?.phase_id ?? createContext?.phase_id ?? "",
  });
  const [notifyAssignee, setNotifyAssignee] = useState(false);
  const [editScope, setEditScope] = useState<"this" | "future" | "all">("this");
  const isSeries = !!task?.series_id;

  // Recurrence — available for new tasks and for converting existing tasks
  const [recurrence, setRecurrence] = useState<RecurrenceConfig | null>(null);

  // Members for owner picker
  const memberEntries = Object.entries(memberMap);

  // Subtasks — works in both create and edit mode (stored as JSONB)
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks || []);
  const [newSubtask, setNewSubtask] = useState("");

  // Comments (edit mode only)
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Attachments (edit mode only)
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewAtt, setPreviewAtt] = useState<TaskAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load comments when tab opens (edit mode only)
  useEffect(() => {
    if (!task || activeTab !== "comments" || comments.length > 0) return;
    setLoadingComments(true);
    fetch(`/api/pm/tasks/${task.id}/comments`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setComments(data); })
      .catch(() => {})
      .finally(() => setLoadingComments(false));
  }, [activeTab, task, comments.length]);

  // Load attachments when tab opens (edit mode only)
  useEffect(() => {
    if (!task || activeTab !== "files" || attachments.length > 0) return;
    setLoadingFiles(true);
    fetch(`/api/pm/tasks/${task.id}/attachments`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAttachments(data); })
      .catch(() => {})
      .finally(() => setLoadingFiles(false));
  }, [activeTab, task, attachments.length]);

  // ─── Save / Create ──────────────────────────────────────────────────

  async function handleSave() {
    if (!form.name.trim()) {
      alert("Task name is required");
      return;
    }
    setSaving(true);
    try {
      if (isCreate) {
        await handleCreate();
      } else {
        await handleUpdate();
      }
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (recurrence) {
      // Create a recurring series
      const seriesBody: Record<string, unknown> = {
        project_id: createContext?.project_id ?? null,
        phase_id: form.phase_id || createContext?.phase_id || null,
        org_id: createContext?.org_id ?? orgId ?? null,
        name: form.name,
        description: form.description || null,
        status_template: form.status,
        owner: form.owner || null,
        subtasks_template: subtasks.length > 0 ? subtasks : [],
        recurrence_mode: recurrence.recurrence_mode,
        freq: recurrence.freq,
        interval: recurrence.interval,
        by_weekday: recurrence.by_weekday,
        by_monthday: recurrence.by_monthday,
        by_setpos: recurrence.by_setpos,
        dtstart: recurrence.dtstart,
        until_date: recurrence.until_date,
        max_count: recurrence.max_count,
        time_of_day: recurrence.time_of_day,
        timezone: recurrence.timezone,
        completion_delay_days: recurrence.completion_delay_days,
      };
      const res = await fetch("/api/pm/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seriesBody),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error);
      }
      const seriesData = await res.json();
      // Generate initial instances
      await fetch("/api/pm/series/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ series_id: seriesData.id, horizon: 14 }),
      });
    } else {
      // Create a one-time task
      const body: Record<string, unknown> = {
        project_id: createContext?.project_id ?? null,
        phase_id: form.phase_id || createContext?.phase_id || null,
        org_id: createContext?.org_id ?? orgId ?? null,
        name: form.name,
        description: form.description || null,
        status: form.status,
        owner: form.owner || null,
        assigned_to: form.owner || null,
        due_date: form.due_date || null,
        subtasks: subtasks.length > 0 ? subtasks : [],
        notify_assignee: notifyAssignee,
      };
      const res = await fetch("/api/pm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error);
      }
    }
  }

  async function handleUpdate() {
    if (!task) return;
    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description || null,
      status: form.status,
      due_date: form.due_date || null,
      owner: form.owner || null,
      notify_assignee: notifyAssignee,
    };
    if (phases && form.phase_id !== undefined) {
      payload.phase_id = form.phase_id || null;
    }

    // Save this instance
    const res = await fetch(`/api/pm/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        ...(isSeries && editScope === "this" ? { is_exception: true } : {}),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(data.error);
    }

    // If editing future or all, also update the series template
    if (isSeries && task.series_id && (editScope === "future" || editScope === "all")) {
      await fetch(`/api/pm/series/${task.series_id}?scope=${editScope}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          owner: form.owner || null,
          status_template: form.status,
        }),
      });
    }

    // If converting to recurring (existing task, recurrence just enabled)
    if (!isSeries && recurrence) {
      const seriesBody: Record<string, unknown> = {
        project_id: task.project_id ?? null,
        phase_id: form.phase_id || task.phase_id || null,
        name: form.name,
        description: form.description || null,
        status_template: form.status,
        owner: form.owner || null,
        subtasks_template: subtasks.length > 0 ? subtasks : [],
        recurrence_mode: recurrence.recurrence_mode,
        freq: recurrence.freq,
        interval: recurrence.interval,
        by_weekday: recurrence.by_weekday,
        by_monthday: recurrence.by_monthday,
        by_setpos: recurrence.by_setpos,
        dtstart: recurrence.dtstart,
        until_date: recurrence.until_date,
        max_count: recurrence.max_count,
        time_of_day: recurrence.time_of_day,
        timezone: recurrence.timezone,
        completion_delay_days: recurrence.completion_delay_days,
      };
      const seriesRes = await fetch("/api/pm/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seriesBody),
      });
      if (seriesRes.ok) {
        const seriesData = await seriesRes.json();
        // Link this task as the first instance
        await fetch(`/api/pm/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            series_id: seriesData.id,
            series_occurrence_date: task.due_date || new Date().toISOString().slice(0, 10),
          }),
        });
        // Generate future instances
        await fetch("/api/pm/series/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ series_id: seriesData.id, horizon: 14 }),
        });
      }
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!task) return;
    if (isSeries && task.series_id) {
      const choice = prompt(
        `This is a recurring task. Type:\n  "this" — delete this occurrence only\n  "series" — delete entire series\n  Cancel to abort`,
        "this"
      );
      if (!choice) return;
      if (choice === "series") {
        await fetch(`/api/pm/series/${task.series_id}`, { method: "DELETE" });
      } else {
        await fetch(`/api/pm/tasks/${task.id}`, { method: "DELETE" });
        if (task.series_occurrence_date) {
          await fetch(`/api/pm/series/${task.series_id}/exceptions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              exception_date: task.series_occurrence_date,
              exception_type: "skip",
              reason: "Deleted by user",
            }),
          });
        }
      }
    } else {
      if (!confirm(`Delete task "${task.name}"?`)) return;
      await fetch(`/api/pm/tasks/${task.id}`, { method: "DELETE" });
    }
    if (onDelete) onDelete();
    onClose();
  }

  // ─── Subtask management ─────────────────────────────────────────────

  function addSubtask() {
    if (!newSubtask.trim()) return;
    const updated = [...subtasks, { text: newSubtask.trim(), done: false }];
    setSubtasks(updated);
    setNewSubtask("");
    if (task) saveSubtasks(updated);
  }

  function toggleSubtask(idx: number) {
    const updated = subtasks.map((s, i) => i === idx ? { ...s, done: !s.done } : s);
    setSubtasks(updated);
    if (task) saveSubtasks(updated);
  }

  function removeSubtask(idx: number) {
    const updated = subtasks.filter((_, i) => i !== idx);
    setSubtasks(updated);
    if (task) saveSubtasks(updated);
  }

  async function saveSubtasks(subs: Subtask[]) {
    if (!task) return;
    await fetch(`/api/pm/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtasks: subs }),
    });
  }

  // ─── Comment management ─────────────────────────────────────────────

  async function postComment() {
    if (!task || !newComment.trim()) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/pm/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: form.owner || "user", body: newComment.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setComments((prev) => [...prev, data]);
      setNewComment("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setPostingComment(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!task) return;
    try {
      await fetch(`/api/pm/tasks/${task.id}/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_id: commentId }),
      });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      alert("Failed to delete comment");
    }
  }

  // ─── File management ────────────────────────────────────────────────

  async function uploadFile(file: File) {
    if (!task) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("uploaded_by", form.owner || "user");
      const res = await fetch(`/api/pm/tasks/${task.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAttachments((prev) => [data, ...prev]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!task || !confirm("Delete this file?")) return;
    try {
      await fetch(`/api/pm/tasks/${task.id}/attachments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachment_id: attachmentId }),
      });
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch {
      alert("Failed to delete attachment");
    }
  }

  async function downloadAttachment(att: TaskAttachment) {
    try {
      const res = await fetch(`/api/pm/attachments/download?type=task&id=${att.id}`);
      const data = await res.json();
      if (data.download_url) {
        const a = document.createElement("a");
        a.href = data.download_url;
        a.download = att.file_name;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch {
      alert("Failed to download file");
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatTimestamp(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ─── Render ─────────────────────────────────────────────────────────

  const completedSubs = subtasks.filter((s) => s.done).length;
  const tabs = [
    { id: "details" as const, label: "Details" },
    { id: "subtasks" as const, label: `Subtasks${subtasks.length > 0 ? ` (${completedSubs}/${subtasks.length})` : ""}` },
    { id: "comments" as const, label: `Comments${comments.length > 0 ? ` (${comments.length})` : ""}` },
    { id: "files" as const, label: `Files${attachments.length > 0 ? ` (${attachments.length})` : ""}` },
  ];

  const title = isCreate ? "New Task" : task.name;
  const saveLabel = isCreate
    ? (recurrence ? "Create Series" : "Add Task")
    : (saving ? "Saving..." : "Save Task");

  return (
    <Modal title={title} onClose={onClose}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-pm-border mb-4 -mt-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-pm-accent text-pm-accent"
                : "border-transparent text-pm-muted hover:text-pm-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Details tab ─────────────────────────────────────────────── */}
      {activeTab === "details" && (
        <div className="space-y-4">
          {/* Personal task indicator — when no project context */}
          {isCreate && !createContext?.project_id && (
            <div className="flex items-center gap-2 bg-pm-bg rounded-lg px-3 py-2">
              <svg className="w-4 h-4 text-pm-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs text-pm-accent font-medium">Personal Task</span>
              <span className="text-xs text-pm-muted ml-1">— not linked to any project</span>
            </div>
          )}
          <Field label="Task Name">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus={isCreate}
            />
          </Field>
          <Field label="Description">
            <Suspense fallback={<div className="h-[150px] bg-pm-bg border border-pm-border rounded-lg flex items-center justify-center text-pm-muted text-sm">Loading editor...</div>}>
              <RichTextEditor
                value={form.description}
                onChange={(html) => setForm((f) => ({ ...f, description: html }))}
                placeholder="Add details..."
              />
            </Suspense>
          </Field>
          {/* Phase picker */}
          {phases && phases.length > 0 && (
            <Field label="Phase">
              <Select value={form.phase_id} onChange={(e) => setForm((f) => ({ ...f, phase_id: e.target.value }))}>
                <option value="">— No phase —</option>
                {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PMStatus }))}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Due Date">
              <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </Field>
          </div>
          <Field label="Owner / Assigned To">
            {memberEntries.length > 0 ? (
              <Select value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}>
                <option value="">— Unassigned —</option>
                {memberEntries.map(([slug, name]) => (
                  <option key={slug} value={slug}>{name}</option>
                ))}
              </Select>
            ) : (
              <Input
                value={form.owner}
                onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                placeholder="Owner slug..."
              />
            )}
          </Field>
          {/* Email notification */}
          {form.owner && (
            <label className="flex items-center gap-2 text-xs text-pm-muted cursor-pointer">
              <input
                type="checkbox"
                checked={notifyAssignee}
                onChange={(e) => setNotifyAssignee(e.target.checked)}
                className="rounded border-pm-border"
              />
              Email notify owner when {isCreate ? "creating" : "saving"} this task
            </label>
          )}
          {/* Recurrence — for new tasks or converting existing tasks */}
          {!isSeries && (
            <RecurrencePicker value={recurrence} onChange={setRecurrence} />
          )}
          {/* Series edit scope — for existing recurring tasks */}
          {isSeries && (
            <div className="bg-pm-bg rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-pm-accent font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Recurring task
              </div>
              <div className="flex gap-2">
                {(["this", "future", "all"] as const).map((scope) => (
                  <label key={scope} className="flex items-center gap-1 text-xs text-pm-muted cursor-pointer">
                    <input
                      type="radio"
                      name="edit_scope"
                      checked={editScope === scope}
                      onChange={() => setEditScope(scope)}
                      className="border-pm-border"
                    />
                    {scope === "this" ? "This occurrence" : scope === "future" ? "This & future" : "Entire series"}
                  </label>
                ))}
              </div>
            </div>
          )}
          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            {task ? (
              <button type="button" onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300">
                Delete Task
              </button>
            ) : <span />}
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "Saving..." : saveLabel}
            </button>
          </div>
        </div>
      )}

      {/* ─── Subtasks tab ────────────────────────────────────────────── */}
      {activeTab === "subtasks" && (
        <div className="space-y-3">
          {subtasks.length > 0 && (
            <div className="space-y-1">
              {subtasks.map((sub, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <button
                    onClick={() => toggleSubtask(idx)}
                    className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      sub.done
                        ? "bg-pm-complete border-pm-complete text-white"
                        : "border-pm-border hover:border-pm-accent"
                    }`}
                  >
                    {sub.done && (
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className={`text-sm flex-1 ${sub.done ? "text-pm-muted line-through" : "text-pm-text"}`}>
                    {sub.text}
                  </span>
                  <button
                    onClick={() => removeSubtask(idx)}
                    className="text-red-400/0 group-hover:text-red-400/60 hover:!text-red-400 text-xs transition-colors"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addSubtask(); }}
              className="flex-1 bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
              placeholder="Add a subtask..."
            />
            <button
              onClick={addSubtask}
              disabled={!newSubtask.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>

          {isCreate && subtasks.length > 0 && (
            <p className="text-xs text-pm-muted">Subtasks will be saved when you create the task.</p>
          )}
        </div>
      )}

      {/* ─── Comments tab ────────────────────────────────────────────── */}
      {activeTab === "comments" && (
        <div className="space-y-4">
          {isCreate ? (
            <p className="text-pm-muted text-sm text-center py-4">Save the task first to add comments.</p>
          ) : loadingComments ? (
            <p className="text-pm-muted text-sm">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-pm-muted text-sm text-center py-4">No comments yet. Start the conversation.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="bg-pm-bg rounded-lg p-3 group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-pm-text">
                      {memberMap[c.author] || c.author}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-pm-muted">{formatTimestamp(c.created_at)}</span>
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="text-red-400/0 group-hover:text-red-400/60 hover:!text-red-400 text-xs transition-colors"
                      >
                        x
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-pm-text whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
          )}

          {!isCreate && (
            <div className="flex items-start gap-2 pt-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                className="flex-1 bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500 resize-none"
                rows={2}
                placeholder="Write a comment... (Enter to send)"
              />
              <button
                onClick={postComment}
                disabled={postingComment || !newComment.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {postingComment ? "..." : "Send"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Files tab ───────────────────────────────────────────────── */}
      {activeTab === "files" && (
        <div className="space-y-4">
          {isCreate ? (
            <p className="text-pm-muted text-sm text-center py-4">Save the task first to attach files.</p>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = ""; }}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-pm-border hover:border-pm-accent rounded-lg py-4 text-sm text-pm-muted hover:text-pm-accent transition-colors"
              >
                {uploading ? "Uploading..." : "Click to upload a file"}
              </button>

              {loadingFiles ? (
                <p className="text-pm-muted text-sm">Loading files...</p>
              ) : attachments.length === 0 ? (
                <p className="text-pm-muted text-sm text-center py-4">No files attached yet.</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 bg-pm-bg rounded-lg px-3 py-2 group">
                      <div className="w-8 h-8 bg-pm-card rounded flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-pm-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => setPreviewAtt(a)}
                          className="text-sm text-blue-400 hover:text-blue-300 truncate block text-left"
                          title="Click to preview"
                        >
                          {a.file_name}
                        </button>
                        <div className="text-xs text-pm-muted">{formatFileSize(a.file_size)}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setPreviewAtt(a)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-pm-muted hover:text-pm-text hover:bg-pm-card rounded transition-all"
                          title="Preview"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => downloadAttachment(a)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-pm-muted hover:text-blue-400 hover:bg-pm-card rounded transition-all"
                          title="Download"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteAttachment(a.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-all"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {previewAtt && (
                <FilePreviewModal
                  fileName={previewAtt.file_name}
                  contentType={previewAtt.content_type || "application/octet-stream"}
                  attachmentType="task"
                  attachmentId={previewAtt.id}
                  onClose={() => setPreviewAtt(null)}
                />
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
