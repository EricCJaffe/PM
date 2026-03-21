"use client";

import { useState, useEffect } from "react";

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

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Props {
  form: Record<string, any>;
  update: (field: string, value: any) => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const PROJECT_TYPES = [
  { value: "client_web_app", label: "Client Web App" },
  { value: "client_marketing", label: "Client Marketing Site" },
  { value: "saas", label: "SaaS Product" },
  { value: "ecommerce", label: "E-Commerce" },
  { value: "church_site", label: "Church / Ministry Site" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "personal_app", label: "Personal / Internal App" },
  { value: "other", label: "Other" },
];

export function Step1Basics({ form, update }: Props) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);

  useEffect(() => {
    fetch("/api/pm/organizations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setOrgs(data);
      })
      .catch(() => {});

    fetch("/api/pm/templates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTemplates(
            data.map((t: { slug: string; name: string; description: string }) => ({
              slug: t.slug,
              name: t.name,
              description: t.description || "",
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.org_id) {
      setMembers([]);
      return;
    }
    fetch(`/api/pm/members/assignable?org_id=${form.org_id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMembers(data);
      })
      .catch(() => setMembers([]));
  }, [form.org_id]);

  const updateName = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    update("name", name);
    update("slug", slug);
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
      setOrgs((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      update("org_id", data.id);
      setShowNewOrg(false);
      setNewOrgName("");
      setNewOrgSlug("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setCreatingOrg(false);
    }
  };

  const siteStaff = members.filter((m) => m.is_site_staff);
  const orgMembers = members.filter((m) => !m.is_site_staff);

  return (
    <div className="space-y-5">
      <h3 className="text-pm-text font-semibold text-lg">Project basics</h3>

      {/* Organization */}
      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">Organization</label>
        {!showNewOrg ? (
          <div className="flex gap-2">
            <select
              value={form.org_id}
              onChange={(e) => update("org_id", e.target.value)}
              className="flex-1 bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Select an organization...</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewOrg(true)}
              className="px-3 py-2 bg-pm-bg border border-pm-border hover:border-pm-muted text-pm-text rounded-lg text-sm"
            >
              + New
            </button>
          </div>
        ) : (
          <div className="bg-pm-bg border border-pm-border rounded-lg p-3 space-y-2">
            <input
              value={newOrgName}
              onChange={(e) => {
                setNewOrgName(e.target.value);
                setNewOrgSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
                );
              }}
              placeholder="Organization name"
              className="w-full bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={createOrg}
                disabled={creatingOrg || !newOrgName}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm"
              >
                {creatingOrg ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowNewOrg(false)}
                className="text-pm-muted hover:text-pm-text text-sm px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Project name */}
      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">Project name</label>
        <input
          value={form.name}
          onChange={(e) => updateName(e.target.value)}
          placeholder="e.g. Honey Lake Digital"
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Project type */}
      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">Project type</label>
        <select
          value={form.project_type}
          onChange={(e) => update("project_type", e.target.value)}
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        >
          {PROJECT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Template */}
      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">Template</label>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => update("template_slug", t.slug)}
              className={`text-left border rounded-lg px-3 py-2 transition-colors ${
                form.template_slug === t.slug
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-pm-border hover:border-pm-muted/50"
              }`}
            >
              <div className="font-medium text-pm-text text-sm">{t.name}</div>
              <div className="text-xs text-pm-muted mt-0.5">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Owner */}
      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">Owner</label>
        <select
          value={form.owner}
          onChange={(e) => update("owner", e.target.value)}
          disabled={!form.org_id}
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
        >
          <option value="">{form.org_id ? "Select owner..." : "Select org first"}</option>
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
        </select>
      </div>

      {/* V1 definition of done */}
      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">
          V1 definition of done
        </label>
        <textarea
          value={form.v1_done}
          onChange={(e) => update("v1_done", e.target.value)}
          placeholder="What does the minimum viable version look like?"
          rows={3}
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Greenfield toggle + dates + budget */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Target date</label>
          <input
            type="date"
            value={form.target_date}
            onChange={(e) => update("target_date", e.target.value)}
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Budget</label>
          <input
            type="number"
            value={form.budget}
            onChange={(e) => update("budget", e.target.value)}
            placeholder="Optional"
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_greenfield}
          onChange={(e) => update("is_greenfield", e.target.checked)}
          className="w-4 h-4 rounded border-pm-border bg-pm-bg text-blue-500 focus:ring-blue-500"
        />
        <span className="text-sm text-pm-text">Greenfield project (no existing codebase)</span>
      </label>
    </div>
  );
}
