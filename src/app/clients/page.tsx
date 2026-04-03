"use client";

import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import Link from "next/link";

const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));
import { SetupBanner } from "@/components/SetupBanner";
import { PipelineKanban } from "@/components/PipelineKanban";
import type { PipelineStatus } from "@/types/pm";

interface Client {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  pipeline_status: PipelineStatus;
  referred_by: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  billing_contact_phone: string | null;
  technical_contact_name: string | null;
  technical_contact_email: string | null;
  technical_contact_phone: string | null;
  other_contact_name: string | null;
  other_contact_email: string | null;
  other_contact_phone: string | null;
  converted_at: string | null;
  created_at: string;
}

interface TableError {
  error: string;
  missing: string[];
  migrations: string[];
}

const PIPELINE_STAGES: { value: PipelineStatus; label: string; color: string; bg: string; border: string; dot: string }[] = [
  { value: "lead", label: "Lead", color: "bg-slate-500/20 text-slate-300", bg: "bg-slate-500/10", border: "border-slate-500/30", dot: "bg-slate-400" },
  { value: "qualified", label: "Qualified", color: "bg-blue-500/20 text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", dot: "bg-blue-400" },
  { value: "discovery_complete", label: "Discovery", color: "bg-cyan-500/20 text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", dot: "bg-cyan-400" },
  { value: "proposal_sent", label: "Proposal Sent", color: "bg-purple-500/20 text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", dot: "bg-purple-400" },
  { value: "negotiation", label: "Negotiation", color: "bg-amber-500/20 text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-400" },
  { value: "closed_won", label: "Closed Won", color: "bg-emerald-500/20 text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  { value: "closed_lost", label: "Closed Lost", color: "bg-red-500/20 text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-400" },
];

function PipelineBadge({ status }: { status: PipelineStatus }) {
  const stage = PIPELINE_STAGES.find((s) => s.value === status) ?? PIPELINE_STAGES[0];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stage.color}`}>
      {stage.label}
    </span>
  );
}

interface StageRevenue {
  mrr: number;
  one_time: number;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState<TableError | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState<PipelineStatus | "all">("all");
  const [stageRevenue, setStageRevenue] = useState<Record<PipelineStatus, StageRevenue> | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    address: "",
    address_line2: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    website: "",
    notes: "",
    pipeline_status: "lead" as PipelineStatus,
    referred_by: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    billing_contact_name: "",
    billing_contact_email: "",
    billing_contact_phone: "",
    technical_contact_name: "",
    technical_contact_email: "",
    technical_contact_phone: "",
    other_contact_name: "",
    other_contact_email: "",
    other_contact_phone: "",
  });

  // Search
  const [search, setSearch] = useState("");

  // View mode: list or kanban
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadClients = () => {
    fetch("/api/pm/organizations")
      .then((r) => r.json())
      .then((data) => {
        if (data?.missing) {
          setTableError(data);
        } else if (Array.isArray(data)) {
          setClients(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadRevenue = () => {
    fetch("/api/pm/organizations/pipeline")
      .then((r) => r.json())
      .then((data) => {
        if (data?.revenue) setStageRevenue(data.revenue);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/api/pm/organizations")
      .then((r) => r.json())
      .then((data) => {
        if (data?.missing) {
          setTableError(data);
        } else if (Array.isArray(data)) {
          setClients(data);
          // Auto-open edit form when navigated with ?edit=slug
          const params = new URLSearchParams(window.location.search);
          const editSlug = params.get("edit");
          if (editSlug) {
            const client = data.find((c: Client) => c.slug === editSlug);
            if (client) startEdit(client);
            window.history.replaceState(null, "", "/clients");
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    loadRevenue();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredClients = useMemo(() => {
    let result = clients;
    if (pipelineFilter !== "all") {
      result = result.filter((c) => c.pipeline_status === pipelineFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.referred_by && c.referred_by.toLowerCase().includes(q)) ||
        (c.contact_name && c.contact_name.toLowerCase().includes(q)) ||
        (c.contact_email && c.contact_email.toLowerCase().includes(q)) ||
        (c.billing_contact_name && c.billing_contact_name.toLowerCase().includes(q)) ||
        (c.billing_contact_email && c.billing_contact_email.toLowerCase().includes(q)) ||
        (c.technical_contact_name && c.technical_contact_name.toLowerCase().includes(q)) ||
        (c.technical_contact_email && c.technical_contact_email.toLowerCase().includes(q)) ||
        (c.other_contact_name && c.other_contact_name.toLowerCase().includes(q)) ||
        (c.other_contact_email && c.other_contact_email.toLowerCase().includes(q))
      );
    }
    return result;
  }, [clients, pipelineFilter, search]);

  // Pipeline counts for filter pills
  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = { all: clients.length };
    for (const stage of PIPELINE_STAGES) {
      counts[stage.value] = clients.filter((c) => c.pipeline_status === stage.value).length;
    }
    return counts;
  }, [clients]);

  const updateSlug = (val: string) => {
    setForm((f) => ({
      ...f,
      name: val,
      slug: val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    }));
  };

  const resetForm = () => {
    setForm({
      name: "",
      slug: "",
      address: "",
      address_line2: "",
      city: "",
      state: "",
      zip: "",
      phone: "",
      website: "",
      notes: "",
      pipeline_status: "lead",
      referred_by: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      billing_contact_name: "",
      billing_contact_email: "",
      billing_contact_phone: "",
      technical_contact_name: "",
      technical_contact_email: "",
      technical_contact_phone: "",
      other_contact_name: "",
      other_contact_email: "",
      other_contact_phone: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (client: Client) => {
    setForm({
      name: client.name,
      slug: client.slug,
      address: client.address || "",
      address_line2: client.address_line2 || "",
      city: client.city || "",
      state: client.state || "",
      zip: client.zip || "",
      phone: client.phone || "",
      website: client.website || "",
      notes: client.notes || "",
      pipeline_status: client.pipeline_status || "lead",
      referred_by: client.referred_by || "",
      contact_name: client.contact_name || "",
      contact_email: client.contact_email || "",
      contact_phone: client.contact_phone || "",
      billing_contact_name: client.billing_contact_name || "",
      billing_contact_email: client.billing_contact_email || "",
      billing_contact_phone: client.billing_contact_phone || "",
      technical_contact_name: client.technical_contact_name || "",
      technical_contact_email: client.technical_contact_email || "",
      technical_contact_phone: client.technical_contact_phone || "",
      other_contact_name: client.other_contact_name || "",
      other_contact_email: client.other_contact_email || "",
      other_contact_phone: client.other_contact_phone || "",
    });
    setEditingId(client.id);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug) return;
    setSaving(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId
        ? { id: editingId, ...form }
        : form;

      const res = await fetch("/api/pm/organizations", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (editingId) {
        setClients((prev) =>
          prev.map((c) => (c.id === editingId ? data : c)).sort((a, b) => a.name.localeCompare(b.name))
        );
      } else {
        setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save client");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch("/api/pm/organizations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClients((prev) => prev.filter((c) => c.id !== id));
      setDeletingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete client");
    }
  };

  const handlePipelineChange = async (clientId: string, newStatus: PipelineStatus) => {
    try {
      const res = await fetch("/api/pm/organizations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: clientId, pipeline_status: newStatus }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, pipeline_status: newStatus } : c)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update pipeline status");
      loadClients(); // re-sync on failure
    }
  };

  if (tableError) {
    return <SetupBanner missing={tableError.missing} migrations={tableError.migrations} />;
  }

  return (
    <div className={`mx-auto p-6 ${viewMode === "kanban" ? "max-w-[1600px]" : "max-w-5xl"}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-pm-text">Clients</h1>
          <p className="text-pm-muted mt-1">Manage your pipeline and client relationships</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-pm-card border border-pm-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 text-sm transition-colors ${viewMode === "list" ? "bg-pm-accent text-white" : "text-pm-muted hover:text-pm-text"}`}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-2 text-sm transition-colors ${viewMode === "kanban" ? "bg-pm-accent text-white" : "text-pm-muted hover:text-pm-text"}`}
              title="Kanban view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
            </button>
          </div>
          <button
            onClick={() => {
              if (showForm) {
                resetForm();
              } else {
                setShowForm(true);
              }
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {showForm ? "Cancel" : "+ New Client"}
          </button>
        </div>
      </div>

      {/* Pipeline stage summary boxes */}
      {clients.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {PIPELINE_STAGES.map((stage) => {
            const count = pipelineCounts[stage.value] || 0;
            const isActive = pipelineFilter === stage.value;
            const rev = stageRevenue?.[stage.value];
            const mrr = rev?.mrr ?? 0;
            const oneTime = rev?.one_time ?? 0;
            return (
              <button
                key={stage.value}
                onClick={() => setPipelineFilter(isActive ? "all" : stage.value)}
                className={`relative rounded-lg border p-3 text-left transition-all hover:scale-[1.02] ${
                  isActive
                    ? `${stage.bg} ${stage.border} ring-1 ring-offset-1 ring-offset-pm-bg ring-current`
                    : "bg-pm-card border-pm-border hover:border-pm-muted"
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${stage.dot} mb-2`} />
                <div className="text-2xl font-bold text-pm-text">{count}</div>
                <div className="text-xs text-pm-muted mt-0.5 truncate">{stage.label}</div>
                {(mrr > 0 || oneTime > 0) && (
                  <div className="mt-2 pt-2 border-t border-pm-border space-y-0.5">
                    {mrr > 0 && (
                      <div className="text-xs font-semibold text-emerald-400">
                        {formatCurrency(mrr)}<span className="text-pm-muted font-normal">/mo</span>
                      </div>
                    )}
                    {oneTime > 0 && (
                      <div className="text-xs text-blue-400">
                        {formatCurrency(oneTime)} <span className="text-pm-muted font-normal">one-time</span>
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Active filter indicator */}
      {pipelineFilter !== "all" && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-pm-muted">
            Showing: <span className="text-pm-text font-medium">{PIPELINE_STAGES.find(s => s.value === pipelineFilter)?.label}</span>
          </span>
          <button
            onClick={() => setPipelineFilter("all")}
            className="text-xs text-pm-accent hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSave} className="card mb-6 space-y-4">
          <div className="text-sm font-semibold text-pm-text">
            {editingId ? "Edit Client" : "New Client"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-pm-muted mb-1">Client Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => editingId ? setForm((f) => ({ ...f, name: e.target.value })) : updateSlug(e.target.value)}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Referred By</label>
              <input
                type="text"
                value={form.referred_by}
                onChange={(e) => setForm((f) => ({ ...f, referred_by: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Person, partner, or organization"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Pipeline Status</label>
              <select
                value={form.pipeline_status}
                onChange={(e) => setForm((f) => ({ ...f, pipeline_status: e.target.value as PipelineStatus }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Website</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="https://example.com"
              />
            </div>
            {/* Address fields */}
            <div className="md:col-span-2 pt-2 border-t border-pm-border">
              <div className="text-xs font-medium text-pm-muted mb-3 uppercase tracking-wider">Address</div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-pm-muted mb-1">Address Line 1</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="123 Main St"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-pm-muted mb-1">Address Line 2</label>
              <input
                type="text"
                value={form.address_line2}
                onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Suite 200, Building A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="San Francisco"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-pm-muted mb-1">State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                  placeholder="CA"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-pm-muted mb-1">ZIP</label>
                <input
                  type="text"
                  value={form.zip}
                  onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                  placeholder="94105"
                />
              </div>
            </div>

            {/* Contact fields */}
            <div className="md:col-span-2 pt-2 border-t border-pm-border">
              <div className="text-xs font-medium text-pm-muted mb-3 uppercase tracking-wider">Primary Contact</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Contact Name</label>
              <input
                type="text"
                value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Contact Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="jane@acme.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Contact Phone</label>
              <input
                type="tel"
                value={form.contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="(555) 987-6543"
              />
            </div>

            <div className="md:col-span-2 pt-2 border-t border-pm-border">
              <div className="text-xs font-medium text-pm-muted mb-3 uppercase tracking-wider">Billing Contact</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Name</label>
              <input
                type="text"
                value={form.billing_contact_name}
                onChange={(e) => setForm((f) => ({ ...f, billing_contact_name: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Accounts payable contact"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Email</label>
              <input
                type="email"
                value={form.billing_contact_email}
                onChange={(e) => setForm((f) => ({ ...f, billing_contact_email: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="billing@client.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Phone</label>
              <input
                type="tel"
                value={form.billing_contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, billing_contact_phone: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="(555) 111-2222"
              />
            </div>

            <div className="md:col-span-2 pt-2 border-t border-pm-border">
              <div className="text-xs font-medium text-pm-muted mb-3 uppercase tracking-wider">Technical Contact</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Name</label>
              <input
                type="text"
                value={form.technical_contact_name}
                onChange={(e) => setForm((f) => ({ ...f, technical_contact_name: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Implementation or IT contact"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Email</label>
              <input
                type="email"
                value={form.technical_contact_email}
                onChange={(e) => setForm((f) => ({ ...f, technical_contact_email: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="tech@client.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Phone</label>
              <input
                type="tel"
                value={form.technical_contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, technical_contact_phone: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="(555) 222-3333"
              />
            </div>

            <div className="md:col-span-2 pt-2 border-t border-pm-border">
              <div className="text-xs font-medium text-pm-muted mb-3 uppercase tracking-wider">Other Contact</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Name</label>
              <input
                type="text"
                value={form.other_contact_name}
                onChange={(e) => setForm((f) => ({ ...f, other_contact_name: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Additional point of contact"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Email</label>
              <input
                type="email"
                value={form.other_contact_email}
                onChange={(e) => setForm((f) => ({ ...f, other_contact_email: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="other@client.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Phone</label>
              <input
                type="tel"
                value={form.other_contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, other_contact_phone: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="(555) 333-4444"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-pm-muted mb-1">Notes</label>
              <Suspense fallback={<div className="h-[120px] bg-pm-bg border border-pm-border rounded-lg flex items-center justify-center text-pm-muted text-sm">Loading editor...</div>}>
                <RichTextEditor
                  value={form.notes}
                  onChange={(html) => setForm((f) => ({ ...f, notes: html }))}
                  placeholder="Any additional notes about this client..."
                />
              </Suspense>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !form.name || !form.slug}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Client"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-pm-muted hover:text-pm-text rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Client list or Kanban */}
      {loading ? (
        <p className="text-pm-muted">Loading...</p>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-pm-muted">
          <p className="text-lg mb-2">No clients yet</p>
          <p className="text-sm">Create your first client to get started.</p>
        </div>
      ) : viewMode === "kanban" ? (
        <PipelineKanban clients={clients} onStatusChange={handlePipelineChange} stageRevenue={stageRevenue} />
      ) : (
        <>
          {/* Search bar */}
          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pm-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full bg-pm-card border border-pm-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-pm-text placeholder-pm-muted focus:outline-none focus:border-blue-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-pm-muted hover:text-pm-text"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {filteredClients.length === 0 ? (
            <div className="text-center py-16 text-pm-muted">
              <p className="text-lg mb-2">{search ? "No clients match your search" : "No clients in this stage"}</p>
              <p className="text-sm">{search ? "Try a different search term." : "Try a different filter or add new clients."}</p>
            </div>
          ) : (
            <div className="bg-pm-card border border-pm-border rounded-lg divide-y divide-pm-border">
              {filteredClients.map((client) => {
                const stage = PIPELINE_STAGES.find((s) => s.value === client.pipeline_status) ?? PIPELINE_STAGES[0];
                return (
                  <Link
                    key={client.id}
                    href={`/clients/${client.slug}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-pm-bg/50 transition-colors group"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${stage.dot}`} />
                    <span className="font-medium text-pm-text group-hover:text-blue-400 transition-colors truncate">
                      {client.name}
                    </span>
                    {client.contact_name && (
                      <span className="text-sm text-pm-muted hidden sm:inline truncate">{client.contact_name}</span>
                    )}
                    {!client.contact_name && client.referred_by && (
                      <span className="text-sm text-pm-muted hidden sm:inline truncate">Referred by {client.referred_by}</span>
                    )}
                    <span className="ml-auto shrink-0">
                      <PipelineBadge status={client.pipeline_status} />
                    </span>
                    <svg className="w-4 h-4 text-pm-muted group-hover:text-pm-text transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
