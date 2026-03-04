'use client';

import { useState, useRef, useCallback } from 'react';

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface CycleStatus {
  cycle_id: string;
  status: string;
  phase: string;
  progress: number;
  done: boolean;
  error: string | null;
}

interface UseBackgroundAnalysisOptions {
  /** e.g. "seo", "content", "ads", "reviews", "social" */
  agent: string;
  /** Called when analysis completes successfully */
  onComplete?: () => void;
  /** Called on failure */
  onError?: (error: string) => void;
  /** Polling interval in ms (default 2000) */
  pollInterval?: number;
}

export function useBackgroundAnalysis({
  agent,
  onComplete,
  onError,
  pollInterval = 2000,
}: UseBackgroundAnalysisOptions) {
  const [analyzing, setAnalyzing] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setPhase('Starting analysis...');
    setProgress(5);
    setError(null);
    stopPolling();

    try {
      const res = await fetch(`${SAMA_API_URL}/api/${agent}/analyze`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || data.detail || 'Failed to start analysis');
      }

      // If backend returned full result (background=false or old backend), we're done
      if (!data.started && !data.cycle_id) {
        setProgress(100);
        setPhase('Analysis complete');
        setAnalyzing(false);
        onComplete?.();
        return data;
      }

      // Start polling for progress
      const cycleId = data.cycle_id;
      setPhase(data.status === 'observing' ? 'Collecting data...' : data.phase || 'Starting...');
      setProgress(15);

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `${SAMA_API_URL}/api/${agent}/cycle-status${cycleId ? `?cycle_id=${cycleId}` : ''}`
          );
          if (!statusRes.ok) return;

          const status: CycleStatus = await statusRes.json();
          setPhase(status.phase);
          setProgress(status.progress);

          if (status.done) {
            stopPolling();
            setAnalyzing(false);

            if (status.error) {
              setError(status.error);
              onError?.(status.error);
            } else {
              onComplete?.();
            }
          }
        } catch {
          // Polling failure is not fatal — will retry next interval
        }
      }, pollInterval);

      return data;
    } catch (err: any) {
      setAnalyzing(false);
      setProgress(0);
      setPhase(null);
      const msg = err.message || 'Error connecting to backend';
      setError(msg);
      onError?.(msg);
      return null;
    }
  }, [agent, onComplete, onError, pollInterval, stopPolling]);

  return {
    startAnalysis,
    analyzing,
    phase,
    progress,
    error,
    stopPolling,
  };
}
