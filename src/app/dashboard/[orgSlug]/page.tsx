import { redirect } from "next/navigation";

export default async function DashboardSlugRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(`/clients/${orgSlug}`);
}
