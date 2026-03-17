"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Profile {
  id: string;
  email: string;
  display_name: string;
  system_role: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/pm/auth/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setProfile(data);
          setDisplayName(data.display_name || "");
        }
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    if (!displayName.trim()) {
      setError("Display name cannot be empty");
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/pm/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setProfile((prev) => prev ? { ...prev, display_name: data.display_name } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-pm-muted">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/" className="text-sm text-pm-muted hover:text-pm-accent transition-colors">
          &larr; Back to Dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-pm-text mb-1">Settings</h1>
      <p className="text-pm-muted text-sm mb-8">Manage your profile and preferences</p>

      <div className="card p-6 space-y-6">
        <h2 className="text-lg font-semibold text-pm-text">Profile</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-pm-muted mb-1.5">Email</label>
            <div className="bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-muted">
              {profile.email}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-pm-muted mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
              placeholder="Your display name"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-pm-muted mb-1.5">Role</label>
            <div className="bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-muted capitalize">
              {profile.system_role}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {saved && <p className="text-sm text-green-400">Settings saved successfully</p>}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving || displayName === profile.display_name}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
