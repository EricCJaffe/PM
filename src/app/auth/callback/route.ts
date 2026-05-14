import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/";
  // Passed when this is a portal invite callback
  const inviteOrgId = searchParams.get("org_id");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const serviceClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Determine if this is a portal invite (from metadata or URL param)
        const isPortalInvite =
          user.user_metadata?.portal_invite === true || !!inviteOrgId;
        const orgId = inviteOrgId || user.user_metadata?.org_id;
        const orgSlug = user.user_metadata?.org_slug || "";

        // Ensure profile exists
        const { data: existing } = await serviceClient
          .from("pm_user_profiles")
          .select("system_role")
          .eq("id", user.id)
          .single();

        if (!existing) {
          const { count } = await serviceClient
            .from("pm_user_profiles")
            .select("id", { count: "exact", head: true });

          await serviceClient.from("pm_user_profiles").upsert({
            id: user.id,
            email: user.email,
            display_name:
              user.user_metadata?.display_name ||
              user.user_metadata?.full_name ||
              user.email?.split("@")[0] || "",
            system_role: isPortalInvite ? "external" : (count === 0 ? "admin" : "user"),
          }, { onConflict: "id" });
        } else if (isPortalInvite && existing.system_role !== "external") {
          // Don't downgrade internal users who happen to use a portal invite link
        }

        // Link org access for portal invites
        if (isPortalInvite && orgId) {
          const { data: existingAccess } = await serviceClient
            .from("pm_user_org_access")
            .select("id")
            .eq("user_id", user.id)
            .eq("org_id", orgId)
            .maybeSingle();

          if (!existingAccess) {
            await serviceClient.from("pm_user_org_access").insert({
              user_id: user.id,
              org_id: orgId,
            });
          }

          // Mark invite as accepted
          await serviceClient
            .from("pm_portal_invites")
            .update({ accepted_at: new Date().toISOString() })
            .eq("email", user.email!)
            .eq("org_id", orgId)
            .is("accepted_at", null);

          // Redirect to set-password page (invite users need to set a password)
          const setPasswordUrl = `/portal/${orgSlug}/set-password`;
          return NextResponse.redirect(new URL(setPasswordUrl, request.url));
        }
      }

      return NextResponse.redirect(new URL(redirect, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
}
