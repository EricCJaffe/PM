"use client";

import { useState, useEffect, useCallback } from "react";
import type { Organization } from "@/types/pm";

interface User {
  id: string;
  slug: string;
  display_name: string;
  email: string | null;
  role: string;
  created_at: string;
}

interface PortalInvite {
  id: string;
  email: string;
  name: string | null;
  role: string;
  accepted_at: string | null;
  is_active: boolean;
  created_at: string;
}

const roles = ["owner", "admin", "member", "viewer"];

export function UsersTab({ org }: { org: Organization }) {
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<PortalInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    display_name: "",
    slug: "",
    email: "",
    role: "member",
    sendInvite: false,
  });

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/pm/members?org_id=${org.id}`).then((r) => r.json()),
      fetch(`/api/pm/portal/invites?org_id=${org.id}`).then((r) => r.json()),
    ])
      .then(([members, portalInvites]) => {
        if (Array.isArray(members)) setUsers(members);
        if (Array.isArray(portalInvites)) setInvites(portalInvites);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [org.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Find portal invite for a given email
  const inviteForEmail = (email: string | null) =>
    email ? invites.find((inv) => inv.email.toLowerCase() === email.toLowerCase()) : undefined;

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
    setForm({ display_name: "", slug: "", email: "", role: "member", sendInvite: false });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (user: User) => {
    setForm({
      display_name: user.display_name,
      slug: user.slug,
      email: user.email || "",
      role: user.role,
      sendInvite: false,
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
        ? { id: editingId, display_name: form.display_name, slug: form.slug, email: form.email, role: form.role }
        : { org_id: org.id, display_name: form.display_name, slug: form.slug, email: form.email, role: form.role };

      const res = await fetch("/api/pm/members", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (editingId) {
        setUsers((prev) => prev.map((u) => (u.id === editingId ? data : u)));
      } else {
        setUsers((prev) => [...prev, data].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      }

      // Send portal invite if requested and email provided
      if (form.sendInvite && form.email && !editingId) {
        await sendPortalInvite(form.email, form.display_name);
      }

      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const sendPortalInvite = async (email: string, name: string) => {
    const res = await fetch("/api/pm/portal/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: org.id, email, name, role: "viewer" }),
    });
    const data = await res.json();
    if (!data.error) {
      setInvites((prev) => [data, ...prev.filter((i) => i.email.toLowerCase() !== email.toLowerCase())]);
    }
    return data;
  };

  const handleSendInvite = async (user: User) => {
    if (!user.email) return;
    setInvitingId(user.id);
    try {
      await sendPortalInvite(user.email, user.display_name);
    } catch {
      alert("Failed to send invite");
    } finally {
      setInvitingId(null);
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
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-pm-text">Team Members ({users.length})</h3>
        <button
          onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Member"}
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSave} className="card mb-4 space-y-4">
          <div className="text-sm font-semibold text-pm-text">
            {editingId ? "Edit Member" : "Add Member"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Name *</label>
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
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="jane@example.com"
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
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Portal invite checkbox — only show when email provided and not editing */}
          {!editingId && form.email && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.sendInvite}
                onChange={(e) => setForm((f) => ({ ...f, sendInvite: e.target.checked }))}
                className="rounded border-pm-border"
              />
              <span className="text-sm text-pm-text">
                Send portal login invite to <span className="text-blue-400">{form.email}</span>
              </span>
            </label>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !form.display_name || !form.slug}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : (form.sendInvite ? "Add & Send Invite" : "Add Member")}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-pm-muted hover:text-pm-text rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Member list */}
      {loading ? (
        <p className="text-pm-muted">Loading...</p>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-pm-muted">
          <p className="text-lg mb-2">No members yet</p>
          <p className="text-sm">Add members to manage this client&apos;s team.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const invite = inviteForEmail(user.email);
            const portalStatus = invite?.accepted_at
              ? "active"
              : invite?.is_active
              ? "invited"
              : null;

            return (
              <div key={user.id} className="card flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-pm-border flex items-center justify-center text-pm-text font-medium text-sm shrink-0">
                    {user.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-pm-text truncate">{user.display_name}</div>
                    <div className="text-xs text-pm-muted truncate">{user.email || "No email"}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="status-badge status-in-progress capitalize text-xs">{user.role}</span>

                  {/* Portal access status */}
                  {portalStatus === "active" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Portal active
                    </span>
                  )}
                  {portalStatus === "invited" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Invite sent
                    </span>
                  )}
                  {!portalStatus && user.email && (
                    <button
                      onClick={() => handleSendInvite(user)}
                      disabled={invitingId === user.id}
                      className="text-xs px-2 py-0.5 rounded-full border border-pm-border text-pm-muted hover:text-blue-400 hover:border-blue-400/50 transition-colors disabled:opacity-50"
                    >
                      {invitingId === user.id ? "Sending…" : "Send portal invite"}
                    </button>
                  )}

                  <button onClick={() => startEdit(user)} className="text-sm text-pm-muted hover:text-pm-text transition-colors">
                    Edit
                  </button>

                  {deletingId === user.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(user.id)} className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors">Confirm</button>
                      <button onClick={() => setDeletingId(null)} className="text-sm text-pm-muted hover:text-pm-text transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeletingId(user.id)} className="text-sm text-red-400/70 hover:text-red-400 transition-colors">Delete</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
