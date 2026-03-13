import { createServiceClient } from "./supabase/server";

const TABLE_MIGRATION_MAP: Record<string, string> = {
  pm_project_templates: "001_pm_schema.sql",
  pm_projects: "001_pm_schema.sql",
  pm_phases: "001_pm_schema.sql",
  pm_tasks: "001_pm_schema.sql",
  pm_risks: "001_pm_schema.sql",
  pm_daily_logs: "001_pm_schema.sql",
  pm_files: "001_pm_schema.sql",
  pm_organizations: "003_orgs_and_members.sql",
  pm_members: "003_orgs_and_members.sql",
};

/**
 * Checks whether required PM tables exist in the database.
 * Returns null if all tables exist, or an error object with details.
 */
export async function checkTablesExist(
  tables: string[]
): Promise<{ error: string; missing: string[]; migrations: string[] } | null> {
  const supabase = createServiceClient();

  const missing: string[] = [];
  for (const table of tables) {
    // Try a lightweight head-only query to see if the table is accessible
    const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error && (error.message.includes("schema cache") || error.message.includes("does not exist") || error.code === "42P01")) {
      missing.push(table);
    }
  }

  if (missing.length === 0) return null;

  const migrations = [...new Set(missing.map((t) => TABLE_MIGRATION_MAP[t] ?? "unknown"))];

  return {
    error: `Missing table(s): ${missing.join(", ")}. Run migration(s): ${migrations.join(", ")} in your Supabase SQL editor.`,
    missing,
    migrations,
  };
}
