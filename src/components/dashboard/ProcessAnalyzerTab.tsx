"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { Organization, PMDocument } from "@/types/pm";

type ScanStep = "select" | "scanning" | "results";

interface ScanResult {
  document_id: string;
  document_title: string;
  opportunities_found: number;
  opportunities_created: number;
  opportunities: ScannedOpportunity[];
}

interface ScannedOpportunity {
  id: string;
  title: string;
  description: string | null;
  complexity: string;
  estimated_savings: number;
  priority_score: number;
  estimated_timeline: string | null;
  source: string | null;
}

export function ProcessAnalyzerTab({
  org,
  onBack,
}: {
  org: Organization;
  onBack: () => void;
}) {
  const [step, setStep] = useState<ScanStep>("select");
  const [documents, setDocuments] = useState<PMDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [currentlyScanningIdx, setCurrentlyScanningIdx] = useState(0);

  useEffect(() => {
    fetch(`/api/pm/documents?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDocuments(data);
      })
      .catch(() => {})
      .finally(() => setLoadingDocs(false));
  }, [org.id]);

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runScan = async () => {
    if (selectedDocIds.size === 0) return;
    setStep("scanning");
    setScanError(null);
    setScanResults([]);
    const ids = Array.from(selectedDocIds);
    const results: ScanResult[] = [];

    for (let i = 0; i < ids.length; i++) {
      setCurrentlyScanningIdx(i);
      const doc = documents.find((d) => d.id === ids[i]);
      try {
        const res = await fetch("/api/pm/scan-sop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_id: ids[i], org_id: org.id }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        results.push({
          document_id: ids[i],
          document_title: doc?.title ?? ids[i],
          opportunities_found: data.opportunities_found ?? 0,
          opportunities_created: data.opportunities_created ?? 0,
          opportunities: data.opportunities ?? [],
        });
      } catch (err) {
        results.push({
          document_id: ids[i],
          document_title: doc?.title ?? ids[i],
          opportunities_found: 0,
          opportunities_created: 0,
          opportunities: [],
        });
        setScanError(`Error scanning "${doc?.title}": ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    setScanResults(results);
    setStep("results");
  };

  const totalFound = scanResults.reduce((s, r) => s + r.opportunities_found, 0);
  const totalCreated = scanResults.reduce((s, r) => s + r.opportunities_created, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-pm-muted hover:text-pm-accent transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Workflows
        </button>
        <div className="h-5 w-px bg-pm-border" />
        <h3 className="text-lg font-semibold text-pm-text">Process Analyzer</h3>
      </div>

      {/* Start Process Discovery Workflow */}
      <ProcessDiscoveryLauncher org={org} />

      {/* Step: Select Documents */}
      {step === "select" && (
        <div className="space-y-6">
          <div className="card">
            <h4 className="font-semibold text-pm-text mb-1">SOP Scanner</h4>
            <ol className="text-sm text-pm-muted space-y-1 list-decimal list-inside">
              <li>Select one or more client documents (SOPs, process docs, manuals)</li>
              <li>AI reads each document and scores it against your methodology</li>
              <li>Automation opportunities are identified, ranked, and saved to this client</li>
            </ol>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-pm-text">
                Client Documents
                {selectedDocIds.size > 0 && (
                  <span className="ml-2 text-sm font-normal text-pm-accent">
                    {selectedDocIds.size} selected
                  </span>
                )}
              </h4>
              <Link
                href={`/clients/${org.slug}?tab=docs`}
                className="text-xs text-pm-muted hover:text-pm-accent transition-colors"
              >
                Manage Docs &rarr;
              </Link>
            </div>

            {loadingDocs ? (
              <div className="card text-center py-8 text-pm-muted text-sm">Loading documents…</div>
            ) : documents.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-pm-muted text-sm mb-3">No documents uploaded for this client yet.</p>
                <Link
                  href={`/clients/${org.slug}?tab=docs`}
                  className="px-4 py-2 bg-pm-surface border border-pm-border rounded-lg text-sm text-pm-text hover:border-pm-muted transition-colors"
                >
                  Upload Documents
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => {
                  const selected = selectedDocIds.has(doc.id);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => toggleDoc(doc.id)}
                      className={`w-full text-left card flex items-center gap-3 transition-colors ${
                        selected ? "border-pm-accent bg-pm-accent/5" : "hover:border-pm-muted/50"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        selected ? "bg-pm-accent border-pm-accent" : "border-pm-border"
                      }`}>
                        {selected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-pm-text truncate">{doc.title}</div>
                        {doc.category && (
                          <div className="text-xs text-pm-muted">{doc.category}</div>
                        )}
                      </div>
                      <div className="text-xs text-pm-muted shrink-0">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={runScan}
              disabled={selectedDocIds.size === 0}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              Scan {selectedDocIds.size > 0 ? `${selectedDocIds.size} Document${selectedDocIds.size > 1 ? "s" : ""}` : "Selected Documents"}
            </button>
            {selectedDocIds.size > 0 && (
              <button
                onClick={() => setSelectedDocIds(new Set())}
                className="px-4 py-2.5 text-pm-muted hover:text-pm-text text-sm transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step: Scanning */}
      {step === "scanning" && (
        <div className="card text-center py-12">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-pm-text font-medium mb-1">Analyzing Documents</p>
          <p className="text-pm-muted text-sm">
            Scanning document {currentlyScanningIdx + 1} of {selectedDocIds.size}…
          </p>
          <p className="text-pm-muted text-xs mt-2">This may take 15–30 seconds per document</p>
        </div>
      )}

      {/* Step: Results */}
      {step === "results" && (
        <div className="space-y-6">
          {/* Summary banner */}
          <div className="card bg-purple-600/10 border-purple-500/30">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-2xl font-bold text-pm-text">{totalFound}</div>
                <div className="text-xs text-pm-muted">Opportunities Found</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-pm-text">{totalCreated}</div>
                <div className="text-xs text-pm-muted">Saved to Client</div>
              </div>
              <div className="flex-1" />
              <div className="flex gap-2">
                <Link
                  href={`/clients/${org.slug}?tab=opportunities`}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  View All Opportunities
                </Link>
                <button
                  onClick={() => { setStep("select"); setScanResults([]); setSelectedDocIds(new Set()); }}
                  className="px-4 py-2 border border-pm-border text-pm-muted hover:text-pm-text rounded-lg text-sm transition-colors"
                >
                  Scan More
                </button>
              </div>
            </div>
          </div>

          {scanError && (
            <div className="card border-red-500/30 bg-red-500/10 text-red-400 text-sm">
              {scanError}
            </div>
          )}

          {/* Per-document results */}
          {scanResults.map((result) => (
            <div key={result.document_id}>
              <h4 className="font-semibold text-pm-text mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                {result.document_title}
                <span className="text-sm font-normal text-pm-muted">
                  — {result.opportunities_found} opportunit{result.opportunities_found === 1 ? "y" : "ies"} found
                </span>
              </h4>

              {result.opportunities.length === 0 ? (
                <div className="card text-pm-muted text-sm text-center py-4">
                  No automation opportunities identified in this document.
                </div>
              ) : (
                <div className="space-y-3">
                  {result.opportunities
                    .sort((a, b) => b.priority_score - a.priority_score)
                    .map((opp) => (
                      <div key={opp.id} className="card">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-pm-text">{opp.title}</span>
                              <ComplexityBadge complexity={opp.complexity} />
                            </div>
                            {opp.description && (
                              <p className="text-sm text-pm-muted">{opp.description}</p>
                            )}
                            {opp.source && (
                              <p className="text-xs text-pm-muted mt-1 italic">{opp.source}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-bold text-pm-text">{opp.priority_score}</div>
                            <div className="text-xs text-pm-muted">score</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-pm-border/50 text-xs text-pm-muted">
                          {opp.estimated_savings > 0 && (
                            <span>${opp.estimated_savings.toLocaleString()}/yr est. savings</span>
                          )}
                          {opp.estimated_timeline && (
                            <span>{opp.estimated_timeline} to implement</span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComplexityBadge({ complexity }: { complexity: string }) {
  const styles: Record<string, string> = {
    low: "bg-emerald-500/20 text-emerald-400",
    medium: "bg-amber-500/20 text-amber-400",
    high: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[complexity] ?? styles.medium}`}>
      {complexity}
    </span>
  );
}

// ─── Process Discovery Workflow Launcher ────────────────────────────

const VERTICALS = [
  { value: "church", label: "Church / Ministry" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "business", label: "Business" },
  { value: "agency", label: "Agency" },
];

function ProcessDiscoveryLauncher({ org }: { org: Organization }) {
  const [templates, setTemplates] = useState<Array<{ id: string; slug: string; name: string; description: string }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedVertical, setSelectedVertical] = useState("business");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ project_name: string; departments_created: number; intake_forms_created: number } | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/pm/templates")
      .then((r: Response) => r.json())
      .then((data: Array<{ id: string; slug: string; name: string; description: string }>) => {
        if (Array.isArray(data)) {
          setTemplates(data);
          const defaultTpl = data.find((t: { slug: string }) => t.slug === "ministry-discovery") || data[0];
          if (defaultTpl) setSelectedTemplate(defaultTpl.slug);
        }
      })
      .catch(() => {});
  }, []);

  async function handleCreate() {
    if (!selectedTemplate) { setError("Select a project template."); return; }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/pm/process-discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: org.id,
          template_slug: selectedTemplate,
          vertical: selectedVertical,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({
        project_name: data.project_name,
        departments_created: data.departments_created,
        intake_forms_created: data.intake_forms_created,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create workflow");
    } finally {
      setCreating(false);
    }
  }

  if (result) {
    return (
      <div className="card border-emerald-500/30 bg-emerald-500/5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-emerald-400 text-lg">&#10003;</span>
          <h4 className="font-semibold text-pm-text">Process Discovery Workflow Created</h4>
        </div>
        <p className="text-sm text-pm-muted">
          Project: <strong>{result.project_name}</strong><br />
          {result.departments_created} departments created, {result.intake_forms_created} intake forms ready.
        </p>
        <p className="text-sm text-pm-muted mt-2">
          Department intake forms are now available in the client portal. Use the SOP scanner below to pre-fill from existing documents.
        </p>
      </div>
    );
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-pm-text">Start Process Discovery Workflow</h4>
          <p className="text-xs text-pm-muted">Create a structured project with department intake forms, playbook generation, and automation analysis.</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-pm-accent hover:text-pm-accent-hover font-medium"
        >
          {expanded ? "Collapse" : "Set Up"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-pm-border pt-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Vertical / Industry</label>
              <select
                value={selectedVertical}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedVertical(e.target.value)}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
              >
                {VERTICALS.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-muted mb-1">Project Template</label>
              <select
                value={selectedTemplate}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTemplate(e.target.value)}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Select template...</option>
                {templates.map((t) => (
                  <option key={t.slug} value={t.slug}>{t.name}</option>
                ))}
              </select>
              {selectedTemplate && (
                <p className="text-xs text-pm-muted mt-1">
                  {templates.find((t) => t.slug === selectedTemplate)?.description}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !selectedTemplate}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
          >
            {creating ? "Creating Workflow..." : "Create Process Discovery Workflow"}
          </button>
        </div>
      )}
    </div>
  );
}
