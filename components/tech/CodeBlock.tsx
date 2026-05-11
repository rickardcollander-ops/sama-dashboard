"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * Small reusable code-snippet block with a copy-to-clipboard button.
 *
 * Used by the Tech page to render before/after snippets on each suggestion
 * card and inside the preview modal. Defaults to a plain monospace <pre> —
 * we deliberately keep this dependency-free for now, but the `language`
 * prop is reserved so a future syntax-highlighter (Shiki, Prism) can hook
 * in without breaking call sites.
 */

export type CodeBlockLanguage =
  | "html"
  | "jsx"
  | "tsx"
  | "json"
  | "yaml"
  | "text"
  | "md"
  | "other";

interface Props {
  /** Source code to render. Empty / null renders nothing. */
  code?: string | null;
  /** Optional path/URL pill shown above the snippet. */
  label?: string;
  /** Reserved for a future syntax highlighter — currently unused. */
  language?: CodeBlockLanguage;
  /** Stable key for the copied-state indicator (allows multiple blocks on a page). */
  copyKey?: string;
  /** Hide the copy button entirely (useful inside print/PDF view). */
  hideCopy?: boolean;
  /** Caps height before scrolling kicks in. */
  maxHeightClass?: string;
  /** Tone of the surrounding container. */
  tone?: "neutral" | "danger" | "success";
}

const TONE_CLASSES: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "border-slate-200 bg-slate-50",
  danger: "border-rose-200 bg-rose-50/50",
  success: "border-emerald-200 bg-emerald-50/40",
};

export default function CodeBlock({
  code,
  label,
  language,
  copyKey,
  hideCopy,
  maxHeightClass = "max-h-72",
  tone = "neutral",
}: Props) {
  const [copied, setCopied] = useState(false);
  const trimmed = (code || "").trimEnd();
  if (!trimmed) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      // 1.5s feels right — long enough to register, short enough that
      // rapid copies of multiple blocks don't all read "copied" forever.
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard failures (insecure context, denied permission)
    }
  };

  return (
    <div className={`rounded-lg border ${TONE_CLASSES[tone]}`}>
      {(label || !hideCopy) && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 px-3 py-2">
          {label ? (
            <code
              className="truncate font-mono text-xs text-slate-600"
              title={label}
            >
              {label}
            </code>
          ) : (
            <span />
          )}
          {!hideCopy && (
            <button
              type="button"
              onClick={onCopy}
              data-copy-key={copyKey}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </button>
          )}
        </div>
      )}
      <pre
        className={`overflow-x-auto whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed text-slate-800 ${maxHeightClass}`}
        data-language={language || "text"}
      >
        {trimmed}
      </pre>
    </div>
  );
}
