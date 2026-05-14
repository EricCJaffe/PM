import { createServiceClient } from "@/lib/supabase/server";
import { getUserSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PortalNotesPage({
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

  // Only show notes explicitly marked as client-visible
  const { data: notes } = await supabase
    .from("pm_client_notes")
    .select("id, title, body, note_type, pinned, created_at, author")
    .eq("org_id", org.id)
    .eq("visibility", "client")
    .neq("note_type", "client-update")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  const noteTypeLabel: Record<string, string> = {
    meeting: "Meeting",
    general: "General",
    "phone-call": "Phone Call",
    "follow-up": "Follow-up",
    decision: "Decision",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-pm-text">Notes</h2>
        <p className="text-sm text-pm-muted mt-1">Shared notes and updates from your project team.</p>
      </div>

      {(!notes || notes.length === 0) ? (
        <div className="bg-pm-card border border-pm-border rounded-lg p-8 text-center">
          <p className="text-pm-muted text-sm">No shared notes yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(notes as Array<{
            id: string; title: string | null; body: string | null;
            note_type: string; pinned: boolean; created_at: string; author: string | null;
          }>).map((note) => (
            <div
              key={note.id}
              className={`bg-pm-card border rounded-lg p-5 ${note.pinned ? "border-blue-500/40" : "border-pm-border"}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {note.pinned && (
                    <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  )}
                  {note.title && (
                    <h3 className="text-sm font-semibold text-pm-text">{note.title}</h3>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-pm-border/60 text-pm-muted">
                    {noteTypeLabel[note.note_type] ?? note.note_type}
                  </span>
                </div>
                <span className="text-xs text-pm-muted whitespace-nowrap">
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
              </div>

              {note.body && (
                <p className="text-sm text-pm-text leading-relaxed whitespace-pre-wrap">{note.body}</p>
              )}

              {note.author && (
                <p className="text-xs text-pm-muted mt-2">— {note.author}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
