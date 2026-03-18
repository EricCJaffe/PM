"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface ProposalView {
  id: string;
  title: string;
  status: string;
  generated_content: string | null;
  org_name: string;
  sent_at: string | null;
}

export default function ProposalPublicView() {
  const params = useParams();
  const token = params.token as string;
  const [proposal, setProposal] = useState<ProposalView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    fetch(`/api/pm/proposals/share/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setProposal(data);
      })
      .catch(() => setError("Failed to load proposal"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleRespond = async (action: "accepted" | "rejected") => {
    setResponding(true);
    try {
      const res = await fetch(`/api/pm/proposals/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProposal((p) => p ? { ...p, status: action } : p);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to respond");
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-pm-bg flex items-center justify-center">
        <p className="text-pm-muted">Loading proposal...</p>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-pm-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-pm-text mb-2">Proposal Not Found</h1>
          <p className="text-pm-muted">{error || "This proposal link may be invalid or expired."}</p>
        </div>
      </div>
    );
  }

  const hasResponded = ["accepted", "rejected"].includes(proposal.status);

  return (
    <div className="min-h-screen bg-pm-bg">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm text-pm-muted mb-1">Proposal from {proposal.org_name}</p>
          <h1 className="text-2xl font-bold text-pm-text">{proposal.title}</h1>
          {proposal.sent_at && (
            <p className="text-sm text-pm-muted mt-1">
              Sent on {new Date(proposal.sent_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Content */}
        {proposal.generated_content ? (
          <div className="card mb-8">
            <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap text-pm-text">
              {proposal.generated_content}
            </div>
          </div>
        ) : (
          <div className="card mb-8 text-center py-12">
            <p className="text-pm-muted">This proposal is still being prepared.</p>
          </div>
        )}

        {/* Response Buttons */}
        {hasResponded ? (
          <div className={`card text-center py-6 ${
            proposal.status === "accepted"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-red-500/30 bg-red-500/5"
          }`}>
            <p className={`font-medium ${
              proposal.status === "accepted" ? "text-emerald-400" : "text-red-400"
            }`}>
              You have {proposal.status === "accepted" ? "accepted" : "declined"} this proposal.
            </p>
          </div>
        ) : proposal.generated_content ? (
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => handleRespond("accepted")}
              disabled={responding}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {responding ? "..." : "Accept Proposal"}
            </button>
            <button
              onClick={() => handleRespond("rejected")}
              disabled={responding}
              className="px-6 py-3 border border-red-600/30 text-red-400 hover:bg-red-600/10 rounded-lg font-medium transition-colors"
            >
              {responding ? "..." : "Decline"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
