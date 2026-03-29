"use client";
import { useState, useEffect } from "react";
import type { Organization, WebPass, WebPassComment, SiteAudit, Pass1FormData } from "@/types/pm";
import { PassStepper } from "./PassStepper";
import { ContentForm } from "./ContentForm";
import { ScoringGate } from "./ScoringGate";
import { BeforeAfterReport } from "./BeforeAfterReport";

const PASS_TYPES = ["discovery", "foundation", "content", "polish", "go-live"] as const;
const PASS_LABELS: Record<string, string> = {
  discovery: "Discovery",
  foundation: "Foundation & Look",
  content: "Content Population",
  polish: "Polish & QA",
  "go-live": "Go-Live",
};

const VERTICALS = ["church", "agency", "nonprofit", "general"];
const TONES = ["professional", "warm", "bold", "minimal"];
const COMMON_PAGES = ["home", "about", "services", "contact", "blog", "team", "gallery", "donate", "give", "sermons", "events"];

export function WebPassTab({
  org,
  audit,
  onBack,
}: {
  org: Organization;
  audit: SiteAudit;
  onBack: () => void;
}) {
  const [passes, setPasses] = useState<WebPass[]>([]);
  const [activePass, setActivePass] = useState<WebPass | null>(null);
  const [comments, setComments] = useState<WebPassComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pass 1 form state
  const [pass1Form, setPass1Form] = useState<Pass1FormData>({
    vertical: (audit.vertical as string) ?? "general",
    business_name: org.name,
    tagline: "",
    brand_colors: { primary: "#2563eb", secondary: "#1e293b", accent: "#f59e0b" },
    logo_url: null,
    pages: ["home", "about", "services", "contact"],
    target_audience: "",
    tone: "professional",
  });

  // Section comment form
  const [commentSection, setCommentSection] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentType, setCommentType] = useState<"approve" | "comment" | "request-change">("comment");
  const [commenterName, setCommenterName] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Load passes
  useEffect(() => {
    setLoading(true);
    fetch(`/api/pm/web-passes?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPasses(data);
          const active = data.find((p: WebPass) => p.status === "active" || p.status === "in-review") ?? data[0];
          setActivePass(active);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [org.id]);

  // Load comments when active pass changes
  useEffect(() => {
    if (!activePass) return;
    fetch(`/api/pm/web-passes/${activePass.id}/comments`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setComments(data); });
  }, [activePass?.id]);

  // Initialize project + all 5 passes
  const initializeProject = async () => {
    setLoading(true);
    setError(null);
    try {
      // Create a web-build project
      const projRes = await fetch("/api/pm/projects/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: org.id,
          template_slug: "website-build",
          name: `${org.name} — Web Project`,
          slug: `${org.slug}-web-${Date.now()}`,
          owner: "",
        }),
      });
      const projData = await projRes.json();
      if (projData.error) throw new Error(projData.error);
      const projectId = projData.project?.id ?? projData.id;
      if (!projectId) throw new Error("Project creation failed");

      // Create all 5 passes
      const passCreations = PASS_TYPES.map((pass_type, i) =>
        fetch("/api/pm/web-passes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            org_id: org.id,
            pass_number: i,
            pass_type,
            site_audit_id: i === 0 ? audit.id : null,
          }),
        }).then((r) => r.json())
      );

      const created = await Promise.all(passCreations);
      const newPasses = created.filter((p) => p && !p.error);
      setPasses(newPasses);
      setActivePass(newPasses[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize project");
    } finally {
      setLoading(false);
    }
  };

  const generateMockup = async () => {
    if (!activePass) return;
    setGenerating(true);
    setError(null);
    try {
      // Save form data first
      await fetch(`/api/pm/web-passes/${activePass.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_data: pass1Form }),
      });

      const res = await fetch(`/api/pm/web-passes/${activePass.id}/generate`, { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setActivePass(data.pass);
      setPasses((prev) => prev.map((p) => (p.id === data.pass.id ? data.pass : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const approvePass = async () => {
    if (!activePass) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/pm/web-passes/${activePass.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: "admin" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Refresh passes
      const refreshed = await fetch(`/api/pm/web-passes?org_id=${org.id}`).then((r) => r.json());
      if (Array.isArray(refreshed)) {
        setPasses(refreshed);
        const next = refreshed.find((p: WebPass) => p.status === "active") ?? refreshed[refreshed.length - 1];
        setActivePass(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  const selectOption = async (option: "a" | "b") => {
    if (!activePass) return;
    const res = await fetch(`/api/pm/web-passes/${activePass.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected_option: option }),
    });
    const data = await res.json();
    if (!data.error) {
      setActivePass(data);
      setPasses((prev) => prev.map((p) => (p.id === data.id ? data : p)));
    }
  };

  const submitComment = async () => {
    if (!activePass || !commentSection) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/pm/web-passes/${activePass.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_id: commentSection,
          section_label: commentSection,
          feedback_type: commentType,
          comment: commentText,
          commenter_name: commenterName || "Team",
        }),
      });
      const data = await res.json();
      if (!data.error) {
        setComments((prev) => [...prev, data]);
        setCommentText("");
        setCommentSection("");
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const copyShareLink = () => {
    if (!activePass?.share_token) return;
    const url = `${window.location.origin}/web-review/${activePass.share_token}`;
    navigator.clipboard.writeText(url);
  };

  if (loading) {
    return (
      <div className="card text-center py-12">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-pm-muted text-sm">Loading web project…</p>
      </div>
    );
  }

  // No project yet — show initializer
  if (passes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="card bg-blue-600/10 border-blue-500/30">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-pm-text mb-1">Site Audit Complete</h4>
              <p className="text-sm text-pm-muted mb-2">
                Overall score: <strong className="text-pm-text">{audit.overall?.grade ?? "—"}</strong>
                {audit.overall?.rebuild_recommended && (
                  <span className="ml-2 text-amber-400">· Rebuild recommended</span>
                )}
              </p>
              <p className="text-sm text-pm-muted">
                Start a Web Project to walk through the 5-pass design and build workflow: Discovery → Foundation → Content → Polish → Go-Live.
              </p>
            </div>
          </div>
        </div>

        {error && <div className="card border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>}

        <button
          onClick={initializeProject}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Start Web Project
        </button>
      </div>
    );
  }

  // Project exists — show pass workflow
  return (
    <div className="space-y-6">
      <PassStepper passes={passes} activePassId={activePass?.id ?? null} onSelectPass={setActivePass} />

      {error && <div className="card border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>}

      {activePass && (
        <div>
          {/* Pass header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-pm-text">
                Pass {activePass.pass_number}: {PASS_LABELS[activePass.pass_type]}
              </h3>
              <p className="text-sm text-pm-muted capitalize">{activePass.status.replace("-", " ")}</p>
            </div>
            <div className="flex gap-2">
              {activePass.share_token && activePass.status === "in-review" && (
                <button
                  onClick={copyShareLink}
                  className="px-3 py-1.5 border border-pm-border text-pm-muted hover:text-pm-text text-sm rounded-lg transition-colors"
                >
                  Copy Client Link
                </button>
              )}
              {(activePass.status === "active" || activePass.status === "in-review") && (
                <button
                  onClick={approvePass}
                  disabled={approving}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
                >
                  {approving ? "Approving…" : "Approve & Advance"}
                </button>
              )}
            </div>
          </div>

          {/* Discovery pass — audit summary */}
          {activePass.pass_type === "discovery" && (
            <div className="card">
              <h4 className="font-semibold text-pm-text mb-3">Audit Results — {audit.url}</h4>
              {audit.scores && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  {Object.entries(audit.scores).map(([dim, score]) => {
                    const s = score as { grade?: string; score?: number };
                    return (
                      <div key={dim} className="bg-pm-bg rounded-lg p-3">
                        <div className="text-xs text-pm-muted capitalize mb-1">{dim.replace(/_/g, " ")}</div>
                        <div className="text-lg font-bold text-pm-text">{s.grade ?? "—"}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {audit.overall?.rebuild_recommended && (
                <div className="text-sm text-amber-400 mt-2">
                  ⚠ Rebuild recommended — {audit.overall.rebuild_reason}
                </div>
              )}
              <p className="text-sm text-pm-muted mt-3">
                Review the full audit findings, then approve this pass to unlock Pass 1: Foundation & Look.
              </p>
            </div>
          )}

          {/* Foundation pass — Pass 1 brand form + mockup */}
          {activePass.pass_type === "foundation" && (
            <div className="space-y-4">
              {!activePass.deliverable_html ? (
                <div className="card space-y-4">
                  <h4 className="font-semibold text-pm-text">Brand & Design Brief</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-pm-muted mb-1">Business Name</label>
                      <input value={pass1Form.business_name} onChange={(e) => setPass1Form((f) => ({ ...f, business_name: e.target.value }))}
                        className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-pm-muted mb-1">Tagline</label>
                      <input value={pass1Form.tagline} onChange={(e) => setPass1Form((f) => ({ ...f, tagline: e.target.value }))}
                        placeholder="One-line description" className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-pm-muted mb-1">Vertical</label>
                      <select value={pass1Form.vertical} onChange={(e) => setPass1Form((f) => ({ ...f, vertical: e.target.value }))}
                        className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500">
                        {VERTICALS.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-pm-muted mb-1">Tone</label>
                      <select value={pass1Form.tone} onChange={(e) => setPass1Form((f) => ({ ...f, tone: e.target.value }))}
                        className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500">
                        {TONES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-pm-muted mb-1">Primary Color</label>
                      <div className="flex gap-2">
                        <input type="color" value={pass1Form.brand_colors.primary}
                          onChange={(e) => setPass1Form((f) => ({ ...f, brand_colors: { ...f.brand_colors, primary: e.target.value } }))}
                          className="w-12 h-9 rounded border border-pm-border bg-pm-bg cursor-pointer" />
                        <input value={pass1Form.brand_colors.primary}
                          onChange={(e) => setPass1Form((f) => ({ ...f, brand_colors: { ...f.brand_colors, primary: e.target.value } }))}
                          className="flex-1 bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-pm-muted mb-1">Target Audience</label>
                      <input value={pass1Form.target_audience} onChange={(e) => setPass1Form((f) => ({ ...f, target_audience: e.target.value }))}
                        placeholder="e.g. Young families in the community" className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-pm-muted mb-2">Pages to Include</label>
                      <div className="flex flex-wrap gap-2">
                        {COMMON_PAGES.map((page) => {
                          const selected = pass1Form.pages.includes(page);
                          return (
                            <button key={page} type="button"
                              onClick={() => setPass1Form((f) => ({
                                ...f,
                                pages: selected ? f.pages.filter((p) => p !== page) : [...f.pages, page],
                              }))}
                              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                                selected ? "bg-blue-600 border-blue-600 text-white" : "border-pm-border text-pm-muted hover:border-pm-muted"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <button onClick={generateMockup} disabled={generating}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-sm">
                    {generating ? "Generating Mockups…" : "Generate Mockup Options"}
                  </button>
                </div>
              ) : (
                // Mockup options view
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-pm-text">Mockup Options</h4>
                    {activePass.selected_option && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                        Option {activePass.selected_option.toUpperCase()} selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: "a" as const, html: activePass.deliverable_html, label: "Option A — Clean & Minimal" },
                      { key: "b" as const, html: activePass.deliverable_html_b, label: "Option B — Bold & Expressive" },
                    ].map(({ key, html, label }) => html ? (
                      <div key={key} className={`card space-y-3 ${activePass.selected_option === key ? "border-emerald-500/50 bg-emerald-500/5" : ""}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-pm-text">{label}</span>
                          <button onClick={() => selectOption(key)}
                            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                              activePass.selected_option === key
                                ? "bg-emerald-600 text-white"
                                : "border border-pm-border text-pm-muted hover:text-pm-text"
                            }`}>
                            {activePass.selected_option === key ? "Selected" : "Select This"}
                          </button>
                        </div>
                        <div className="w-full h-64 border border-pm-border rounded-lg overflow-hidden">
                          <iframe srcDoc={html} className="w-full h-full border-0 pointer-events-none" style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%", height: "200%" }} />
                        </div>
                      </div>
                    ) : null)}
                  </div>
                  <button onClick={generateMockup} disabled={generating}
                    className="px-4 py-2 border border-pm-border text-pm-muted hover:text-pm-text text-sm rounded-lg transition-colors">
                    {generating ? "Regenerating…" : "Regenerate Options"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Content pass — content form + preview */}
          {activePass.pass_type === "content" && (
            <div className="space-y-6">
              <ContentForm
                pass={activePass}
                onSaved={(updated) => {
                  setActivePass(updated);
                  setPasses((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                }}
              />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-pm-text">Preview</h4>
                  <button onClick={generateMockup} disabled={generating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
                    {generating ? "Generating…" : "Generate from Content"}
                  </button>
                </div>
                {activePass.deliverable_html ? (
                  <div className="w-full h-96 border border-pm-border rounded-lg overflow-hidden">
                    <iframe srcDoc={activePass.deliverable_html} className="w-full h-full border-0" />
                  </div>
                ) : (
                  <div className="card text-center py-12 text-pm-muted text-sm">
                    Save your content above, then click Generate to render the preview.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Polish pass — show deliverable + comment panel */}
          {activePass.pass_type === "polish" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-pm-text">Preview</h4>
                  <button onClick={generateMockup} disabled={generating}
                    className="px-3 py-1 border border-pm-border text-pm-muted hover:text-pm-text text-xs rounded-lg transition-colors">
                    {generating ? "Generating…" : "Apply Feedback & Polish"}
                  </button>
                </div>
                {activePass.deliverable_html ? (
                  <div className="w-full h-96 border border-pm-border rounded-lg overflow-hidden">
                    <iframe srcDoc={activePass.deliverable_html} className="w-full h-full border-0" />
                  </div>
                ) : (
                  <div className="card text-center py-12 text-pm-muted text-sm">
                    No preview yet. Click Generate to apply feedback.
                  </div>
                )}
              </div>

              {/* Scoring gate + Comments panel */}
              <div className="space-y-4">
                <ScoringGate
                  pass={activePass}
                  onScored={(updated) => {
                    setActivePass(updated);
                    setPasses((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                  }}
                  onApprove={async () => {
                    await fetch(`/api/pm/web-passes/${activePass.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
                    const updated = await fetch(`/api/pm/web-passes?project_id=${passes[0]?.project_id}`).then(r => r.json());
                    if (Array.isArray(updated)) setPasses(updated);
                  }}
                />
                <h4 className="font-semibold text-pm-text">Section Feedback</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-pm-muted text-xs">No feedback yet.</p>
                  ) : comments.map((c) => (
                    <div key={c.id} className={`card text-xs space-y-1 ${c.is_resolved ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-2">
                        <FeedbackTypeBadge type={c.feedback_type} />
                        <span className="text-pm-muted">{c.section_label ?? c.section_id}</span>
                      </div>
                      {c.comment && <p className="text-pm-text">{c.comment}</p>}
                      <p className="text-pm-muted">{c.commenter_name ?? "Anonymous"}</p>
                    </div>
                  ))}
                </div>

                {/* Add comment form */}
                <div className="card space-y-2">
                  <input value={commentSection} onChange={(e) => setCommentSection(e.target.value)}
                    placeholder="Section name (e.g. hero, about)" className="w-full bg-pm-bg border border-pm-border rounded px-2 py-1.5 text-pm-text text-xs focus:outline-none focus:border-blue-500" />
                  <select value={commentType} onChange={(e) => setCommentType(e.target.value as typeof commentType)}
                    className="w-full bg-pm-bg border border-pm-border rounded px-2 py-1.5 text-pm-text text-xs focus:outline-none focus:border-blue-500">
                    <option value="comment">Comment</option>
                    <option value="request-change">Request Change</option>
                    <option value="approve">Approve Section</option>
                  </select>
                  <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Feedback…" rows={2} className="w-full bg-pm-bg border border-pm-border rounded px-2 py-1.5 text-pm-text text-xs focus:outline-none focus:border-blue-500 resize-none" />
                  <input value={commenterName} onChange={(e) => setCommenterName(e.target.value)}
                    placeholder="Your name" className="w-full bg-pm-bg border border-pm-border rounded px-2 py-1.5 text-pm-text text-xs focus:outline-none focus:border-blue-500" />
                  <button onClick={submitComment} disabled={submittingComment || !commentSection}
                    className="w-full px-3 py-1.5 bg-pm-accent hover:opacity-90 disabled:opacity-50 text-white text-xs rounded font-medium transition-colors">
                    {submittingComment ? "Posting…" : "Add Feedback"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Go-Live pass */}
          {activePass.pass_type === "go-live" && (
            <GoLivePanel
              pass={activePass}
              orgId={org.id}
              onCompleted={(updated) => {
                setActivePass(updated);
                setPasses((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function GoLivePanel({
  pass,
  orgId,
  onCompleted,
}: {
  pass: WebPass;
  orgId: string;
  onCompleted: (updated: WebPass) => void;
}) {
  const [finalAuditId, setFinalAuditId] = useState("");
  const [deployedUrl, setDeployedUrl] = useState(pass.notes ?? "");
  const [deploying, setDeploying] = useState(false);
  const [audits, setAudits] = useState<{ id: string; url: string; created_at: string }[]>([]);

  // Load org audits for final audit picker
  useEffect(() => {
    fetch(`/api/pm/site-audit?org_id=${orgId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAudits(data); });
  }, [orgId]);

  const scoringResults = pass.scoring_results as Record<string, unknown> | null;
  const beforeAfter = scoringResults?.before_after as Parameters<typeof BeforeAfterReport>[0]["data"] | null;
  const isComplete = pass.status === "approved";

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const res = await fetch(`/api/pm/web-passes/${pass.id}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          final_audit_id: finalAuditId || null,
          deployed_url: deployedUrl || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onCompleted(data.pass);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Checklist */}
      <div className="card space-y-4">
        <h4 className="font-semibold text-pm-text">Go-Live Checklist</h4>
        <ul className="space-y-3">
          {[
            { label: "All passes approved", done: true },
            { label: "Scoring gate passed", done: !!(scoringResults && (scoringResults as { overall_pass?: boolean }).overall_pass) },
            { label: "Domain DNS configured", done: false },
            { label: "Site deployed to production", done: !!deployedUrl },
            { label: "Analytics tracking verified", done: false },
            { label: "Contact forms tested", done: false },
          ].map(({ label, done }) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                done ? "bg-emerald-600/20 border-emerald-500 text-emerald-400" : "border-pm-border"
              }`}>
                {done && <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
              </span>
              <span className={done ? "text-pm-text" : "text-pm-muted"}>{label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Deploy form */}
      {!isComplete && (
        <div className="card space-y-4">
          <h4 className="font-semibold text-pm-text">Mark as Launched</h4>
          <div>
            <label className="block text-xs font-medium text-pm-muted mb-1">Deployed URL</label>
            <input
              value={deployedUrl}
              onChange={(e) => setDeployedUrl(e.target.value)}
              placeholder="https://clientsite.com"
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-pm-muted mb-1">
              Final Site Audit (optional — select a post-launch audit for before/after report)
            </label>
            <select
              value={finalAuditId}
              onChange={(e) => setFinalAuditId(e.target.value)}
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">— skip before/after report —</option>
              {audits.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.url} ({new Date(a.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
            <p className="text-xs text-pm-muted mt-1">
              Run a new Site Audit on the live URL first, then select it here.
            </p>
          </div>
          <button
            onClick={handleDeploy}
            disabled={deploying || !deployedUrl}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
          >
            {deploying ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Completing project…
              </span>
            ) : "Mark as Launched & Complete Project"}
          </button>
        </div>
      )}

      {isComplete && (
        <div className="card border-emerald-500/30 bg-emerald-600/10 text-center py-6 space-y-2">
          <div className="text-2xl">🚀</div>
          <p className="font-semibold text-emerald-400">Project Complete — Site is Live!</p>
          {deployedUrl && (
            <a href={deployedUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm text-pm-accent hover:underline">{deployedUrl}</a>
          )}
        </div>
      )}

      {/* Before/After Report */}
      {beforeAfter && <BeforeAfterReport data={beforeAfter} />}
    </div>
  );
}

function FeedbackTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    approve: "bg-emerald-500/20 text-emerald-400",
    comment: "bg-blue-500/20 text-blue-400",
    "request-change": "bg-amber-500/20 text-amber-400",
  };
  const labels: Record<string, string> = {
    approve: "Approved",
    comment: "Comment",
    "request-change": "Change",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${styles[type] ?? styles.comment}`}>
      {labels[type] ?? type}
    </span>
  );
}
