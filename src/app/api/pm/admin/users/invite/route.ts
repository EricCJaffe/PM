import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { sendInviteEmail } from "@/lib/email";

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

// POST: Create a real auth user, profile, org access, and member records
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, display_name, system_role, org_ids } = await request.json();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!display_name) return NextResponse.json({ error: "Display name is required" }, { status: 400 });

  const validRole = ["admin", "user", "external"].includes(system_role) ? system_role : "user";
  const service = createServiceClient();

  // Check if profile already exists
  const { data: existingProfile } = await service
    .from("pm_user_profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (existingProfile) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  // 1. Create a real Supabase auth user (or find existing auth user)
  let authUserId: string;

  // Check if auth user already exists (e.g. from another app sharing this Supabase project)
  const { data: authList } = await service.auth.admin.listUsers();
  const existingAuth = authList?.users?.find((u: { email?: string }) => u.email === email);

  if (existingAuth) {
    authUserId = existingAuth.id;
  } else {
    // Create new auth user — they'll get an invite email to set their password
    const { data: newAuth, error: authError } = await service.auth.admin.createUser({
      email,
      email_confirm: true, // Skip email confirmation since admin is creating them
      user_metadata: { display_name },
    });

    if (authError) {
      return NextResponse.json({ error: `Failed to create auth user: ${authError.message}` }, { status: 500 });
    }
    authUserId = newAuth.user.id;
  }

  // 2. Create pm_user_profiles record
  const { error: profileError } = await service
    .from("pm_user_profiles")
    .upsert({
      id: authUserId,
      email,
      display_name: display_name,
      system_role: validRole,
    }, { onConflict: "id" });

  if (profileError) {
    return NextResponse.json({ error: `Failed to create profile: ${profileError.message}` }, { status: 500 });
  }

  // 3. Determine which orgs to add the user to
  let assignOrgIds: string[] = [];

  if (validRole === "admin" || validRole === "user") {
    // Internal users (FSA staff): auto-access to ALL orgs
    const { data: allOrgs } = await service
      .from("pm_organizations")
      .select("id");
    assignOrgIds = (allOrgs ?? []).map((o: { id: string }) => o.id);
  } else {
    // External users: only the specified org(s)
    assignOrgIds = org_ids ?? [];
    if (assignOrgIds.length === 0) {
      // No org specified — that's OK, admin can assign later
    }
  }

  // 4. Create pm_user_org_access and pm_members records for each org
  const memberSlug = slugify(display_name);

  for (const orgId of assignOrgIds) {
    // Add org access
    await service.from("pm_user_org_access").upsert({
      user_id: authUserId,
      org_id: orgId,
      role: validRole === "admin" ? "admin" : "member",
    }, { onConflict: "user_id,org_id" });

    // Add pm_members record (for task assignment pickers)
    const { data: existingMember } = await service
      .from("pm_members")
      .select("id")
      .eq("org_id", orgId)
      .eq("slug", memberSlug)
      .single();

    if (!existingMember) {
      await service.from("pm_members").insert({
        org_id: orgId,
        slug: memberSlug,
        display_name: display_name,
        email: email,
        role: validRole === "admin" ? "admin" : "member",
        user_id: authUserId,
      });
    } else {
      // Link existing member to auth user
      await service.from("pm_members")
        .update({ user_id: authUserId, email })
        .eq("id", existingMember.id);
    }
  }

  // 5. Generate a magic link for the user to set up their account
  const { data: magicLink } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  // 6. Send invite email
  sendInviteEmail({
    to: email,
    displayName: display_name,
    role: validRole === "admin" ? "Admin" : validRole === "external" ? "Client User" : "Staff",
    invitedBy: admin.id !== "no-auth" ? "An administrator" : undefined,
  }).catch((err) => console.error("[Email] Invite error:", err));

  return NextResponse.json({
    id: authUserId,
    email,
    display_name,
    system_role: validRole,
    org_ids: assignOrgIds,
    magic_link: magicLink?.properties?.action_link || null,
  });
}
