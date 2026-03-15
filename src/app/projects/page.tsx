"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressBar } from "@/components/ProgressBar";
import type { ProjectStatus } from "@/types/pm";

/* ─── Types ─────────────────────────────────────────────── */

interface ProjectItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: ProjectStatus;
  owner: string | null;
  org_name?: string;
  phase_count: number;
  task_count: number;
  complete_tasks: number;
  blocked_tasks: number;
  overall_progress: number;
}

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

/* ─── Main Page ─────────────────────────────────────────── */

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto p-6"><p className="text-pm-muted">Loading...</p></div>}>
      <ProjectsPageInner />
    </Suspense>
  );
}

function ProjectsPageInner() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "templates" ? "templates" : "projects";
  const [activeTab, setActiveTab] = useState<"projects" | "templates">(initialTab);

  const tabs = [
    { id: "projects" as const, label: "Projects" },
    { id: "templates" as const, label: "Templates" },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-pm-text">Projects</h1>
        <p className="text-pm-muted mt-1">Manage your projects and templates</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-pm-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-pm-accent text-pm-accent"
                : "border-transparent text-pm-muted hover:text-pm-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "projects" && <ProjectsTab />}
      {activeTab === "templates" && <TemplatesTab />}
    </div>
  );
}

/* ─── Projects Tab ──────────────────────────────────────── */

function ProjectsTab() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pm/projects")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setProjects(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/pm/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } else {
      const { error } = await res.json();
      alert(`Delete failed: ${error}`);
    }
  };

  const totalTasks = projects.reduce((s, p) => s + p.task_count, 0);
  const completeTasks = projects.reduce((s, p) => s + p.complete_tasks, 0);
  const blockedTasks = projects.reduce((s, p) => s + p.blocked_tasks, 0);
  const activeProjects = projects.filter((p) => p.status === "active").length;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-6 text-sm">
          <div><span className="text-pm-muted">Active:</span> <span className="text-pm-in-progress font-medium">{activeProjects}</span></div>
          <div><span className="text-pm-muted">Tasks:</span> <span className="text-pm-text font-medium">{totalTasks}</span></div>
          <div><span className="text-pm-muted">Completed:</span> <span className="text-pm-complete font-medium">{completeTasks}</span></div>
          <div><span className="text-pm-muted">Blocked:</span> <span className="text-pm-blocked font-medium">{blockedTasks}</span></div>
        </div>
        <Link
          href="/projects/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Project
        </Link>
      </div>

      {loading ? (
        <p className="text-pm-muted">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-pm-muted">
          <p className="text-lg mb-2">No projects yet</p>
          <p className="text-sm">Create your first project to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div key={project.id} className="relative group">
              <Link href={`/projects/${project.slug}`}>
                <div className="card hover:border-pm-muted/50 transition-colors cursor-pointer">
                  {project.org_name && (
                    <div className="text-xs font-medium text-blue-400 mb-2 uppercase tracking-wide">
                      {project.org_name}
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg text-pm-text">{project.name}</h3>
                      <p className="text-sm text-pm-muted mt-0.5">{project.description}</p>
                    </div>
                    <StatusBadge status={project.status} />
                  </div>
                  <ProgressBar value={project.overall_progress} className="mb-3" />
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <div className="font-medium text-pm-text">{project.phase_count}</div>
                      <div className="text-pm-muted">Phases</div>
                    </div>
                    <div>
                      <div className="font-medium text-pm-text">{project.task_count}</div>
                      <div className="text-pm-muted">Tasks</div>
                    </div>
                    <div>
                      <div className="font-medium text-pm-complete">{project.complete_tasks}</div>
                      <div className="text-pm-muted">Done</div>
                    </div>
                    <div>
                      <div className="font-medium text-pm-blocked">{project.blocked_tasks}</div>
                      <div className="text-pm-muted">Blocked</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-pm-border text-xs text-pm-muted">
                    <span>Owner: {project.owner || "Unassigned"}</span>
                    <span>{project.overall_progress}% complete</span>
                  </div>
                </div>
              </Link>
              <button
                onClick={() => handleDelete(project.id, project.name)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded z-10"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ─── Templates Tab ─────────────────────────────────────── */

function TemplatesTab() {
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
    <>
      <div className="flex items-center justify-end mb-6">
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
    </>
  );
}
