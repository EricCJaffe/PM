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

  // Primary query: by org_id + log_type
  const { data, error } = await supabase
    .from("pm_daily_logs")
    .select("*")
    .eq("org_id", orgId)
    .eq("log_type", "standup")
    .order("date", { ascending: false })
    .limit(limit);

  if (!error && data) {
    return NextResponse.json(data);
  }

  // Fallback 1: org_id exists but log_type doesn't
  const { data: fb1, error: fb1Err } = await supabase
    .from("pm_daily_logs")
    .select("*")
    .eq("org_id", orgId)
    .eq("generated_by", "standup-agent")
    .order("date", { ascending: false })
    .limit(limit);

  if (!fb1Err && fb1) {
    return NextResponse.json(fb1);
  }

  // Fallback 2: neither org_id nor log_type columns exist
  const { data: fb2 } = await supabase
    .from("pm_daily_logs")
    .select("*")
    .eq("generated_by", "standup-agent")
    .order("created_at", { ascending: false })
    .limit(limit);

  return NextResponse.json(fb2 ?? []);
}
