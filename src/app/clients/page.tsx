"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SetupBanner } from "@/components/SetupBanner";

interface Client {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
}

interface TableError {
  error: string;
  missing: string[];
  migrations: string[];
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState<TableError | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    address: "",
    phone: "",
    website: "",
    notes: "",
  });

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
    setForm({ name: "", slug: "", address: "", phone: "", website: "", notes: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (client: Client) => {
    setForm({
      name: client.name,
      slug: client.slug,
      address: client.address || "",
      phone: client.phone || "",
      website: client.website || "",
      notes: client.notes || "",
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

  if (tableError) {
    return <SetupBanner missing={tableError.missing} migrations={tableError.migrations} />;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-pm-text">Clients</h1>
          <p className="text-pm-muted mt-1">Manage your clients and their users</p>
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

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSave} className="card mb-6 space-y-4">
          <div className="text-sm font-semibold text-pm-text">
            {editingId ? "Edit Client" : "New Client"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
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
              <label className="block text-sm font-medium text-pm-muted mb-1">Slug *</label>
              <input
                type="text"
                required
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500 font-mono text-sm"
                placeholder="acme-corp"
                disabled={!!editingId}
              />
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
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-pm-muted mb-1">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="123 Main St, City, State 12345"
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

      {/* Client list */}
      {loading ? (
        <p className="text-pm-muted">Loading...</p>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-pm-muted">
          <p className="text-lg mb-2">No clients yet</p>
          <p className="text-sm">Create your first client to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <div key={client.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="font-semibold text-pm-text text-lg">{client.name}</div>
                    <span className="text-xs text-pm-muted font-mono">{client.slug}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-pm-muted">
                    {client.phone && <span>{client.phone}</span>}
                    {client.website && <span>{client.website}</span>}
                    {client.address && <span>{client.address}</span>}
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
