import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const { org_id, project_id, label } = await request.json();
  if (!org_id) return NextResponse.json({ error: "org_id required" }, { status: 400 });

  const token = crypto.randomBytes(24).toString("base64url");
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("pm_share_tokens").insert({
    org_id,
    project_id: project_id || null,
    token,
    label: label || null,
    permissions: "read",
    is_active: true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org_id");
  if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_share_tokens").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
