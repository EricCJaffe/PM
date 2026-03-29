import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/pm/portal/invite-accept
 * Validates an invite token and links the email to the org.
 * Called before magic link is sent so the user gets org access on login.
 */
export async function POST(request: NextRequest) {
  try {
    const { token, email } = await request.json();

    if (!token || !email) {
      return NextResponse.json({ error: "Token and email are required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Find the invite
    const { data: invite, error: invErr } = await supabase
      .from("pm_portal_invites")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (invErr || !invite) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
    }

    // Check expiration
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
    }

    // Check email matches
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Email does not match the invite" }, { status: 403 });
    }

    // Check if already accepted
    if (invite.accepted_at) {
      return NextResponse.json({ error: "Invite already accepted", org_id: invite.org_id });
    }

    // Check if user already exists in auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase()
    );

    // If user exists, ensure they have org access
    if (existingUser) {
      // Check if org access already exists
      const { data: existingAccess } = await supabase
        .from("pm_user_org_access")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("org_id", invite.org_id)
        .single();

      if (!existingAccess) {
        await supabase.from("pm_user_org_access").insert({
          user_id: existingUser.id,
          org_id: invite.org_id,
        });
      }

      // Ensure user profile exists with external role
      const { data: profile } = await supabase
        .from("pm_user_profiles")
        .select("id")
        .eq("id", existingUser.id)
        .single();

      if (!profile) {
        await supabase.from("pm_user_profiles").insert({
          id: existingUser.id,
          email: email,
          display_name: invite.name || email.split("@")[0],
          system_role: "external",
        });
      }
    }
    // If user doesn't exist, they'll be created when the magic link is clicked.
    // We store the pending org access in the invite, and the auth callback
    // will link them on first login.

    // Mark invite as accepted
    await supabase
      .from("pm_portal_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return NextResponse.json({
      success: true,
      org_id: invite.org_id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
