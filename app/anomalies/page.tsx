"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, TrendingDown, Activity, Search } from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface Anomaly {
  metric: string;
  current_value: number;
  baseline_mean: number;
  deviation_percentage: number;
  direction: string;
  severity: string;
  detected_at: string;
}

export default function AnomaliesPage() {
  const [trafficAnomalies, setTrafficAnomalies] = useState<Anomaly[]>([]);
  const [conversionAnomalies, setConversionAnomalies] = useState<Anomaly[]>([]);
  const [spendAnomalies, setSpendAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);

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
    } finally {
      setLoading(false);
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

        <button className="rounded-md bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Investigate
        </button>
      </div>
    </div>
  );

  const allAnomalies = [...trafficAnomalies, ...conversionAnomalies, ...spendAnomalies];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Anomaly Detection</h1>
                <p className="text-sm text-slate-500">Automatic monitoring and alerts</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={detectAnomalies}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
              >
                <Search className="h-4 w-4" />
                {loading ? 'Scanning...' : 'Scan Now'}
              </button>
              <Link
                href="/"
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-500">Scanning for anomalies...</p>
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
