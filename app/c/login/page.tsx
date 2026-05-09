"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Mode = "login" | "signup" | "forgot";

export default function CustomerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const supabase = getSupabaseBrowser();

    try {
      if (mode === "signup") {
        if (password.length < 6) {
          setError("Password must be at least 6 characters");
          return;
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError(signUpError.message);
        } else {
          setMessage("Account created! You can now sign in.");
          setMode("login");
        }
      } else if (mode === "forgot") {
        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}/c/auth/reset-password`
            : undefined;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          { redirectTo }
        );
        if (resetError) {
          setError(resetError.message);
        } else {
          setMessage(
            "If the account exists, a reset link has been sent to the email."
          );
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(
            signInError.message === "Invalid login credentials"
              ? "Wrong email or password"
              : signInError.message
          );
        } else {
          router.push("/c/dashboard");
          router.refresh();
        }
      }
    } catch {
      setError("Could not connect");
    } finally {
      setLoading(false);
    }
  };

  const headline =
    mode === "login"
      ? "Sign in to your portal"
      : mode === "signup"
        ? "Create an account"
        : "Reset your password";

  const submitLabel = loading
    ? mode === "login"
      ? "Signing in…"
      : mode === "signup"
        ? "Creating account…"
        : "Sending email…"
    : mode === "login"
      ? "Sign in"
      : mode === "signup"
        ? "Create account"
        : "Send reset link";

  const submitDisabled =
    loading || !email || (mode !== "forgot" && !password);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-sm">
        <form
          onSubmit={handleSubmit}
          className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="rounded-full bg-blue-600/20 p-4 mb-4">
              <Lock className="h-8 w-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">SAMA</h1>
            <p className="text-slate-400 text-sm mt-1">{headline}</p>
          </div>

          <div className="relative mb-4">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {mode !== "forgot" && (
            <>
              <div className="relative mb-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-10 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {mode === "signup" ? (
                <p className="text-xs text-slate-500 mb-4 ml-1">
                  At least 6 characters
                </p>
              ) : (
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError("");
                      setMessage("");
                    }}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-red-400 text-sm text-center mb-4">{error}</p>
          )}

          {message && (
            <p className="text-green-400 text-sm text-center mb-4">{message}</p>
          )}

          <button
            type="submit"
            disabled={submitDisabled}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitLabel}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
              setMessage("");
            }}
            className="w-full mt-3 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {mode === "login"
              ? "No account? Create one"
              : mode === "signup"
                ? "Already have an account? Sign in"
                : "Back to sign in"}
          </button>
          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setMessage("");
              }}
              className="w-full mt-2 text-sm text-slate-500 hover:text-white"
            >
              Back to sign in
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
