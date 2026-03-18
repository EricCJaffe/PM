"use client";

import { useState, useEffect } from "react";
import type { Organization, ClientNote, NoteType } from "@/types/pm";

const NOTE_TYPES: { value: NoteType; label: string; icon: string }[] = [
  { value: "general", label: "General", icon: "📝" },
  { value: "meeting", label: "Meeting", icon: "🤝" },
  { value: "phone-call", label: "Phone Call", icon: "📞" },
  { value: "follow-up", label: "Follow-up", icon: "📋" },
];

export function NotesTab({ org }: { org: Organization }) {
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<NoteType | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    note_type: "general" as NoteType,
    pinned: false,
  });

  useEffect(() => {
    fetch(`/api/pm/notes?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setNotes(data); })
      .finally(() => setLoading(false));
  }, [org.id]);

  const filtered = filterType === "all" ? notes : notes.filter((n) => n.note_type === filterType);

  const resetForm = () => {
    setForm({ title: "", body: "", note_type: "general", pinned: false });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (note: ClientNote) => {
    setForm({
      title: note.title,
      body: note.body || "",
      note_type: note.note_type,
      pinned: note.pinned,
    });
    setEditingId(note.id);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    setSaving(true);

    try {
      if (editingId) {
        const res = await fetch(`/api/pm/notes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setNotes((prev) => prev.map((n) => (n.id === editingId ? data : n)));
      } else {
        const res = await fetch("/api/pm/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ org_id: org.id, ...form }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setNotes((prev) => [data, ...prev]);
      }
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    const res = await fetch(`/api/pm/notes/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const togglePin = async (note: ClientNote) => {
    const res = await fetch(`/api/pm/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !note.pinned }),
    });
    const data = await res.json();
    if (data.error) return;
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? data : n))
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
    );
  };

  if (loading) return <div className="text-pm-muted py-8">Loading notes...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-pm-text">Notes</h3>
          <p className="text-sm text-pm-muted">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => showForm ? resetForm() : setShowForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? "Cancel" : "+ New Note"}
        </button>
      </div>

      {/* Type filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterType("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filterType === "all"
              ? "bg-pm-accent text-white"
              : "bg-pm-card border border-pm-border text-pm-muted hover:text-pm-text"
          }`}
        >
          All
        </button>
        {NOTE_TYPES.map((nt) => (
          <button
            key={nt.value}
            onClick={() => setFilterType(nt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterType === nt.value
                ? "bg-pm-accent text-white"
                : "bg-pm-card border border-pm-border text-pm-muted hover:text-pm-text"
            }`}
          >
            {nt.icon} {nt.label}
          </button>
        ))}
      </div>

      {/* Note form */}
      {showForm && (
        <form onSubmit={handleSave} className="card space-y-4">
          <div className="text-sm font-semibold text-pm-text">
            {editingId ? "Edit Note" : "New Note"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Title *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Note title..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Type</label>
              <select
                value={form.note_type}
                onChange={(e) => setForm((f) => ({ ...f, note_type: e.target.value as NoteType }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
              >
                {NOTE_TYPES.map((nt) => (
                  <option key={nt.value} value={nt.value}>{nt.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-pm-muted mb-1">Content</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={5}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Write your note here..."
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-pm-muted">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
                className="rounded"
              />
              Pin to top
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !form.title}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Note"}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-pm-muted hover:text-pm-text text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Notes list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-pm-muted">No notes{filterType !== "all" ? ` of type "${filterType}"` : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => {
            const nt = NOTE_TYPES.find((t) => t.value === note.note_type);
            return (
              <div key={note.id} className={`card ${note.pinned ? "border-pm-accent/30" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {note.pinned && <span className="text-xs" title="Pinned">📌</span>}
                      <span className="text-xs">{nt?.icon}</span>
                      <span className="font-medium text-pm-text">{note.title}</span>
                      <span className="text-xs text-pm-muted px-2 py-0.5 bg-pm-surface rounded">{nt?.label || note.note_type}</span>
                    </div>
                    {note.body && (
                      <p className="text-sm text-pm-muted mt-2 whitespace-pre-wrap line-clamp-3">{note.body}</p>
                    )}
                    <div className="flex gap-3 mt-2 text-xs text-pm-muted">
                      {note.author && <span>By: {note.author}</span>}
                      <span>{new Date(note.created_at).toLocaleDateString()}</span>
                      {note.updated_at !== note.created_at && (
                        <span>(edited {new Date(note.updated_at).toLocaleDateString()})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4 shrink-0">
                    <button
                      onClick={() => togglePin(note)}
                      className="p-1.5 text-pm-muted hover:text-pm-text rounded transition-colors"
                      title={note.pinned ? "Unpin" : "Pin"}
                    >
                      📌
                    </button>
                    <button
                      onClick={() => startEdit(note)}
                      className="px-2 py-1 text-xs border border-pm-border text-pm-text hover:bg-pm-card rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="px-2 py-1 text-xs border border-red-600/30 text-red-400 hover:bg-red-600/10 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
