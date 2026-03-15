"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Risk } from "@/types/pm";
import { Modal, Field, Input, Select, Textarea, ModalActions } from "./Modal";
import { OwnerPicker } from "./OwnerPicker";

const LEVELS = ["low", "medium", "high"] as const;
const RISK_STATUSES = ["open", "mitigated", "closed"] as const;
const levelColors = { low: "text-green-400", medium: "text-yellow-400", high: "text-red-400" };

function RiskModal({ projectId, orgId, risk, onClose }: { projectId: string; orgId: string; risk?: Risk; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: risk?.title ?? "",
    description: risk?.description ?? "",
    probability: risk?.probability ?? "medium",
    impact: risk?.impact ?? "medium",
    mitigation: risk?.mitigation ?? "",
    owner: risk?.owner ?? "",
    status: risk?.status ?? "open",
  });

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, description: form.description || null, mitigation: form.mitigation || null, owner: form.owner || null };
    if (risk) {
      await fetch(`/api/pm/risks/${risk.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/pm/risks", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, ...payload }),
      });
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!risk) return;
    if (!confirm(`Delete risk "${risk.title}"?`)) return;
    await fetch(`/api/pm/risks/${risk.id}`, { method: "DELETE" });
    onClose();
    router.refresh();
  }

  return (
    <Modal title={risk ? "Edit Risk" : "Add Risk"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Risk Title">
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} required autoFocus />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe the risk…" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Probability">
            <Select value={form.probability} onChange={(e) => set("probability", e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Impact">
            <Select value={form.impact} onChange={(e) => set("impact", e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {RISK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Mitigation">
          <Textarea value={form.mitigation} onChange={(e) => set("mitigation", e.target.value)} placeholder="How will you address this risk?" />
        </Field>
        <Field label="Owner">
          <OwnerPicker orgId={orgId} value={form.owner} onChange={(v) => set("owner", v)} />
        </Field>
        <div className="flex items-center justify-between pt-2">
          {risk ? (
            <button type="button" onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300">Delete risk</button>
          ) : <span />}
          <ModalActions onClose={onClose} saving={saving} label={risk ? "Save Changes" : "Add Risk"} />
        </div>
      </form>
    </Modal>
  );
}

export function EditableRiskTable({ risks, projectId, orgId }: { risks: Risk[]; projectId: string; orgId: string }) {
  const [modal, setModal] = useState<Risk | "new" | null>(null);

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-pm-muted">{risks.length} risks</span>
        <button
          onClick={() => setModal("new")}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium"
        >
          + Add Risk
        </button>
      </div>

      {risks.length === 0 ? (
        <p className="text-pm-muted text-center py-8">No risks logged yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pm-border text-pm-muted text-left">
                <th className="py-2 pr-4">Risk</th>
                <th className="py-2 pr-4">Prob</th>
                <th className="py-2 pr-4">Impact</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Owner</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((risk) => (
                <tr
                  key={risk.id}
                  className="border-b border-pm-border/50 hover:bg-pm-card/50 cursor-pointer"
                  onClick={() => setModal(risk)}
                >
                  <td className="py-2 pr-4">
                    <div className="font-medium text-pm-text">{risk.title}</div>
                    {risk.mitigation && (
                      <div className="text-xs text-pm-muted truncate max-w-xs">↳ {risk.mitigation}</div>
                    )}
                  </td>
                  <td className={`py-2 pr-4 capitalize font-medium ${levelColors[risk.probability]}`}>{risk.probability}</td>
                  <td className={`py-2 pr-4 capitalize font-medium ${levelColors[risk.impact]}`}>{risk.impact}</td>
                  <td className="py-2 pr-4 text-pm-muted capitalize">{risk.status}</td>
                  <td className="py-2 pr-4 text-pm-muted">{risk.owner || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === "new" && <RiskModal projectId={projectId} orgId={orgId} onClose={() => setModal(null)} />}
      {modal && modal !== "new" && <RiskModal projectId={projectId} orgId={orgId} risk={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
