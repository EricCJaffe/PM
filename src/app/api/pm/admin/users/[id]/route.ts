import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const service = createServiceClient();
    const { data: profile } = await service
      .from("pm_user_profiles").select("system_role").eq("id", user.id).single();
    if (!profile || profile.system_role !== "admin") return null;
    return user;
  }

  // Allow access when auth is disabled
  return { id: "no-auth" } as { id: string };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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

  // Update system role — when changing to/from external, rebuild org access
  if (body.system_role) {
    const newRole = body.system_role;

    // Get the user's current profile
    const { data: profile } = await service
      .from("pm_user_profiles")
      .select("system_role, display_name, email")
      .eq("id", id)
      .single();

    const oldRole = profile?.system_role;

    // Update the profile
    const { error } = await service
      .from("pm_user_profiles")
      .update({ system_role: newRole, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Rebuild org access if role type changed
    if (oldRole !== newRole && profile) {
      if (newRole === "admin" || newRole === "user") {
        // Becoming internal: grant access to ALL orgs
        const { data: allOrgs } = await service
          .from("pm_organizations")
          .select("id");

        for (const org of allOrgs ?? []) {
          await service.from("pm_user_org_access").upsert({
            user_id: id,
            org_id: org.id,
            role: newRole === "admin" ? "admin" : "member",
          }, { onConflict: "user_id,org_id" });

          // Ensure pm_members record exists
          const memberSlug = slugify(profile.display_name || profile.email);
          const { data: existingMember } = await service
            .from("pm_members")
            .select("id")
            .eq("org_id", org.id)
            .eq("slug", memberSlug)
            .single();

          if (!existingMember) {
            await service.from("pm_members").insert({
              org_id: org.id,
              slug: memberSlug,
              display_name: profile.display_name,
              email: profile.email,
              role: newRole === "admin" ? "admin" : "member",
              user_id: id,
            });
          }
        }
      } else if (newRole === "external") {
        // Becoming external: remove all org access (admin will assign one client)
        await service.from("pm_user_org_access").delete().eq("user_id", id);
      }
    }
  }

  // Update display name
  if (body.display_name !== undefined) {
    const { error } = await service
      .from("pm_user_profiles")
      .update({ display_name: body.display_name, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Assign external user to a specific client org
  if (body.assigned_org_id !== undefined) {
    // Remove all existing non-site org access
    const { data: currentAccess } = await service
      .from("pm_user_org_access")
      .select("org_id")
      .eq("user_id", id);

    for (const access of currentAccess ?? []) {
      await service.from("pm_user_org_access").delete()
        .eq("user_id", id)
        .eq("org_id", access.org_id);
    }

    // Add access to the selected org (if one was chosen)
    if (body.assigned_org_id) {
      const { data: profile } = await service
        .from("pm_user_profiles")
        .select("display_name, email")
        .eq("id", id)
        .single();

      await service.from("pm_user_org_access").upsert({
        user_id: id,
        org_id: body.assigned_org_id,
        role: "member",
      }, { onConflict: "user_id,org_id" });

      // Ensure pm_members record exists for task assignment
      if (profile) {
        const memberSlug = slugify(profile.display_name || profile.email);
        const { data: existingMember } = await service
          .from("pm_members")
          .select("id")
          .eq("org_id", body.assigned_org_id)
          .eq("slug", memberSlug)
          .single();

        if (!existingMember) {
          await service.from("pm_members").insert({
            org_id: body.assigned_org_id,
            slug: memberSlug,
            display_name: profile.display_name,
            email: profile.email,
            role: "member",
            user_id: id,
          });
        }
      }
    }
  }

  // Legacy: Add/update org access (keep for backward compatibility)
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

// DELETE: Remove a user profile and their org access
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const service = createServiceClient();

  // Prevent self-deletion
  if (admin.id === id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  // Remove org access first
  await service.from("pm_user_org_access").delete().eq("user_id", id);

  // Remove user profile
  const { error } = await service.from("pm_user_profiles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
