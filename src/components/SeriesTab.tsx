"use client";

import { useState, useEffect } from "react";
import type { TaskSeries, RecurrenceFreq } from "@/types/pm";

const FREQ_LABELS: Record<RecurrenceFreq, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function recurrenceLabel(s: TaskSeries): string {
  const base = FREQ_LABELS[s.freq] ?? s.freq;
  if (s.freq === "weekly" && s.by_weekday.length > 0) {
    const days = s.by_weekday.map((d) => WEEKDAYS[d] ?? d).join(", ");
    return `${base} on ${days}`;
  }
  if (s.interval > 1) return `Every ${s.interval} ${s.freq}`;
  return base;
}

interface SeriesFormState {
  name: string;
  description: string;
  freq: RecurrenceFreq;
  interval: number;
  by_weekday: number[];
  dtstart: string;
  until_date: string;
  max_count: string;
  time_of_day: string;
  status_template: string;
}

const defaultForm: SeriesFormState = {
  name: "",
  description: "",
  freq: "weekly",
  interval: 1,
  by_weekday: [],
  dtstart: new Date().toISOString().slice(0, 10),
  until_date: "",
  max_count: "",
  time_of_day: "",
  status_template: "not-started",
};

function SeriesForm({
  initial,
  projectId,
  orgId,
  phases,
  onSave,
  onCancel,
}: {
  initial?: Partial<SeriesFormState & { id: string; phase_id: string | null }>;
  projectId: string;
  orgId: string | null;
  phases: Array<{ id: string; name: string }>;
  onSave: (series: TaskSeries) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SeriesFormState & { phase_id: string }>({
    ...defaultForm,
    phase_id: "",
    ...(initial ?? {}),
    max_count: initial?.max_count != null ? String(initial.max_count) : "",
    interval: initial?.interval ?? 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const toggleWeekday = (d: number) => {
    set(
      "by_weekday",
      form.by_weekday.includes(d)
        ? form.by_weekday.filter((x) => x !== d)
        : [...form.by_weekday, d].sort()
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        project_id: projectId,
        org_id: orgId,
        phase_id: form.phase_id || null,
        name: form.name,
        description: form.description || null,
        freq: form.freq,
        interval: form.interval,
        by_weekday: form.freq === "weekly" ? form.by_weekday : [],
        dtstart: form.dtstart,
        until_date: form.until_date || null,
        max_count: form.max_count ? parseInt(form.max_count) : null,
        time_of_day: form.time_of_day || null,
        status_template: form.status_template,
      };

      const isEdit = !!initial?.id;
      const res = await fetch(
        isEdit ? `/api/pm/series/${initial!.id}` : "/api/pm/series",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onSave(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="text-sm font-semibold text-pm-text">
        {initial?.id ? "Edit Recurring Series" : "New Recurring Series"}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs text-pm-muted mb-1">Task Name *</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            placeholder="e.g. Weekly Status Report"
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs text-pm-muted mb-1">Description</label>
          <input
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Optional details"
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
          />
        </div>

        {phases.length > 0 && (
          <div>
            <label className="block text-xs text-pm-muted mb-1">Phase</label>
            <select
              value={form.phase_id}
              onChange={(e) => set("phase_id", e.target.value)}
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
            >
              <option value="">(no phase)</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-pm-muted mb-1">Frequency *</label>
          <select
            value={form.freq}
            onChange={(e) => set("freq", e.target.value as RecurrenceFreq)}
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
          >
            {(Object.keys(FREQ_LABELS) as RecurrenceFreq[]).map((f) => (
              <option key={f} value={f}>{FREQ_LABELS[f]}</option>
            ))}
          </select>
        </div>

        {form.freq === "weekly" && (
          <div className="md:col-span-2">
            <label className="block text-xs text-pm-muted mb-1">Days of week</label>
            <div className="flex gap-1">
              {WEEKDAYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWeekday(i)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    form.by_weekday.includes(i)
                      ? "bg-blue-600 text-white"
                      : "bg-pm-bg border border-pm-border text-pm-muted hover:text-pm-text"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs text-pm-muted mb-1">Start Date *</label>
          <input
            type="date"
            value={form.dtstart}
            onChange={(e) => set("dtstart", e.target.value)}
            required
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-pm-muted mb-1">End Date (optional)</label>
          <input
            type="date"
            value={form.until_date}
            onChange={(e) => set("until_date", e.target.value)}
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-pm-muted mb-1">Max occurrences (optional)</label>
          <input
            type="number"
            min={1}
            value={form.max_count}
            onChange={(e) => set("max_count", e.target.value)}
            placeholder="e.g. 52"
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-pm-muted mb-1">Time of day (optional)</label>
          <input
            type="time"
            value={form.time_of_day}
            onChange={(e) => set("time_of_day", e.target.value)}
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving || !form.name}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          {saving ? "Saving..." : initial?.id ? "Save Changes" : "Create Series"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-pm-muted hover:text-pm-text text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function SeriesTab({
  projectId,
  orgId,
  phases,
}: {
  projectId: string;
  orgId: string | null;
  phases: Array<{ id: string; name: string }>;
}) {
  const [series, setSeries] = useState<TaskSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TaskSeries | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/pm/series?project_id=${projectId}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setSeries(d); })
      .finally(() => setLoading(false));
  }, [projectId]);

  async function togglePause(s: TaskSeries) {
    setTogglingId(s.id);
    try {
      const res = await fetch(`/api/pm/series/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_paused: !s.is_paused }),
      });
      const data = await res.json();
      if (res.ok) setSeries((prev) => prev.map((x) => (x.id === s.id ? data : x)));
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteSeries(id: string) {
    if (!confirm("Delete this recurring series? Generated tasks are not affected.")) return;
    const res = await fetch(`/api/pm/series/${id}`, { method: "DELETE" });
    if (res.ok) setSeries((prev) => prev.filter((x) => x.id !== id));
    setDeletingId(null);
  }

  function handleSaved(updated: TaskSeries) {
    if (editing) {
      setSeries((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditing(null);
    } else {
      setSeries((prev) => [updated, ...prev]);
      setShowForm(false);
    }
  }

  if (loading) return <div className="text-pm-muted py-8">Loading series...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-pm-muted">
            Recurring tasks are generated daily by the cron job. Each series produces one task per occurrence.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); }}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shrink-0"
        >
          + New Series
        </button>
      </div>

      {(showForm && !editing) && (
        <SeriesForm
          projectId={projectId}
          orgId={orgId}
          phases={phases}
          onSave={handleSaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {series.length === 0 && !showForm ? (
        <div className="text-center py-12 text-pm-muted">
          <p className="mb-2">No recurring series yet</p>
          <p className="text-xs">Create a series to automatically generate tasks on a schedule.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {series.map((s) => (
            <div key={s.id}>
              {editing?.id === s.id ? (
                <SeriesForm
                  initial={{ ...s, max_count: s.max_count ?? undefined }}
                  projectId={projectId}
                  orgId={orgId}
                  phases={phases}
                  onSave={handleSaved}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className={`card flex items-start justify-between gap-4 ${s.is_paused ? "opacity-60" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-pm-text text-sm">{s.name}</span>
                      {s.is_paused && (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                          Paused
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-pm-muted">
                      <span>{recurrenceLabel(s)}</span>
                      <span>&middot;</span>
                      <span>From {s.dtstart}</span>
                      {s.until_date && <><span>&middot;</span><span>Until {s.until_date}</span></>}
                      {s.max_count && <><span>&middot;</span><span>Max {s.max_count}</span></>}
                      <span>&middot;</span>
                      <span>{s.generated_count} generated</span>
                      {s.next_occurrence && (
                        <><span>&middot;</span><span className="text-blue-400">Next: {s.next_occurrence}</span></>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-xs text-pm-muted mt-1">{s.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => togglePause(s)}
                      disabled={togglingId === s.id}
                      className="text-xs px-2 py-1 rounded border border-pm-border text-pm-muted hover:text-pm-text disabled:opacity-50"
                    >
                      {s.is_paused ? "Resume" : "Pause"}
                    </button>
                    <button
                      onClick={() => { setEditing(s); setShowForm(false); }}
                      className="text-xs px-2 py-1 rounded border border-pm-border text-pm-muted hover:text-pm-text"
                    >
                      Edit
                    </button>
                    {deletingId === s.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => deleteSeries(s.id)} className="text-xs text-red-400 hover:text-red-300">Confirm</button>
                        <button onClick={() => setDeletingId(null)} className="text-xs text-pm-muted hover:text-pm-text">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(s.id)}
                        className="text-xs text-red-400/60 hover:text-red-400"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
