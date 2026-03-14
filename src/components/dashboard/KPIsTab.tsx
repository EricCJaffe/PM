"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Organization, KPI } from "@/types/pm";
import { Modal, Field, Input, Select, Textarea, ModalActions } from "../Modal";

const TRENDS = ["up", "down", "flat"] as const;
const PERIODS = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;

const trendIcons: Record<string, { icon: string; color: string }> = {
  up: { icon: "↑", color: "text-pm-complete" },
  down: { icon: "↓", color: "text-pm-blocked" },
  flat: { icon: "→", color: "text-pm-muted" },
};

function KPIModal({ orgId, kpi, onClose }: { orgId: string; kpi?: KPI; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: kpi?.name ?? "",
    current_value: String(kpi?.current_value ?? ""),
    target_value: String(kpi?.target_value ?? ""),
    unit: kpi?.unit ?? "",
    trend: kpi?.trend ?? "flat",
    period: kpi?.period ?? "monthly",
    category: kpi?.category ?? "",
    description: kpi?.description ?? "",
  });

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      current_value: parseFloat(form.current_value) || 0,
      target_value: form.target_value ? parseFloat(form.target_value) : null,
      unit: form.unit || "",
      trend: form.trend,
      period: form.period,
      category: form.category || null,
      description: form.description || null,
    };
    if (kpi) {
      await fetch(`/api/pm/kpis/${kpi.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/pm/kpis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, ...payload }),
      });
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!kpi) return;
    if (!confirm(`Delete KPI "${kpi.name}"?`)) return;
    await fetch(`/api/pm/kpis/${kpi.id}`, { method: "DELETE" });
    onClose();
    router.refresh();
  }

  return (
    <Modal title={kpi ? "Edit KPI" : "Add KPI"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="KPI Name">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Current Value">
            <Input type="number" step="any" value={form.current_value} onChange={(e) => set("current_value", e.target.value)} />
          </Field>
          <Field label="Target Value">
            <Input type="number" step="any" value={form.target_value} onChange={(e) => set("target_value", e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Unit">
            <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="%, $, hrs" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Trend">
            <Select value={form.trend} onChange={(e) => set("trend", e.target.value)}>
              {TRENDS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Period">
            <Select value={form.period} onChange={(e) => set("period", e.target.value)}>
              {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Category">
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="flex items-center justify-between pt-2">
          {kpi ? (
            <button type="button" onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300">Delete</button>
          ) : <span />}
          <ModalActions onClose={onClose} saving={saving} label={kpi ? "Save" : "Add"} />
        </div>
      </form>
    </Modal>
  );
}

export function KPIsTab({ org, kpis }: { org: Organization; kpis: KPI[] }) {
  const [modal, setModal] = useState<KPI | "new" | null>(null);

  const categories = [...new Set(kpis.map((k) => k.category).filter(Boolean))] as string[];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-pm-muted">{kpis.length} KPIs</span>
        <button onClick={() => setModal("new")} className="px-3 py-1.5 bg-pm-accent hover:bg-pm-accent-hover text-white text-sm rounded-lg font-medium">
          + Add KPI
        </button>
      </div>

      {kpis.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-pm-muted">No KPIs tracked yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpis.map((kpi) => {
            const trend = trendIcons[kpi.trend];
            const pctOfTarget = kpi.target_value
              ? Math.round((kpi.current_value / kpi.target_value) * 100)
              : null;
            return (
              <div key={kpi.id} className="card cursor-pointer hover:border-pm-accent/50 transition-colors" onClick={() => setModal(kpi)}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-pm-muted">{kpi.name}</span>
                  {kpi.category && <span className="text-xs text-pm-muted bg-pm-surface px-1.5 py-0.5 rounded">{kpi.category}</span>}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-pm-text">{kpi.current_value}</span>
                  {kpi.unit && <span className="text-sm text-pm-muted">{kpi.unit}</span>}
                  <span className={`text-sm ${trend.color}`}>{trend.icon}</span>
                </div>
                {kpi.target_value !== null && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-pm-muted mb-1">
                      <span>Target: {kpi.target_value}{kpi.unit}</span>
                      <span>{pctOfTarget}%</span>
                    </div>
                    <div className="w-full bg-pm-border rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-pm-accent transition-all"
                        style={{ width: `${Math.min(pctOfTarget ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="text-xs text-pm-muted mt-2 capitalize">{kpi.period}</div>
              </div>
            );
          })}
        </div>
      )}

      {modal === "new" && <KPIModal orgId={org.id} onClose={() => setModal(null)} />}
      {modal && modal !== "new" && <KPIModal orgId={org.id} kpi={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
