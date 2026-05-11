"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Loader2, Palette, Save } from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

function normalizeHex(v: string): string {
  const trimmed = v.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export default function BrandingPage() {
  const { user } = useUser();
  const { activeSite, reloadSites } = useSite();
  const { t } = useLanguage();

  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const raw = activeSite?.settings as Record<string, unknown> | undefined;
    if (raw) {
      setLogoUrl(typeof raw.publisher_logo_url === "string" ? raw.publisher_logo_url : "");
      setPrimaryColor(typeof raw.primary_color === "string" ? raw.primary_color : "");
      setSecondaryColor(typeof raw.secondary_color === "string" ? raw.secondary_color : "");
    }
    setLoading(false);
  }, [user, activeSite]);

  const save = async () => {
    if (!user || !activeSite) return;
    if (primaryColor && !HEX_RE.test(primaryColor)) {
      setError(t.branding.invalidColor);
      return;
    }
    if (secondaryColor && !HEX_RE.test(secondaryColor)) {
      setError(t.branding.invalidColor);
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const nextSettings = {
        ...(activeSite.settings || {}),
        publisher_logo_url: logoUrl.trim(),
        primary_color: primaryColor ? normalizeHex(primaryColor) : "",
        secondary_color: secondaryColor ? normalizeHex(secondaryColor) : "",
      };
      const { error: upsertError } = await getSupabaseBrowser()
        .from("user_sites")
        .upsert(
          {
            id: activeSite.id,
            user_id: activeSite.user_id,
            site_name: activeSite.site_name,
            settings: nextSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
      if (upsertError) throw upsertError;
      await reloadSites();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className="lg:pl-56">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
                <Palette className="h-7 w-7 text-slate-400" />
                {t.branding.title}
              </h1>
              <p className="mt-1 text-sm text-slate-500">{t.branding.subtitle}</p>
            </div>
            <button
              onClick={save}
              disabled={saving || loading || !activeSite}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 shadow-sm transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? t.common.saving : t.common.save}
            </button>
          </div>

          {saved && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              <CheckCircle className="h-4 w-4" /> {t.branding.saved}
            </div>
          )}
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-6">
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">{t.branding.logoTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">{t.branding.logoDesc}</p>
                <div className="mt-4 flex items-start gap-4">
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt={t.branding.logoPreviewAlt}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">
                        {t.branding.logoPreviewEmpty}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {t.branding.logoUrlLabel}
                    </label>
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://yourbrand.com/logo.png"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-slate-400">{t.branding.logoUrlHint}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">{t.branding.colorsTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">{t.branding.colorsDesc}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <ColorField
                    label={t.branding.primaryColor}
                    value={primaryColor}
                    onChange={setPrimaryColor}
                  />
                  <ColorField
                    label={t.branding.secondaryColor}
                    value={secondaryColor}
                    onChange={setSecondaryColor}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const display = value && HEX_RE.test(value) ? normalizeHex(value) : "#e2e8f0";
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <label
          className="relative h-10 w-10 flex-shrink-0 cursor-pointer rounded-lg border border-slate-200"
          style={{ backgroundColor: display }}
        >
          <input
            type="color"
            value={display}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <div className="flex flex-1 items-center rounded-lg border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
          <span className="px-3 text-sm text-slate-400">#</span>
          <input
            type="text"
            value={value.replace(/^#/, "")}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            placeholder="4F46E5"
            maxLength={6}
            className="w-full bg-transparent py-2 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
