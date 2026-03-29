"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import type { Organization, ProjectWithStats, PipelineStatus, KPI } from "@/types/pm";
import { StandupWidget } from "../StandupWidget";

const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));

const PIPELINE_STAGES: { value: PipelineStatus; label: string; color: string }[] = [
  { value: "lead", label: "Lead", color: "bg-slate-500" },
  { value: "qualified", label: "Qualified", color: "bg-blue-500" },
  { value: "discovery_complete", label: "Discovery", color: "bg-cyan-500" },
  { value: "proposal_sent", label: "Proposal Sent", color: "bg-purple-500" },
  { value: "negotiation", label: "Negotiation", color: "bg-amber-500" },
  { value: "closed_won", label: "Closed Won", color: "bg-emerald-500" },
  { value: "closed_lost", label: "Closed Lost", color: "bg-red-500" },
];

export function OverviewTab({
  org,
  projects,
  kpis,
}: {
  org: Organization;
  projects: ProjectWithStats[];
  kpis?: KPI[];
}) {
  const [saving, setSaving] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>(org.pipeline_status || "lead");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    contact_name: org.contact_name || "",
    contact_email: org.contact_email || "",
    contact_phone: org.contact_phone || "",
    phone: org.phone || "",
    website: org.website || "",
    address: org.address || "",
    address_line2: org.address_line2 || "",
    city: org.city || "",
    state: org.state || "",
    zip: org.zip || "",
    notes: org.notes || "",
  });

  const currentStageIndex = PIPELINE_STAGES.findIndex((s) => s.value === pipelineStatus);

  const updatePipelineStatus = async (newStatus: PipelineStatus) => {
    setSaving(true);
    try {
      const res = await fetch("/api/pm/organizations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: org.id,
          pipeline_status: newStatus,
          ...(newStatus === "closed_won" && !org.converted_at ? { converted_at: new Date().toISOString() } : {}),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPipelineStatus(newStatus);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInfo = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/pm/organizations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: org.id, ...form }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const activeProjects = projects.filter((p) => p.status === "active").length;
  const totalTasks = projects.reduce((s, p) => s + p.task_count, 0);
  const completeTasks = projects.reduce((s, p) => s + p.complete_tasks, 0);

  return (
    <div className="space-y-6">
      {/* Morning Standup */}
      <StandupWidget orgId={org.id} />

      {/* Pipeline Status */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-pm-text">Pipeline Status</h3>
          {saving && <span className="text-xs text-pm-muted">Saving...</span>}
        </div>
        <div className="flex items-center gap-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const isActive = i <= currentStageIndex && pipelineStatus !== "closed_lost";
            const isCurrent = stage.value === pipelineStatus;
            return (
              <button
                key={stage.value}
                onClick={() => updatePipelineStatus(stage.value)}
                disabled={saving}
                className={`flex-1 py-2.5 px-2 text-xs font-medium rounded transition-all text-center ${
                  isCurrent
                    ? `${stage.color} text-white shadow-lg scale-105`
                    : isActive
                      ? `${stage.color}/30 text-pm-text`
                      : "bg-pm-surface text-pm-muted hover:bg-pm-card"
                } ${i === 0 ? "rounded-l-lg" : ""} ${i === PIPELINE_STAGES.length - 1 ? "rounded-r-lg" : ""}`}
              >
                {stage.label}
              </button>
            );
          })}
        </div>
        {org.converted_at && (
          <p className="text-xs text-pm-muted mt-3">
            Converted to client: {new Date(org.converted_at).toLocaleDateString()}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Details */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-pm-text">Company Details</h3>
            <button
              onClick={() => editing ? handleSaveInfo() : setEditing(true)}
              disabled={saving}
              className="text-xs text-pm-accent hover:text-pm-accent-hover font-medium"
            >
              {editing ? (saving ? "Saving..." : "Save") : "Edit"}
            </button>
          </div>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-pm-muted mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text"
                />
              </div>
              <div>
                <label className="block text-xs text-pm-muted mb-1">Website</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, website: e.target.value }))}
                  className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text"
                />
              </div>
              <div>
                <label className="block text-xs text-pm-muted mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text"
                  placeholder="123 Main St"
                />
              </div>
              <div>
                <label className="block text-xs text-pm-muted mb-1">Address Line 2</label>
                <input
                  type="text"
                  value={form.address_line2}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, address_line2: e.target.value }))}
                  className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text"
                  placeholder="Suite 200"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-pm-muted mb-1">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text"
                  />
                </div>
                <div>
                  <label className="block text-xs text-pm-muted mb-1">State</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, state: e.target.value }))}
                    className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text"
                  />
                </div>
                <div>
                  <label className="block text-xs text-pm-muted mb-1">ZIP</label>
                  <input
                    type="text"
                    value={form.zip}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, zip: e.target.value }))}
                    className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pm-muted mb-1">Notes</label>
                <Suspense fallback={<div className="h-[120px] bg-pm-bg border border-pm-border rounded flex items-center justify-center text-pm-muted text-sm">Loading editor...</div>}>
                  <RichTextEditor
                    value={form.notes}
                    onChange={(html: string) => setForm((f) => ({ ...f, notes: html }))}
                    placeholder="Notes about this organization..."
                  />
                </Suspense>
              </div>
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-pm-muted hover:text-pm-text"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <InfoRow label="Phone" value={org.phone} />
              <InfoRow label="Website" value={org.website} link />
              <InfoRow label="Address" value={org.address} />
              {org.address_line2 && <InfoRow label="" value={org.address_line2} />}
              <InfoRow label="City" value={[org.city, org.state, org.zip].filter(Boolean).join(", ") || null} />
              {org.notes && (
                <div className="flex items-start gap-3">
                  <span className="text-xs text-pm-muted w-16 shrink-0 pt-0.5">Notes</span>
                  <div className="text-sm text-pm-text prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: org.notes }} />
                </div>
              )}
              {!org.phone && !org.website && !org.address && !org.city && (
                <p className="text-sm text-pm-muted italic">No company details yet. Click Edit to add.</p>
              )}
            </div>
          )}
        </div>

        {/* Primary Contact */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-pm-text">Primary Contact</h3>
            {editing && <span className="text-xs text-pm-muted">(editing above)</span>}
          </div>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-pm-muted mb-1">Name</label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                  className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-xs text-pm-muted mb-1">Email</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                  className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text"
                  placeholder="jane@acme.com"
                />
              </div>
              <div>
                <label className="block text-xs text-pm-muted mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.contact_phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                  className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text"
                  placeholder="(555) 987-6543"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <InfoRow label="Name" value={org.contact_name} />
              <InfoRow label="Email" value={org.contact_email} link />
              <InfoRow label="Phone" value={org.contact_phone} />
              {!org.contact_name && !org.contact_email && !org.contact_phone && (
                <p className="text-sm text-pm-muted italic">No contact info yet. Click Edit above to add.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="card">
        <h3 className="font-semibold text-pm-text mb-4">Activity Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-pm-text">{projects.length}</div>
            <div className="text-xs text-pm-muted">Total Projects</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-pm-in-progress">{activeProjects}</div>
            <div className="text-xs text-pm-muted">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-pm-text">{totalTasks}</div>
            <div className="text-xs text-pm-muted">Total Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-pm-complete">{completeTasks}</div>
            <div className="text-xs text-pm-muted">Completed</div>
          </div>
        </div>
      </div>
      {/* KPIs */}
      {kpis && kpis.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-pm-text mb-4">Key Performance Indicators</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.map((kpi: KPI) => (
              <div key={kpi.id} className="bg-pm-bg border border-pm-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-pm-text">{kpi.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    kpi.trend === "up" ? "bg-emerald-500/20 text-emerald-400" :
                    kpi.trend === "down" ? "bg-red-500/20 text-red-400" :
                    "bg-gray-500/20 text-gray-400"
                  }`}>
                    {kpi.trend === "up" ? "↑" : kpi.trend === "down" ? "↓" : "→"} {kpi.trend}
                  </span>
                </div>
                <div className="text-2xl font-bold text-pm-text">
                  {kpi.current_value}{kpi.unit ? ` ${kpi.unit}` : ""}
                </div>
                {kpi.target_value != null && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-pm-muted mb-1">
                      <span>Target: {kpi.target_value}{kpi.unit ? ` ${kpi.unit}` : ""}</span>
                      <span>{Math.min(100, Math.round((kpi.current_value / kpi.target_value) * 100))}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-pm-border rounded-full">
                      <div className="h-full bg-pm-accent rounded-full" style={{ width: `${Math.min(100, Math.round((kpi.current_value / kpi.target_value) * 100))}%` }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Departments & Vocabulary */}
      <DepartmentsSection orgId={org.id} />
    </div>
  );
}

function DepartmentsSection({ orgId }: { orgId: string }) {
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; description: string | null; head_name: string | null; member_count: number | null; is_active: boolean }>>([]);
  const [vocab, setVocab] = useState<Array<{ base_term: string; display_label: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/pm/departments?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/pm/departments/vocab?org_id=${orgId}`).then((r) => r.json()),
    ]).then(([deptData, vocabData]) => {
      if (Array.isArray(deptData)) setDepartments(deptData);
      if (Array.isArray(vocabData)) setVocab(vocabData);
    }).finally(() => setLoading(false));
  }, [orgId]);

  if (loading) return null;
  if (departments.length === 0 && vocab.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {departments.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-pm-text mb-4">Departments</h3>
          <div className="space-y-2">
            {departments.filter((d) => d.is_active).map((dept) => (
              <div key={dept.id} className="flex items-center justify-between py-2 border-b border-pm-border/50 last:border-0">
                <div>
                  <span className="text-sm font-medium text-pm-text">{dept.name}</span>
                  {dept.head_name && <span className="text-xs text-pm-muted ml-2">— {dept.head_name}</span>}
                </div>
                {dept.member_count != null && dept.member_count > 0 && (
                  <span className="text-xs text-pm-muted">{dept.member_count} members</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {vocab.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-pm-text mb-4">Custom Vocabulary</h3>
          <div className="space-y-2">
            {vocab.filter((v) => v.base_term !== v.display_label).map((v) => (
              <div key={v.base_term} className="flex items-center justify-between py-2 border-b border-pm-border/50 last:border-0">
                <span className="text-xs text-pm-muted">{v.base_term}</span>
                <span className="text-sm text-pm-text">→ {v.display_label}</span>
              </div>
            ))}
            {vocab.every((v) => v.base_term === v.display_label) && (
              <p className="text-sm text-pm-muted">Using default vocabulary.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, link }: { label: string; value: string | null; link?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-pm-muted w-16 shrink-0 pt-0.5">{label}</span>
      {link && value.includes("@") ? (
        <a href={`mailto:${value}`} className="text-sm text-pm-accent hover:underline">{value}</a>
      ) : link && value.startsWith("http") ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-pm-accent hover:underline">{value}</a>
      ) : (
        <span className="text-sm text-pm-text">{value}</span>
      )}
    </div>
  );
}
