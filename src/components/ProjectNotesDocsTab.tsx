"use client";

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import type { ClientNote, ClientNoteAttachment, NoteType, NoteVisibility, ProjectDocument, ProjectComment } from "@/types/pm";

const RichTextEditor = lazy(() => import("./RichTextEditor"));

type Section = "notes" | "documents" | "comments";

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "meeting", label: "Meeting" },
  { value: "phone-call", label: "Phone Call" },
  { value: "follow-up", label: "Follow-up" },
  { value: "decision", label: "Decision" },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString();
}

function FileIcon({ contentType }: { contentType: string | null }) {
  const type = contentType || "";
  if (type.startsWith("image/"))
    return <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>;
  if (type === "application/pdf")
    return <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
  return <svg className="w-5 h-5 text-pm-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
}

export function ProjectNotesDocsTab({
  projectId,
  orgId,
}: {
  projectId: string;
  orgId: string;
}) {
  const [activeSection, setActiveSection] = useState<Section>("notes");

  return (
    <div className="space-y-4">
      {/* Section picker */}
      <div className="flex gap-1 bg-pm-card border border-pm-border rounded-lg p-1 w-fit">
        {(["notes", "documents", "comments"] as Section[]).map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors capitalize ${
              activeSection === s
                ? "bg-blue-600 text-white"
                : "text-pm-muted hover:text-pm-text"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {activeSection === "notes" && <NotesSection projectId={projectId} orgId={orgId} />}
      {activeSection === "documents" && <DocumentsSection projectId={projectId} orgId={orgId} />}
      {activeSection === "comments" && <CommentsSection projectId={projectId} />}
    </div>
  );
}

// ─── Notes Section ────────────────────────────────────────────────────────────

function NotesSection({ projectId, orgId }: { projectId: string; orgId: string }) {
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
    visibility: "internal" as NoteVisibility,
    pinned: false,
  });
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Record<string, ClientNoteAttachment[]>>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const reload = useCallback(() => {
    return fetch(`/api/pm/projects/${projectId}/notes`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setNotes(data); });
  }, [projectId]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const resetForm = () => {
    setForm({ title: "", body: "", note_type: "general", visibility: "internal", pinned: false });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (note: ClientNote) => {
    setForm({
      title: note.title,
      body: note.body || "",
      note_type: note.note_type,
      visibility: note.visibility || "internal",
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
        const res = await fetch(`/api/pm/projects/${projectId}/notes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setNotes((prev) => prev.map((n) => (n.id === editingId ? data : n)));
      } else {
        const res = await fetch(`/api/pm/projects/${projectId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ org_id: orgId, ...form }),
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
    const res = await fetch(`/api/pm/projects/${projectId}/notes/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const togglePin = async (note: ClientNote) => {
    const res = await fetch(`/api/pm/projects/${projectId}/notes/${note.id}`, {
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

  const loadAttachments = async (noteId: string) => {
    if (expandedNoteId === noteId) { setExpandedNoteId(null); return; }
    setExpandedNoteId(noteId);
    if (attachments[noteId]) return;
    const res = await fetch(`/api/pm/notes/${noteId}/attachments`);
    const data = await res.json();
    if (Array.isArray(data)) setAttachments((prev) => ({ ...prev, [noteId]: data }));
  };

  const handleUpload = async (noteId: string, file: File) => {
    setUploading(true);
    setUploadingFor(noteId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/pm/notes/${noteId}/attachments`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAttachments((prev) => ({ ...prev, [noteId]: [...(prev[noteId] || []), data] }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadingFor(null);
    }
  };

  const handleDeleteAttachment = async (noteId: string, attachmentId: string) => {
    const res = await fetch(`/api/pm/notes/${noteId}/attachments?attachment_id=${attachmentId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setAttachments((prev) => ({ ...prev, [noteId]: (prev[noteId] || []).filter((a) => a.id !== attachmentId) }));
  };

  const filtered = notes.filter((n) => filterType === "all" || n.note_type === filterType);

  if (loading) return <div className="text-pm-muted py-8">Loading notes...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-pm-muted">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => (showForm && !editingId ? resetForm() : setShowForm(true))}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm && !editingId ? "Cancel" : "+ New Note"}
        </button>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filterType === "all" ? "bg-pm-accent text-white" : "bg-pm-card border border-pm-border text-pm-muted hover:text-pm-text"
          }`}
        >
          All
        </button>
        {NOTE_TYPES.map((nt) => (
          <button
            key={nt.value}
            onClick={() => setFilterType(nt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterType === nt.value ? "bg-pm-accent text-white" : "bg-pm-card border border-pm-border text-pm-muted hover:text-pm-text"
            }`}
          >
            {nt.label}
          </button>
        ))}
      </div>

      {/* Note form */}
      {showForm && (
        <form onSubmit={handleSave} className="card space-y-4">
          <div className="text-sm font-semibold text-pm-text">{editingId ? "Edit Note" : "New Note"}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
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
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as NoteVisibility }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
              >
                <option value="internal">Internal Only</option>
                <option value="client">Client Visible</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-pm-muted mb-1">Content</label>
              <Suspense fallback={<div className="h-[200px] bg-pm-bg border border-pm-border rounded-lg flex items-center justify-center text-pm-muted text-sm">Loading editor...</div>}>
                <RichTextEditor
                  value={form.body}
                  onChange={(html) => setForm((f) => ({ ...f, body: html }))}
                  placeholder="Write your note here..."
                />
              </Suspense>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-pm-muted cursor-pointer">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))} className="rounded" />
              Pin to top
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !form.title} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Note"}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-pm-muted hover:text-pm-text text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Notes list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-pm-muted">No notes yet — add one to capture meeting notes, decisions, or follow-ups.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => {
            const noteAttachments = attachments[note.id] || [];
            const isExpanded = expandedNoteId === note.id;
            return (
              <div key={note.id} className={`card ${note.pinned ? "border-pm-accent/40" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {note.pinned && (
                        <svg className="w-3.5 h-3.5 text-pm-accent shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                      )}
                      <span className="font-medium text-pm-text">{note.title}</span>
                      <span className="text-xs text-pm-muted px-2 py-0.5 bg-pm-surface rounded">
                        {NOTE_TYPES.find((t) => t.value === note.note_type)?.label || note.note_type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        note.visibility === "client" ? "bg-green-600/20 text-green-400" : "bg-amber-600/20 text-amber-400"
                      }`}>
                        {note.visibility === "client" ? "Client Visible" : "Internal"}
                      </span>
                    </div>
                    {note.body && (
                      <div
                        className="text-sm text-pm-muted mt-2 line-clamp-3 prose prose-sm prose-invert max-w-none [&>*]:m-0"
                        dangerouslySetInnerHTML={{ __html: note.body }}
                      />
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-pm-muted">
                      {note.author && <span>By {note.author}</span>}
                      <span>{new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => loadAttachments(note.id)}
                      className={`p-1.5 rounded transition-colors ${isExpanded ? "text-pm-accent" : "text-pm-muted hover:text-pm-text"}`}
                      title="Attachments"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                    </button>
                    <button
                      onClick={() => togglePin(note)}
                      className={`p-1.5 rounded transition-colors ${note.pinned ? "text-pm-accent" : "text-pm-muted hover:text-pm-text"}`}
                      title={note.pinned ? "Unpin" : "Pin"}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" /></svg>
                    </button>
                    <button onClick={() => startEdit(note)} className="px-2 py-1 text-xs border border-pm-border text-pm-text hover:bg-pm-card rounded transition-colors">Edit</button>
                    <button onClick={() => handleDelete(note.id)} className="px-2 py-1 text-xs border border-red-600/30 text-red-400 hover:bg-red-600/10 rounded transition-colors">Delete</button>
                  </div>
                </div>

                {/* Attachments panel */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-pm-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-pm-muted">Attachments ({noteAttachments.length})</span>
                      <button
                        onClick={() => { setUploadingFor(note.id); fileInputRef.current?.click(); }}
                        className="text-xs text-pm-accent hover:underline"
                      >
                        + Attach File
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && uploadingFor) handleUpload(uploadingFor, file);
                        e.target.value = "";
                      }}
                    />
                    {uploading && uploadingFor === note.id && (
                      <p className="text-xs text-pm-muted">Uploading...</p>
                    )}
                    {noteAttachments.length === 0 && !uploading ? (
                      <p className="text-xs text-pm-muted">No attachments</p>
                    ) : (
                      <div className="space-y-1.5">
                        {noteAttachments.map((att) => (
                          <div key={att.id} className="flex items-center justify-between bg-pm-bg rounded px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileIcon contentType={att.content_type} />
                              <span className="text-sm text-pm-text truncate">{att.file_name}</span>
                              {att.file_size && (
                                <span className="text-xs text-pm-muted shrink-0">{formatFileSize(att.file_size)}</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteAttachment(note.id, att.id)}
                              className="text-xs text-red-400 hover:text-red-300 ml-2 shrink-0"
                            >
                              Remove
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

// ─── Documents Section ────────────────────────────────────────────────────────

function DocumentsSection({ projectId, orgId }: { projectId: string; orgId: string }) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    return fetch(`/api/pm/projects/${projectId}/documents`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setDocuments(data); });
  }, [projectId]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("org_id", orgId);
      const res = await fetch(`/api/pm/projects/${projectId}/documents`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDocuments((prev) => [data, ...prev]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    const res = await fetch(`/api/pm/projects/${projectId}/documents?document_id=${docId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleDownload = (doc: ProjectDocument) => {
    if (!doc.download_url) { alert("Download link unavailable — refresh the page."); return; }
    const a = document.createElement("a");
    a.href = doc.download_url;
    a.download = doc.file_name;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) return <div className="text-pm-muted py-8">Loading documents...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-pm-muted">{documents.length} document{documents.length !== 1 ? "s" : ""}</p>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {uploading ? "Uploading..." : "+ Upload Document"}
          </button>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-10 h-10 text-pm-muted mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-pm-muted text-sm">No documents uploaded yet.</p>
          <p className="text-pm-muted text-xs mt-1">Upload PDFs, spreadsheets, images, or any file related to this project.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="card flex items-center gap-4">
              <div className="shrink-0">
                <FileIcon contentType={doc.content_type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-pm-text truncate">{doc.title || doc.file_name}</div>
                {doc.title && doc.title !== doc.file_name && (
                  <div className="text-xs text-pm-muted">{doc.file_name}</div>
                )}
                <div className="flex gap-3 mt-0.5 text-xs text-pm-muted">
                  {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                  {doc.uploaded_by && <span>by {doc.uploaded_by}</span>}
                  <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDownload(doc)}
                  className="px-3 py-1.5 text-xs border border-pm-border text-pm-text hover:bg-pm-card rounded transition-colors"
                >
                  Download
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="px-3 py-1.5 text-xs border border-red-600/30 text-red-400 hover:bg-red-600/10 rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Comments Section ─────────────────────────────────────────────────────────

function CommentsSection({ projectId }: { projectId: string }) {
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    return fetch(`/api/pm/projects/${projectId}/comments`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setComments(data); });
  }, [projectId]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pm/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: author.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setComments((prev) => [...prev, data]);
      setBody("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(`/api/pm/projects/${projectId}/comments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment_id: commentId }),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  if (loading) return <div className="text-pm-muted py-8">Loading comments...</div>;

  return (
    <div className="space-y-5">
      {/* Thread */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <div className="card text-center py-12">
            <svg className="w-10 h-10 text-pm-muted mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <p className="text-pm-muted text-sm">No comments yet — start a discussion below.</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="card group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-7 h-7 rounded-full bg-pm-accent/20 flex items-center justify-center text-pm-accent text-xs font-bold shrink-0">
                      {comment.author.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-medium text-pm-text text-sm">{comment.author}</span>
                    <span className="text-xs text-pm-muted">{formatRelativeTime(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-pm-text leading-relaxed whitespace-pre-wrap pl-9">{comment.body}</p>
                </div>
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition-opacity shrink-0 mt-0.5"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="card space-y-3">
        <div className="text-sm font-semibold text-pm-text">Add a Comment</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-pm-muted mb-1">Your Name</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
              placeholder="e.g. Eric"
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-pm-muted mb-1">Comment</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={3}
              placeholder="Write your comment..."
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting || !author.trim() || !body.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {submitting ? "Posting..." : "Post Comment"}
        </button>
      </form>
    </div>
  );
}
