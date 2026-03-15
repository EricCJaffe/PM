"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SetupBanner } from "@/components/SetupBanner";

interface TableError {
  error: string;
  missing: string[];
  migrations: string[];
}

interface Org {
  id: string;
  slug: string;
  name: string;
}

interface AssignableMember {
  id: string;
  slug: string;
  display_name: string;
  role: string;
  is_site_staff: boolean;
  org_name: string;
}

interface TemplateOption {
  slug: string;
  name: string;
  description: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [tableError, setTableError] = useState<TableError | null>(null);
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    owner: "",
    template_slug: "saas-rollout",
    org_id: "",
    start_date: "",
    target_date: "",
    budget: "",
  });

  // Load orgs and templates on mount
  useEffect(() => {
    fetch("/api/pm/organizations")
      .then((r) => r.json())
      .then((data) => {
        if (data?.missing) {
          setTableError(data);
        } else if (Array.isArray(data)) {
          setOrgs(data);
        }
      })
      .catch(() => {});

    fetch("/api/pm/templates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTemplates(data.map((t: { slug: string; name: string; description: string }) => ({
            slug: t.slug,
            name: t.name,
            description: t.description || "",
          })));
          // Default to first template if available
          if (data.length > 0) {
            setForm((f) => ({ ...f, template_slug: f.template_slug || data[0].slug }));
          }
        }
      })
      .catch(() => {});
  }, []);

  // Load members when org changes
  useEffect(() => {
    if (!form.org_id) {
      setMembers([]);
      setForm((f) => ({ ...f, owner: "" }));
      return;
    }
    fetch(`/api/pm/members/assignable?org_id=${form.org_id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.missing) {
          setTableError(data);
        } else if (Array.isArray(data)) {
          setMembers(data);
        }
      })
      .catch(() => setMembers([]));
  }, [form.org_id]);

  const updateSlug = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setForm((f) => ({ ...f, name, slug }));
  };

  const updateNewOrgSlug = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setNewOrgName(name);
    setNewOrgSlug(slug);
  };

  const createOrg = async () => {
    if (!newOrgName || !newOrgSlug) return;
    setCreatingOrg(true);
    try {
      const res = await fetch("/api/pm/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName, slug: newOrgSlug }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Add to list and select it
      setOrgs((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, org_id: data.id }));
      setShowNewOrg(false);
      setNewOrgName("");
      setNewOrgSlug("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.org_id) {
      alert("Please select an organization");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/pm/projects/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description,
          owner: form.owner || "",
          template_slug: form.template_slug,
          org_id: form.org_id,
          org_slug: selectedOrg?.slug || "",
          budget: form.budget ? Number(form.budget) : null,
          start_date: form.start_date || null,
          target_date: form.target_date || null,
        }),
      });
      const data = await res.json();
      if (data.missing) {
        setTableError(data);
        return;
      }
      if (data.error) {
        const d = data.details;
        let detail = "";
        if (d) {
          detail += `\n\nDebug: org_id=${d.org_id}, code=${d.code}`;
          if (d.org_exists_now !== undefined) {
            detail += `\nOrg exists now: ${d.org_exists_now}`;
            detail += `\nOrg found: ${JSON.stringify(d.org_found)}`;
            detail += `\nAll orgs in DB: ${JSON.stringify(d.all_orgs)}`;
            if (d.hint) detail += `\nHint: ${d.hint}`;
            if (d.pg_detail) detail += `\nPG detail: ${d.pg_detail}`;
          }
        }
        throw new Error(data.error + detail);
      }
      router.push(`/projects/${form.slug}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const selectedOrg = orgs.find((o) => o.id === form.org_id);

  if (tableError) {
    return <SetupBanner missing={tableError.missing} migrations={tableError.migrations} />;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-pm-text mb-8">New Project</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Organization */}
        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Organization</label>
          {!showNewOrg ? (
            <div className="flex gap-2">
              <select
                required
                value={form.org_id}
                onChange={(e) => setForm((f) => ({ ...f, org_id: e.target.value }))}
                className="flex-1 bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
              >
                <option value="">Select an organization...</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.slug})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewOrg(true)}
                className="px-3 py-2 bg-pm-card border border-pm-border hover:border-pm-muted text-pm-text rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                + New Org
              </button>
            </div>
          ) : (
            <div className="card space-y-3">
              <div className="text-sm font-medium text-pm-text">Create New Organization</div>
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => updateNewOrgSlug(e.target.value)}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Organization name"
              />
              <input
                type="text"
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value)}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500 font-mono text-sm"
                placeholder="org-slug"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={createOrg}
                  disabled={creatingOrg || !newOrgName || !newOrgSlug}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {creatingOrg ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewOrg(false); setNewOrgName(""); setNewOrgSlug(""); }}
                  className="px-4 py-2 bg-pm-card border border-pm-border hover:border-pm-muted text-pm-muted rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {selectedOrg && (
            <div className="text-xs text-pm-muted mt-1 font-mono">{selectedOrg.slug}</div>
          )}
        </div>

        {/* Template */}
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

        {/* Project Name */}
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

        {/* Slug */}
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

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
            rows={3}
          />
        </div>

        {/* Owner */}
        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Owner</label>
          <select
            value={form.owner}
            onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
            className="w-full bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
            disabled={!form.org_id}
          >
            <option value="">{form.org_id ? "Select owner..." : "Select org first"}</option>
            {(() => {
              const siteStaff = members.filter((m) => m.is_site_staff);
              const orgMembers = members.filter((m) => !m.is_site_staff);
              return (
                <>
                  {siteStaff.length > 0 && (
                    <optgroup label={siteStaff[0].org_name}>
                      {siteStaff.map((m) => (
                        <option key={m.id} value={m.slug}>{m.display_name}</option>
                      ))}
                    </optgroup>
                  )}
                  {orgMembers.length > 0 && (
                    <optgroup label={orgMembers[0].org_name}>
                      {orgMembers.map((m) => (
                        <option key={m.id} value={m.slug}>{m.display_name}</option>
                      ))}
                    </optgroup>
                  )}
                </>
              );
            })()}
          </select>
          {form.org_id && members.length === 0 && (
            <p className="text-xs text-pm-muted mt-1">
              No users yet. Add users from the client&apos;s <a href="/clients" className="text-blue-400 hover:underline">dashboard</a> first.
            </p>
          )}
        </div>

        {/* Start Date + End Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-pm-muted mb-1">Start Date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              className="w-full bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-pm-muted mb-1">End Date</label>
            <input
              type="date"
              value={form.target_date}
              onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
              className="w-full bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Budget */}
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
          disabled={loading || !form.org_id}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? "Creating..." : "Create Project"}
        </button>
      </form>
    </div>
  );
}
