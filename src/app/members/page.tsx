"use client";

import { useState, useEffect } from "react";

interface Org {
  id: string;
  slug: string;
  name: string;
}

interface Member {
  id: string;
  slug: string;
  display_name: string;
  email: string | null;
  role: string;
  created_at: string;
}

const roles = ["owner", "admin", "member", "viewer"];

export default function MembersPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    display_name: "",
    slug: "",
    email: "",
    role: "member",
  });

  // Load orgs on mount
  useEffect(() => {
    fetch("/api/pm/organizations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setOrgs(data);
      })
      .catch(() => {});
  }, []);

  // Load members when org changes
  useEffect(() => {
    if (!selectedOrgId) {
      setMembers([]);
      return;
    }
    setLoading(true);
    fetch(`/api/pm/members?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMembers(data);
      })
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [selectedOrgId]);

  const updateSlug = (displayName: string) => {
    const slug = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setForm((f) => ({ ...f, display_name: displayName, slug }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.display_name || !form.slug || !selectedOrgId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/pm/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: selectedOrgId,
          slug: form.slug,
          display_name: form.display_name,
          email: form.email || null,
          role: form.role,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMembers((prev) =>
        [...prev, data].sort((a, b) => a.display_name.localeCompare(b.display_name))
      );
      setForm({ display_name: "", slug: "", email: "", role: "member" });
      setShowForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setCreating(false);
    }
  };

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-pm-text">Members</h1>
          <p className="text-pm-muted mt-1">Manage organization members</p>
        </div>
        {selectedOrgId && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {showForm ? "Cancel" : "+ Add Member"}
          </button>
        )}
      </div>

      {/* Org selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-pm-muted mb-1">Organization</label>
        <select
          value={selectedOrgId}
          onChange={(e) => {
            setSelectedOrgId(e.target.value);
            setShowForm(false);
          }}
          className="w-full max-w-md bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
        >
          <option value="">Select an organization...</option>
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name} ({org.slug})
            </option>
          ))}
        </select>
        {orgs.length === 0 && (
          <p className="text-xs text-pm-muted mt-1">
            No organizations yet. Create one on the Organizations page first.
          </p>
        )}
      </div>

      {/* Add member form */}
      {showForm && selectedOrgId && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-4">
          <div className="text-sm font-medium text-pm-text">
            Add Member to {selectedOrg?.name}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Display Name</label>
              <input
                type="text"
                required
                value={form.display_name}
                onChange={(e) => updateSlug(e.target.value)}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="e.g. Eric Jaffe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Slug</label>
              <input
                type="text"
                required
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500 font-mono text-sm"
                placeholder="eric-jaffe"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || !form.display_name || !form.slug}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {creating ? "Adding..." : "Add Member"}
          </button>
        </form>
      )}

      {/* Members list */}
      {!selectedOrgId ? (
        <div className="text-center py-16 text-pm-muted">
          <p>Select an organization to view its members.</p>
        </div>
      ) : loading ? (
        <p className="text-pm-muted">Loading...</p>
      ) : members.length === 0 ? (
        <div className="text-center py-16 text-pm-muted">
          <p className="text-lg mb-2">No members in {selectedOrg?.name}</p>
          <p className="text-sm">Add your first member to this organization.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-pm-border flex items-center justify-center text-pm-text font-medium text-sm">
                  {member.display_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div>
                  <div className="font-semibold text-pm-text">{member.display_name}</div>
                  <div className="text-sm text-pm-muted font-mono">{member.slug}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {member.email && (
                  <span className="text-sm text-pm-muted">{member.email}</span>
                )}
                <span className="status-badge status-in-progress capitalize">{member.role}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
