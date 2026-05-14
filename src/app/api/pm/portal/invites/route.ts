import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://pm.foundationstoneadvisors.com";

/** GET: List portal invites for an org */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org_id");
  if (!orgId) {
    return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_portal_invites")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST: Create a portal invite and send Supabase invitation email */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, email, name, role, invited_by } = body;

    if (!org_id || !email) {
      return NextResponse.json(
        { error: "org_id and email are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch org slug for redirect URL
    const { data: org } = await supabase
      .from("pm_organizations")
      .select("slug")
      .eq("id", org_id)
      .single();

    const orgSlug = org?.slug ?? "";

    // Record invite in our table first
    const { data: invite, error: insertError } = await supabase
      .from("pm_portal_invites")
      .insert({
        org_id,
        email,
        name: name ?? null,
        role: role ?? "viewer",
        invited_by: invited_by ?? null,
      })
      .select()
      .single();

    if (insertError) {
      // If duplicate, just re-send the invite
      if (!insertError.message.includes("duplicate")) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // Use Supabase's native invite — this works even with signups disabled,
    // creates the user in Supabase auth, and sends the email via Supabase's SMTP.
    // The redirectTo URL is where Supabase sends the user after they click the link.
    const redirectTo = `${APP_URL}/auth/callback?redirect=/portal/${orgSlug}/set-password&org_id=${org_id}`;

    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
        data: {
          portal_invite: true,
          org_id,
          org_slug: orgSlug,
          display_name: name || email.split("@")[0],
        },
      }
    );

    if (inviteError) {
      // User already registered — send a password reset link so they can
      // set/reset their password and access the portal
      if (
        inviteError.message.toLowerCase().includes("already") ||
        inviteError.message.toLowerCase().includes("registered")
      ) {
        const resetRedirect = `${APP_URL}/auth/callback?redirect=/portal/${orgSlug}`;
        await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: resetRedirect },
        });
        console.log(`[Invite] ${email} already exists — sent password reset instead`);
      } else {
        console.error("[Invite] inviteUserByEmail error:", inviteError.message);
        // Non-fatal: invite record was created, just email failed
      }
    }

    return NextResponse.json(invite ?? { email, org_id }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/** DELETE: Revoke a portal invite */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("pm_portal_invites")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
