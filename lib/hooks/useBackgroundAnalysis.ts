'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SAMA_API_URL } from '@/lib/api';

/** Hard ceiling on how long we'll poll before giving up (10 min). */
const MAX_POLL_DURATION_MS = 10 * 60_000;
/** Hard cap on number of polls regardless of duration. */
const MAX_POLLS = 200;

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
  const pollCountRef = useRef(0);
  const pollStartRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollCountRef.current = 0;
    pollStartRef.current = 0;
  }, []);

  // Cleanup on unmount — without this, navigating away while analyzing
  // leaks the interval and keeps hitting the backend forever.
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setPhase('Starting analysis...');
    setProgress(5);
    setError(null);
    stopPolling();

    try {
      const res = await fetch(`${SAMA_API_URL}/api/${agent}/analyze`, {
        method: 'POST',
        headers: { 'X-Sama-Intent': 'user-action' },
      });

      let data: {
        started?: boolean;
        cycle_id?: string;
        phase?: string;
        progress?: number;
        error?: string;
        detail?: string;
      };
      try {
        data = await res.json();
      } catch {
        throw new Error(`Backend returned non-JSON response (status ${res.status})`);
      }

      if (!res.ok || data.error) {
        throw new Error(data.error || data.detail || `Analysis failed (status ${res.status})`);
      }

      // If backend returned full result (background=false or old backend), we're done
      if (!data.started && !data.cycle_id) {
        setProgress(100);
        setPhase('Analysis complete');
        setAnalyzing(false);
        onComplete?.();
        return data;
      }

      // Start polling for progress (always poll latest cycle, no cycle_id filter)
      setPhase(data.phase || 'Collecting data...');
      setProgress(data.progress || 10);

      pollCountRef.current = 0;
      pollStartRef.current = Date.now();

      pollRef.current = setInterval(async () => {
        // Hard safety bounds so a stuck "running" status can't poll forever.
        pollCountRef.current += 1;
        if (
          pollCountRef.current > MAX_POLLS ||
          Date.now() - pollStartRef.current > MAX_POLL_DURATION_MS
        ) {
          stopPolling();
          setAnalyzing(false);
          setError('Analysis polling timed out — stop has been forced to avoid runaway calls.');
          onError?.('Polling timeout');
          return;
        }
        try {
          const statusRes = await fetch(
            `${SAMA_API_URL}/api/${agent}/cycle-status`
          );
          if (!statusRes.ok) return;

          let status: CycleStatus;
          try {
            status = await statusRes.json();
          } catch {
            return; // non-JSON response, retry next interval
          }
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
    } catch (err) {
      setAnalyzing(false);
      setProgress(0);
      setPhase(null);
      const msg = err instanceof Error ? err.message : 'Error connecting to backend';
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
