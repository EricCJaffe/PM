"use client";
import { useState, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Organization, ProjectWithStats, ProcessMap, Opportunity, PipelineStatus } from "@/types/pm";
import { StandupWidget } from "../StandupWidget";
import { UsersTab } from "./UsersTab";
import { DepartmentsTab } from "./DepartmentsTab";

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
  processMaps,
  opportunities,
}: {
  org: Organization;
  projects: ProjectWithStats[];
  processMaps: ProcessMap[];
  opportunities: Opportunity[];
}) {
  const router = useRouter();

  // --- Edit / Delete state ---
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/pm/organizations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: org.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      router.push("/clients");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete client");
      setDeleting(false);
      setConfirming(false);
    }
  };

  // --- Company info edit state ---
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

      {/* Activity Summary */}
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

      {/* Actions bar: Edit / Delete */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-pm-text">Client Details</h2>
        <div className="flex items-center gap-2">
          <Link
            href={`/clients?edit=${org.slug}`}
            className="px-3 py-2 border border-pm-border text-pm-text hover:bg-pm-card rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Client
          </Link>
          {confirming ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="px-3 py-2 text-pm-muted hover:text-pm-text rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="px-3 py-2 border border-red-600/30 text-red-400 hover:bg-red-600/10 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Client
            </button>
          )}
        </div>
      </div>

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

      {/* Company Details + Primary Contact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text" />
              </div>
              <div>
                <label className="block text-xs text-pm-muted mb-1">Website</label>
                <input type="url" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text" />
              </div>
              <div>
                <label className="block text-xs text-pm-muted mb-1">Address Line 1</label>
                <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text" placeholder="123 Main St" />
              </div>
              <div>
                <label className="block text-xs text-pm-muted mb-1">Address Line 2</label>
                <input type="text" value={form.address_line2} onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))} className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text" placeholder="Suite 200" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-pm-muted mb-1">City</label>
                  <input type="text" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text" />
                </div>
                <div>
                  <label className="block text-xs text-pm-muted mb-1">State</label>
                  <input type="text" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text" />
                </div>
                <div>
                  <label className="block text-xs text-pm-muted mb-1">ZIP</label>
                  <input type="text" value={form.zip} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-pm-muted mb-1">Notes</label>
                <Suspense fallback={<div className="h-[120px] bg-pm-bg border border-pm-border rounded flex items-center justify-center text-pm-muted text-sm">Loading editor...</div>}>
                  <RichTextEditor value={form.notes} onChange={(html) => setForm((f) => ({ ...f, notes: html }))} placeholder="Notes about this organization..." />
                </Suspense>
              </div>
              <button onClick={() => setEditing(false)} className="text-xs text-pm-muted hover:text-pm-text">Cancel</button>
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

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-pm-text">Primary Contact</h3>
            {editing && <span className="text-xs text-pm-muted">(editing above)</span>}
          </div>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-pm-muted mb-1">Name</label>
                <input type="text" value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text" placeholder="Jane Smith" />
              </div>
              <div>
                <label className="block text-xs text-pm-muted mb-1">Email</label>
                <input type="email" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text" placeholder="jane@acme.com" />
              </div>
              <div>
                <label className="block text-xs text-pm-muted mb-1">Phone</label>
                <input type="tel" value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} className="w-full bg-pm-bg border border-pm-border rounded px-3 py-1.5 text-sm text-pm-text" placeholder="(555) 987-6543" />
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

      {/* Users */}
      <UsersTab org={org} />

      {/* Departments */}
      <DepartmentsTab org={org} />

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
