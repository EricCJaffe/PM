import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/projects";

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
      // Ensure profile exists after email confirmation
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { createClient } = require("@supabase/supabase-js");
        const serviceClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        // First-user-becomes-admin
        const { count } = await serviceClient.from("pm_user_profiles").select("id", { count: "exact", head: true });
        const isFirstUser = count === 0;
        const { data: existing } = await serviceClient.from("pm_user_profiles").select("system_role").eq("id", user.id).single();

        await serviceClient.from("pm_user_profiles").upsert({
          id: user.id,
          email: user.email,
          display_name: user.user_metadata?.display_name || user.email?.split("@")[0] || "",
          ...(existing ? {} : { system_role: isFirstUser ? "admin" : "user" }),
        }, { onConflict: "id" });
      }
      return NextResponse.redirect(new URL(redirect, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
}
