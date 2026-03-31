"use client";

import Link from "next/link";

interface PortalDashboardProps {
  orgSlug: string;
  orgName: string;
  workflows: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  showWorkflow: boolean;
  showDocuments: boolean;
  showTasks: boolean;
  welcomeMessage: string;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-blue-500/20 text-blue-400",
    complete: "bg-emerald-500/20 text-emerald-400",
    paused: "bg-amber-500/20 text-amber-400",
    sent: "bg-blue-500/20 text-blue-400",
    signed: "bg-emerald-500/20 text-emerald-400",
    approved: "bg-purple-500/20 text-purple-400",
    "not-started": "bg-gray-500/20 text-gray-400",
    "in-progress": "bg-blue-500/20 text-blue-400",
    blocked: "bg-red-500/20 text-red-400",
    pending: "bg-amber-500/20 text-amber-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || "bg-gray-500/20 text-gray-400"}`}>
      {status.replace("-", " ")}
    </span>
  );
}

export function PortalDashboard({
  orgSlug,
  workflows,
  documents,
  tasks,
  showWorkflow,
  showDocuments,
  showTasks,
  welcomeMessage,
}: PortalDashboardProps) {
  const base = `/portal/${orgSlug}`;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <p className="text-pm-muted text-sm">{welcomeMessage}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Workflow Card */}
        {showWorkflow && (
          <div className="bg-pm-card border border-pm-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-pm-text uppercase tracking-wider">Workflow</h2>
              <Link href={`${base}/workflow`} className="text-xs text-blue-400 hover:text-blue-300">
                View all
              </Link>
            </div>
            {workflows.length === 0 ? (
              <p className="text-sm text-pm-muted">No active workflows.</p>
            ) : (
              <div className="space-y-3">
                {workflows.map((w) => (
                  <div key={w.id as string} className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-pm-text capitalize">
                        {(w.workflow_type as string).replace("-", " ")}
                      </span>
                      {w.current_score != null && (
                        <span className="text-xs text-pm-muted ml-2">
                          Score: {w.current_score as number}
                          {(w.target_scores as Record<string, number>)?.overall && (
                            <> / {(w.target_scores as Record<string, number>).overall}</>
                          )}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={w.status as string} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Documents Card */}
        {showDocuments && (
          <div className="bg-pm-card border border-pm-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-pm-text uppercase tracking-wider">Documents</h2>
              <Link href={`${base}/documents`} className="text-xs text-blue-400 hover:text-blue-300">
                View all
              </Link>
            </div>
            {documents.length === 0 ? (
              <p className="text-sm text-pm-muted">No documents shared yet.</p>
            ) : (
              <div className="space-y-3">
                {documents.map((d) => {
                  const dt = d.document_types as { name: string } | null;
                  return (
                    <div key={d.id as string} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-pm-text">{d.title as string}</p>
                        {dt?.name && (
                          <p className="text-xs text-pm-muted">{dt.name}</p>
                        )}
                      </div>
                      <StatusBadge status={(d.esign_status as string) || (d.status as string)} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tasks Card */}
        {showTasks && (
          <div className="bg-pm-card border border-pm-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-pm-text uppercase tracking-wider">Tasks</h2>
              <Link href={`${base}/tasks`} className="text-xs text-blue-400 hover:text-blue-300">
                View all
              </Link>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-pm-muted">No open tasks.</p>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 5).map((t) => {
                  const task = t as { id: string; name: string; status: string; due_date: string | null };
                  return (
                  <div key={task.id} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-sm text-pm-text truncate">{task.name}</p>
                      {task.due_date && (
                        <p className="text-xs text-pm-muted">Due: {task.due_date}</p>
                      )}
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                  );
                })}
                {tasks.length > 5 && (
                  <p className="text-xs text-pm-muted">+{tasks.length - 5} more</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
