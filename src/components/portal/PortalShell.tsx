"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface PortalSettings {
  show_workflow?: boolean;
  show_documents?: boolean;
  show_tasks?: boolean;
  show_site_audit?: boolean;
  allow_task_comments?: boolean;
  allow_file_uploads?: boolean;
  [key: string]: unknown;
}

interface PortalShellProps {
  orgSlug: string;
  orgName: string;
  portalTitle: string;
  primaryColor: string;
  logoUrl: string | null;
  welcomeMessage: string;
  userName: string;
  settings: PortalSettings | null;
  children: React.ReactNode;
}

export function PortalShell({
  orgSlug,
  orgName,
  portalTitle,
  primaryColor,
  logoUrl,
  userName,
  settings,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/portal/${orgSlug}`;

  const showWorkflow = settings?.show_workflow !== false;
  const showDocuments = settings?.show_documents !== false;
  const showTasks = settings?.show_tasks !== false;

  const navItems = [
    { href: base, label: "Home", show: true },
    { href: `${base}/workflow`, label: "Workflow", show: showWorkflow },
    { href: `${base}/documents`, label: "Documents", show: showDocuments },
    { href: `${base}/tasks`, label: "Tasks", show: showTasks },
  ].filter((n) => n.show);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/portal/auth?org=${orgSlug}`);
  }

  return (
    <div className="min-h-screen bg-pm-bg">
      {/* Accent bar */}
      <div className="h-1" style={{ background: primaryColor }} />

      {/* Header */}
      <header className="border-b border-pm-border bg-pm-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={orgName} className="h-8 w-auto" />
            ) : (
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ background: primaryColor }}
              >
                {orgName.charAt(0)}
              </div>
            )}
            <h1 className="text-lg font-semibold text-pm-text">{portalTitle}</h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-pm-muted">{userName}</span>
            <button
              onClick={handleSignOut}
              className="text-xs text-pm-muted hover:text-pm-text transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === base
                  ? pathname === base
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    isActive
                      ? "text-pm-text"
                      : "border-transparent text-pm-muted hover:text-pm-text"
                  }`}
                  style={isActive ? { borderBottomColor: primaryColor, color: primaryColor } : {}}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
