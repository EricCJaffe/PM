import { createServiceClient } from "@/lib/supabase/server";
import { getUserSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/PortalShell";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getUserSession();

  if (!session) {
    redirect(`/portal/auth?org=${orgSlug}`);
  }

  const supabase = createServiceClient();

  // Fetch the org by slug
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("id, name, slug")
    .eq("slug", orgSlug)
    .single();

  if (!org) {
    redirect("/portal/auth");
  }

  // Verify this user has access to this org
  if (session.system_role === "external") {
    if (!session.org_ids.includes(org.id)) {
      redirect("/portal/auth");
    }
  }

  // Fetch portal settings
  const { data: settings } = await supabase
    .from("pm_portal_settings")
    .select("*")
    .eq("org_id", org.id)
    .single();

  // Fetch org branding (client logo, colors)
  const { data: branding } = await supabase
    .from("pm_org_branding")
    .select("client_logo_url, client_company_name, color_overrides")
    .eq("org_id", org.id)
    .single();

  const portalTitle = settings?.portal_title || org.name;
  const primaryColor = settings?.primary_color || "#5B9BD5";
  const logoUrl = branding?.client_logo_url || null;
  const welcomeMessage = settings?.welcome_message || `Welcome to your ${org.name} project portal.`;

  return (
    <PortalShell
      orgSlug={orgSlug}
      orgName={org.name}
      portalTitle={portalTitle}
      primaryColor={primaryColor}
      logoUrl={logoUrl}
      welcomeMessage={welcomeMessage}
      userName={session.display_name || session.email}
      settings={settings}
    >
      {children}
    </PortalShell>
  );
}
