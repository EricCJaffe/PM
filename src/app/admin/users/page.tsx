"use client";
import { useState, useEffect } from "react";

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  system_role: string;
  created_at: string;
}

interface OrgAccess {
  id: string;
  user_id: string;
  org_id: string;
  role: string;
}

interface Org {
  id: string;
  name: string;
  slug: string;
  is_site_org?: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [orgAccess, setOrgAccess] = useState<OrgAccess[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviteOrgId, setInviteOrgId] = useState(""); // Single org for external users
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const siteOrg = orgs.find((o) => o.is_site_org);
  const clientOrgs = orgs.filter((o) => !o.is_site_org);

  async function loadUsers() {
    const res = await fetch("/api/pm/admin/users");
    if (!res.ok) {
      if (res.status === 403) {
        setError("Access denied. Admin role required.");
      } else {
        setError("Failed to load users.");
      }
      setLoading(false);
      return;
    }
    const data = await res.json();
    setUsers(data.users);
    setOrgAccess(data.org_access);
    setOrgs(data.organizations);
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateRole(userId: string, system_role: string) {
    setSaving(userId);
    await fetch(`/api/pm/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_role }),
    });
    await loadUsers();
    setSaving(null);
  }

  async function updateExternalOrg(userId: string, orgId: string) {
    setSaving(userId);
    await fetch(`/api/pm/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_org_id: orgId || null }),
    });
    await loadUsers();
    setSaving(null);
  }

  async function deleteUser(user: UserProfile) {
    if (!confirm(`Delete user "${user.display_name || user.email}"? This cannot be undone.`)) return;
    setSaving(user.id);
    const res = await fetch(`/api/pm/admin/users/${user.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to delete" }));
      alert(data.error || "Failed to delete user");
    }
    await loadUsers();
    setSaving(null);
  }

  async function inviteUser(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    if (inviteRole === "external" && !inviteOrgId) {
      setInviteError("Please select a client for this external user.");
      return;
    }
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await fetch("/api/pm/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          display_name: inviteName.trim(),
          system_role: inviteRole,
          // Internal users: no org_ids needed (auto all-access)
          // External users: single org assignment
          org_ids: inviteRole === "external" ? [inviteOrgId] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite");
      setInviteSuccess(`User "${data.display_name}" created successfully.`);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("user");
      setInviteOrgId("");
      await loadUsers();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setInviting(false);
    }
  }

  function getUserAssignedOrg(userId: string): string {
    // For external users, find their non-site-org assignment
    const access = orgAccess.filter((a) => a.user_id === userId);
    const nonSiteAccess = access.find((a) => {
      const org = orgs.find((o) => o.id === a.org_id);
      return org && !org.is_site_org;
    });
    return nonSiteAccess?.org_id || "";
  }

  function getAccessLabel(user: UserProfile): string {
    if (user.system_role === "admin" || user.system_role === "user") {
      return "All Clients";
    }
    const orgId = getUserAssignedOrg(user.id);
    const org = orgs.find((o) => o.id === orgId);
    return org ? org.name : "No Client Assigned";
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-pm-muted">Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-pm-blocked">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-pm-text">User Management</h1>
          <p className="text-sm text-pm-muted mt-1">{users.length} user{users.length !== 1 ? "s" : ""} registered</p>
        </div>
        <button
          onClick={() => { setShowInvite(!showInvite); setInviteError(null); setInviteSuccess(null); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showInvite ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <form onSubmit={inviteUser} className="card mb-6 space-y-4">
          <h3 className="text-sm font-medium text-pm-text">Add a New User</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-pm-muted block mb-1">Display Name *</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                required
                placeholder="John Doe"
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-pm-muted block mb-1">Email *</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                placeholder="user@example.com"
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-pm-muted block mb-1">User Type</label>
            <div className="flex gap-3">
              {[
                { value: "admin", label: "Admin", desc: "FSA staff — full access + admin console" },
                { value: "user", label: "Staff", desc: "FSA staff — full access to all clients" },
                { value: "external", label: "Client User", desc: "Access to one assigned client only" },
              ].map((r) => (
                <label
                  key={r.value}
                  className={`flex-1 cursor-pointer rounded-lg border p-3 transition-colors ${
                    inviteRole === r.value
                      ? "border-pm-accent bg-pm-accent/10"
                      : "border-pm-border hover:border-pm-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="invite_role"
                    value={r.value}
                    checked={inviteRole === r.value}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="sr-only"
                  />
                  <div className="text-sm font-medium text-pm-text">{r.label}</div>
                  <div className="text-xs text-pm-muted mt-0.5">{r.desc}</div>
                </label>
              ))}
            </div>
          </div>

          {/* Show org picker only for external users */}
          {inviteRole === "external" && (
            <div>
              <label className="text-xs text-pm-muted block mb-1">Assign to Client *</label>
              <select
                value={inviteOrgId}
                onChange={(e) => setInviteOrgId(e.target.value)}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
              >
                <option value="">Select a client...</option>
                {clientOrgs.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Info message for internal users */}
          {inviteRole !== "external" && (
            <div className="bg-pm-accent/5 border border-pm-accent/20 rounded-lg px-3 py-2 text-xs text-pm-muted">
              {inviteRole === "admin" ? "Admins" : "Staff"} members are part of Foundation Stone Advisors and automatically have access to all client data.
            </div>
          )}

          {inviteError && <p className="text-sm text-red-400">{inviteError}</p>}
          {inviteSuccess && <p className="text-sm text-pm-complete">{inviteSuccess}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {inviting ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pm-border text-pm-muted text-left">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Access</th>
              <th className="px-4 py-3 font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-pm-border last:border-0 hover:bg-pm-bg/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-pm-accent/20 text-pm-accent flex items-center justify-center text-xs font-bold">
                      {(u.display_name || u.email || "?")[0].toUpperCase()}
                    </div>
                    <span className="text-pm-text font-medium">{u.display_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-pm-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.system_role}
                    onChange={(e) => updateRole(u.id, e.target.value)}
                    disabled={saving === u.id}
                    className="bg-pm-bg border border-pm-border rounded px-2 py-1 text-pm-text text-xs"
                  >
                    <option value="admin">Admin</option>
                    <option value="user">Staff</option>
                    <option value="external">Client User</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  {u.system_role === "external" ? (
                    <select
                      value={getUserAssignedOrg(u.id)}
                      onChange={(e) => updateExternalOrg(u.id, e.target.value)}
                      disabled={saving === u.id}
                      className="bg-pm-bg border border-pm-border rounded px-2 py-1 text-pm-text text-xs"
                    >
                      <option value="">No Client</option>
                      {clientOrgs.map((org) => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-pm-complete font-medium">All Clients</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => deleteUser(u)}
                    disabled={saving === u.id}
                    className="text-xs text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <p className="text-pm-muted mt-4 text-center">No users yet. Add someone to get started.</p>
      )}
    </div>
  );
}
