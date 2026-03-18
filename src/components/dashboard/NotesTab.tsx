"use client";

import { useState, useEffect, useRef } from "react";
import type { Organization, ClientNote, ClientNoteAttachment, NoteType } from "@/types/pm";

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "meeting", label: "Meeting" },
  { value: "phone-call", label: "Phone Call" },
  { value: "follow-up", label: "Follow-up" },
];

function NoteTypeIcon({ type, className = "w-4 h-4" }: { type: NoteType; className?: string }) {
  switch (type) {
    case "meeting":
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>;
    case "phone-call":
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>;
    case "follow-up":
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>;
    default: // general
      return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
  }
}

function PinIcon({ className = "w-4 h-4" }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" /></svg>;
}

function PaperclipIcon({ className = "w-4 h-4" }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>;
}

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

  // AI summary state
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  // Attachment state
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Record<string, ClientNoteAttachment[]>>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Attachment handlers
  const loadAttachments = async (noteId: string) => {
    if (expandedNoteId === noteId) {
      setExpandedNoteId(null);
      return;
    }
    setExpandedNoteId(noteId);
    if (attachments[noteId]) return;
    const res = await fetch(`/api/pm/notes/${noteId}/attachments`);
    const data = await res.json();
    if (Array.isArray(data)) {
      setAttachments((prev) => ({ ...prev, [noteId]: data }));
    }
  };

  const handleUpload = async (noteId: string, file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/pm/notes/${noteId}/attachments`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAttachments((prev) => ({
        ...prev,
        [noteId]: [...(prev[noteId] || []), data],
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (noteId: string, attachmentId: string) => {
    const res = await fetch(`/api/pm/notes/${noteId}/attachments?attachment_id=${attachmentId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setAttachments((prev) => ({
      ...prev,
      [noteId]: (prev[noteId] || []).filter((a) => a.id !== attachmentId),
    }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    setSummary(null);
    try {
      const noteIds = filtered.map((n) => n.id);
      const res = await fetch("/api/pm/notes/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: org.id, note_ids: noteIds.length < notes.length ? noteIds : undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSummary(data.summary);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Summarization failed");
    } finally {
      setSummarizing(false);
    }
  };

  if (loading) return <div className="text-pm-muted py-8">Loading notes...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-pm-text">Notes</h3>
          <p className="text-sm text-pm-muted">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {notes.length > 0 && (
            <button
              onClick={handleSummarize}
              disabled={summarizing}
              className="px-4 py-2 border border-pm-accent text-pm-accent hover:bg-pm-accent hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {summarizing ? "Summarizing..." : "AI Summary"}
            </button>
          )}
          <button
            onClick={() => showForm ? resetForm() : setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {showForm ? "Cancel" : "+ New Note"}
          </button>
        </div>
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterType === nt.value
                ? "bg-pm-accent text-white"
                : "bg-pm-card border border-pm-border text-pm-muted hover:text-pm-text"
            }`}
          >
            <NoteTypeIcon type={nt.value} className="w-3.5 h-3.5" />
            {nt.label}
          </button>
        ))}
      </div>

      {/* AI Summary panel */}
      {summary && (
        <div className="card border-pm-accent/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-pm-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
              <span className="text-sm font-semibold text-pm-accent">AI Summary</span>
            </div>
            <button onClick={() => setSummary(null)} className="text-pm-muted hover:text-pm-text text-xs">&times; Close</button>
          </div>
          <div className="prose prose-sm prose-invert max-w-none text-pm-text text-sm whitespace-pre-wrap leading-relaxed">
            {summary}
          </div>
        </div>
      )}

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
            <label className="flex items-center gap-2 text-sm text-pm-muted cursor-pointer">
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
            const noteAttachments = attachments[note.id] || [];
            const isExpanded = expandedNoteId === note.id;
            return (
              <div key={note.id} className={`card ${note.pinned ? "border-pm-accent/30" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {note.pinned && (
                        <span className="text-pm-accent" title="Pinned">
                          <PinIcon className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <span className="text-pm-muted">
                        <NoteTypeIcon type={note.note_type} className="w-4 h-4" />
                      </span>
                      <span className="font-medium text-pm-text">{note.title}</span>
                      <span className="text-xs text-pm-muted px-2 py-0.5 bg-pm-surface rounded">
                        {NOTE_TYPES.find((t) => t.value === note.note_type)?.label || note.note_type}
                      </span>
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
                      onClick={() => loadAttachments(note.id)}
                      className={`p-1.5 rounded transition-colors ${isExpanded ? "text-pm-accent" : "text-pm-muted hover:text-pm-text"}`}
                      title="Attachments"
                    >
                      <PaperclipIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => togglePin(note)}
                      className={`p-1.5 rounded transition-colors ${note.pinned ? "text-pm-accent" : "text-pm-muted hover:text-pm-text"}`}
                      title={note.pinned ? "Unpin" : "Pin"}
                    >
                      <PinIcon className="w-4 h-4" />
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

                {/* Attachments panel */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-pm-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-pm-muted uppercase tracking-wider">
                        Attachments ({noteAttachments.length})
                      </span>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-pm-surface border border-pm-border text-pm-text hover:bg-pm-card rounded-md transition-colors disabled:opacity-50"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        {uploading ? "Uploading..." : "Upload File"}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(note.id, file);
                          e.target.value = "";
                        }}
                      />
                    </div>
                    {noteAttachments.length === 0 ? (
                      <p className="text-xs text-pm-muted py-2">No attachments yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {noteAttachments.map((att) => (
                          <div key={att.id} className="flex items-center justify-between py-2 px-3 bg-pm-surface rounded-lg">
                            <div className="flex items-center gap-2 min-w-0">
                              <svg className="w-4 h-4 text-pm-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                              <span className="text-sm text-pm-text truncate">{att.file_name}</span>
                              <span className="text-xs text-pm-muted shrink-0">{formatFileSize(att.file_size)}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteAttachment(note.id, att.id)}
                              className="p-1 text-pm-muted hover:text-red-400 transition-colors shrink-0 ml-2"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
