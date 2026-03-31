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

  // Fetch documents shared with this org (sent, signed, approved)
  const { data: documents } = await supabase
    .from("generated_documents")
    .select("id, title, status, esign_status, esign_sent_at, esign_completed_at, sent_at, signed_at, created_at, document_types(name)")
    .eq("org_id", org.id)
    .in("status", ["sent", "signed", "approved"])
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-pm-text">Documents</h2>

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
    </div>
  );
}
