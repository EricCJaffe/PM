import type { PMStatus, ProjectStatus } from "@/types/pm";

const statusConfig: Record<string, { label: string; className: string }> = {
  "not-started": { label: "Not Started", className: "status-not-started" },
  "in-progress": { label: "In Progress", className: "status-in-progress" },
  complete: { label: "Complete", className: "status-complete" },
  blocked: { label: "Blocked", className: "status-blocked" },
  pending: { label: "Pending", className: "status-pending" },
  "on-hold": { label: "On Hold", className: "status-on-hold" },
  active: { label: "Active", className: "status-in-progress" },
  paused: { label: "Paused", className: "status-on-hold" },
  archived: { label: "Archived", className: "status-not-started" },
};

export function StatusBadge({ status }: { status: PMStatus | ProjectStatus }) {
  const config = statusConfig[status] ?? { label: status, className: "status-not-started" };
  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
}
