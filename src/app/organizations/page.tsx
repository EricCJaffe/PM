"use client";

import { useState, useEffect } from "react";
import { SetupBanner } from "@/components/SetupBanner";

interface Org {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

interface TableError {
  error: string;
  missing: string[];
  migrations: string[];
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tableError, setTableError] = useState<TableError | null>(null);

  const loadOrgs = () => {
    fetch("/api/pm/organizations")
      .then((r) => r.json())
      .then((data) => {
        if (data?.missing) {
          setTableError(data);
        } else if (Array.isArray(data)) {
          setOrgs(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrgs(); }, []);

  const updateSlug = (val: string) => {
    setName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return;
    setCreating(true);
    try {
      const res = await fetch("/api/pm/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOrgs((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setSlug("");
      setShowForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  if (tableError) {
    return <SetupBanner missing={tableError.missing} migrations={tableError.migrations} />;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-pm-text">Organizations</h1>
          <p className="text-pm-muted mt-1">Manage your organizations</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? "Cancel" : "+ New Organization"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-pm-muted mb-1">Organization Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => updateSlug(e.target.value)}
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
              placeholder="e.g. Yarash Eretz"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-pm-muted mb-1">Slug</label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500 font-mono text-sm"
              placeholder="yarash-eretz"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !name || !slug}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {creating ? "Creating..." : "Create Organization"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-pm-muted">Loading...</p>
      ) : orgs.length === 0 ? (
        <div className="text-center py-16 text-pm-muted">
          <p className="text-lg mb-2">No organizations yet</p>
          <p className="text-sm">Create your first organization to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => (
            <div key={org.id} className="card flex items-center justify-between">
              <div>
                <div className="font-semibold text-pm-text">{org.name}</div>
                <div className="text-sm text-pm-muted font-mono">{org.slug}</div>
              </div>
              <div className="text-xs text-pm-muted">
                Created {new Date(org.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
