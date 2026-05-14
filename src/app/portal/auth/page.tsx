"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PortalAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-pm-bg flex items-center justify-center">
          <p className="text-pm-muted text-sm">Loading...</p>
        </div>
      }
    >
      <PortalLoginForm />
    </Suspense>
  );
}

function PortalLoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgSlug = searchParams.get("org") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      if (signInError.message.toLowerCase().includes("invalid")) {
        setError("Incorrect email or password. Check your invite email if this is your first login.");
      } else {
        setError(signInError.message);
      }
      setLoading(false);
      return;
    }

    // Redirect into the portal
    router.replace(orgSlug ? `/portal/${orgSlug}` : "/portal");
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Enter your email address above first.");
      return;
    }
    setLoading(true);
    setError("");

    const supabase = createClient();
    const appUrl = window.location.origin;
    const redirectTo = orgSlug
      ? `${appUrl}/auth/callback?redirect=/portal/${orgSlug}`
      : `${appUrl}/auth/callback?redirect=/portal`;

    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setResetSent(true);
    setLoading(false);
  }

  if (resetSent) {
    return (
      <div className="min-h-screen bg-pm-bg flex items-center justify-center">
        <div className="bg-pm-card border border-pm-border rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <span className="text-emerald-400 text-xl">&#10003;</span>
          </div>
          <h1 className="text-xl font-semibold text-pm-text mb-2">Check your email</h1>
          <p className="text-sm text-pm-muted mb-1">
            We sent a password reset link to <strong className="text-pm-text">{email}</strong>
          </p>
          <p className="text-xs text-pm-muted">Click the link to set a new password.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pm-bg flex items-center justify-center">
      <div className="bg-pm-card border border-pm-border rounded-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-pm-text">Client Portal</h1>
          <p className="text-sm text-pm-muted mt-1">Sign in with your email and password.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-pm-text mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-pm-text mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
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
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowReset(!showReset)}
            className="text-xs text-pm-muted hover:text-pm-text transition-colors"
          >
            Forgot password?
          </button>
        </div>

        {showReset && (
          <form onSubmit={handlePasswordReset} className="mt-3">
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-2 px-4 border border-pm-border text-pm-muted hover:text-pm-text disabled:opacity-50 text-xs font-medium rounded-lg transition-colors"
            >
              {loading ? "Sending…" : `Send reset link to ${email || "your email"}`}
            </button>
          </form>
        )}

        <p className="text-xs text-pm-muted text-center mt-6">
          Powered by Foundation Stone Advisors
        </p>
      </div>
    </div>
  );
}
