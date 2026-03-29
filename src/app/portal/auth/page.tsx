"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  const orgSlug = searchParams.get("org") || "";
  const inviteToken = searchParams.get("token") || "";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // If there's an invite token, accept it first
      if (inviteToken) {
        const res = await fetch("/api/pm/portal/invite-accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: inviteToken, email }),
        });
        const data = await res.json();
        if (!res.ok && data.error !== "Invite already accepted") {
          setError(data.error || "Invalid or expired invite.");
          setLoading(false);
          return;
        }
      }

      // Send magic link
      const supabase = createClient();
      const redirectTo = orgSlug
        ? `${window.location.origin}/auth/callback?redirect=/portal/${orgSlug}`
        : `${window.location.origin}/auth/callback?redirect=/portal/auth`;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (otpError) {
        setError(otpError.message);
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-pm-bg flex items-center justify-center">
        <div className="bg-pm-card border border-pm-border rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <span className="text-emerald-400 text-xl">&#10003;</span>
          </div>
          <h1 className="text-xl font-semibold text-pm-text mb-2">Check your email</h1>
          <p className="text-sm text-pm-muted mb-1">
            We sent a sign-in link to <strong className="text-pm-text">{email}</strong>
          </p>
          <p className="text-xs text-pm-muted">Click the link in the email to access your portal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pm-bg flex items-center justify-center">
      <div className="bg-pm-card border border-pm-border rounded-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-pm-text">Client Portal</h1>
          <p className="text-sm text-pm-muted mt-1">Enter your email to receive a sign-in link.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
              autoFocus
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? "Sending..." : "Send sign-in link"}
          </button>
        </form>

        <p className="text-xs text-pm-muted text-center mt-6">
          Powered by Foundation Stone Advisors
        </p>
      </div>
    </div>
  );
}
