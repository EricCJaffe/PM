/**
 * Bootstrap script: Link Eric Jaffe's auth.users record to PM user profile
 *
 * Run: npx tsx scripts/bootstrap-admin-user.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *
 * This script:
 * 1. Finds the existing auth.users record for ejaffejax@gmail.com
 * 2. Creates/upserts a pm_user_profiles record with system_role = 'admin'
 * 3. Creates pm_user_org_access for Foundation Stone Advisors (site org)
 * 4. Links the existing pm_members record to the auth user
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = "ejaffejax@gmail.com";
const ADMIN_NAME = "Eric Jaffe";
const ADMIN_SLUG = "eric-jaffe";

async function bootstrap() {
  console.log("=== Bootstrap Admin User ===\n");

  // 1. Find auth user by email
  const { data: authList, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error("Failed to list auth users:", authError.message);
    process.exit(1);
  }

  const authUser = authList.users.find((u) => u.email === ADMIN_EMAIL);
  if (!authUser) {
    console.log(`No auth user found for ${ADMIN_EMAIL}. Creating one...`);
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      email_confirm: true,
      user_metadata: { display_name: ADMIN_NAME },
    });
    if (createError) {
      console.error("Failed to create auth user:", createError.message);
      process.exit(1);
    }
    console.log(`Created auth user: ${newUser.user.id}`);
    await linkUser(newUser.user.id);
  } else {
    console.log(`Found auth user: ${authUser.id} (${authUser.email})`);
    await linkUser(authUser.id);
  }
}

async function linkUser(authUserId: string) {
  // 2. Upsert pm_user_profiles
  const { error: profileError } = await supabase
    .from("pm_user_profiles")
    .upsert({
      id: authUserId,
      email: ADMIN_EMAIL,
      display_name: ADMIN_NAME,
      system_role: "admin",
    }, { onConflict: "id" });

  if (profileError) {
    console.error("Failed to upsert profile:", profileError.message);
    // If it's a constraint issue with the old CHECK, try cleaning up first
    if (profileError.message.includes("check")) {
      console.log("Hint: Run migration 013_auth_system_upgrade.sql first to update the role CHECK constraint.");
    }
    process.exit(1);
  }
  console.log("Upserted pm_user_profiles with system_role = admin");

  // 3. Find site org
  const { data: siteOrg } = await supabase
    .from("pm_organizations")
    .select("id, name")
    .eq("is_site_org", true)
    .single();

  if (!siteOrg) {
    console.log("No site org found. Run backfill-fsa-site-org.ts first.");
    return;
  }

  console.log(`Site org: ${siteOrg.name} (${siteOrg.id})`);

  // 4. Create org access
  const { error: accessError } = await supabase
    .from("pm_user_org_access")
    .upsert({
      user_id: authUserId,
      org_id: siteOrg.id,
      role: "admin",
    }, { onConflict: "user_id,org_id" });

  if (accessError) {
    console.error("Failed to create org access:", accessError.message);
  } else {
    console.log("Created pm_user_org_access (admin) for site org");
  }

  // 5. Link existing pm_members record
  const { data: existingMember } = await supabase
    .from("pm_members")
    .select("id")
    .eq("org_id", siteOrg.id)
    .eq("slug", ADMIN_SLUG)
    .single();

  if (existingMember) {
    const { error: linkError } = await supabase
      .from("pm_members")
      .update({ user_id: authUserId, email: ADMIN_EMAIL })
      .eq("id", existingMember.id);

    if (linkError) {
      console.error("Failed to link member:", linkError.message);
    } else {
      console.log(`Linked pm_members record (${ADMIN_SLUG}) to auth user`);
    }
  } else {
    // Create member if it doesn't exist
    const { error: insertError } = await supabase
      .from("pm_members")
      .insert({
        org_id: siteOrg.id,
        slug: ADMIN_SLUG,
        display_name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        role: "owner",
        user_id: authUserId,
      });

    if (insertError) {
      console.error("Failed to create member:", insertError.message);
    } else {
      console.log("Created pm_members record linked to auth user");
    }
  }

  // 6. Also add access to all other orgs (admin sees everything)
  const { data: allOrgs } = await supabase
    .from("pm_organizations")
    .select("id, name")
    .neq("id", siteOrg.id);

  for (const org of allOrgs ?? []) {
    await supabase.from("pm_user_org_access").upsert({
      user_id: authUserId,
      org_id: org.id,
      role: "admin",
    }, { onConflict: "user_id,org_id" });
    console.log(`Added org access for: ${org.name}`);
  }

  console.log("\n=== Done! Eric Jaffe is now linked as admin. ===");
}

bootstrap().catch(console.error);
