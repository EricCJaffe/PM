"use client";

import type { DocumentStatus } from "@/types/pm";

const config: Record<DocumentStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-500/20 text-gray-400" },
  review: { label: "In Review", className: "bg-yellow-500/20 text-yellow-400" },
  approved: { label: "Approved", className: "bg-green-500/20 text-green-400" },
  sent: { label: "Sent", className: "bg-blue-500/20 text-blue-400" },
  signed: { label: "Signed", className: "bg-emerald-500/20 text-emerald-400" },
  archived: { label: "Archived", className: "bg-gray-500/20 text-gray-500" },
};

export function DocStatusBadge({ status }: { status: DocumentStatus }) {
  const c = config[status] ?? config.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}
