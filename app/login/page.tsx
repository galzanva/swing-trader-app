"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setIsLoading(false);
        return;
      }

      const callbackUrl = searchParams.get("callbackUrl") || "/";
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent mb-4">
            <span className="text-white font-bold text-lg">TJ</span>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">Trader Journey</h1>
          <p className="text-text-secondary text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-surface-1 rounded-xl p-6 border border-border">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-loss/10 border border-loss/20 text-loss text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-surface-2 border border-border text-text-primary placeholder-text-muted
                           focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all text-sm"
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-surface-2 border border-border text-text-primary placeholder-text-muted
                           focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all text-sm"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-text-muted text-xs mt-6">
          &copy; 2026 Trader Journey
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg flex items-center justify-center">
          <p className="text-text-secondary">Loading…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
