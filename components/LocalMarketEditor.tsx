"use client";

import { useState } from "react";
import { MapPin, Plus, X } from "lucide-react";
import type { TargetLocation } from "@/lib/types/location";

interface Props {
  locations: TargetLocation[];
  onChange: (locations: TargetLocation[]) => void;
}

const EMPTY = { city: "", country: "", region: "", address: "", postal_code: "", phone: "" };

export default function LocalMarketEditor({ locations, onChange }: Props) {
  const [form, setForm] = useState(EMPTY);

  const addLocation = () => {
    const city = form.city.trim();
    const country = form.country.trim().toUpperCase();
    if (!city || !country) return;
    const loc: TargetLocation = {
      city,
      country,
      ...(form.region.trim() ? { region: form.region.trim() } : {}),
      ...(form.address.trim() ? { address: form.address.trim() } : {}),
      ...(form.postal_code.trim() ? { postal_code: form.postal_code.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      is_primary: locations.length === 0,
    };
    onChange([...locations, loc]);
    setForm(EMPTY);
  };

  const removeLocation = (idx: number) => {
    const next = locations.filter((_, i) => i !== idx);
    if (next.length > 0 && !next.some((l) => l.is_primary)) {
      next[0] = { ...next[0], is_primary: true };
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {locations.length > 0 && (
        <div className="space-y-2">
          {locations.map((loc, i) => (
            <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                  <span className="text-sm font-medium text-slate-900">
                    {loc.city}{loc.region ? `, ${loc.region}` : ""} — {loc.country}
                  </span>
                  {loc.is_primary && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      primary
                    </span>
                  )}
                </div>
                {(loc.address || loc.phone) && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    {[loc.address, loc.postal_code, loc.phone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeLocation(i)}
                className="flex-shrink-0 rounded-full p-1 hover:bg-slate-200"
                aria-label="Remove location"
              >
                <X className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {locations.length === 0 ? "Add a location" : "Add another location"}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">City *</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              placeholder="e.g. Stockholm"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Country (ISO) *</label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm((p) => ({ ...p, country: e.target.value.toUpperCase().slice(0, 2) }))}
              placeholder="e.g. SE"
              maxLength={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Region <span className="text-slate-400">(optional)</span></label>
            <input
              type="text"
              value={form.region}
              onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}
              placeholder="e.g. Stockholms län"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Phone <span className="text-slate-400">(optional)</span></label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="e.g. +46 8 123 456"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Street address <span className="text-slate-400">(optional)</span></label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="e.g. Storgatan 1"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Postal code <span className="text-slate-400">(optional)</span></label>
            <input
              type="text"
              value={form.postal_code}
              onChange={(e) => setForm((p) => ({ ...p, postal_code: e.target.value }))}
              placeholder="e.g. 111 22"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={!form.city.trim() || !form.country.trim()}
          onClick={addLocation}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Add location
        </button>
      </div>

      {locations.length === 0 && (
        <p className="text-center text-xs text-slate-400">
          Skip if you serve customers nationally or globally
        </p>
      )}
    </div>
  );
}
