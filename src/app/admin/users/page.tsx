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
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [orgAccess, setOrgAccess] = useState<OrgAccess[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

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

  useEffect(() => { loadUsers(); }, []);

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

  function getUserOrgRole(userId: string, orgId: string) {
    return orgAccess.find((a) => a.user_id === userId && a.org_id === orgId)?.role || "";
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-pm-muted">Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-pm-blocked">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-pm-text mb-6">User Management</h1>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pm-border text-pm-muted text-left">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">System Role</th>
              {orgs.map((org) => (
                <th key={org.id} className="px-4 py-3 font-medium">{org.name}</th>
              ))}
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
                    <option value="manager">Manager</option>
                    <option value="user">User</option>
                    <option value="viewer">Viewer</option>
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
                      <option value="manager">Manager</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <p className="text-pm-muted mt-4 text-center">No users yet. The first user to sign up will become admin.</p>
      )}
    </div>
  );
}
