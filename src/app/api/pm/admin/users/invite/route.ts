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

// POST: Invite a new user by creating a profile placeholder
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, display_name, system_role } = await request.json();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const service = createServiceClient();

  // Check if user already exists
  const { data: existing } = await service
    .from("pm_user_profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  // Create a placeholder profile (will be linked to auth user when they sign up)
  const { data, error } = await service
    .from("pm_user_profiles")
    .insert({
      id: crypto.randomUUID(),
      email,
      display_name: display_name || email.split("@")[0],
      system_role: system_role === "admin" ? "admin" : "user",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // TODO: Send invite email via email service (Resend, SendGrid, etc.)
  // When configured, this will send a signup link to the user
  console.log(`[Invite] User invite created for ${email} with role ${system_role}`);

  return NextResponse.json(data);
}
