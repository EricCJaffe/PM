import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/client-update?project_id=...&org_id=...
export async function GET(req: NextRequest) {
  const authClient = await createServerSupabase();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get("project_id");
  const orgId = req.nextUrl.searchParams.get("org_id");

  const supabase = createServiceClient();
  let query = supabase
    .from("pm_client_notes")
    .select("*")
    .eq("note_type", "client-update")
    .order("created_at", { ascending: false })
    .limit(20);

  if (projectId) query = query.eq("project_id", projectId);
  if (orgId) query = query.eq("org_id", orgId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
