"use client";

import { useEffect, useState } from "react";

/**
 * Thin progress bar pinned to the top of the viewport that fills as the
 * reader scrolls through the article. Pure CSS transform — no layout
 * thrash on scroll.
 */
export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = () => {
      const scrollTop = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, Math.max(0, (scrollTop / max) * 100)) : 0);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-slate-100/80">
      <div
        className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
        style={{ width: `${progress}%`, transition: "width 120ms linear" }}
      />
    </div>
  );
}
