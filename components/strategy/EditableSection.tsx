"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";

// Sprint 5 (S1) — single-field inline editor for strategy sections.
//
// Renders the current value as plain text (single-line or paragraph) until
// the user clicks the pencil. Then it swaps to an input/textarea, and a
// Spara/Avbryt pair. Save is async; while saving the controls disable.

type Multiline = "input" | "textarea";

interface Props {
  value: string;
  onSave: (next: string) => Promise<void>;
  /** Defaults to single-line `input`. Use `textarea` for paragraphs. */
  variant?: Multiline;
  placeholder?: string;
  className?: string;
  textClassName?: string;
  /** Aria/screen-reader label for the edit button. */
  label?: string;
}

export default function EditableSection({
  value,
  onSave,
  variant = "input",
  placeholder = "—",
  className = "",
  textClassName = "",
  label = "Redigera",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      // Autosize textarea on open
      if (variant === "textarea" && inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
      }
    }
  }, [editing, variant]);

  const start = () => {
    setDraft(value);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
    setError(null);
  };

  const save = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara");
    }
    setSaving(false);
  };

  if (!editing) {
    return (
      <div className={`group relative ${className}`}>
        <div className={`whitespace-pre-line ${textClassName}`}>
          {value?.trim() ? value : <span className="text-slate-400">{placeholder}</span>}
        </div>
        <button
          onClick={start}
          aria-label={label}
          title={label}
          className="absolute right-0 top-0 hidden rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 group-hover:inline-flex"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && variant === "input") {
      e.preventDefault();
      save();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {variant === "input" ? (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          disabled={saving}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
        />
      ) : (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          disabled={saving}
          rows={4}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
        />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Spara
        </button>
        <button
          onClick={cancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          <X className="h-3 w-3" />
          Avbryt
        </button>
        <p className="text-[10px] text-slate-400 ml-auto">
          {variant === "textarea" ? "⌘+Enter sparar · Esc avbryter" : "Enter sparar · Esc avbryter"}
        </p>
      </div>
    </div>
  );
}
