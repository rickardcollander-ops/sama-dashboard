"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { useToast } from "@/components/Toast";

const _RAW_SAMA_API = process.env.NEXT_PUBLIC_SAMA_API_URL || '';
const SAMA_API_URL = /^https?:\/\//.test(_RAW_SAMA_API) ? _RAW_SAMA_API : '/api/sama';

interface Anomaly {
  metric: string;
  current_value: number;
  baseline_mean: number;
  deviation_percentage: number;
  direction: string;
  severity: string;
  detected_at: string;
}

interface Investigation {
  anomaly: Anomaly;
  loading: boolean;
  result: any | null;
  error: string | null;
}

export default function AnomaliesPage() {
  const toast = useToast();
  const [trafficAnomalies, setTrafficAnomalies] = useState<Anomaly[]>([]);
  const [conversionAnomalies, setConversionAnomalies] = useState<Anomaly[]>([]);
  const [spendAnomalies, setSpendAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [investigation, setInvestigation] = useState<Investigation | null>(null);

  useEffect(() => {
    detectAnomalies();
  }, []);

  const detectAnomalies = async () => {
    setLoading(true);
    try {
      // Traffic anomalies
      const trafficRes = await fetch(`${SAMA_API_URL}/api/analytics/anomalies/traffic?days=30`);
      if (trafficRes.ok) {
        const data = await trafficRes.json();
        setTrafficAnomalies(data.anomalies || []);
      }

      // Conversion anomalies
      const conversionRes = await fetch(`${SAMA_API_URL}/api/analytics/anomalies/conversions?days=30`);
      if (conversionRes.ok) {
        const data = await conversionRes.json();
        setConversionAnomalies(data.anomalies || []);
      }

      // Spend anomalies
      const spendRes = await fetch(`${SAMA_API_URL}/api/analytics/anomalies/spend?days=30`);
      if (spendRes.ok) {
        const data = await spendRes.json();
        setSpendAnomalies(data.anomalies || []);
      }
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      const msg = error instanceof Error ? error.message : 'Failed to detect anomalies';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const investigateAnomaly = async (anomaly: Anomaly) => {
    setInvestigation({ anomaly, loading: true, result: null, error: null });
    try {
      const response = await fetch(`${SAMA_API_URL}/api/analytics/anomalies/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(anomaly),
      });
      if (response.ok) {
        const data = await response.json();
        setInvestigation({ anomaly, loading: false, result: data, error: null });
      } else {
        setInvestigation({ anomaly, loading: false, result: null, error: `Analysis failed (${response.status})` });
      }
    } catch {
      setInvestigation({ anomaly, loading: false, result: null, error: 'Could not reach backend' });
      toast.error('Could not reach backend for analysis');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-300 bg-red-50';
      case 'warning': return 'border-orange-300 bg-orange-50';
      default: return 'border-blue-300 bg-blue-50';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      default: return <Activity className="h-5 w-5 text-blue-600" />;
    }
  };

  const renderAnomaly = (anomaly: Anomaly, idx: number) => (
    <div key={idx} className={`rounded-lg border p-4 ${getSeverityColor(anomaly.severity)}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {getSeverityIcon(anomaly.severity)}
          <div>
            <h3 className="font-semibold text-slate-900">
              {anomaly.metric.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h3>
            <p className="mt-1 text-sm text-slate-700">
              {anomaly.direction === 'increase' ? (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Increased by {anomaly.deviation_percentage.toFixed(1)}%
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-4 w-4" />
                  Decreased by {anomaly.deviation_percentage.toFixed(1)}%
                </span>
              )}
            </p>
            <div className="mt-2 flex gap-4 text-sm">
              <span className="text-slate-600">
                Current: <strong>{anomaly.current_value.toFixed(0)}</strong>
              </span>
              <span className="text-slate-600">
                Baseline: <strong>{anomaly.baseline_mean.toFixed(0)}</strong>
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Detected: {new Date(anomaly.detected_at).toLocaleString()}
            </p>
          </div>
        </div>

        <button
          onClick={() => investigateAnomaly(anomaly)}
          disabled={investigation?.loading && investigation.anomaly.metric === anomaly.metric}
          className="rounded-md bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {investigation?.loading && investigation.anomaly.metric === anomaly.metric ? 'Analyzing...' : 'Investigate'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Anomaly Detection</h2>
          <p className="mt-1 text-slate-500 text-sm">Automatically detects unusual changes in traffic, conversions, and ad spend. Uses statistical analysis (2+ standard deviations or 30%+ change) to flag metrics that need attention.</p>
        </div>
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-500">Scanning for anomalies...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-12 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-4 text-lg font-semibold text-red-900">Failed to Load Anomalies</h3>
            <p className="mt-2 text-sm text-red-600">{error}</p>
            <button onClick={detectAnomalies} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Retry</button>
          </div>
        ) : trafficAnomalies.length === 0 && conversionAnomalies.length === 0 && spendAnomalies.length === 0 ? (
          <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
            <Activity className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No Data Available</h3>
            <p className="mt-2 text-sm text-slate-500">Run analytics to detect anomalies, or check if backend is running.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Traffic Anomalies */}
            {trafficAnomalies.length > 0 && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Traffic Anomalies</h2>
                <div className="space-y-3">
                  {trafficAnomalies.map(renderAnomaly)}
                </div>
              </div>
            )}

            {/* Conversion Anomalies */}
            {conversionAnomalies.length > 0 && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Conversion Anomalies</h2>
                <div className="space-y-3">
                  {conversionAnomalies.map(renderAnomaly)}
                </div>
              </div>
            )}

            {/* Spend Anomalies */}
            {spendAnomalies.length > 0 && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Spend Anomalies</h2>
                <div className="space-y-3">
                  {spendAnomalies.map(renderAnomaly)}
                </div>
              </div>
            )}

            {/* Investigation Panel */}
            {investigation && !investigation.loading && (investigation.result || investigation.error) && (
              <div className={`rounded-lg border p-6 shadow-sm ${investigation.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-white'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Investigation: {investigation.anomaly.metric.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h2>
                  <button onClick={() => setInvestigation(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                </div>
                {investigation.error ? (
                  <p className="text-sm text-red-700">{investigation.error}</p>
                ) : (
                  <div className="space-y-3">
                    {investigation.result.root_cause && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Root Cause</p>
                        <p className="text-sm text-slate-700">{investigation.result.root_cause}</p>
                      </div>
                    )}
                    {investigation.result.recommendations && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Recommendations</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {(Array.isArray(investigation.result.recommendations) ? investigation.result.recommendations : [investigation.result.recommendations]).map((rec: string, i: number) => (
                            <li key={i} className="text-sm text-slate-700">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {investigation.result.contributing_factors && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Contributing Factors</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {(Array.isArray(investigation.result.contributing_factors) ? investigation.result.contributing_factors : [investigation.result.contributing_factors]).map((f: string, i: number) => (
                            <li key={i} className="text-sm text-slate-700">{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!investigation.result.root_cause && !investigation.result.recommendations && (
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 overflow-auto max-h-64">{JSON.stringify(investigation.result, null, 2)}</pre>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Detection Info */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
              <h3 className="mb-2 font-semibold text-blue-900">Detection Methodology</h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• Statistical: &gt;2 standard deviations from baseline</li>
                <li>• Percentage: &gt;30% change from 30-day average</li>
                <li>• Minimum 7 days of data required</li>
                <li>• Automatic alerts sent for critical anomalies</li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
