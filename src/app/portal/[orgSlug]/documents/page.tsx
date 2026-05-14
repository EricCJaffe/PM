import { createServiceClient } from "@/lib/supabase/server";
import { getUserSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PortalDocumentsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getUserSession();
  if (!session) redirect(`/portal/auth?org=${orgSlug}`);

  const supabase = createServiceClient();

  const { data: org } = await supabase
    .from("pm_organizations")
    .select("id, name")
    .eq("slug", orgSlug)
    .single();

  if (!org) redirect("/portal/auth");

  // Fetch signed/sent formal documents (SOWs, NDAs, MSAs)
  const { data: documents } = await supabase
    .from("generated_documents")
    .select("id, title, status, esign_status, esign_sent_at, esign_completed_at, sent_at, signed_at, created_at, document_types(name)")
    .eq("org_id", org.id)
    .in("status", ["sent", "signed", "approved"])
    .order("created_at", { ascending: false });

  // Fetch project file uploads for this org's projects
  const { data: orgProjects } = await supabase
    .from("pm_projects")
    .select("id, name")
    .eq("org_id", org.id)
    .eq("is_personal", false);

  const projectIds = (orgProjects || []).map((p: { id: string }) => p.id);
  let projectFiles: Array<Record<string, unknown>> = [];
  if (projectIds.length > 0) {
    const { data: files } = await supabase
      .from("pm_project_documents")
      .select("id, file_name, file_size, content_type, created_at, project_id")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .limit(30);
    const projNameMap: Record<string, string> = {};
    for (const p of orgProjects || [] as Array<{ id: string; name: string }>) projNameMap[p.id] = p.name;
    projectFiles = (files || []).map((f: Record<string, unknown>) => ({ ...f, project_name: projNameMap[f.project_id as string] ?? "Project" }));
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-pm-text">Docs &amp; SOPs</h2>

      {(!documents || documents.length === 0) ? (
        <div className="bg-pm-card border border-pm-border rounded-lg p-8 text-center">
          <p className="text-pm-muted text-sm">No documents shared yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc: { id: string; title: string; status: string; esign_status: string | null; esign_sent_at: string | null; esign_completed_at: string | null; sent_at: string | null; signed_at: string | null; created_at: string; document_types: { name: string } | null }) => {
            const dt = doc.document_types as { name: string } | null;
            const esign = doc.esign_status;

            return (
              <div key={doc.id} className="bg-pm-card border border-pm-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-pm-text">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {dt?.name && (
                      <span className="text-xs text-pm-muted">{dt.name}</span>
                    )}
                    <span className="text-xs text-pm-muted">&middot;</span>
                    <span className="text-xs text-pm-muted">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {esign === "waiting" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                      Awaiting signature
                    </span>
                  )}
                  {esign === "signed" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                      Signed
                    </span>
                  )}
                  {!esign && doc.status === "sent" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
                      Sent
                    </span>
                  )}
                  {!esign && doc.status === "approved" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                      Approved
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project file uploads */}
      {projectFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-pm-text mb-3">Project Files</h3>
          <div className="space-y-2">
            {(projectFiles as Array<{
              id: string; file_name: string; file_size: number | null;
              content_type: string | null; created_at: string; project_name: string; project_id: string;
            }>).map((file) => {
              const sizeKB = file.file_size ? Math.round(file.file_size / 1024) : null;
              return (
                <div key={file.id} className="bg-pm-card border border-pm-border rounded-lg p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <svg className="w-5 h-5 text-pm-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-pm-text truncate">{file.file_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-pm-muted">
                        <span>{file.project_name}</span>
                        {sizeKB && <span>&middot; {sizeKB} KB</span>}
                        <span>&middot; {new Date(file.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={`/api/pm/projects/${file.project_id}/documents?file_id=${file.id}&download=1`}
                    className="text-xs px-3 py-1 rounded-lg border border-pm-border text-pm-muted hover:text-pm-text transition-colors shrink-0"
                  >
                    Download
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
