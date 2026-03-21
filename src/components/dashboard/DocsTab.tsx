"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Organization, PMDocument, ProjectWithStats } from "@/types/pm";
import { Modal, Field, Input, Select, ModalActions } from "../Modal";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const CATEGORIES = ["sop", "document", "report", "template", "policy", "other"] as const;

const categoryLabels: Record<string, string> = {
  sop: "SOP",
  document: "Document",
  report: "Report",
  template: "Template",
  policy: "Policy",
  other: "Other",
};

const categoryIcons: Record<string, string> = {
  sop: "📋",
  document: "📄",
  report: "📊",
  template: "📑",
  policy: "📜",
  other: "📎",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadModal({ orgId, onClose, projectId }: { orgId: string; onClose: () => void; projectId?: string | null }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("document");
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !title) return;

    setSaving(true);
    const formData = new FormData();
    formData.append("org_id", orgId);
    if (projectId) formData.append("project_id", projectId);
    formData.append("title", title);
    formData.append("category", category);
    formData.append("department", department);
    formData.append("description", description);
    formData.append("file", file);

    await fetch("/api/pm/documents", { method: "POST", body: formData });
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <Modal title="Upload Document" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder="Document name" />
        </Field>
        <Field label="File">
          <input
            ref={fileRef}
            type="file"
            required
            className="w-full text-sm text-pm-muted file:mr-3 file:py-2 file:px-3 file:border-0 file:text-sm file:font-medium file:bg-pm-accent file:text-white file:rounded-lg file:cursor-pointer hover:file:bg-pm-accent-hover"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabels[c]}</option>)}
            </Select>
          </Field>
          <Field label="Department">
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </Field>
        <ModalActions onClose={onClose} saving={saving} label="Upload" />
      </form>
    </Modal>
  );
}

export function DocsTab({ org, documents, projects, selectedProjectId }: { org: Organization; documents: PMDocument[]; projects?: ProjectWithStats[]; selectedProjectId?: string | null }) {
  const router = useRouter();
  const [upload, setUpload] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [scanning, setScanning] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ docTitle: string; count: number } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PMDocument | null>(null);

  const filtered = filter ? documents.filter((d) => d.category === filter) : documents;
  const categories = [...new Set(documents.map((d) => d.category))];

  async function handleDelete(doc: PMDocument) {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    await fetch(`/api/pm/documents/${doc.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleScan(doc: PMDocument) {
    setScanning(doc.id);
    setScanResult(null);
    const res = await fetch("/api/pm/scan-sop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: doc.id,
        org_id: org.id,
        project_id: selectedProjectId || doc.project_id || null,
      }),
    });
    const data = await res.json();
    setScanning(null);
    if (res.ok) {
      setScanResult({ docTitle: doc.title, count: data.opportunities_created });
      router.refresh();
    } else {
      alert(data.error || "Scan failed");
    }
  }

  async function handleDownload(doc: PMDocument) {
    try {
      const res = await fetch(`/api/pm/attachments/download?type=document&id=${doc.id}`);
      const data = await res.json();
      if (data.download_url) {
        const a = document.createElement("a");
        a.href = data.download_url;
        a.download = doc.file_name;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch {
      alert("Failed to download file");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-pm-muted">{documents.length} documents</span>
          {categories.length > 1 && (
            <div className="flex gap-1 ml-3">
              <button
                onClick={() => setFilter(null)}
                className={`px-2 py-0.5 rounded text-xs ${!filter ? "bg-pm-accent text-white" : "text-pm-muted border border-pm-border"}`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={`px-2 py-0.5 rounded text-xs ${filter === c ? "bg-pm-accent text-white" : "text-pm-muted border border-pm-border"}`}
                >
                  {categoryLabels[c]}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setUpload(true)} className="px-3 py-1.5 bg-pm-accent hover:bg-pm-accent-hover text-white text-sm rounded-lg font-medium">
          + Upload Document
        </button>
      </div>

      {scanResult && (
        <div className="mb-4 px-4 py-3 bg-pm-complete/10 border border-pm-complete/30 rounded-lg flex items-center justify-between">
          <span className="text-sm text-pm-text">
            AI scan of &ldquo;{scanResult.docTitle}&rdquo; found <strong>{scanResult.count}</strong> automation {scanResult.count === 1 ? "opportunity" : "opportunities"}.
            {scanResult.count > 0 && " Check the Opportunities tab to review."}
          </span>
          <button onClick={() => setScanResult(null)} className="text-pm-muted hover:text-pm-text text-xs ml-3">&times;</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-pm-muted">{documents.length === 0 ? "No documents uploaded yet." : "No documents in this category."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div key={doc.id} className="card flex items-center gap-4 group">
              <span className="text-2xl">{categoryIcons[doc.category] ?? "📎"}</span>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => setPreviewDoc(doc)}
                  className="font-medium text-blue-400 hover:text-blue-300 text-left truncate block"
                  title="Click to preview"
                >
                  {doc.title}
                </button>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-pm-muted">
                  <span>{categoryLabels[doc.category]}</span>
                  {doc.department && <span>{doc.department}</span>}
                  <span>{doc.file_name}</span>
                  <span>{formatFileSize(doc.file_size)}</span>
                  {doc.uploaded_by && <span>by {doc.uploaded_by}</span>}
                </div>
                {doc.description && <p className="text-xs text-pm-muted mt-1">{doc.description}</p>}
              </div>
              <button
                onClick={() => setPreviewDoc(doc)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-pm-muted hover:text-pm-text hover:bg-pm-bg rounded transition-all shrink-0"
                title="Preview"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
              <button
                onClick={() => handleDownload(doc)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-pm-muted hover:text-blue-400 hover:bg-pm-bg rounded transition-all shrink-0"
                title="Download"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onClick={() => handleScan(doc)}
                disabled={scanning === doc.id}
                className="px-2 py-1 text-xs rounded border border-pm-accent text-pm-accent hover:bg-pm-accent hover:text-white transition-colors disabled:opacity-50 shrink-0"
                title="AI Scan for automation opportunities"
              >
                {scanning === doc.id ? "Scanning..." : "AI Scan"}
              </button>
              <button
                onClick={() => handleDelete(doc)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-pm-muted hover:text-pm-blocked hover:bg-pm-bg rounded transition-all shrink-0"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {upload && <UploadModal orgId={org.id} onClose={() => setUpload(false)} projectId={selectedProjectId} />}

      {previewDoc && (
        <FilePreviewModal
          fileName={previewDoc.file_name}
          contentType={previewDoc.mime_type || "application/octet-stream"}
          attachmentType="document"
          attachmentId={previewDoc.id}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
