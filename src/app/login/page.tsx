"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-pm-bg flex items-center justify-center"><p className="text-pm-muted">Loading...</p></div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else {
      try { await fetch("/api/pm/auth/profile", { method: "POST" }); } catch {}
      router.push(redirect);
      router.refresh();
    }
    setLoading(false);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError("Enter your email first."); return; }
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email for a login link.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-pm-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-pm-text">BusinessOS</h1>
          <p className="text-pm-muted text-sm mt-1">Project Management</p>
        </div>

        <div className="card">
          {/* Microsoft SSO */}
          <button
            onClick={async () => {
              setError(null);
              setLoading(true);
              const supabase = createClient();
              const { error } = await supabase.auth.signInWithOAuth({
                provider: "azure",
                options: {
                  scopes: "email profile openid",
                  redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
                },
              });
              if (error) { setError(error.message); setLoading(false); }
            }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 mb-4 bg-[#2f2f2f] hover:bg-[#3b3b3b] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors border border-pm-border"
          >
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            {loading ? "Redirecting..." : "Sign in with Microsoft"}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border-t border-pm-border" />
            <span className="text-xs text-pm-muted">or use email</span>
            <div className="flex-1 border-t border-pm-border" />
          </div>

          <div className="flex mb-6 border-b border-pm-border">
            <button
              onClick={() => { setMode("password"); setError(null); setMessage(null); }}
              className={`flex-1 pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                mode === "password" ? "border-pm-accent text-pm-accent" : "border-transparent text-pm-muted"
              }`}
            >
              Password
            </button>
            <button
              onClick={() => { setMode("magic"); setError(null); setMessage(null); }}
              className={`flex-1 pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                mode === "magic" ? "border-pm-accent text-pm-accent" : "border-transparent text-pm-muted"
              }`}
            >
              Magic Link
            </button>
          </div>

          {mode === "password" ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-pm-muted mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-pm-accent"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="block text-sm text-pm-muted mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-pm-accent"
                  placeholder="Your password"
                />
              </div>

              {error && <p className="text-sm text-pm-blocked">{error}</p>}
              {message && <p className="text-sm text-pm-complete">{message}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-pm-accent hover:bg-pm-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (!email) { setError("Enter your email first."); return; }
                  setError(null);
                  const supabase = createClient();
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
                  });
                  if (error) setError(error.message);
                  else setMessage("Password reset link sent to your email.");
                }}
                className="w-full text-center text-xs text-pm-muted hover:text-pm-accent transition-colors"
              >
                Forgot password?
              </button>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label className="block text-sm text-pm-muted mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-pm-accent"
                  placeholder="you@company.com"
                />
              </div>

              {error && <p className="text-sm text-pm-blocked">{error}</p>}
              {message && <p className="text-sm text-pm-complete">{message}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-pm-accent hover:bg-pm-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? "Sending..." : "Send Magic Link"}
              </button>

              <p className="text-xs text-pm-muted text-center">
                We&apos;ll email you a link to sign in — no password needed.
              </p>
            </form>
          )}
        </div>

        <p className="text-xs text-pm-muted text-center mt-4">
          Contact your administrator if you need an account.
        </p>
      </div>
    </div>
  );
}
