"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { X, CheckCircle, XCircle, Info } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  exiting: boolean;
}

interface ToastAPI {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastAPI | null>(null);

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 4000;
const EXIT_ANIMATION_MS = 300;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    // Start exit animation
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    // Remove from DOM after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_ANIMATION_MS);
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, message, exiting: false }]);

      const timer = setTimeout(() => {
        removeToast(id);
        timersRef.current.delete(id);
      }, AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  const handleClose = useCallback(
    (id: string) => {
      const timer = timersRef.current.get(id);
      if (timer) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
      removeToast(id);
    },
    [removeToast]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const api = useCallback(
    (): ToastAPI => ({
      success: (msg: string) => addToast("success", msg),
      error: (msg: string) => addToast("error", msg),
      info: (msg: string) => addToast("info", msg),
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={api()}>
      {children}

      {/* Toast container — top-right, stacked */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[9999] flex flex-col gap-3"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={handleClose} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Individual Toast ─────────────────────────────────────────────────────────

const typeStyles: Record<
  ToastType,
  { bg: string; border: string; icon: React.ReactNode }
> = {
  success: {
    bg: "bg-green-50",
    border: "border-green-300",
    icon: <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />,
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-300",
    icon: <XCircle className="h-5 w-5 flex-shrink-0 text-red-600" />,
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-300",
    icon: <Info className="h-5 w-5 flex-shrink-0 text-blue-600" />,
  },
};

function ToastCard({
  toast,
  onClose,
}: {
  toast: ToastItem;
  onClose: (id: string) => void;
}) {
  const { bg, border, icon } = typeStyles[toast.type];

  return (
    <div
      className={`pointer-events-auto flex w-80 items-start gap-3 rounded-lg border ${border} ${bg} p-4 shadow-lg transition-all duration-300 ${
        toast.exiting
          ? "translate-x-full opacity-0"
          : "translate-x-0 opacity-100"
      }`}
      style={{
        animation: toast.exiting ? undefined : "slideInRight 0.3s ease-out",
      }}
    >
      {icon}
      <p className="flex-1 text-sm font-medium text-slate-800">
        {toast.message}
      </p>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
