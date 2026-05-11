"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, Phone } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * Login screen for the TM portal. Uses the same Supabase auth as the
 * customer portal, but lands the user at `/tm` instead of the
 * dashboard. Sign-up is disabled here — TM operators have to be
 * provisioned by an admin and added to TM_USER_EMAILS.
 */
export default function TmLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const supabase = getSupabaseBrowser();
    try {
      if (forgotMode) {
        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}/c/auth/reset-password`
            : undefined;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          { redirectTo },
        );
        if (resetError) setError(resetError.message);
        else setMessage("Om kontot finns har en återställningslänk skickats.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(
            signInError.message === "Invalid login credentials"
              ? "Fel e-post eller lösenord"
              : signInError.message,
          );
        } else {
          router.push("/tm");
          router.refresh();
        }
      }
    } catch {
      setError("Kunde inte ansluta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-sm">
        <form
          onSubmit={handleSubmit}
          className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="rounded-full bg-violet-600/20 p-4 mb-4">
              <Phone className="h-8 w-8 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">TM-portalen</h1>
            <p className="text-slate-400 text-sm mt-1">
              {forgotMode ? "Återställ ditt lösenord" : "Logga in för att se kampanjlistan"}
            </p>
          </div>

          <div className="relative mb-4">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-post"
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {!forgotMode && (
            <div className="relative mb-2">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Lösenord"
                className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-10 py-3 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}

          {!forgotMode && (
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setForgotMode(true);
                  setError("");
                  setMessage("");
                }}
                className="text-xs text-slate-400 hover:text-white"
              >
                Glömt lösenord?
              </button>
            </div>
          )}

          {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}
          {message && <p className="text-green-400 text-sm text-center mb-4">{message}</p>}

          <button
            type="submit"
            disabled={loading || !email || (!forgotMode && !password)}
            className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? forgotMode
                ? "Skickar e-post…"
                : "Loggar in…"
              : forgotMode
                ? "Skicka återställningslänk"
                : "Logga in"}
          </button>

          {forgotMode && (
            <button
              type="button"
              onClick={() => {
                setForgotMode(false);
                setError("");
                setMessage("");
              }}
              className="w-full mt-3 text-sm text-slate-400 hover:text-white"
            >
              Tillbaka till inloggning
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
