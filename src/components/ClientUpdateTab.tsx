"use client";

import { useState, useEffect, useCallback } from "react";

interface ClientUpdate {
  id: string;
  title: string;
  body: string;
  subject: string | null;
  status: "draft" | "sent" | "archived";
  sent_at: string | null;
  sent_to_email: string | null;
  sent_to_name: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

interface Props {
  projectId: string;
  orgId: string;
}

export function ClientUpdateTab({ projectId, orgId }: Props) {
  const [updates, setUpdates] = useState<ClientUpdate[]>([]);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [tone, setTone] = useState<"friendly" | "formal">("friendly");

  const loadUpdates = useCallback(async () => {
    try {
      const res = await fetch(`/api/pm/client-update?project_id=${projectId}`);
      if (res.ok) setUpdates(await res.json());
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    loadUpdates();
  }, [loadUpdates]);

  const generateUpdate = async () => {
    if (!clientEmail || !clientName) return;
    setGenerating(true);
    setShowForm(false);
    try {
      const res = await fetch("/api/pm/client-update/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          client_email: clientEmail,
          client_name: clientName,
          tone,
        }),
      });
      if (res.ok) {
        await loadUpdates();
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        alert(err.error || "Failed to generate update");
      }
    } finally {
      setGenerating(false);
    }
  };

  const sendUpdate = async (id: string) => {
    setSending(id);
    try {
      const res = await fetch(`/api/pm/client-update/${id}/send`, {
        method: "POST",
      });
      if (res.ok) {
        await loadUpdates();
      } else {
        const err = await res.json().catch(() => ({ error: "Send failed" }));
        alert(err.error || "Failed to send");
      }
    } finally {
      setSending(null);
    }
  };

  const saveEdit = async (id: string, body: string, subject: string) => {
    await fetch(`/api/pm/client-update/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, subject }),
    });
    setEditingId(null);
    await loadUpdates();
  };

  const drafts = updates.filter((u) => u.status === "draft");
  const sent = updates.filter((u) => u.status === "sent");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-pm-text font-semibold">Client Updates</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Generate Update
        </button>
      </div>

      {/* Generate form */}
      {showForm && (
        <div className="bg-pm-card rounded-xl border border-pm-border p-5 space-y-4">
          <h4 className="text-pm-text font-medium text-sm">
            Generate weekly update
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-pm-muted text-xs block mb-1">
                Client name
              </label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-pm-muted text-xs block mb-1">
                Client email
              </label>
              <input
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="jane@client.com"
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="text-pm-muted text-xs block mb-1">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as "friendly" | "formal")}
              className="bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={generateUpdate}
              disabled={!clientEmail || !clientName || generating}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {generating ? "Generating..." : "Generate Draft"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-pm-muted hover:text-pm-text text-sm px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Generating indicator */}
      {generating && (
        <div className="text-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-pm-muted text-sm">Generating client update...</p>
        </div>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-pm-muted text-xs font-medium uppercase tracking-wide">
            Drafts ({drafts.length})
          </h4>
          {drafts.map((update) => (
            <ClientUpdateCard
              key={update.id}
              update={update}
              onSend={() => sendUpdate(update.id)}
              onEdit={() =>
                setEditingId(editingId === update.id ? null : update.id)
              }
              onSaveEdit={saveEdit}
              isEditing={editingId === update.id}
              isSending={sending === update.id}
            />
          ))}
        </div>
      )}

      {/* Sent */}
      {sent.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-pm-muted text-xs font-medium uppercase tracking-wide">
            Sent ({sent.length})
          </h4>
          {sent.map((update) => (
            <div
              key={update.id}
              className="bg-pm-card/50 rounded-xl border border-pm-border/50 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-pm-text text-sm font-medium">
                    {update.subject ?? update.title}
                  </p>
                  <p className="text-pm-muted text-xs mt-1">
                    Sent to {update.sent_to_name} ({update.sent_to_email})
                    {update.sent_at
                      ? ` · ${new Date(update.sent_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <span className="text-green-400 text-xs bg-green-900/20 px-2 py-1 rounded-full border border-green-800/50">
                  Sent
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {updates.length === 0 && !showForm && !generating && (
        <div className="text-center py-10">
          <p className="text-pm-muted text-sm">No client updates yet</p>
          <p className="text-pm-muted/60 text-xs mt-1">
            Generate a weekly update to keep your client informed
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Card Component ─────────────────────────────────────────────────

interface CardProps {
  update: ClientUpdate;
  onSend: () => void;
  onEdit: () => void;
  onSaveEdit: (id: string, body: string, subject: string) => void;
  isEditing: boolean;
  isSending: boolean;
}

function ClientUpdateCard({
  update,
  onSend,
  onEdit,
  onSaveEdit,
  isEditing,
  isSending,
}: CardProps) {
  const [editBody, setEditBody] = useState(update.body);
  const [editSubject, setEditSubject] = useState(
    update.subject ?? update.title
  );

  return (
    <div className="bg-pm-card rounded-xl border border-pm-border overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-3 border-b border-pm-border flex items-center justify-between">
        <div>
          <p className="text-pm-text text-sm font-medium">
            {update.subject ?? update.title}
          </p>
          <p className="text-pm-muted text-xs mt-0.5">
            To: {update.sent_to_name} ({update.sent_to_email})
            {update.period_start &&
              ` · ${update.period_start} to ${update.period_end}`}
          </p>
        </div>
        <span className="text-orange-400 text-xs bg-orange-900/20 px-2 py-1 rounded-full border border-orange-800/50">
          Draft
        </span>
      </div>

      {/* Body */}
      <div className="p-5">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="text-pm-muted text-xs block mb-1">
                Subject line
              </label>
              <input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-pm-muted text-xs block mb-1">
                Email body
              </label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={12}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm font-mono resize-y focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  onSaveEdit(update.id, editBody, editSubject)
                }
                className="bg-pm-card border border-pm-border hover:border-blue-500/50 text-pm-text px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Save changes
              </button>
              <button
                onClick={onEdit}
                className="text-pm-muted hover:text-pm-text text-sm px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-pm-text/80 text-sm leading-relaxed whitespace-pre-wrap">
            {update.body}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="px-5 py-3 border-t border-pm-border flex gap-3">
          <button
            onClick={onSend}
            disabled={isSending}
            className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {isSending
              ? "Sending..."
              : `Send to ${update.sent_to_name}`}
          </button>
          <button
            onClick={onEdit}
            className="border border-pm-border text-pm-muted hover:text-pm-text px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
