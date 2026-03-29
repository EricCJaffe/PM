"use client";

import { useState, useEffect } from "react";
import type { Organization, PortalSettings, PortalInvite } from "@/types/pm";

const defaultSettings: Omit<PortalSettings, "id" | "org_id" | "created_at" | "updated_at"> = {
  show_projects: true,
  show_phases: true,
  show_tasks: true,
  show_risks: false,
  show_process_maps: false,
  show_kpis: false,
  show_documents: true,
  show_proposals: true,
  show_reports: false,
  show_daily_logs: false,
  show_engagements: false,
  show_kb_articles: false,
  allow_task_comments: false,
  allow_file_uploads: false,
  allow_chat: false,
  portal_title: null,
  welcome_message: null,
  primary_color: null,
};

const inviteRoles = ["viewer", "member"];

export function PortalSettingsTab({ org }: { org: Organization }) {
  // --- Settings state ---
  const [settings, setSettings] = useState(defaultSettings);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // --- Invites state ---
  const [invites, setInvites] = useState<PortalInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [savingInvite, setSavingInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "viewer" });
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // --- Load settings ---
  useEffect(() => {
    setLoadingSettings(true);
    fetch(`/api/pm/portal?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          const { id, org_id, created_at, updated_at, ...rest } = data;
          setSettings({ ...defaultSettings, ...rest });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, [org.id]);

  // --- Load invites ---
  const loadInvites = () => {
    setLoadingInvites(true);
    fetch(`/api/pm/portal/invites?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setInvites(data);
      })
      .catch(() => setInvites([]))
      .finally(() => setLoadingInvites(false));
  };

  useEffect(() => {
    loadInvites();
  }, [org.id]);

  // --- Save settings ---
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/pm/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: org.id, ...settings }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // --- Toggle helper ---
  const toggle = (key: keyof typeof settings) => {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  };

  // --- Invite handlers ---
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email) return;
    setSavingInvite(true);
    try {
      const res = await fetch("/api/pm/portal/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: org.id,
          email: inviteForm.email,
          name: inviteForm.name || null,
          role: inviteForm.role,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInvites((prev) => [data, ...prev]);
      setInviteForm({ email: "", name: "", role: "viewer" });
      setShowInviteForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSavingInvite(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await fetch("/api/pm/portal/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInvites((prev) => prev.filter((inv) => inv.id !== id));
      setRevokingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke invite");
    }
  };

  // --- Toggle switch component ---
  const Toggle = ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: () => void;
  }) => (
    <label className="flex items-center justify-between py-1.5 cursor-pointer group">
      <span className="text-sm text-pm-text group-hover:text-white transition-colors">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-pm-border"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );

  const portalUrl = typeof window !== "undefined"
    ? `${window.location.origin}/portal/${org.slug}`
    : `/portal/${org.slug}`;

  const [copied, setCopied] = useState(false);
  const copyPortalLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loadingSettings) {
    return <p className="text-pm-muted">Loading portal settings...</p>;
  }

  return (
    <div className="space-y-8">
      {/* ===== Portal Link ===== */}
      <div className="card border-pm-accent/30">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-pm-text mb-1">Client Portal Link</h4>
            <p className="text-sm text-pm-muted">Share this link with your client to give them access to their portal.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-pm-surface border border-pm-border hover:border-pm-accent/50 text-pm-text text-sm rounded-lg font-medium transition-colors"
            >
              Open Portal
            </a>
            <button
              onClick={copyPortalLink}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 bg-pm-bg border border-pm-border rounded-lg px-3 py-2">
          <span className="text-sm text-pm-muted font-mono truncate flex-1">{portalUrl}</span>
        </div>
      </div>

      {/* ===== SECTION 1: Portal Settings ===== */}
      <div>
        <h3 className="text-lg font-semibold text-pm-text mb-4">Portal Settings</h3>

        {/* Branding */}
        <div className="card mb-4">
          <h4 className="text-sm font-semibold text-pm-text mb-3">Branding</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">
                Portal Title
              </label>
              <input
                type="text"
                value={settings.portal_title || ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    portal_title: e.target.value || null,
                  }))
                }
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="e.g. Client Portal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">
                Welcome Message
              </label>
              <textarea
                value={settings.welcome_message || ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    welcome_message: e.target.value || null,
                  }))
                }
                rows={3}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Welcome to your project portal..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">
                Primary Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.primary_color || "#3b82f6"}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, primary_color: e.target.value }))
                  }
                  className="h-9 w-14 rounded border border-pm-border bg-pm-bg cursor-pointer"
                />
                <span className="text-sm text-pm-muted">
                  {settings.primary_color || "Default (blue)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Visibility */}
        <div className="card mb-4">
          <h4 className="text-sm font-semibold text-pm-text mb-3">Content Visibility</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <Toggle label="Projects" checked={!!settings.show_projects} onChange={() => toggle("show_projects")} />
            <Toggle label="Phases" checked={!!settings.show_phases} onChange={() => toggle("show_phases")} />
            <Toggle label="Tasks" checked={!!settings.show_tasks} onChange={() => toggle("show_tasks")} />
            <Toggle label="Risks" checked={!!settings.show_risks} onChange={() => toggle("show_risks")} />
          </div>
        </div>

        {/* Reports & Logs */}
        <div className="card mb-4">
          <h4 className="text-sm font-semibold text-pm-text mb-3">Reports</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <Toggle label="Reports" checked={!!settings.show_reports} onChange={() => toggle("show_reports")} />
            <Toggle label="Daily Logs" checked={!!settings.show_daily_logs} onChange={() => toggle("show_daily_logs")} />
            <Toggle label="Proposals" checked={!!settings.show_proposals} onChange={() => toggle("show_proposals")} />
          </div>
        </div>

        {/* Resources */}
        <div className="card mb-4">
          <h4 className="text-sm font-semibold text-pm-text mb-3">Resources</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <Toggle label="Process Maps" checked={!!settings.show_process_maps} onChange={() => toggle("show_process_maps")} />
            <Toggle label="KPIs" checked={!!settings.show_kpis} onChange={() => toggle("show_kpis")} />
            <Toggle label="Documents" checked={!!settings.show_documents} onChange={() => toggle("show_documents")} />
            <Toggle label="Engagements" checked={!!settings.show_engagements} onChange={() => toggle("show_engagements")} />
            <Toggle label="KB Articles" checked={!!settings.show_kb_articles} onChange={() => toggle("show_kb_articles")} />
          </div>
        </div>

        {/* Interaction Permissions */}
        <div className="card mb-4">
          <h4 className="text-sm font-semibold text-pm-text mb-3">Interaction Permissions</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <Toggle label="Allow Task Comments" checked={!!settings.allow_task_comments} onChange={() => toggle("allow_task_comments")} />
            <Toggle label="Allow File Uploads" checked={!!settings.allow_file_uploads} onChange={() => toggle("allow_file_uploads")} />
            <Toggle label="Allow Chat" checked={!!settings.allow_chat} onChange={() => toggle("allow_chat")} />
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {savingSettings ? "Saving..." : "Save Settings"}
          </button>
          {savedFlash && (
            <span className="text-sm text-green-400 font-medium">Saved!</span>
          )}
        </div>
      </div>

      {/* ===== SECTION 2: Portal Invitations ===== */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-pm-text">
            Portal Invitations ({invites.length})
          </h3>
          <button
            onClick={() => {
              if (showInviteForm) {
                setShowInviteForm(false);
                setInviteForm({ email: "", name: "", role: "viewer" });
              } else {
                setShowInviteForm(true);
              }
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            {showInviteForm ? "Cancel" : "+ Invite"}
          </button>
        </div>

        {/* Invite form */}
        {showInviteForm && (
          <form onSubmit={handleInvite} className="card mb-4 space-y-4">
            <div className="text-sm font-semibold text-pm-text">Send Invitation</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-pm-muted mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-pm-muted mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-pm-muted mb-1">
                  Role
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, role: e.target.value }))
                  }
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                >
                  {inviteRoles.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingInvite || !inviteForm.email}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {savingInvite ? "Sending..." : "Send Invite"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInviteForm(false);
                  setInviteForm({ email: "", name: "", role: "viewer" });
                }}
                className="px-4 py-2 text-pm-muted hover:text-pm-text rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Invite list */}
        {loadingInvites ? (
          <p className="text-pm-muted">Loading invites...</p>
        ) : invites.length === 0 ? (
          <div className="text-center py-12 text-pm-muted">
            <p className="text-lg mb-2">No portal invitations</p>
            <p className="text-sm">
              Invite external users to give them access to the client portal.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="card flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-pm-border flex items-center justify-center text-pm-text font-medium text-sm">
                    {(invite.name || invite.email)
                      .split(/[\s@]/)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-medium text-pm-text">
                      {invite.name || invite.email}
                    </div>
                    <div className="text-xs text-pm-muted">
                      {invite.name ? invite.email : ""}{" "}
                      {invite.name && " \u00b7 "}
                      Invited{" "}
                      {new Date(invite.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      invite.accepted_at
                        ? "bg-green-500/20 text-green-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {invite.accepted_at ? "Accepted" : "Pending"}
                  </span>
                  <span className="status-badge status-in-progress capitalize text-xs">
                    {invite.role}
                  </span>
                  {revokingId === invite.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRevoke(invite.id)}
                        className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setRevokingId(null)}
                        className="text-sm text-pm-muted hover:text-pm-text transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRevokingId(invite.id)}
                      className="text-sm text-red-400/70 hover:text-red-400 transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
