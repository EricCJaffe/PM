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
  const redirect = searchParams.get("redirect") || "/projects";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
        },
      });
      if (error) {
        // If user already exists, suggest signing in
        if (error.message.toLowerCase().includes("already") || error.message.toLowerCase().includes("exists")) {
          setError("An account with this email already exists. Try signing in instead.");
        } else {
          setError(error.message);
        }
      } else if (data.user && !data.session) {
        // User created but needs email confirmation
        setMessage("Check your email for a confirmation link.");
      } else if (data.session) {
        // Auto-confirmed (e.g. email confirmations disabled in Supabase)
        try { await fetch("/api/pm/auth/profile", { method: "POST" }); } catch {}
        router.push(redirect);
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        // Ensure profile exists — don't block login if this fails
        try { await fetch("/api/pm/auth/profile", { method: "POST" }); } catch {}
        router.push(redirect);
        router.refresh();
      }
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
          <div className="flex mb-6 border-b border-pm-border">
            <button
              onClick={() => { setMode("login"); setError(null); setMessage(null); }}
              className={`flex-1 pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                mode === "login" ? "border-pm-accent text-pm-accent" : "border-transparent text-pm-muted"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("signup"); setError(null); setMessage(null); }}
              className={`flex-1 pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                mode === "signup" ? "border-pm-accent text-pm-accent" : "border-transparent text-pm-muted"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-sm text-pm-muted mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-pm-accent"
                  placeholder="Your name"
                />
              </div>
            )}
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
                placeholder="Min 6 characters"
              />
            </div>

            {error && <p className="text-sm text-pm-blocked">{error}</p>}
            {message && <p className="text-sm text-pm-complete">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-pm-accent hover:bg-pm-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>

            {mode === "login" && (
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
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
