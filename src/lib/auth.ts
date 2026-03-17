import { createServerSupabase, createServiceClient } from "./supabase/server";

export interface UserSession {
  id: string;
  email: string;
  display_name: string;
  system_role: "admin" | "user" | "external";
  org_ids: string[];
}

/**
 * Get the current authenticated user's profile and org access.
 * Returns null if not authenticated or profile doesn't exist.
 */
export async function getUserSession(): Promise<UserSession | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();

  const { data: profile } = await service
    .from("pm_user_profiles")
    .select("email, display_name, system_role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  // Get org IDs this user has access to
  const { data: orgAccess } = await service
    .from("pm_user_org_access")
    .select("org_id")
    .eq("user_id", user.id);

  return {
    id: user.id,
    email: profile.email,
    display_name: profile.display_name,
    system_role: profile.system_role as UserSession["system_role"],
    org_ids: (orgAccess ?? []).map((a: { org_id: string }) => a.org_id),
  };
}

/**
 * Get org IDs the user can access.
 * Admin/User: all orgs (returns null meaning "no filter").
 * External: only their assigned orgs.
 */
export async function getUserOrgFilter(): Promise<string[] | null> {
  const session = await getUserSession();
  if (!session) return []; // No session = no access
  if (session.system_role === "admin" || session.system_role === "user") return null; // No filter
  return session.org_ids; // External users: filter to their orgs
}
