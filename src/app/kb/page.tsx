"use client";

import { KBTab } from "@/components/dashboard/KBTab";

export default function GlobalKBPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-pm-text">Knowledge Base</h1>
        <p className="text-sm text-pm-muted mt-1">
          Company-wide knowledge that informs all AI interactions. For client-specific knowledge, use the KB tab on each client&apos;s dashboard.
        </p>
      </div>
      <KBTab scope="global" />
    </div>
  );
}
