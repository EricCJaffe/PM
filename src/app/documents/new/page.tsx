"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { DocumentType } from "@/types/pm";

export default function NewDocumentPage() {
  const router = useRouter();
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
        title: title.trim(),
      }),
    });

    if (res.ok) {
      const doc = await res.json();
      router.push(`/documents/${doc.id}`);
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

  // Group by category
  const byCategory = new Map<string, DocumentType[]>();
  for (const dt of docTypes) {
    const cat = dt.category || "other";
    const group = byCategory.get(cat) ?? [];
    group.push(dt);
    byCategory.set(cat, group);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <button
        onClick={() => router.push("/documents")}
        className="text-sm text-pm-muted hover:text-pm-text mb-4 inline-block"
      >
        &larr; Documents
      </button>

      <h1 className="text-2xl font-bold text-pm-text mb-2">New Document</h1>
      <p className="text-sm text-pm-muted mb-8">
        Choose a document type and enter a title to get started.
      </p>

      {loading ? (
        <div className="text-pm-muted text-sm py-12 text-center">Loading document types...</div>
      ) : docTypes.length === 0 ? (
        <div className="text-center py-16 bg-pm-card border border-pm-border rounded-xl">
          <p className="text-pm-muted mb-2">No document types available</p>
          <p className="text-xs text-pm-muted">
            Run <code className="bg-pm-bg px-1 py-0.5 rounded">npm run seed:docgen</code> to add document types.
          </p>
        </div>
      ) : (
        <>
          {/* Document type selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-pm-muted mb-3">
              Document Type
            </label>
            <div className="space-y-6">
              {Array.from(byCategory.entries()).map(([cat, types]) => (
                <div key={cat}>
                  <h3 className="text-xs font-semibold text-pm-muted uppercase mb-2">
                    {categoryLabels[cat] ?? cat}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {types.map((dt) => (
                      <button
                        key={dt.id}
                        onClick={() => {
                          setSelectedType(dt.id);
                          if (!title) setTitle(`${dt.name}`);
                        }}
                        className={`text-left p-4 rounded-lg border transition-colors ${
                          selectedType === dt.id
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-pm-border bg-pm-card hover:border-pm-muted"
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
          <div className="mb-8">
            <label className="block text-sm font-medium text-pm-muted mb-1">
              Document Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., SOW - Acme Corp Website Redesign"
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={!selectedType || !title.trim() || creating}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg"
          >
            {creating ? "Creating..." : "Create Document"}
          </button>
        </>
      )}
    </div>
  );
}
