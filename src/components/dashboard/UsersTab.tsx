"use client";

import { useState, useEffect } from "react";
import type { Organization } from "@/types/pm";

interface User {
  id: string;
  slug: string;
  display_name: string;
  email: string | null;
  role: string;
  created_at: string;
}

const roles = ["owner", "admin", "member", "viewer"];

export function UsersTab({ org }: { org: Organization }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    display_name: "",
    slug: "",
    email: "",
    role: "member",
  });

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadUsers = () => {
    setLoading(true);
    fetch(`/api/pm/members?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, [org.id]);

  const updateSlug = (displayName: string) => {
    setForm((f) => ({
      ...f,
      display_name: displayName,
      slug: displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    }));
  };

  const resetForm = () => {
    setForm({ display_name: "", slug: "", email: "", role: "member" });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (user: User) => {
    setForm({
      display_name: user.display_name,
      slug: user.slug,
      email: user.email || "",
      role: user.role,
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.display_name || !form.slug) return;
    setSaving(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId
        ? { id: editingId, ...form }
        : { org_id: org.id, ...form };

      const res = await fetch("/api/pm/members", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (editingId) {
        setUsers((prev) =>
          prev.map((u) => (u.id === editingId ? data : u)).sort((a, b) => a.display_name.localeCompare(b.display_name))
        );
      } else {
        setUsers((prev) =>
          [...prev, data].sort((a, b) => a.display_name.localeCompare(b.display_name))
        );
      }
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch("/api/pm/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setDeletingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-pm-text">
          Users ({users.length})
        </h3>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          {showForm ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSave} className="card mb-4 space-y-4">
          <div className="text-sm font-semibold text-pm-text">
            {editingId ? "Edit User" : "Add User"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Display Name *</label>
              <input
                type="text"
                required
                value={form.display_name}
                onChange={(e) =>
                  editingId
                    ? setForm((f) => ({ ...f, display_name: e.target.value }))
                    : updateSlug(e.target.value)
                }
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="e.g. Eric Jaffe"
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
                placeholder="eric-jaffe"
                disabled={!!editingId}
              />
            </div>
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
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !form.display_name || !form.slug}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add User"}
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

      {/* User list */}
      {loading ? (
        <p className="text-pm-muted">Loading users...</p>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-pm-muted">
          <p className="text-lg mb-2">No users yet</p>
          <p className="text-sm">Add users to manage this client&apos;s team.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-pm-border flex items-center justify-center text-pm-text font-medium text-sm">
                  {user.display_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div>
                  <div className="font-medium text-pm-text">{user.display_name}</div>
                  <div className="text-xs text-pm-muted">
                    {user.email || user.slug}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="status-badge status-in-progress capitalize text-xs">{user.role}</span>
                <button
                  onClick={() => startEdit(user)}
                  className="text-sm text-pm-muted hover:text-pm-text transition-colors"
                >
                  Edit
                </button>
                {deletingId === user.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="text-sm text-pm-muted hover:text-pm-text transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(user.id)}
                    className="text-sm text-red-400/70 hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
