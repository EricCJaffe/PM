import { createServiceClient } from "@/lib/supabase/server";
import { DepartmentInterviewForm } from "@/components/interview/DepartmentInterviewForm";
import type { Organization } from "@/types/pm";

export const metadata = {
  title: "Department Interview — BusinessOS Discovery",
};

export default async function DepartmentInterviewPage() {
  const supabase = createServiceClient();

  const { data: orgs } = await supabase
    .from("pm_organizations")
    .select("id, slug, name, is_site_org")
    .eq("is_site_org", false)
    .order("name");

  return (
    <main className="px-4 py-8 max-w-4xl mx-auto">
      <DepartmentInterviewForm orgs={(orgs ?? []) as Organization[]} />
    </main>
  );
}
