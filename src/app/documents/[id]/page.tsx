"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { GeneratedDocument, DocumentIntakeField, DocumentSection, DocumentStatus } from "@/types/pm";
import { IntakeForm } from "@/components/documents/IntakeForm";
import { SectionEditor } from "@/components/documents/SectionEditor";
import { DocumentPreview } from "@/components/documents/DocumentPreview";
import { DocStatusBadge } from "@/components/documents/DocStatusBadge";

type Tab = "intake" | "sections" | "preview";

export default function DocumentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<GeneratedDocument & { html_template?: string; css_styles?: string } | null>(null);
  const [fields, setFields] = useState<DocumentIntakeField[]>([]);
  const [sections, setSections] = useState<DocumentSection[]>([]);
  const [intakeValues, setIntakeValues] = useState<Record<string, string>>({});
  const [compiledHtml, setCompiledHtml] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("intake");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load document, fields, sections
  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/pm/docgen/${id}`).then((r) => r.json()),
      fetch(`/api/pm/docgen/${id}/sections`).then((r) => r.json()),
    ]).then(([docData, sectionData]) => {
      setDoc(docData);
      setSections(Array.isArray(sectionData) ? sectionData : []);
      setIntakeValues(docData.intake_data ?? {});
      if (docData.compiled_html) setCompiledHtml(docData.compiled_html);

      // Load intake fields for this document type
      if (docData.document_type_slug) {
        fetch(`/api/pm/document-types/${docData.document_type_slug}/fields`)
          .then((r) => r.json())
          .then((f) => { if (Array.isArray(f)) setFields(f); });
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Save intake data
  const saveIntake = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    await fetch(`/api/pm/docgen/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intake_data: intakeValues,
        org_id: intakeValues._org_id || undefined,
      }),
    });
    setSaving(false);
  }, [id, intakeValues]);

  // Save sections
  async function saveSections() {
    if (!id) return;
    setSaving(true);
    const res = await fetch(`/api/pm/docgen/${id}/sections`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSections(updated);
    }
    setSaving(false);
  }

  // AI generate all sections
  async function handleGenerate() {
    if (!id) return;
    // Save intake first
    await saveIntake();
    setGenerating(true);
    const res = await fetch(`/api/pm/docgen/${id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.sections) setSections(data.sections);
      setActiveTab("sections");
    } else {
      const err = await res.json();
      alert(`Generation failed: ${err.error ?? "Unknown error"}`);
    }
    setGenerating(false);
  }

  // Compile HTML preview
  async function handleCompile() {
    if (!id) return;
    await saveSections();
    setCompiling(true);
    const res = await fetch(`/api/pm/docgen/${id}/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      setCompiledHtml(data.compiled_html);
      setActiveTab("preview");
    }
    setCompiling(false);
  }

  // Send document
  async function handleSend() {
    if (!id || !confirm("Mark this document as sent?")) return;
    setSending(true);
    const res = await fetch(`/api/pm/docgen/${id}/send`, { method: "POST" });
    if (res.ok) {
      const updated = await res.json();
      setDoc((prev) => prev ? { ...prev, status: updated.status, sent_at: updated.sent_at } : prev);
    }
    setSending(false);
  }

  // Status update
  async function handleStatusChange(status: DocumentStatus) {
    if (!id) return;
    await fetch(`/api/pm/docgen/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setDoc((prev) => prev ? { ...prev, status } : prev);
  }

  function handleSectionUpdate(sectionId: string, contentHtml: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, content_html: contentHtml } : s))
    );
  }

  function handleToggleLock(sectionId: string, locked: boolean) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, is_locked: locked } : s))
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <p className="text-pm-muted text-sm">Loading document...</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <p className="text-pm-muted">Document not found</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "intake", label: "Intake Form" },
    { id: "sections", label: "Sections" },
    { id: "preview", label: "Preview" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={() => router.push("/documents")}
          className="text-sm text-pm-muted hover:text-pm-text"
        >
          &larr; Documents
        </button>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-pm-text">{doc.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-pm-muted">{doc.document_type_name}</span>
            <DocStatusBadge status={doc.status} />
            <span className="text-xs text-pm-muted">v{doc.version}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Status dropdown */}
          <select
            value={doc.status}
            onChange={(e) => handleStatusChange(e.target.value as DocumentStatus)}
            className="bg-pm-bg border border-pm-border rounded-lg px-3 py-1.5 text-pm-text text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="draft">Draft</option>
            <option value="review">In Review</option>
            <option value="approved">Approved</option>
            <option value="sent">Sent</option>
            <option value="signed">Signed</option>
            <option value="archived">Archived</option>
          </select>

          {doc.status !== "sent" && doc.status !== "signed" && (
            <button
              onClick={handleSend}
              disabled={sending || !compiledHtml}
              className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium"
              title={!compiledHtml ? "Compile the document first" : ""}
            >
              {sending ? "Sending..." : "Mark as Sent"}
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-pm-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-pm-muted hover:text-pm-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "intake" && (
        <div>
          <IntakeForm
            fields={fields}
            values={intakeValues}
            onChange={setIntakeValues}
          />
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-pm-border">
            <button
              onClick={saveIntake}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium"
            >
              {saving ? "Saving..." : "Save Intake Data"}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium"
            >
              {generating ? "Generating Sections..." : "AI Generate All Sections"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "sections" && (
        <div>
          {sections.length === 0 ? (
            <div className="text-center py-12 text-pm-muted">
              <p className="mb-4">No sections yet. Generate them from the Intake Form tab.</p>
              <button
                onClick={() => setActiveTab("intake")}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Go to Intake Form
              </button>
            </div>
          ) : (
            <>
              <SectionEditor
                sections={sections}
                onUpdate={handleSectionUpdate}
                onToggleLock={handleToggleLock}
              />
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-pm-border">
                <button
                  onClick={saveSections}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium"
                >
                  {saving ? "Saving..." : "Save Sections"}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium"
                >
                  {generating ? "Regenerating..." : "Regenerate (unlocked only)"}
                </button>
                <button
                  onClick={handleCompile}
                  disabled={compiling}
                  className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium"
                >
                  {compiling ? "Compiling..." : "Compile & Preview"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "preview" && (
        <div>
          {compiledHtml ? (
            <DocumentPreview compiledHtml={compiledHtml} documentTitle={doc.title} />
          ) : (
            <div className="text-center py-12 text-pm-muted">
              <p className="mb-4">No preview available. Compile the document from the Sections tab.</p>
              <button
                onClick={() => setActiveTab("sections")}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Go to Sections
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
