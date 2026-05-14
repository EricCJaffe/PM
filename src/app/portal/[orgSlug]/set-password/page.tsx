"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  // Verify user is logged in (they came via invite link → /auth/callback → here)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace(`/portal/auth?org=${orgSlug}`);
      } else {
        setChecking(false);
      }
    });
  }, [orgSlug, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Redirect to their portal
    router.replace(`/portal/${orgSlug}`);
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-pm-bg flex items-center justify-center">
        <p className="text-pm-muted text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pm-bg flex items-center justify-center">
      <div className="bg-pm-card border border-pm-border rounded-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-pm-text">Set Your Password</h1>
          <p className="text-sm text-pm-muted mt-1">
            Create a password to access your portal going forward.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-pm-text mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              autoFocus
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-pm-text mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              required
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? "Saving…" : "Set Password & Enter Portal"}
          </button>
        </form>

        <p className="text-xs text-pm-muted text-center mt-6">
          Powered by Foundation Stone Advisors
        </p>
      </div>
    </div>
  );
}
