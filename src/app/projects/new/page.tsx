"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const templates = [
  {
    slug: "saas-rollout",
    name: "SaaS App Rollout",
    description: "26-phase rollout for SaaS products across Build, Go-to-Market, Grow, and Foundation stages.",
  },
  {
    slug: "ministry-discovery",
    name: "Ministry / Org Discovery",
    description: "7-phase discovery process for ministry and organizational transformation.",
  },
  {
    slug: "tech-stack-modernization",
    name: "Tech Stack Modernization (PMBOK)",
    description: "PMBOK-aligned tech modernization with 12 management sections.",
  },
  {
    slug: "custom",
    name: "Custom",
    description: "Blank slate. Define your own phases, tasks, and structure.",
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    owner: "",
    template_slug: "saas-rollout",
    org_slug: "",
    target_date: "",
    budget: "",
  });

  const updateSlug = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setForm((f) => ({ ...f, name, slug }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/pm/projects/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          budget: form.budget ? Number(form.budget) : null,
          target_date: form.target_date || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      router.push(`/projects/${form.slug}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-pm-text mb-8">New Project</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Template</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => setForm((f) => ({ ...f, template_slug: t.slug }))}
                className={`card text-left transition-colors ${
                  form.template_slug === t.slug
                    ? "border-blue-500 bg-blue-500/10"
                    : "hover:border-pm-muted/50"
                }`}
              >
                <div className="font-medium text-pm-text text-sm">{t.name}</div>
                <div className="text-xs text-pm-muted mt-1">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Project Name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => updateSlug(e.target.value)}
            className="w-full bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
            placeholder="e.g. Honey Lake Digital"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Slug</label>
          <input
            type="text"
            required
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            className="w-full bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Organization Slug</label>
          <input
            type="text"
            required
            value={form.org_slug}
            onChange={(e) => setForm((f) => ({ ...f, org_slug: e.target.value }))}
            className="w-full bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500 font-mono text-sm"
            placeholder="e.g. yarash-eretz"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-pm-muted mb-1">Owner</label>
            <input
              type="text"
              value={form.owner}
              onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
              className="w-full bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
              placeholder="e.g. eric-jaffe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-pm-muted mb-1">Target Date</label>
            <input
              type="date"
              value={form.target_date}
              onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
              className="w-full bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Budget</label>
          <input
            type="number"
            value={form.budget}
            onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
            className="w-full bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
            placeholder="Optional"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? "Creating..." : "Create Project"}
        </button>
      </form>
    </div>
  );
}
