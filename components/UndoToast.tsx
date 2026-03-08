"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { Undo2, X } from "lucide-react";

interface ExecutedAction {
  id: string;
  title: string;
  agent: string;
  payload: any;
  timestamp: number;
}

interface UndoContextType {
  pushAction: (action: Omit<ExecutedAction, 'timestamp'>) => void;
}

const UndoContext = createContext<UndoContextType>({ pushAction: () => {} });

export function useUndo() {
  return useContext(UndoContext);
}

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<ExecutedAction[]>([]);
  const [showToast, setShowToast] = useState<ExecutedAction | null>(null);

  const pushAction = useCallback((action: Omit<ExecutedAction, 'timestamp'>) => {
    const full = { ...action, timestamp: Date.now() };
    setHistory(prev => [full, ...prev].slice(0, 20));
    setShowToast(full);
  }, []);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleUndo = async (action: ExecutedAction) => {
    try {
      await fetch(`${SAMA_API_URL}/api/${action.agent}/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: action.id, payload: action.payload }),
      });
      setHistory(prev => prev.filter(a => a.id !== action.id));
    } catch {
      // Best-effort undo
    }
    setShowToast(null);
  };

  return (
    <UndoContext.Provider value={{ pushAction }}>
      {children}

      {/* Undo toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border bg-slate-900 px-4 py-3 text-white shadow-2xl animate-slide-up">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Executed: {showToast.title}</p>
            <p className="text-xs text-slate-400">Click undo to revert this action</p>
          </div>
          <button
            onClick={() => handleUndo(showToast)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
          >
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </button>
          <button onClick={() => setShowToast(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </UndoContext.Provider>
  );
}
