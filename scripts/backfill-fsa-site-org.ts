/**
 * Backfill script: Foundation Stone Advisors — Site-Level Organization
 *
 * Run: npx tsx scripts/backfill-fsa-site-org.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *
 * This script:
 * 1. Creates Foundation Stone Advisors as the site-level org (is_site_org = true)
 * 2. Adds Eric Jaffe as the owner member
 * 3. Applies migration 008 (is_site_org column) if not already present
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ORG = {
  name: "Foundation Stone Advisors",
  slug: "foundation-stone-advisors",
};

const MEMBERS = [
  {
    slug: "eric-jaffe",
    display_name: "Eric Jaffe",
    email: "ejaffe@foundationstoneadvisors.com",
    role: "owner",
  },
];

async function main() {
  console.log("=== FSA Site-Org Backfill ===\n");

  // 1. Ensure is_site_org column exists (idempotent)
  console.log("Ensuring is_site_org column exists...");
  const { error: migrationError } = await supabase.rpc("exec_sql", {
    sql: "ALTER TABLE pm_organizations ADD COLUMN IF NOT EXISTS is_site_org BOOLEAN NOT NULL DEFAULT false;",
  });
  if (migrationError) {
    // If rpc doesn't exist, that's fine — column may already exist from migration
    console.log("  (rpc not available or column already exists, continuing)");
  }

  // 2. Upsert org
  console.log(`Creating org: ${ORG.name}...`);
  const { data: existingOrg } = await supabase
    .from("pm_organizations")
    .select("id, slug, is_site_org")
    .eq("slug", ORG.slug)
    .single();

  let orgId: string;

  if (existingOrg) {
    console.log(`  Org already exists (id=${existingOrg.id})`);
    orgId = existingOrg.id;

    // Ensure it's marked as site org
    if (!existingOrg.is_site_org) {
      const { error: updateErr } = await supabase
        .from("pm_organizations")
        .update({ is_site_org: true })
        .eq("id", orgId);
      if (updateErr) {
        console.error("  Failed to set is_site_org:", updateErr.message);
      } else {
        console.log("  Updated is_site_org = true");
      }
    }
  } else {
    const { data: newOrg, error: orgErr } = await supabase
      .from("pm_organizations")
      .insert({ name: ORG.name, slug: ORG.slug, is_site_org: true })
      .select()
      .single();

    if (orgErr) {
      console.error("Failed to create org:", orgErr.message);
      process.exit(1);
    }
    orgId = newOrg.id;
    console.log(`  Created org (id=${orgId})`);
  }

  // 3. Add members
  for (const member of MEMBERS) {
    console.log(`Adding member: ${member.display_name}...`);

    const { data: existing } = await supabase
      .from("pm_members")
      .select("id")
      .eq("org_id", orgId)
      .eq("slug", member.slug)
      .single();

    if (existing) {
      console.log(`  Already exists (id=${existing.id})`);
      continue;
    }

    const { data: newMember, error: memberErr } = await supabase
      .from("pm_members")
      .insert({ org_id: orgId, ...member })
      .select()
      .single();

    if (memberErr) {
      console.error(`  Failed: ${memberErr.message}`);
    } else {
      console.log(`  Created (id=${newMember.id})`);
    }
  }

  console.log("\n=== Done ===");
  console.log(`\nFSA org ID: ${orgId}`);
  console.log("FSA staff will now appear in owner dropdowns across all client orgs.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
