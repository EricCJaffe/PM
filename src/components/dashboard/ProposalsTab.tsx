"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Organization, GeneratedDocument, DocumentType, DocumentStatus } from "@/types/pm";
import { DocStatusBadge } from "@/components/documents/DocStatusBadge";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
  { value: "signed", label: "Signed" },
  { value: "archived", label: "Archived" },
];

export function ProposalsTab({ org }: { org: Organization }) {
  const [docs, setDocs] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showNewDoc, setShowNewDoc] = useState(false);

  useEffect(() => {
    loadDocs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id, statusFilter]);

  async function loadDocs() {
    setLoading(true);
    const params = new URLSearchParams({ org_id: org.id });
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/pm/docgen?${params}`);
    if (res.ok) setDocs(await res.json());
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    const res = await fetch(`/api/pm/docgen/${id}`, { method: "DELETE" });
    if (res.ok) setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  const filtered = search
    ? docs.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          (d.document_type_name ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : docs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-pm-text">Proposals &amp; Documents</h3>
          <p className="text-sm text-pm-muted">
            {docs.length} document{docs.length !== 1 ? "s" : ""} for {org.name}
          </p>
        </div>
        <button
          onClick={() => setShowNewDoc(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Document
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        />
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === sf.value
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-pm-muted hover:text-pm-text hover:bg-pm-card"
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="text-pm-muted text-sm py-12 text-center">Loading documents...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-pm-card border border-pm-border rounded-xl">
          <p className="text-pm-muted mb-2">No documents found</p>
          <p className="text-sm text-pm-muted">
            Create your first document to get started.
          </p>
        </div>
      ) : (
        <div className="bg-pm-card border border-pm-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-pm-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-pm-muted uppercase">Title</th>
                <th className="px-4 py-3 text-xs font-medium text-pm-muted uppercase">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-pm-muted uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-pm-muted uppercase">Version</th>
                <th className="px-4 py-3 text-xs font-medium text-pm-muted uppercase">Updated</th>
                <th className="px-4 py-3 text-xs font-medium text-pm-muted uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} className="border-b border-pm-border last:border-0 hover:bg-pm-bg/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="text-sm font-medium text-pm-text hover:text-blue-400"
                    >
                      {doc.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-pm-muted">
                    {doc.document_type_name}
                  </td>
                  <td className="px-4 py-3">
                    <DocStatusBadge status={doc.status as DocumentStatus} />
                  </td>
                  <td className="px-4 py-3 text-sm text-pm-muted">v{doc.version}</td>
                  <td className="px-4 py-3 text-sm text-pm-muted">
                    {new Date(doc.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Document Modal */}
      {showNewDoc && (
        <NewDocumentModal
          org={org}
          onClose={() => setShowNewDoc(false)}
          onCreated={(doc) => {
            setDocs((prev) => [doc, ...prev]);
            setShowNewDoc(false);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* New Document Modal                                                  */
/* ------------------------------------------------------------------ */

function NewDocumentModal({
  org,
  onClose,
  onCreated,
}: {
  org: Organization;
  onClose: () => void;
  onCreated: (doc: GeneratedDocument) => void;
}) {
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    fetch("/api/pm/document-types")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setDocTypes(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!selectedType || !title.trim()) return;
    setCreating(true);

    const res = await fetch("/api/pm/docgen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_type_id: selectedType,
        org_id: org.id,
        title: title.trim(),
      }),
    });

    if (res.ok) {
      const doc = await res.json();
      // Enrich with type name for display
      const dt = docTypes.find((t) => t.id === selectedType);
      doc.document_type_name = dt?.name ?? "";
      doc.document_type_slug = dt?.slug ?? "";
      onCreated(doc);
    } else {
      setCreating(false);
      alert("Failed to create document");
    }
  }

  const categoryLabels: Record<string, string> = {
    proposal: "Proposals",
    contract: "Contracts",
    report: "Reports",
    internal: "Internal",
  };

  const byCategory = new Map<string, DocumentType[]>();
  for (const dt of docTypes) {
    const cat = dt.category || "other";
    const group = byCategory.get(cat) ?? [];
    group.push(dt);
    byCategory.set(cat, group);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-pm-card rounded-xl border border-pm-border max-w-2xl w-full max-h-[85vh] overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-pm-text">New Document</h3>
            <button onClick={onClose} className="text-pm-muted hover:text-pm-text text-xl">
              &times;
            </button>
          </div>

          {loading ? (
            <div className="text-pm-muted text-sm py-8 text-center">Loading document types...</div>
          ) : docTypes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-pm-muted mb-2">No document types available</p>
              <p className="text-xs text-pm-muted">
                Run <code className="bg-pm-bg px-1 py-0.5 rounded">npm run seed:docgen</code> to add
                document types.
              </p>
            </div>
          ) : (
            <>
              {/* Document type selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-pm-muted mb-3">
                  Document Type
                </label>
                <div className="space-y-5">
                  {Array.from(byCategory.entries()).map(([cat, types]) => (
                    <div key={cat}>
                      <h4 className="text-xs font-semibold text-pm-muted uppercase mb-2">
                        {categoryLabels[cat] ?? cat}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {types.map((dt) => (
                          <button
                            key={dt.id}
                            onClick={() => {
                              setSelectedType(dt.id);
                              if (!title) setTitle(`${dt.name} — ${org.name}`);
                            }}
                            className={`text-left p-3 rounded-lg border transition-colors ${
                              selectedType === dt.id
                                ? "border-blue-500 bg-blue-500/10"
                                : "border-pm-border bg-pm-bg hover:border-pm-muted"
                            }`}
                          >
                            <div className="font-medium text-sm text-pm-text">{dt.name}</div>
                            {dt.description && (
                              <div className="text-xs text-pm-muted mt-1 line-clamp-2">
                                {dt.description}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-pm-muted mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`e.g., SOW - ${org.name} Website Redesign`}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!selectedType || !title.trim() || creating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {creating ? "Creating..." : "Create Document"}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-pm-muted hover:text-pm-text text-sm"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
