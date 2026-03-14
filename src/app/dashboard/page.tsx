import { getOrganizations, getProjects } from "@/lib/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const orgs = await getOrganizations();

  // Get project counts per org
  const orgStats = await Promise.all(
    orgs.map(async (org) => {
      const projects = await getProjects(org.id);
      const active = projects.filter((p) => p.status === "active").length;
      const totalProgress = projects.length > 0
        ? Math.round(projects.reduce((sum, p) => sum + p.overall_progress, 0) / projects.length)
        : 0;
      return { org, projectCount: projects.length, active, totalProgress };
    })
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-pm-text">Client Dashboards</h1>
          <p className="text-pm-muted mt-1">Manage clients, track implementation progress, and share with stakeholders.</p>
        </div>
      </div>

      {orgStats.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-pm-muted">No clients yet. Create an organization to get started.</p>
          <Link href="/organizations" className="mt-4 inline-block px-4 py-2 bg-pm-accent hover:bg-pm-accent-hover text-white rounded-lg text-sm font-medium">
            Go to Organizations
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgStats.map(({ org, projectCount, active, totalProgress }) => (
            <Link key={org.id} href={`/dashboard/${org.slug}`} className="card hover:border-pm-accent/50 transition-colors group">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-pm-text group-hover:text-pm-accent transition-colors">{org.name}</h2>
                <span className="text-xs text-pm-muted">{org.slug}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xl font-bold text-pm-text">{projectCount}</div>
                  <div className="text-xs text-pm-muted">Projects</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-pm-in-progress">{active}</div>
                  <div className="text-xs text-pm-muted">Active</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-pm-complete">{totalProgress}%</div>
                  <div className="text-xs text-pm-muted">Progress</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
