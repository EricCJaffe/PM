"use client";

import { useState, useEffect, useCallback } from "react";
import type { Organization, GapAnalysis, GapSeverity, GapStatus, GapSource, Department } from "@/types/pm";
import { Modal, Field, Input, Select, Textarea, ModalActions } from "@/components/Modal";

const SEVERITIES: { value: GapSeverity; label: string; color: string; bg: string }[] = [
  { value: "critical", label: "Critical", color: "text-red-500", bg: "bg-red-500" },
  { value: "high", label: "High", color: "text-amber-500", bg: "bg-amber-500" },
  { value: "medium", label: "Medium", color: "text-yellow-500", bg: "bg-yellow-500" },
  { value: "low", label: "Low", color: "text-blue-500", bg: "bg-blue-500" },
];

const STATUSES: { value: GapStatus; label: string }[] = [
  { value: "identified", label: "Identified" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

const CATEGORIES = [
  { value: "vision", label: "Vision" },
  { value: "people", label: "People" },
  { value: "data", label: "Data" },
  { value: "processes", label: "Processes" },
  { value: "meetings", label: "Meetings" },
  { value: "issues", label: "Issues" },
  { value: "other", label: "Other" },
];

const SOURCES: { value: GapSource; label: string }[] = [
  { value: "interview", label: "Interview" },
  { value: "observation", label: "Observation" },
  { value: "document-review", label: "Document Review" },
  { value: "audit", label: "Audit" },
  { value: "other", label: "Other" },
];

const severityMeta = Object.fromEntries(SEVERITIES.map((s) => [s.value, s]));

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SeverityBadge({ severity }: { severity: GapSeverity }) {
  const meta = severityMeta[severity];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta?.color ?? "text-pm-muted"} bg-opacity-15 ${meta?.bg.replace("bg-", "bg-")}/15`}>
      {meta?.label ?? severity}
    </span>
  );
}

function StatusBadge({ status }: { status: GapStatus }) {
  const colors: Record<GapStatus, string> = {
    identified: "text-slate-400 bg-slate-400/15",
    acknowledged: "text-blue-400 bg-blue-400/15",
    planned: "text-purple-400 bg-purple-400/15",
    "in-progress": "text-amber-400 bg-amber-400/15",
    resolved: "text-green-400 bg-green-400/15",
  };
  const labels: Record<GapStatus, string> = {
    identified: "Identified",
    acknowledged: "Acknowledged",
    planned: "Planned",
    "in-progress": "In Progress",
    resolved: "Resolved",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-pm-muted bg-pm-bg border border-pm-border">
      {category.charAt(0).toUpperCase() + category.slice(1)}
    </span>
  );
}

const emptyForm = {
  title: "",
  category: "processes",
  severity: "medium" as GapSeverity,
  priority: 3,
  status: "identified" as GapStatus,
  source: "observation" as GapSource,
  current_state: "",
  desired_state: "",
  gap_description: "",
  resolution_notes: "",
  discovered_by: "",
  department_id: "",
};

export function GapAnalysisTab({ org }: { org: Organization }) {
  const [gaps, setGaps] = useState<GapAnalysis[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  // Filters
  const [filterStatus, setFilterStatus] = useState<GapStatus | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<GapSeverity | "all">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");

  const reloadGaps = useCallback(() => {
    return fetch(`/api/pm/gap-analysis?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setGaps(data); });
  }, [org.id]);

  useEffect(() => {
    Promise.all([
      reloadGaps(),
      fetch(`/api/pm/departments?org_id=${org.id}`)
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setDepartments(data); }),
    ]).finally(() => setLoading(false));
  }, [org.id, reloadGaps]);

  // Derived stats
  const totalCount = gaps.length;
  const critHighCount = gaps.filter((g) => g.severity === "critical" || g.severity === "high").length;
  const resolvedCount = gaps.filter((g) => g.status === "resolved").length;
  const openCount = gaps.filter((g) => g.status !== "resolved").length;

  const severityCounts = SEVERITIES.map((s) => ({
    ...s,
    count: gaps.filter((g) => g.severity === s.value).length,
  }));
  const maxSevCount = Math.max(...severityCounts.map((s) => s.count), 1);

  // Filtered list
  const filtered = gaps.filter((g) => {
    if (filterStatus !== "all" && g.status !== filterStatus) return false;
    if (filterSeverity !== "all" && g.severity !== filterSeverity) return false;
    if (filterCategory !== "all" && g.category !== filterCategory) return false;
    if (filterDepartment !== "all" && g.department_id !== filterDepartment) return false;
    return true;
  });

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (gap: GapAnalysis) => {
    setForm({
      title: gap.title,
      category: gap.category,
      severity: gap.severity,
      priority: gap.priority,
      status: gap.status,
      source: gap.source ?? "observation",
      current_state: gap.current_state ?? "",
      desired_state: gap.desired_state ?? "",
      gap_description: gap.gap_description ?? "",
      resolution_notes: gap.resolution_notes ?? "",
      discovered_by: gap.discovered_by ?? "",
      department_id: gap.department_id ?? "",
    });
    setEditingId(gap.id);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      category: form.category,
      severity: form.severity,
      priority: form.priority,
      status: form.status,
      source: form.source,
      current_state: form.current_state || null,
      desired_state: form.desired_state || null,
      gap_description: form.gap_description || null,
      resolution_notes: form.status === "resolved" ? (form.resolution_notes || null) : null,
      discovered_by: form.discovered_by || null,
      department_id: form.department_id || null,
    };

    try {
      if (editingId) {
        await fetch(`/api/pm/gap-analysis/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        payload.org_id = org.id;
        await fetch("/api/pm/gap-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      await reloadGaps();
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this gap analysis item?")) return;
    await fetch(`/api/pm/gap-analysis/${id}`, { method: "DELETE" });
    await reloadGaps();
  }

  if (loading) {
    return <div className="text-pm-muted text-sm py-12 text-center">Loading gap analysis...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-pm-muted text-xs font-medium uppercase tracking-wide">Total Gaps</div>
          <div className="text-2xl font-bold text-pm-text mt-1">{totalCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-pm-muted text-xs font-medium uppercase tracking-wide">Critical / High</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{critHighCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-pm-muted text-xs font-medium uppercase tracking-wide">Resolved</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{resolvedCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-pm-muted text-xs font-medium uppercase tracking-wide">Open</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{openCount}</div>
        </div>
      </div>

      {/* Severity breakdown bars */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-pm-text mb-3">Severity Breakdown</h3>
        <div className="space-y-2">
          {severityCounts.map((s) => (
            <div key={s.value} className="flex items-center gap-3">
              <span className={`text-xs font-medium w-16 ${s.color}`}>{s.label}</span>
              <div className="flex-1 h-5 bg-pm-bg rounded overflow-hidden">
                <div
                  className={`h-full ${s.bg} rounded transition-all duration-300`}
                  style={{ width: `${(s.count / maxSevCount) * 100}%`, minWidth: s.count > 0 ? "1.5rem" : "0" }}
                />
              </div>
              <span className="text-xs text-pm-muted w-8 text-right">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar + Add button */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as GapStatus | "all")} className="bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm">
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
        <Select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value as GapSeverity | "all")} className="bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm">
          <option value="all">All Severities</option>
          {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
        <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm">
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
        {departments.length > 0 && (
          <Select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm">
            <option value="all">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        )}
        <div className="flex-1" />
        <button onClick={openAdd} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
          + Add Gap
        </button>
      </div>

      {/* Gap list */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-pm-muted text-sm">
            {totalCount === 0
              ? "No gap analysis items yet. Click \"+ Add Gap\" to record your first discovery gap."
              : "No gaps match the current filters."}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((gap) => (
            <div key={gap.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h4 className="text-sm font-semibold text-pm-text">{gap.title}</h4>
                    <CategoryBadge category={gap.category} />
                    <SeverityBadge severity={gap.severity} />
                    <StatusBadge status={gap.status} />
                  </div>

                  {(gap.current_state || gap.desired_state) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      {gap.current_state && (
                        <div className="bg-pm-bg rounded-lg p-3">
                          <div className="text-xs font-medium text-pm-muted mb-1">Current State</div>
                          <div className="text-sm text-pm-text whitespace-pre-wrap">{gap.current_state}</div>
                        </div>
                      )}
                      {gap.desired_state && (
                        <div className="bg-pm-bg rounded-lg p-3">
                          <div className="text-xs font-medium text-pm-muted mb-1">Desired State</div>
                          <div className="text-sm text-pm-text whitespace-pre-wrap">{gap.desired_state}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {gap.gap_description && (
                    <p className="text-sm text-pm-muted mb-2 whitespace-pre-wrap">{gap.gap_description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-pm-muted">
                    {gap.source && <span>Source: {gap.source}</span>}
                    {gap.discovered_by && <span>Discovered by: {gap.discovered_by}</span>}
                    <span>{formatDate(gap.discovered_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(gap)} className="px-3 py-1.5 text-xs text-pm-muted hover:text-pm-text border border-pm-border rounded-lg hover:bg-pm-bg">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(gap.id)} className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-pm-border rounded-lg hover:bg-red-500/10">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal title={editingId ? "Edit Gap" : "Add Gap"} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Gap title"
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="Severity">
                <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as GapSeverity })}>
                  {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Priority (1-5)">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                />
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as GapStatus })}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
            </div>

            <Field label="Source">
              <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as GapSource })}>
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>

            {departments.length > 0 && (
              <Field label="Department">
                <Select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                  <option value="">None</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
            )}

            <Field label="Current State">
              <Textarea
                value={form.current_state}
                onChange={(e) => setForm({ ...form, current_state: e.target.value })}
                placeholder="Describe the current state..."
              />
            </Field>

            <Field label="Desired State">
              <Textarea
                value={form.desired_state}
                onChange={(e) => setForm({ ...form, desired_state: e.target.value })}
                placeholder="Describe the desired state..."
              />
            </Field>

            <Field label="Gap Description">
              <Textarea
                value={form.gap_description}
                onChange={(e) => setForm({ ...form, gap_description: e.target.value })}
                placeholder="Describe the gap between current and desired state..."
              />
            </Field>

            <Field label="Discovered By">
              <Input
                value={form.discovered_by}
                onChange={(e) => setForm({ ...form, discovered_by: e.target.value })}
                placeholder="Name of person who discovered this gap"
              />
            </Field>

            {form.status === "resolved" && (
              <Field label="Resolution Notes">
                <Textarea
                  value={form.resolution_notes}
                  onChange={(e) => setForm({ ...form, resolution_notes: e.target.value })}
                  placeholder="How was this gap resolved?"
                />
              </Field>
            )}

            <ModalActions onClose={closeModal} saving={saving} label={editingId ? "Update" : "Create"} />
          </form>
        </Modal>
      )}
    </div>
  );
}
