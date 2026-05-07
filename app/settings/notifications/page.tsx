"use client";

import { useEffect, useState } from "react";
import { Mail, Send, Eye, Check } from "lucide-react";
import { useToast } from "@/components/Toast";

type Preferences = {
  weekly_email_enabled: boolean;
  recipient_override: string | null;
};

const INITIAL: Preferences = {
  weekly_email_enabled: false,
  recipient_override: null,
};

export default function NotificationsSettingsPage() {
  const toast = useToast();

  const [prefs, setPrefs] = useState<Preferences>(INITIAL);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [overrideText, setOverrideText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/notifications");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setPrefs(data.preferences ?? INITIAL);
        setUserEmail(data.user_email ?? null);
        setOverrideText(data.preferences?.recipient_override ?? "");
      } catch (e) {
        toast.error("Kunde inte ladda inställningarna");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const save = async (next: Preferences) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setPrefs(next);
      toast.success("Inställningar sparade");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  };

  const toggleWeekly = (enabled: boolean) => {
    save({ ...prefs, weekly_email_enabled: enabled });
  };

  const saveOverride = () => {
    const trimmed = overrideText.trim();
    save({ ...prefs, recipient_override: trimmed || null });
  };

  const sendTest = async () => {
    setSendingTest(true);
    try {
      const res = await fetch("/api/email/test-weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_override: overrideText.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      if (data.sent) {
        toast.success(`Testmail skickat till ${data.recipient}`);
      } else if (data.skipped) {
        const reason =
          data.reason === "provider_not_configured"
            ? "Mailtjänsten är inte konfigurerad än"
            : data.reason === "no_recipient"
              ? "Hittade ingen mottagaradress"
              : "Hoppades över";
        toast.info(reason);
      } else {
        toast.error(data.error || "Kunde inte skicka");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte skicka");
    } finally {
      setSendingTest(false);
    }
  };

  const recipient = (overrideText.trim() || prefs.recipient_override || userEmail) ?? "—";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-slate-500">Laddar…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-slate-900">Notiser</h1>
          <p className="mt-1 text-sm text-slate-600">
            Bestäm hur ofta och var Sama hör av sig.
          </p>
        </header>

        {/* Weekly status email */}
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-base font-semibold text-slate-900">
                  Veckorapport via mail
                </h2>
                <ToggleSwitch
                  enabled={prefs.weekly_email_enabled}
                  disabled={saving}
                  onChange={toggleWeekly}
                />
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Måndagar 09:00 sammanfattar vi vad agenterna gjort senaste
                veckan och vad som väntar på ditt godkännande.
              </p>
            </div>
          </div>

          {prefs.weekly_email_enabled && (
            <div className="mt-6 space-y-5 border-t border-slate-100 pt-5">
              {/* Recipient */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Skicka till
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Lämna tomt för att använda din kontomail ({userEmail ?? "okänd"}).
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="email"
                    value={overrideText}
                    onChange={(e) => setOverrideText(e.target.value)}
                    placeholder={userEmail ?? "namn@exempel.se"}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <button
                    onClick={saveOverride}
                    disabled={saving || overrideText.trim() === (prefs.recipient_override ?? "")}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Spara
                  </button>
                </div>
              </div>

              {/* Test + preview actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={sendTest}
                  disabled={sendingTest}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {sendingTest ? "Skickar…" : `Skicka testmail till ${recipient}`}
                </button>
                <button
                  onClick={() => setShowPreview((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Eye className="h-4 w-4" />
                  {showPreview ? "Dölj förhandsvisning" : "Förhandsvisa"}
                </button>
              </div>

              {showPreview && (
                <div className="overflow-hidden rounded-md border border-slate-200">
                  <iframe
                    src="/api/email/preview-weekly"
                    title="Förhandsvisning av veckomail"
                    className="h-[640px] w-full bg-slate-100"
                  />
                </div>
              )}
            </div>
          )}
        </section>

        <p className="text-xs text-slate-500">
          Vi skickar bara mail när du själv slagit på det. Du kan stänga av när som helst.
        </p>
      </main>
    </div>
  );
}

// ── Toggle switch ────────────────────────────────────────────────────────────

function ToggleSwitch({
  enabled,
  disabled,
  onChange,
}: {
  enabled: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        enabled ? "bg-blue-600" : "bg-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
