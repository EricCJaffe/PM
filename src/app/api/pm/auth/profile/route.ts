import { NextResponse } from "next/server";
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
