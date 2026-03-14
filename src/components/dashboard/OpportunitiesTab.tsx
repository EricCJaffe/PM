"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Organization, Opportunity, ProjectWithStats } from "@/types/pm";
import { Modal, Field, Input, Select, Textarea, ModalActions } from "../Modal";

const STATUSES = ["identified", "proposed", "approved", "in-progress", "complete", "declined"] as const;
const COMPLEXITIES = ["low", "medium", "high"] as const;
const UNITS = ["year", "month", "quarter", "one-time"] as const;

const complexityColors: Record<string, string> = {
  low: "bg-pm-complete/20 text-pm-complete",
  medium: "bg-pm-in-progress/20 text-pm-in-progress",
  high: "bg-pm-blocked/20 text-pm-blocked",
};
const statusColors: Record<string, string> = {
  identified: "text-pm-muted",
  proposed: "text-pm-pending",
  approved: "text-pm-accent",
  "in-progress": "text-pm-in-progress",
  complete: "text-pm-complete",
  declined: "text-pm-blocked",
};

function OpportunityModal({
  orgId, opportunity, onClose, projectId,
}: {
  orgId: string; opportunity?: Opportunity; onClose: () => void; projectId?: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: opportunity?.title ?? "",
    description: opportunity?.description ?? "",
    estimated_savings: String(opportunity?.estimated_savings ?? ""),
    savings_unit: opportunity?.savings_unit ?? "year",
    complexity: opportunity?.complexity ?? "medium",
    estimated_timeline: opportunity?.estimated_timeline ?? "",
    priority_score: String(opportunity?.priority_score ?? ""),
    status: opportunity?.status ?? "identified",
    source: opportunity?.source ?? "",
    owner: opportunity?.owner ?? "",
  });

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description || null,
      estimated_savings: parseFloat(form.estimated_savings) || 0,
      savings_unit: form.savings_unit,
      complexity: form.complexity,
      estimated_timeline: form.estimated_timeline || null,
      priority_score: parseInt(form.priority_score) || 0,
      status: form.status,
      source: form.source || null,
      owner: form.owner || null,
    };
    if (opportunity) {
      await fetch(`/api/pm/opportunities/${opportunity.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/pm/opportunities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, project_id: projectId || null, ...payload }),
      });
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!opportunity) return;
    if (!confirm(`Delete opportunity "${opportunity.title}"?`)) return;
    await fetch(`/api/pm/opportunities/${opportunity.id}`, { method: "DELETE" });
    onClose();
    router.refresh();
  }

  return (
    <Modal title={opportunity ? "Edit Opportunity" : "Add Opportunity"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Title">
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} required autoFocus />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Est. Savings ($)">
            <Input type="number" value={form.estimated_savings} onChange={(e) => set("estimated_savings", e.target.value)} placeholder="0" />
          </Field>
          <Field label="Per">
            <Select value={form.savings_unit} onChange={(e) => set("savings_unit", e.target.value)}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
          <Field label="Complexity">
            <Select value={form.complexity} onChange={(e) => set("complexity", e.target.value)}>
              {COMPLEXITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Timeline">
            <Input value={form.estimated_timeline} onChange={(e) => set("estimated_timeline", e.target.value)} placeholder="~2 weeks" />
          </Field>
          <Field label="Priority (0–100)">
            <Input type="number" min={0} max={100} value={form.priority_score} onChange={(e) => set("priority_score", e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source">
            <Input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="Which SOP or process?" />
          </Field>
          <Field label="Owner">
            <Input value={form.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Name" />
          </Field>
        </div>
        <div className="flex items-center justify-between pt-2">
          {opportunity ? (
            <button type="button" onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300">Delete</button>
          ) : <span />}
          <ModalActions onClose={onClose} saving={saving} label={opportunity ? "Save" : "Add"} />
        </div>
      </form>
    </Modal>
  );
}

export function OpportunitiesTab({ org, opportunities, projects, selectedProjectId }: { org: Organization; opportunities: Opportunity[]; projects?: ProjectWithStats[]; selectedProjectId?: string | null }) {
  const [modal, setModal] = useState<Opportunity | "new" | null>(null);

  const totalSavings = opportunities
    .filter((o) => o.status !== "declined")
    .reduce((sum, o) => sum + (o.estimated_savings || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-pm-muted">{opportunities.length} opportunities</span>
          <span className="text-sm text-pm-text font-medium">
            Total: ${totalSavings >= 1000 ? `${Math.round(totalSavings / 1000)}K` : totalSavings}/yr
          </span>
        </div>
        <button onClick={() => setModal("new")} className="px-3 py-1.5 bg-pm-accent hover:bg-pm-accent-hover text-white text-sm rounded-lg font-medium">
          + Add Opportunity
        </button>
      </div>

      {opportunities.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-pm-muted">No opportunities identified yet. Upload SOPs and use the AI scanner to find automation opportunities.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {opportunities.map((opp) => (
            <div key={opp.id} className="card cursor-pointer hover:border-pm-accent/50 transition-colors" onClick={() => setModal(opp)}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-pm-text">{opp.title}</h3>
                    <span className={`text-xs capitalize ${statusColors[opp.status]}`}>{opp.status}</span>
                  </div>
                  {opp.description && <p className="text-xs text-pm-muted truncate">{opp.description}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${complexityColors[opp.complexity]}`}>
                      {opp.complexity}
                    </span>
                    {opp.estimated_timeline && <span className="text-xs text-pm-muted">~{opp.estimated_timeline}</span>}
                    {opp.source && <span className="text-xs text-pm-muted">from: {opp.source}</span>}
                    {opp.owner && <span className="text-xs text-pm-muted">owner: {opp.owner}</span>}
                    {opp.priority_score > 0 && (
                      <span className="text-xs text-pm-muted">priority: {opp.priority_score}/100</span>
                    )}
                  </div>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <div className="text-lg font-bold text-pm-text">
                    ${opp.estimated_savings >= 1000 ? `${Math.round(opp.estimated_savings / 1000)}K` : opp.estimated_savings}
                  </div>
                  <div className="text-xs text-pm-muted">/{opp.savings_unit === "year" ? "yr" : opp.savings_unit}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal === "new" && <OpportunityModal orgId={org.id} onClose={() => setModal(null)} projectId={selectedProjectId} />}
      {modal && modal !== "new" && <OpportunityModal orgId={org.id} opportunity={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
