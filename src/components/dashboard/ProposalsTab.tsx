"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Organization, Proposal, ProposalTemplate, ProposalStatus } from "@/types/pm";

const STATUS_COLORS: Record<ProposalStatus, string> = {
  draft: "bg-slate-500/20 text-slate-300",
  sent: "bg-blue-500/20 text-blue-400",
  viewed: "bg-purple-500/20 text-purple-400",
  accepted: "bg-emerald-500/20 text-emerald-400",
  rejected: "bg-red-500/20 text-red-400",
  expired: "bg-amber-500/20 text-amber-400",
};

const DOC_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-300",
  review: "bg-purple-500/20 text-purple-400",
  approved: "bg-emerald-500/20 text-emerald-400",
  sent: "bg-blue-500/20 text-blue-400",
  signed: "bg-emerald-500/20 text-emerald-400",
  archived: "bg-amber-500/20 text-amber-400",
};

interface GeneratedDoc {
  id: string;
  title: string;
  status: string;
  document_type_name: string;
  document_type_slug: string;
  version: number;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  compiled_html: string | null;
}

export function ProposalsTab({ org }: { org: Organization }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>([]);
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showPreview, setShowPreview] = useState<Proposal | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/pm/proposals?org_id=${org.id}`).then((r) => r.json()),
      fetch("/api/pm/proposal-templates").then((r) => r.json()),
      fetch(`/api/pm/docgen?org_id=${org.id}`).then((r) => r.json()),
    ])
      .then(([p, t, d]) => {
        if (Array.isArray(p)) setProposals(p);
        if (Array.isArray(t)) setTemplates(t);
        if (Array.isArray(d)) setGeneratedDocs(d);
      })
      .finally(() => setLoading(false));
  }, [org.id]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this proposal?")) return;
    const res = await fetch(`/api/pm/proposals/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setProposals((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSend = async (id: string) => {
    const res = await fetch(`/api/pm/proposals/${id}/send`, { method: "POST" });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setProposals((prev) => prev.map((p) => (p.id === id ? data : p)));
  };

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/proposals/view/${token}`;
    navigator.clipboard.writeText(url);
    alert("Share link copied!");
  };

  if (loading) return <div className="text-pm-muted py-8">Loading proposals...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-pm-text">Proposals</h3>
          <p className="text-sm text-pm-muted">{proposals.length} proposal{proposals.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowBuilder(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Proposal
        </button>
      </div>

      {proposals.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-pm-muted mb-2">No proposals yet</p>
          <p className="text-sm text-pm-muted">Create your first proposal to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((proposal) => (
            <div key={proposal.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-pm-text">{proposal.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[proposal.status]}`}>
                      {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-pm-muted">
                    {proposal.template_slug && <span>Template: {proposal.template_slug}</span>}
                    <span>Created: {new Date(proposal.created_at).toLocaleDateString()}</span>
                    {proposal.sent_at && <span>Sent: {new Date(proposal.sent_at).toLocaleDateString()}</span>}
                    {proposal.viewed_at && <span>Viewed: {new Date(proposal.viewed_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {proposal.generated_content && (
                    <button
                      onClick={() => setShowPreview(proposal)}
                      className="px-3 py-1.5 border border-pm-border text-pm-text hover:bg-pm-card rounded-md text-xs font-medium transition-colors"
                    >
                      Preview
                    </button>
                  )}
                  {proposal.share_token && (
                    <button
                      onClick={() => copyShareLink(proposal.share_token)}
                      className="px-3 py-1.5 border border-pm-border text-pm-text hover:bg-pm-card rounded-md text-xs font-medium transition-colors"
                    >
                      Copy Link
                    </button>
                  )}
                  {proposal.status === "draft" && proposal.generated_content && (
                    <button
                      onClick={() => handleSend(proposal.id)}
                      className="px-3 py-1.5 bg-pm-accent hover:bg-pm-accent-hover text-white rounded-md text-xs font-medium transition-colors"
                    >
                      Mark Sent
                    </button>
                  )}
                  {proposal.status === "draft" && (
                    <button
                      onClick={() => handleDelete(proposal.id)}
                      className="px-3 py-1.5 border border-red-600/30 text-red-400 hover:bg-red-600/10 rounded-md text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generated Documents (SOWs, etc.) */}
      {generatedDocs.length > 0 && (
        <div className="space-y-3 mt-8">
          <div>
            <h3 className="font-semibold text-pm-text">Documents</h3>
            <p className="text-sm text-pm-muted">{generatedDocs.length} generated document{generatedDocs.length !== 1 ? "s" : ""}</p>
          </div>
          {generatedDocs.map((doc) => (
            <div key={doc.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-pm-text">{doc.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DOC_STATUS_COLORS[doc.status] || DOC_STATUS_COLORS.draft}`}>
                      {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                    </span>
                    <span className="text-xs text-pm-muted">{doc.document_type_name}</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-pm-muted">
                    <span>v{doc.version}</span>
                    <span>Created: {new Date(doc.created_at).toLocaleDateString()}</span>
                    {doc.sent_at && <span>Sent: {new Date(doc.sent_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="px-3 py-1.5 bg-pm-accent hover:bg-pm-accent-hover text-white rounded-md text-xs font-medium transition-colors"
                  >
                    Open
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Proposal Builder Modal */}
      {showBuilder && (
        <ProposalBuilder
          org={org}
          templates={templates}
          onClose={() => setShowBuilder(false)}
          onCreated={(p) => {
            setProposals((prev) => [p, ...prev]);
            setShowBuilder(false);
          }}
        />
      )}

      {/* Proposal Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-pm-card rounded-xl border border-pm-border max-w-3xl w-full max-h-[80vh] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-pm-text">{showPreview.title}</h3>
              <button onClick={() => setShowPreview(null)} className="text-pm-muted hover:text-pm-text text-xl">&times;</button>
            </div>
            <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap text-pm-text">
              {showPreview.generated_content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProposalBuilder({
  org,
  templates,
  onClose,
  onCreated,
}: {
  org: Organization;
  templates: ProposalTemplate[];
  onClose: () => void;
  onCreated: (p: Proposal) => void;
}) {
  const [step, setStep] = useState<"template" | "form" | "generating" | "done">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [createdProposal, setCreatedProposal] = useState<Proposal | null>(null);

  const selectTemplate = (t: ProposalTemplate) => {
    setSelectedTemplate(t);
    setTitle(`${t.name} — ${org.name}`);
    // Pre-fill with client data
    const prefill: Record<string, string> = {};
    for (const field of t.variable_fields || []) {
      if (field.name === "client_name") prefill[field.name] = org.name;
      else if (field.name === "contact_name") prefill[field.name] = org.contact_name || "";
      else if (field.name === "contact_email") prefill[field.name] = org.contact_email || "";
      else prefill[field.name] = "";
    }
    setFormData(prefill);
    setStep("form");
  };

  const handleGenerate = async () => {
    if (!title) return;
    setGenerating(true);
    setStep("generating");

    try {
      // Create proposal
      const createRes = await fetch("/api/pm/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: org.id,
          template_slug: selectedTemplate?.slug || null,
          title,
          form_data: formData,
        }),
      });
      const proposal = await createRes.json();
      if (proposal.error) throw new Error(proposal.error);

      // Generate content with AI
      const genRes = await fetch(`/api/pm/proposals/${proposal.id}/generate`, {
        method: "POST",
      });
      const generated = await genRes.json();
      if (generated.error) throw new Error(generated.error);

      setCreatedProposal(generated);
      setStep("done");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate proposal");
      setStep("form");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-pm-card rounded-xl border border-pm-border max-w-2xl w-full max-h-[85vh] overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-pm-text">
              {step === "template" && "Choose Template"}
              {step === "form" && "Fill in Details"}
              {step === "generating" && "Generating..."}
              {step === "done" && "Proposal Ready"}
            </h3>
            <button onClick={onClose} className="text-pm-muted hover:text-pm-text text-xl">&times;</button>
          </div>

          {/* Step 1: Template Selection */}
          {step === "template" && (
            <div className="space-y-3">
              {templates.length === 0 ? (
                <p className="text-sm text-pm-muted py-4">No templates available. Create one first.</p>
              ) : (
                templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className="w-full text-left card hover:border-pm-accent/50 transition-colors"
                  >
                    <div className="font-medium text-pm-text">{t.name}</div>
                    {t.description && <p className="text-sm text-pm-muted mt-1">{t.description}</p>}
                    <div className="text-xs text-pm-muted mt-2">
                      {(t.variable_fields || []).length} fields &middot; {t.output_format}
                    </div>
                  </button>
                ))
              )}
              {/* Quick create without template */}
              <button
                onClick={() => {
                  setTitle(`Proposal — ${org.name}`);
                  setStep("form");
                }}
                className="w-full text-left card hover:border-pm-accent/50 transition-colors border-dashed"
              >
                <div className="font-medium text-pm-text">Blank Proposal</div>
                <p className="text-sm text-pm-muted mt-1">Start from scratch — AI will generate based on your inputs</p>
              </button>
            </div>
          )}

          {/* Step 2: Form */}
          {step === "form" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-pm-muted mb-1">Proposal Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
                />
              </div>

              {selectedTemplate?.variable_fields?.map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-pm-muted mb-1">
                    {field.label} {field.required && "*"}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      value={formData[field.name] || ""}
                      onChange={(e) => setFormData((f) => ({ ...f, [field.name]: e.target.value }))}
                      rows={3}
                      placeholder={field.placeholder}
                      className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={formData[field.name] || ""}
                      onChange={(e) => setFormData((f) => ({ ...f, [field.name]: e.target.value }))}
                      className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                      value={formData[field.name] || ""}
                      onChange={(e) => setFormData((f) => ({ ...f, [field.name]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              ))}

              {!selectedTemplate && (
                <div>
                  <label className="block text-sm font-medium text-pm-muted mb-1">Describe what this proposal should cover</label>
                  <textarea
                    value={formData.description || ""}
                    onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                    rows={4}
                    placeholder="Describe the project scope, deliverables, timeline, and pricing..."
                    className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleGenerate}
                  disabled={!title}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Generate with AI
                </button>
                <button
                  onClick={() => setStep("template")}
                  className="px-4 py-2 text-pm-muted hover:text-pm-text text-sm"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Generating */}
          {step === "generating" && (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-pm-accent border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-pm-muted">AI is generating your proposal...</p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === "done" && createdProposal && (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <p className="text-sm text-emerald-400 font-medium">Proposal generated successfully!</p>
              </div>
              <div className="max-h-[40vh] overflow-auto bg-pm-bg rounded-lg p-4 border border-pm-border">
                <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap text-pm-text">
                  {createdProposal.generated_content}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onCreated(createdProposal);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
