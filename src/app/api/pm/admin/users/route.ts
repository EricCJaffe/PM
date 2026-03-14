import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const { data: profile } = await service
    .from("pm_user_profiles").select("system_role").eq("id", user.id).single();

  if (!profile || profile.system_role !== "admin") return null;
  return user;
}

// GET: List all users with their org access
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data: users, error } = await service
    .from("pm_user_profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get org access for all users
  const { data: orgAccess } = await service
    .from("pm_user_org_access")
    .select("*");

  // Get orgs for display
  const { data: orgs } = await service
    .from("pm_organizations")
    .select("id, name, slug");

  return NextResponse.json({
    users: users ?? [],
    org_access: orgAccess ?? [],
    organizations: orgs ?? [],
  });
}
