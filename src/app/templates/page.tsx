"use client";

import { useState, useEffect } from "react";

interface TemplatePhase {
  order: number;
  slug: string;
  name: string;
  group?: string;
  tasks?: { slug: string; name: string; description?: string }[];
}

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string;
  phases: TemplatePhase[];
  created_at: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTemplates = () => {
    fetch("/api/pm/templates")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTemplates(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTemplates(); }, []);

  const updateSlug = (val: string) => {
    setForm((f) => ({
      ...f,
      name: val,
      slug: val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    }));
  };

  const resetForm = () => {
    setForm({ name: "", slug: "", description: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (t: Template) => {
    setForm({ name: t.name, slug: t.slug, description: t.description || "" });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug) return;
    setSaving(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId
        ? { id: editingId, name: form.name, description: form.description }
        : { ...form, phases: [] };

      const res = await fetch("/api/pm/templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (editingId) {
        setTemplates((prev) => prev.map((t) => (t.id === editingId ? data : t)));
      } else {
        setTemplates((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch("/api/pm/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setDeletingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  const phaseCount = (t: Template) => t.phases?.length ?? 0;
  const taskCount = (t: Template) =>
    (t.phases ?? []).reduce((sum, p) => sum + (p.tasks?.length ?? 0), 0);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-pm-text">Project Templates</h1>
          <p className="text-pm-muted mt-1">Manage reusable project templates with predefined phases and tasks</p>
        </div>
        <button
          onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? "Cancel" : "+ New Template"}
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSave} className="card mb-6 space-y-4">
          <div className="text-sm font-semibold text-pm-text">
            {editingId ? "Edit Template" : "New Template"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-pm-muted mb-1">Template Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => editingId ? setForm((f) => ({ ...f, name: e.target.value })) : updateSlug(e.target.value)}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="e.g. Church Plant Launch"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-pm-muted mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="What this template is for..."
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !form.name || !form.slug}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Template"}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-pm-muted hover:text-pm-text rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Template list */}
      {loading ? (
        <p className="text-pm-muted">Loading...</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-pm-muted">
          <p className="text-lg mb-2">No templates yet</p>
          <p className="text-sm">Create your first template or save an existing project as a template.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                  <div className="flex items-center gap-3">
                    <span className="text-pm-muted text-xs">
                      {expandedId === t.id ? "\u25BC" : "\u25B6"}
                    </span>
                    <div>
                      <div className="font-semibold text-pm-text">{t.name}</div>
                      <div className="text-sm text-pm-muted">
                        {phaseCount(t)} phases, {taskCount(t)} tasks
                      </div>
                    </div>
                  </div>
                  {t.description && (
                    <p className="text-sm text-pm-muted mt-1 ml-7">{t.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => startEdit(t)}
                    className="px-3 py-1.5 border border-pm-border text-pm-text hover:bg-pm-card rounded-md text-sm font-medium transition-colors"
                  >
                    Edit
                  </button>
                  {deletingId === t.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(t.id)}
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
                      onClick={() => setDeletingId(t.id)}
                      className="px-3 py-1.5 border border-red-600/30 text-red-400 hover:bg-red-600/10 rounded-md text-sm font-medium transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded: show phases and tasks */}
              {expandedId === t.id && t.phases && t.phases.length > 0 && (
                <div className="mt-4 ml-7 border-t border-pm-border pt-4 space-y-3">
                  {t.phases.map((p) => (
                    <div key={p.slug}>
                      <div className="flex items-center gap-2">
                        {p.group && (
                          <span className="text-[10px] font-medium uppercase tracking-wider text-pm-accent bg-pm-accent/10 px-1.5 py-0.5 rounded">
                            {p.group}
                          </span>
                        )}
                        <span className="text-xs text-pm-muted font-mono">P{String(p.order).padStart(2, "0")}</span>
                        <span className="text-sm font-medium text-pm-text">{p.name}</span>
                      </div>
                      {p.tasks && p.tasks.length > 0 && (
                        <ul className="ml-6 mt-1 space-y-0.5">
                          {p.tasks.map((task) => (
                            <li key={task.slug} className="text-xs text-pm-muted flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-pm-not-started shrink-0" />
                              {task.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
