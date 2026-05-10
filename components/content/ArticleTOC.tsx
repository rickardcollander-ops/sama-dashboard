"use client";

import { useEffect, useRef, useState } from "react";

interface Item {
  id: string;
  label: string;
}

interface Props {
  items: Item[];
}

/**
 * In-body Table of Contents with scroll-spy. Highlights the section
 * currently in view and smooth-scrolls to the target on click.
 *
 * IntersectionObserver is set up against the live #section-id targets
 * the article renders — cheap to wire up, no scroll listeners.
 */
export default function ArticleTOC({ items }: Props) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  const observed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!items.length) return;
    // Top of the section is "active" once it's about 25% from the top of
    // the viewport — that matches the typical reading focus better than
    // strict 0-pixel intersections.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0, 1] }
    );
    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el && !observed.current.has(item.id)) {
        observer.observe(el);
        observed.current.add(item.id);
      }
    });
    return () => observer.disconnect();
  }, [items]);

  if (!items.length) return null;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    if (history.replaceState) history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav aria-label="Table of contents" className="my-10 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3">
        Table of Contents
      </div>
      <ol className="space-y-1 border-l border-slate-200">
        {items.map((item, i) => {
          const isActive = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => handleClick(e, item.id)}
                className={`group flex items-baseline gap-3 -ml-px border-l-2 pl-4 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "border-orange-500 text-orange-700 font-medium"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <span className="text-xs tabular-nums text-slate-400 group-hover:text-slate-500 w-6">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="leading-tight">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
