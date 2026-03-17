"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string; display_name?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({
          email: user.email,
          display_name: user.user_metadata?.display_name || user.email?.split("@")[0],
        });
      }
    });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1 rounded-md text-sm text-pm-muted hover:text-pm-text hover:bg-pm-card transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-pm-accent/20 text-pm-accent flex items-center justify-center text-xs font-bold">
          {(user.display_name || user.email || "?")[0].toUpperCase()}
        </div>
        <span className="hidden sm:inline max-w-24 truncate">{user.display_name || user.email}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-pm-card border border-pm-border rounded-lg shadow-xl py-1 z-50">
          <div className="px-3 py-2 border-b border-pm-border">
            <div className="text-sm text-pm-text font-medium truncate">{user.display_name}</div>
            <div className="text-xs text-pm-muted truncate">{user.email}</div>
          </div>
          <Link
            href="/settings"
            className="block px-3 py-2 text-sm text-pm-muted hover:text-pm-text hover:bg-pm-bg transition-colors"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 text-sm text-pm-muted hover:text-pm-text hover:bg-pm-bg transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
