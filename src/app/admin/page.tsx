"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminUsersPanel from "./UsersPanel";
import AdminApiKeysPanel from "./ApiKeysPanel";

type Tab = "users" | "api-keys";

function AdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "users";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/pm/auth/profile")
      .then((r) => r.json())
      .then((data) => {
        setAuthorized(data?.system_role === "admin");
      })
      .catch(() => setAuthorized(false));
  }, []);

  function switchTab(t: Tab) {
    setTab(t);
    router.replace(`/admin?tab=${t}`, { scroll: false });
  }

  if (authorized === null) {
    return <p className="text-pm-muted">Loading...</p>;
  }

  if (!authorized) {
    return <p className="text-pm-blocked">Access denied. Admin role required.</p>;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "users", label: "Users" },
    { key: "api-keys", label: "API Keys" },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold text-pm-text mb-6">Admin</h1>

      <div className="flex gap-1 border-b border-pm-border mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-pm-accent text-pm-accent"
                : "border-transparent text-pm-muted hover:text-pm-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <AdminUsersPanel />}
      {tab === "api-keys" && <AdminApiKeysPanel />}
    </>
  );
}

export default function AdminPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Suspense fallback={<p className="text-pm-muted">Loading...</p>}>
        <AdminContent />
      </Suspense>
    </div>
  );
}
