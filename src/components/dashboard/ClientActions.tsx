"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ClientActionsProps {
  clientId: string;
  clientSlug: string;
}

export function ClientActions({ clientId, clientSlug }: ClientActionsProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/pm/organizations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: clientId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      router.push("/clients");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete client");
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <Link
        href={`/clients?edit=${clientSlug}`}
        className="px-3 py-2 border border-pm-border text-pm-text hover:bg-pm-card rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </Link>
      {confirming ? (
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {deleting ? "Deleting..." : "Confirm Delete"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="px-3 py-2 text-pm-muted hover:text-pm-text rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="px-3 py-2 border border-red-600/30 text-red-400 hover:bg-red-600/10 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      )}
    </>
  );
}
