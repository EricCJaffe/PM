"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { href: "/projects", label: "Projects" },
  { href: "/dashboard", label: "Clients" },
  { href: "/organizations", label: "Organizations" },
  { href: "/members", label: "Members" },
];

export function NavBar() {
  const pathname = usePathname();

  // Hide NavBar on public share pages
  if (pathname.startsWith("/share/")) return null;
  // Hide NavBar on login page
  if (pathname === "/login") return null;

  return (
    <nav className="border-b border-pm-border bg-pm-card/50">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        <Link href="/" className="font-bold text-pm-text text-lg">
          BusinessOS <span className="text-pm-muted font-normal text-sm">PM</span>
        </Link>
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
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
          <Link
            href="/projects/new"
            className="ml-3 px-3 py-1.5 bg-pm-accent hover:bg-pm-accent-hover text-white rounded-md text-sm font-medium transition-colors"
          >
            + New Project
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
