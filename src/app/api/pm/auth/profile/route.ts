import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// POST: Ensure authenticated user has a profile
export async function POST() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();

  // First-user-becomes-admin: if no profiles exist yet, this user becomes admin
  const { count } = await service.from("pm_user_profiles").select("id", { count: "exact", head: true });
  const isFirstUser = count === 0;

  // Check if profile already exists (preserve existing role)
  const { data: existing } = await service.from("pm_user_profiles").select("system_role").eq("id", user.id).single();

  const { data, error } = await service.from("pm_user_profiles").upsert({
    id: user.id,
    email: user.email,
    display_name: user.user_metadata?.display_name || user.email?.split("@")[0] || "",
    ...(existing ? {} : { system_role: isFirstUser ? "admin" : "user" }),
  }, { onConflict: "id" }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// GET: Get current user profile
export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service
    .from("pm_user_profiles").select("*").eq("id", user.id).single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Get org access
  const { data: orgAccess } = await service
    .from("pm_user_org_access").select("*").eq("user_id", user.id);

  return NextResponse.json({ ...profile, org_access: orgAccess ?? [] });
}

// PATCH: Update current user's profile (display_name)
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.display_name === "string" && body.display_name.trim()) {
    updates.display_name = body.display_name.trim();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("pm_user_profiles")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also update auth user metadata so it stays in sync
  await supabase.auth.updateUser({ data: { display_name: updates.display_name } });

  return NextResponse.json(data);
}
