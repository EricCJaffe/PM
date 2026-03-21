"use client";

import { useState, useEffect } from "react";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: { read?: string[]; write?: string[] };
  org_scope: string[] | null;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
  raw_key?: string;
}

export default function AdminApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/pm/api-keys")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setKeys(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/pm/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNewRawKey(data.raw_key);
      setKeys((prev) => [{ ...data, is_active: true }, ...prev]);
      setNewKeyName("");
      setShowCreate(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this API key? Any integrations using it will stop working.")) return;
    try {
      await fetch("/api/pm/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, is_active: false } : k)));
    } catch {}
  }

  function copyKey() {
    if (newRawKey) {
      navigator.clipboard.writeText(newRawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-pm-text mb-1">API Keys</h2>
        <p className="text-pm-muted text-sm">Manage API keys for external integrations (AI assistants, automations)</p>
      </div>

      {/* New key reveal */}
      {newRawKey && (
        <div className="card border-amber-500/30 bg-amber-500/5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            <span className="text-sm font-semibold text-amber-400">Save this key now — it won&apos;t be shown again</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text font-mono break-all select-all">
              {newRawKey}
            </code>
            <button onClick={copyKey} className="px-3 py-2 bg-pm-accent hover:bg-pm-accent-hover text-white rounded-lg text-sm shrink-0">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button onClick={() => setNewRawKey(null)} className="text-xs text-pm-muted hover:text-pm-text mt-2">
            I&apos;ve saved it — dismiss
          </button>
        </div>
      )}

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-pm-text">Active Keys</span>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {showCreate ? "Cancel" : "+ New Key"}
          </button>
        </div>

        {showCreate && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. OpenAI Assistant)"
              className="flex-1 bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-pm-muted">Loading...</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-pm-muted py-4 text-center">No API keys yet. Create one to enable external integrations.</p>
        ) : (
          <div className="divide-y divide-pm-border">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-pm-text">{key.name}</span>
                    {!key.is_active && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Revoked</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <code className="text-xs text-pm-muted font-mono">{key.key_prefix}</code>
                    <span className="text-xs text-pm-muted">
                      Created {new Date(key.created_at).toLocaleDateString()}
                    </span>
                    {key.last_used_at && (
                      <span className="text-xs text-pm-muted">
                        Last used {new Date(key.last_used_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {key.is_active && (
                  <button
                    onClick={() => handleRevoke(key.id)}
                    className="px-3 py-1.5 border border-red-600/30 text-red-400 hover:bg-red-600/10 rounded-lg text-xs font-medium"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
