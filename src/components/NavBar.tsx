"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { createClient } from "@/lib/supabase/client";

interface UserInfo {
  display_name: string;
  system_role: string;
}

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const hidden = pathname.startsWith("/share/") || pathname === "/login";

  // Fetch user profile on mount
  useEffect(() => {
    if (hidden) return;
    fetch("/api/pm/auth/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && !data.error) {
          setUser({ display_name: data.display_name, system_role: data.system_role });
        }
      })
      .catch(() => {});
  }, [hidden]);

  // Hide NavBar on public share pages and login
  if (hidden) return null;

  const isAdmin = user?.system_role === "admin";

  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/projects", label: "Projects" },
    { href: "/clients", label: "Clients" },
    { href: "/documents", label: "Documents" },
    { href: "/kb", label: "Knowledge Base" },
    ...(isAdmin ? [{ href: "/admin/users", label: "Admin" }] : []),
  ];

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-pm-border bg-pm-card/50">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        <Link href="/" className="font-bold text-pm-text text-lg">
          BusinessOS <span className="text-pm-muted font-normal text-sm">PM</span>
        </Link>
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-pm-accent/20 text-pm-accent"
                    : "text-pm-muted hover:text-pm-text hover:bg-pm-card"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <ThemeToggle />

          {/* User menu */}
          {user && (
            <div className="relative ml-2">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-8 h-8 rounded-full bg-pm-accent/20 text-pm-accent flex items-center justify-center text-xs font-bold hover:bg-pm-accent/30 transition-colors"
                title={user.display_name}
              >
                {user.display_name[0]?.toUpperCase() || "?"}
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-pm-card border border-pm-border rounded-lg shadow-xl z-50 py-1">
                    <div className="px-3 py-2 border-b border-pm-border">
                      <div className="text-sm font-medium text-pm-text truncate">{user.display_name}</div>
                      <div className="text-xs text-pm-muted capitalize">{user.system_role}</div>
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setShowMenu(false)}
                      className="block px-3 py-2 text-sm text-pm-muted hover:text-pm-text hover:bg-pm-bg transition-colors"
                    >
                      My Profile
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-3 py-2 text-sm text-pm-muted hover:text-pm-text hover:bg-pm-bg transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
