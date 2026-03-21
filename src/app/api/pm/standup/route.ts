import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/standup?org_id=<uuid>&limit=7
export async function GET(req: NextRequest) {
  const authClient = await createServerSupabase();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("org_id");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "7");

  if (!orgId) {
    return NextResponse.json({ error: "org_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("pm_daily_logs")
    .select("*")
    .eq("org_id", orgId)
    .eq("log_type", "standup")
    .order("date", { ascending: false })
    .limit(limit);

  if (error) {
    // Fallback if org_id/log_type columns don't exist yet (pre-migration)
    const fallback = await supabase
      .from("pm_daily_logs")
      .select("*")
      .eq("generated_by", "standup-agent")
      .order("date", { ascending: false })
      .limit(limit);
    return NextResponse.json(fallback.data ?? []);
  }

  return NextResponse.json(data ?? []);
}
