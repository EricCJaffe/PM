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
  const [inviteOrgIds, setInviteOrgIds] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

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
    // Default invite org selection to the site org
    const siteOrg = data.organizations.find((o: Org) => o.is_site_org);
    if (siteOrg && inviteOrgIds.length === 0) {
      setInviteOrgIds([siteOrg.id]);
    }
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
          org_ids: inviteOrgIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite");
      setInviteSuccess(`User "${data.display_name}" created successfully.`);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("user");
      // Reset org selection to site org
      const siteOrg = orgs.find((o) => o.is_site_org);
      setInviteOrgIds(siteOrg ? [siteOrg.id] : []);
      await loadUsers();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setInviting(false);
    }
  }

  function toggleOrgId(orgId: string) {
    setInviteOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  }

  function getUserOrgRole(userId: string, orgId: string) {
    return orgAccess.find((a) => a.user_id === userId && a.org_id === orgId)?.role || "";
  }

  async function updateOrgAccess(userId: string, orgId: string, role: string) {
    setSaving(userId);
    await fetch(`/api/pm/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_access: { org_id: orgId, role } }),
    });
    await loadUsers();
    setSaving(null);
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
            <label className="text-xs text-pm-muted block mb-1">System Role</label>
            <div className="flex gap-3">
              {[
                { value: "admin", label: "Admin", desc: "Full access + admin console" },
                { value: "user", label: "User", desc: "Full access, no admin console" },
                { value: "external", label: "External", desc: "Only assigned orgs" },
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

          <div>
            <label className="text-xs text-pm-muted block mb-2">Organization Access</label>
            <div className="space-y-1">
              {orgs.map((org) => (
                <label key={org.id} className="flex items-center gap-2 text-sm text-pm-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inviteOrgIds.includes(org.id)}
                    onChange={() => toggleOrgId(org.id)}
                    className="rounded border-pm-border"
                  />
                  {org.name}
                  {org.is_site_org && (
                    <span className="text-[10px] bg-pm-accent/10 text-pm-accent px-1.5 py-0.5 rounded">Site Org</span>
                  )}
                </label>
              ))}
            </div>
          </div>

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
              {orgs.map((org) => (
                <th key={org.id} className="px-4 py-3 font-medium whitespace-nowrap">
                  {org.name}
                  {org.is_site_org && <span className="text-[10px] text-pm-accent ml-1">*</span>}
                </th>
              ))}
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
                    <option value="user">User</option>
                    <option value="external">External</option>
                  </select>
                </td>
                {orgs.map((org) => (
                  <td key={org.id} className="px-4 py-3">
                    <select
                      value={getUserOrgRole(u.id, org.id)}
                      onChange={(e) => updateOrgAccess(u.id, org.id, e.target.value || "remove")}
                      disabled={saving === u.id}
                      className="bg-pm-bg border border-pm-border rounded px-2 py-1 text-pm-text text-xs"
                    >
                      <option value="">No Access</option>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                ))}
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
