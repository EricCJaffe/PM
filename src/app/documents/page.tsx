"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { GeneratedDocument, DocumentStatus } from "@/types/pm";
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

export default function DocumentsPage() {
  const [docs, setDocs] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadDocs();
  }, [statusFilter]);

  async function loadDocs() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/pm/docgen?${params}`);
    if (res.ok) setDocs(await res.json());
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    await fetch(`/api/pm/docgen/${id}`, { method: "DELETE" });
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  const filtered = search
    ? docs.filter((d) =>
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        (d.document_type_name ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : docs;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-pm-text">Documents</h1>
          <p className="text-sm text-pm-muted mt-1">
            Generate, edit, and send professional documents
          </p>
        </div>
        <Link
          href="/documents/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
        >
          + New Document
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        />
        <div className="flex gap-1">
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
        <div className="text-center py-16">
          <p className="text-pm-muted mb-4">No documents found</p>
          <Link
            href="/documents/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
          >
            Create your first document
          </Link>
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
                    <Link href={`/documents/${doc.id}`} className="text-sm font-medium text-pm-text hover:text-blue-400">
                      {doc.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-pm-muted">
                    {doc.document_type_name}
                  </td>
                  <td className="px-4 py-3">
                    <DocStatusBadge status={doc.status as DocumentStatus} />
                  </td>
                  <td className="px-4 py-3 text-sm text-pm-muted">
                    v{doc.version}
                  </td>
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
    </div>
  );
}
