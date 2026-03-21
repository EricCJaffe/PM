import { createServiceClient } from "@/lib/supabase/server";
import { SiteAuditStandalone } from "./SiteAuditStandalone";

export const metadata = {
  title: "Site Audit Tool — BusinessOS",
};

export default async function SiteAuditPage() {
  const supabase = createServiceClient();

  // Load all orgs for the org selector
  const { data: orgs } = await supabase
    .from("pm_organizations")
    .select("id, name, slug")
    .order("name");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-pm-text">Site Audit Tool</h1>
        <p className="text-pm-muted mt-1">
          Enter any website URL to get a scored gap analysis and rebuild
          recommendations.
        </p>
      </div>

      {orgs && orgs.length > 0 ? (
        <SiteAuditStandalone orgs={orgs} />
      ) : (
        <div className="bg-pm-card border border-pm-border rounded-xl p-6">
          <p className="text-pm-muted text-sm">
            No organizations found. Create one first at{" "}
            <a href="/clients" className="text-blue-400 hover:text-blue-300">
              /clients
            </a>.
          </p>
        </div>
      )}
    </div>
  );
}
