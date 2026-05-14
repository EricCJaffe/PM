import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getBranding, buildEmailFrom, buildEmailFooterHtml } from "@/lib/branding";
import { Resend } from "resend";

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

/** POST: Create a portal invite */
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
    const { data, error } = await supabase
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fetch org slug for the portal URL
    const { data: org } = await supabase
      .from("pm_organizations")
      .select("slug")
      .eq("id", org_id)
      .single();

    // Send invite email (non-blocking — don't fail the invite if email errors)
    sendPortalInviteEmail({
      to: email,
      displayName: name || email,
      orgId: org_id,
      orgSlug: org?.slug ?? null,
      token: data.token,
    }).catch((err) => console.error("[Email] Portal invite send failed:", err));

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

async function sendPortalInviteEmail({
  to,
  displayName,
  orgId,
  orgSlug,
  token,
}: {
  to: string;
  displayName: string;
  orgId: string;
  orgSlug?: string | null;
  token: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] Resend not configured — skipping portal invite to ${to}`);
    return;
  }

  const branding = await getBranding(orgId);
  const from = buildEmailFrom(branding);
  const footer = buildEmailFooterHtml(branding);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    branding.website_url ||
    "https://pm.foundationstoneadvisors.com";

  // If we have the org slug from the insert, use it; otherwise fall back to
  // fetching it. The token is the primary key for invite-accept, so even a
  // missing slug just means the user will need to enter their org slug manually.
  const portalUrl = orgSlug
    ? `${appUrl}/portal/auth?org=${orgSlug}&token=${token}`
    : `${appUrl}/portal/auth?token=${token}`;

  const r = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await r.emails.send({
    from,
    to,
    subject: `You've been invited to the ${branding.agency_name} client portal`,
    html: `
      <div style="font-family: ${branding.font_body ?? "Inter"}, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${branding.primary_color};">You're invited!</h2>
        <p>Hi ${displayName},</p>
        <p>You've been invited to access the <strong>${branding.agency_name}</strong> client portal,
           where you can view and collaborate on your projects, tasks, and documents.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${portalUrl}"
             style="background: ${branding.secondary_color}; color: white; padding: 14px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Access Client Portal
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px;">
          Or copy this link: <a href="${portalUrl}" style="color: ${branding.secondary_color};">${portalUrl}</a>
        </p>
        <p style="color: #64748b; font-size: 13px;">
          This invite link is tied to your email address (${to}).
          You'll be asked to verify your email with a one-time code on first login.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        ${footer}
      </div>
    `,
  });

  if (error) {
    console.error(`[Email] Failed to send portal invite to ${to}:`, error);
  } else {
    console.log(`[Email] Portal invite sent to ${to}, id: ${data?.id}`);
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
