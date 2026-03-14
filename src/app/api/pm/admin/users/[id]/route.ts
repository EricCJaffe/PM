import { NextRequest, NextResponse } from "next/server";
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

// PATCH: Update user role or org access
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const service = createServiceClient();

  // Update system role
  if (body.system_role) {
    const { error } = await service
      .from("pm_user_profiles")
      .update({ system_role: body.system_role, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update display name
  if (body.display_name !== undefined) {
    const { error } = await service
      .from("pm_user_profiles")
      .update({ display_name: body.display_name, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add/update org access
  if (body.org_access) {
    const { org_id, role } = body.org_access;
    if (role === "remove") {
      await service.from("pm_user_org_access").delete().eq("user_id", id).eq("org_id", org_id);
    } else {
      const { error } = await service.from("pm_user_org_access").upsert({
        user_id: id,
        org_id,
        role,
      }, { onConflict: "user_id,org_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
