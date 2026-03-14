"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Organization } from "@/types/pm";

export function ShareButton({ org }: { org: Organization }) {
  const router = useRouter();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createShareLink() {
    setCreating(true);
    const res = await fetch("/api/pm/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: org.id, label: `${org.name} share link` }),
    });
    const data = await res.json();
    const url = `${window.location.origin}/share/${data.token}`;
    setShareUrl(url);
    setCreating(false);
    router.refresh();
  }

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      {shareUrl ? (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="bg-pm-bg border border-pm-border rounded-lg px-3 py-1.5 text-sm text-pm-text w-64"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button onClick={copyLink} className="px-3 py-1.5 bg-pm-accent hover:bg-pm-accent-hover text-white text-sm rounded-lg font-medium">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      ) : (
        <button
          onClick={createShareLink}
          disabled={creating}
          className="px-3 py-1.5 bg-pm-accent hover:bg-pm-accent-hover disabled:opacity-50 text-white text-sm rounded-lg font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          {creating ? "Creating…" : "Share with Client"}
        </button>
      )}
    </div>
  );
}
