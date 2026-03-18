"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
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
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  converted_at: string | null;
  created_at: string;
}

interface TableError {
  error: string;
  missing: string[];
  migrations: string[];
}

const PIPELINE_STAGES: { value: PipelineStatus; label: string; color: string }[] = [
  { value: "lead", label: "Lead", color: "bg-slate-500/20 text-slate-300" },
  { value: "prospect", label: "Prospect", color: "bg-blue-500/20 text-blue-400" },
  { value: "proposal_sent", label: "Proposal Sent", color: "bg-purple-500/20 text-purple-400" },
  { value: "negotiation", label: "Negotiation", color: "bg-amber-500/20 text-amber-400" },
  { value: "client", label: "Client", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "inactive", label: "Inactive", color: "bg-red-500/20 text-red-400" },
];

function PipelineBadge({ status }: { status: PipelineStatus }) {
  const stage = PIPELINE_STAGES.find((s) => s.value === status) ?? PIPELINE_STAGES[0];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stage.color}`}>
      {stage.label}
    </span>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState<TableError | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState<PipelineStatus | "all">("all");

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
    contact_name: "",
    contact_email: "",
    contact_phone: "",
  });

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

  useEffect(() => { loadClients(); }, []);

  const filteredClients = useMemo(() => {
    if (pipelineFilter === "all") return clients;
    return clients.filter((c) => c.pipeline_status === pipelineFilter);
  }, [clients, pipelineFilter]);

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
    setForm({ name: "", slug: "", address: "", address_line2: "", city: "", state: "", zip: "", phone: "", website: "", notes: "", pipeline_status: "lead", contact_name: "", contact_email: "", contact_phone: "" });
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
      contact_name: client.contact_name || "",
      contact_email: client.contact_email || "",
      contact_phone: client.contact_phone || "",
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

      {/* Pipeline filter pills */}
      {clients.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setPipelineFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              pipelineFilter === "all"
                ? "bg-pm-accent text-white"
                : "bg-pm-card border border-pm-border text-pm-muted hover:text-pm-text"
            }`}
          >
            All ({pipelineCounts.all})
          </button>
          {PIPELINE_STAGES.map((stage) => (
            <button
              key={stage.value}
              onClick={() => setPipelineFilter(stage.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                pipelineFilter === stage.value
                  ? "bg-pm-accent text-white"
                  : "bg-pm-card border border-pm-border text-pm-muted hover:text-pm-text"
              }`}
            >
              {stage.label} ({pipelineCounts[stage.value] || 0})
            </button>
          ))}
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

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-pm-muted mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Any additional notes about this client..."
              />
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
        <PipelineKanban clients={clients} onStatusChange={handlePipelineChange} />
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-16 text-pm-muted">
          <p className="text-lg mb-2">No clients in this stage</p>
          <p className="text-sm">Try a different filter or add new clients.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client) => (
            <div key={client.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="font-semibold text-pm-text text-lg">{client.name}</div>
                    <PipelineBadge status={client.pipeline_status} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-pm-muted">
                    {client.contact_name && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {client.contact_name}
                      </span>
                    )}
                    {(client.contact_email || client.phone) && (
                      <span>{client.contact_email || client.phone}</span>
                    )}
                    {client.website && <span>{client.website}</span>}
                    {(client.city || client.state) && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                        {[client.city, client.state].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <Link
                    href={`/clients/${client.slug}`}
                    className="px-3 py-1.5 bg-pm-accent hover:bg-pm-accent-hover text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => startEdit(client)}
                    className="px-3 py-1.5 border border-pm-border text-pm-text hover:bg-pm-card rounded-md text-sm font-medium transition-colors"
                  >
                    Edit
                  </button>
                  {deletingId === client.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-3 py-1.5 text-pm-muted hover:text-pm-text rounded-md text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(client.id)}
                      className="px-3 py-1.5 border border-red-600/30 text-red-400 hover:bg-red-600/10 rounded-md text-sm font-medium transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
