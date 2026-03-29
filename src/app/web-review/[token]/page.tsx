"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { WebPass, WebPassComment, WebPassFeedbackType } from "@/types/pm";

interface PassData {
  pass: WebPass;
  org: { name: string; slug: string } | null;
  comments: WebPassComment[];
}

const PASS_LABELS: Record<string, string> = {
  discovery: "Discovery",
  foundation: "Foundation & Look",
  content: "Content",
  polish: "Polish & QA",
  "go-live": "Go-Live",
};

const FEEDBACK_TYPES: { value: WebPassFeedbackType; label: string; color: string }[] = [
  { value: "approve", label: "Looks great!", color: "bg-emerald-600 hover:bg-emerald-700" },
  { value: "request-change", label: "Request change", color: "bg-amber-600 hover:bg-amber-700" },
  { value: "comment", label: "Comment", color: "bg-blue-600 hover:bg-blue-700" },
];

function SectionCommentForm({
  sectionId,
  sectionLabel,
  token,
  onSubmitted,
}: {
  sectionId: string;
  sectionLabel: string;
  token: string;
  onSubmitted: (comment: WebPassComment) => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<WebPassFeedbackType>("comment");
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pm/web-passes/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_id: sectionId,
          section_label: sectionLabel,
          feedback_type: type,
          comment,
          commenter_name: name || null,
          commenter_email: email || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onSubmitted(data);
      setOpen(false);
      setComment("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-pm-accent hover:underline"
      >
        + Add feedback on this section
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-3 bg-pm-card border border-pm-border rounded-lg space-y-3">
      <div className="flex gap-2">
        {FEEDBACK_TYPES.map((ft) => (
          <button
            key={ft.value}
            type="button"
            onClick={() => setType(ft.value)}
            className={`px-3 py-1 rounded text-xs font-medium text-white transition-colors ${
              type === ft.value ? ft.color : "bg-pm-border text-pm-muted"
            }`}
          >
            {ft.label}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Describe your feedback..."
        rows={3}
        className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text placeholder-pm-muted focus:outline-none focus:border-pm-accent resize-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text placeholder-pm-muted focus:outline-none focus:border-pm-accent"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          type="email"
          className="bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text placeholder-pm-muted focus:outline-none focus:border-pm-accent"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-pm-accent hover:bg-pm-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {submitting ? "Submitting..." : "Submit Feedback"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 text-sm text-pm-muted hover:text-pm-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function CommentBadge({ type }: { type: WebPassFeedbackType }) {
  const colors: Record<WebPassFeedbackType, string> = {
    approve: "bg-emerald-600/20 text-emerald-400",
    "request-change": "bg-amber-600/20 text-amber-400",
    comment: "bg-blue-600/20 text-blue-400",
  };
  const labels: Record<WebPassFeedbackType, string> = {
    approve: "Approved",
    "request-change": "Change Requested",
    comment: "Comment",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[type]}`}>
      {labels[type]}
    </span>
  );
}

export default function WebReviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<PassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | null>(null);
  const [selectingOption, setSelectingOption] = useState(false);
  const [optionSubmitted, setOptionSubmitted] = useState(false);
  const [comments, setComments] = useState<WebPassComment[]>([]);

  useEffect(() => {
    fetch(`/api/pm/web-passes/share/${token}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setData(d);
        setComments(d.comments ?? []);
        if (d.pass.selected_option) {
          setSelectedOption(d.pass.selected_option as "A" | "B");
          setOptionSubmitted(true);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSelectOption = async (option: "A" | "B") => {
    setSelectingOption(true);
    try {
      const res = await fetch(`/api/pm/web-passes/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_option: option }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setSelectedOption(option);
      setOptionSubmitted(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit selection");
    } finally {
      setSelectingOption(false);
    }
  };

  const handleCommentAdded = (comment: WebPassComment) => {
    setComments((prev) => [...prev, comment]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-pm-bg flex items-center justify-center">
        <div className="text-pm-muted animate-pulse">Loading review...</div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-pm-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-pm-text font-semibold mb-2">Review link not found</p>
          <p className="text-sm text-pm-muted">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const { pass, org } = data;
  const passLabel = PASS_LABELS[pass.pass_type] ?? pass.pass_type;
  const isFoundation = pass.pass_type === "foundation";
  const hasHtml = !!pass.deliverable_html;
  const hasTwoOptions = isFoundation && !!pass.deliverable_html_b;

  // Group comments by section
  const commentsBySection = comments.reduce<Record<string, WebPassComment[]>>((acc, c) => {
    if (!acc[c.section_id]) acc[c.section_id] = [];
    acc[c.section_id].push(c);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-pm-bg">
      {/* Header */}
      <div className="border-b border-pm-border bg-pm-card/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-pm-muted font-medium">
              {org?.name ?? "Web Project"} &mdash; Review Request
            </p>
            <h1 className="text-lg font-semibold text-pm-text">
              Pass {pass.pass_number + 1}: {passLabel}
            </h1>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            pass.status === "in-review" ? "bg-amber-500/20 text-amber-400" :
            pass.status === "approved" ? "bg-emerald-500/20 text-emerald-400" :
            "bg-blue-500/20 text-blue-400"
          }`}>
            {pass.status === "in-review" ? "Awaiting your review" :
             pass.status === "approved" ? "Approved" : pass.status}
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Foundation: Two-option mockup selector */}
        {isFoundation && hasTwoOptions && (
          <div className="space-y-6">
            {optionSubmitted && selectedOption ? (
              <div className="card border-emerald-500/30 text-center py-4">
                <p className="text-emerald-400 font-medium">
                  You selected Option {selectedOption} — thank you!
                </p>
                <p className="text-sm text-pm-muted mt-1">
                  Your selection has been recorded. The team will proceed with your choice.
                </p>
              </div>
            ) : (
              <div className="card">
                <h2 className="font-semibold text-pm-text mb-1">Choose Your Direction</h2>
                <p className="text-sm text-pm-muted mb-6">
                  Review both mockup options below and click <strong>Select</strong> on the one you prefer.
                  You can still leave feedback on either option.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Option A */}
              <div className={`space-y-3 ${optionSubmitted && selectedOption === "B" ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-pm-text">Option A — Clean &amp; Minimal</h3>
                  {!optionSubmitted && (
                    <button
                      onClick={() => handleSelectOption("A")}
                      disabled={selectingOption}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {selectingOption ? "Saving..." : "Select Option A"}
                    </button>
                  )}
                  {optionSubmitted && selectedOption === "A" && (
                    <span className="px-3 py-1 bg-emerald-600/20 text-emerald-400 text-sm rounded-lg font-medium">
                      Selected
                    </span>
                  )}
                </div>
                <div className="rounded-xl overflow-hidden border border-pm-border bg-white">
                  <iframe
                    srcDoc={pass.deliverable_html ?? undefined}
                    className="w-full h-[600px]"
                    sandbox="allow-same-origin"
                    title="Option A"
                  />
                </div>
                <SectionCommentForm
                  sectionId="option-a"
                  sectionLabel="Option A"
                  token={token}
                  onSubmitted={handleCommentAdded}
                />
              </div>

              {/* Option B */}
              <div className={`space-y-3 ${optionSubmitted && selectedOption === "A" ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-pm-text">Option B — Bold &amp; Expressive</h3>
                  {!optionSubmitted && (
                    <button
                      onClick={() => handleSelectOption("B")}
                      disabled={selectingOption}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {selectingOption ? "Saving..." : "Select Option B"}
                    </button>
                  )}
                  {optionSubmitted && selectedOption === "B" && (
                    <span className="px-3 py-1 bg-emerald-600/20 text-emerald-400 text-sm rounded-lg font-medium">
                      Selected
                    </span>
                  )}
                </div>
                <div className="rounded-xl overflow-hidden border border-pm-border bg-white">
                  <iframe
                    srcDoc={pass.deliverable_html_b ?? undefined}
                    className="w-full h-[600px]"
                    sandbox="allow-same-origin"
                    title="Option B"
                  />
                </div>
                <SectionCommentForm
                  sectionId="option-b"
                  sectionLabel="Option B"
                  token={token}
                  onSubmitted={handleCommentAdded}
                />
              </div>
            </div>
          </div>
        )}

        {/* Single mockup preview (content, polish) */}
        {!isFoundation && hasHtml && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-pm-text">Your Website Preview</h2>
              <p className="text-sm text-pm-muted">Leave feedback on specific sections below</p>
            </div>
            <div className="rounded-xl overflow-hidden border border-pm-border bg-white">
              <iframe
                srcDoc={pass.deliverable_html ?? undefined}
                className="w-full h-[700px]"
                sandbox="allow-same-origin"
                title="Website Preview"
              />
            </div>
          </div>
        )}

        {/* Section Feedback Panel */}
        {hasHtml && !isFoundation && (
          <div className="card">
            <h2 className="font-semibold text-pm-text mb-1">Section Feedback</h2>
            <p className="text-sm text-pm-muted mb-6">
              Leave feedback on specific sections of the design. Select a section and describe what you&apos;d like changed.
            </p>

            {/* Common sections */}
            {["header", "hero", "about", "services", "contact", "footer"].map((section) => {
              const sectionComments = commentsBySection[section] ?? [];
              return (
                <div key={section} className="mb-6 pb-6 border-b border-pm-border/50 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-pm-text capitalize">{section}</h3>
                    {sectionComments.length > 0 && (
                      <span className="text-xs text-pm-muted">{sectionComments.length} comment{sectionComments.length > 1 ? "s" : ""}</span>
                    )}
                  </div>
                  {sectionComments.map((c) => (
                    <div key={c.id} className="mb-2 p-3 bg-pm-bg rounded-lg border border-pm-border">
                      <div className="flex items-center gap-2 mb-1">
                        <CommentBadge type={c.feedback_type} />
                        {c.commenter_name && (
                          <span className="text-xs text-pm-muted">{c.commenter_name}</span>
                        )}
                        <span className="text-xs text-pm-muted ml-auto">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {c.comment && <p className="text-sm text-pm-text">{c.comment}</p>}
                    </div>
                  ))}
                  <SectionCommentForm
                    sectionId={section}
                    sectionLabel={section.charAt(0).toUpperCase() + section.slice(1)}
                    token={token}
                    onSubmitted={handleCommentAdded}
                  />
                </div>
              );
            })}

            {/* Custom section */}
            <div>
              <h3 className="text-sm font-medium text-pm-text mb-2">Other / General</h3>
              {(commentsBySection["general"] ?? []).map((c) => (
                <div key={c.id} className="mb-2 p-3 bg-pm-bg rounded-lg border border-pm-border">
                  <div className="flex items-center gap-2 mb-1">
                    <CommentBadge type={c.feedback_type} />
                    {c.commenter_name && <span className="text-xs text-pm-muted">{c.commenter_name}</span>}
                    <span className="text-xs text-pm-muted ml-auto">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  {c.comment && <p className="text-sm text-pm-text">{c.comment}</p>}
                </div>
              ))}
              <SectionCommentForm
                sectionId="general"
                sectionLabel="General"
                token={token}
                onSubmitted={handleCommentAdded}
              />
            </div>
          </div>
        )}

        {/* Go-Live pass */}
        {pass.pass_type === "go-live" && (
          <div className="card">
            <h2 className="font-semibold text-pm-text mb-4">Go-Live Checklist</h2>
            <div className="space-y-3 text-sm text-pm-muted">
              {[
                "Final content approved",
                "Domain DNS configured",
                "SSL certificate active",
                "Analytics tracking verified",
                "Contact forms tested",
                "Mobile responsiveness confirmed",
                "Site speed optimized",
                "Launch approved by client",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded border border-pm-border shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-pm-border">
              <SectionCommentForm
                sectionId="go-live"
                sectionLabel="Go-Live"
                token={token}
                onSubmitted={handleCommentAdded}
              />
            </div>
          </div>
        )}

        {/* Discovery pass */}
        {pass.pass_type === "discovery" && (
          <div className="card">
            <h2 className="font-semibold text-pm-text mb-2">Discovery Phase</h2>
            <p className="text-sm text-pm-muted mb-4">
              We&apos;ve analyzed your current website. Our team is reviewing the findings and will reach out to discuss next steps.
            </p>
            {pass.form_data && (
              <div className="space-y-2">
                {Object.entries(pass.form_data as Record<string, unknown>).map(([k, v]) => (
                  <div key={k} className="flex gap-3 text-sm">
                    <span className="text-pm-muted capitalize w-32 shrink-0">{k.replace(/_/g, " ")}</span>
                    <span className="text-pm-text">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 pt-4 border-t border-pm-border">
              <SectionCommentForm
                sectionId="discovery"
                sectionLabel="Discovery"
                token={token}
                onSubmitted={handleCommentAdded}
              />
            </div>
          </div>
        )}

        {/* All comments summary (for foundation pass, show inline per section above; here show global summary) */}
        {comments.length > 0 && !isFoundation && (
          <div className="card">
            <h3 className="font-semibold text-pm-text mb-3">All Your Feedback ({comments.length})</h3>
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-3 py-2 border-b border-pm-border/50 last:border-0">
                  <CommentBadge type={c.feedback_type} />
                  <div className="flex-1 min-w-0">
                    {c.section_label && <span className="text-xs text-pm-muted capitalize">{c.section_label} &mdash; </span>}
                    <span className="text-sm text-pm-text">{c.comment}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-pm-border text-center text-xs text-pm-muted">
          Powered by BusinessOS
        </div>
      </div>
    </div>
  );
}
