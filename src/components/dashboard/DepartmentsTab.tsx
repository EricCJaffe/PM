"use client";

import { useState, useEffect } from "react";
import type { Organization } from "@/types/pm";

interface Department {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  description: string | null;
  head_name: string | null;
  head_email: string | null;
  member_count: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function DepartmentsTab({ org }: { org: Organization }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    head_name: "",
    head_email: "",
    is_active: true,
  });

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDepartments = () => {
    setLoading(true);
    fetch(`/api/pm/departments?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDepartments(data);
      })
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDepartments(); }, [org.id]);

  const updateSlug = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    }));
  };

  const resetForm = () => {
    setForm({ name: "", slug: "", description: "", head_name: "", head_email: "", is_active: true });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (dept: Department) => {
    setForm({
      name: dept.name,
      slug: dept.slug,
      description: dept.description || "",
      head_name: dept.head_name || "",
      head_email: dept.head_email || "",
      is_active: dept.is_active,
    });
    setEditingId(dept.id);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug) return;
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/pm/departments/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            slug: form.slug,
            description: form.description || null,
            head_name: form.head_name || null,
            head_email: form.head_email || null,
            is_active: form.is_active,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setDepartments((prev) =>
          prev.map((d) => (d.id === editingId ? data : d)).sort((a, b) => a.sort_order - b.sort_order)
        );
      } else {
        const res = await fetch("/api/pm/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            org_id: org.id,
            name: form.name,
            slug: form.slug,
            description: form.description || null,
            head_name: form.head_name || null,
            head_email: form.head_email || null,
            sort_order: departments.length,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setDepartments((prev) =>
          [...prev, data].sort((a, b) => a.sort_order - b.sort_order)
        );
      }
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save department");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/pm/departments/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDepartments((prev) => prev.filter((d) => d.id !== id));
      setDeletingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete department");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-pm-text">
          Departments ({departments.length})
        </h3>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Department"}
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSave} className="card mb-4 space-y-4">
          <div className="text-sm font-semibold text-pm-text">
            {editingId ? "Edit Department" : "Add Department"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) =>
                  editingId
                    ? setForm((f) => ({ ...f, name: e.target.value }))
                    : updateSlug(e.target.value)
                }
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="e.g. Engineering"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Head Name</label>
              <input
                type="text"
                value={form.head_name}
                onChange={(e) => setForm((f) => ({ ...f, head_name: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Head Email</label>
              <input
                type="email"
                value={form.head_email}
                onChange={(e) => setForm((f) => ({ ...f, head_email: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="rounded border-pm-border"
            />
            <span className="text-sm text-pm-muted">Active</span>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !form.name || !form.slug}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Department"}
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

      {/* Department list */}
      {loading ? (
        <p className="text-pm-muted">Loading departments...</p>
      ) : departments.length === 0 ? (
        <div className="text-center py-12 text-pm-muted">
          <p className="text-lg mb-2">No departments yet</p>
          <p className="text-sm">Add departments to organize this client&apos;s structure.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {departments.map((dept) => (
            <div key={dept.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-pm-border flex items-center justify-center text-pm-text font-medium text-sm">
                  {dept.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div>
                  <div className="font-medium text-pm-text flex items-center gap-2">
                    {dept.name}
                    {!dept.is_active && (
                      <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded text-[10px] uppercase font-semibold">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-pm-muted flex items-center gap-2">
                    {dept.description && <span>{dept.description}</span>}
                    {dept.description && (dept.head_name || dept.member_count > 0) && (
                      <span className="text-pm-border">|</span>
                    )}
                    {dept.head_name && (
                      <span>
                        {dept.head_name}
                        {dept.head_email && ` (${dept.head_email})`}
                      </span>
                    )}
                    {dept.head_name && dept.member_count > 0 && (
                      <span className="text-pm-border">|</span>
                    )}
                    {dept.member_count > 0 && (
                      <span>{dept.member_count} member{dept.member_count !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`status-badge ${dept.is_active ? "status-in-progress" : "status-blocked"} text-xs`}>
                  {dept.is_active ? "Active" : "Inactive"}
                </span>
                <button
                  onClick={() => startEdit(dept)}
                  className="text-sm text-pm-muted hover:text-pm-text transition-colors"
                >
                  Edit
                </button>
                {deletingId === dept.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(dept.id)}
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
                    onClick={() => setDeletingId(dept.id)}
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
