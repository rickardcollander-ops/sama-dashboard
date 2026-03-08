"use client";

import { useState, useEffect } from "react";
import { Settings, Save, CheckCircle, AlertTriangle, RefreshCw, Key, Globe, Clock, Bell } from "lucide-react";
import { useToast } from "@/components/Toast";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface ConfigSection {
  label: string;
  icon: React.ElementType;
  fields: { key: string; label: string; desc: string; type: 'text' | 'number' | 'toggle' }[];
}

const SECTIONS: ConfigSection[] = [
  {
    label: 'API Connections',
    icon: Key,
    fields: [
      { key: 'google_ads_customer_id', label: 'Google Ads Customer ID', desc: 'Your Google Ads account customer ID', type: 'text' },
      { key: 'ga4_property_id', label: 'GA4 Property ID', desc: 'Google Analytics 4 property ID', type: 'text' },
      { key: 'site_url', label: 'Site URL', desc: 'Your website URL for SEO monitoring', type: 'text' },
    ],
  },
  {
    label: 'Scheduling',
    icon: Clock,
    fields: [
      { key: 'keyword_tracking_hour', label: 'Keyword Tracking Hour (UTC)', desc: 'Daily keyword rank check time', type: 'number' },
      { key: 'daily_workflow_hour', label: 'Daily Workflow Hour (UTC)', desc: 'Social + reviews workflow trigger time', type: 'number' },
    ],
  },
  {
    label: 'Thresholds',
    icon: AlertTriangle,
    fields: [
      { key: 'review_sla_hours', label: 'Review SLA (hours)', desc: 'Max hours before a review should be responded to', type: 'number' },
      { key: 'anomaly_sensitivity', label: 'Anomaly Sensitivity (sigma)', desc: 'Standard deviations before flagging as anomaly', type: 'number' },
      { key: 'budget_auto_threshold', label: 'Budget Auto-Apply %', desc: 'Max budget change % to auto-apply without approval', type: 'number' },
    ],
  },
  {
    label: 'Notifications',
    icon: Bell,
    fields: [
      { key: 'notify_anomalies', label: 'Anomaly Alerts', desc: 'Show alerts when anomalies are detected', type: 'toggle' },
      { key: 'notify_reviews', label: 'New Review Alerts', desc: 'Show alerts when new reviews appear', type: 'toggle' },
      { key: 'notify_actions', label: 'Pending Action Alerts', desc: 'Show alerts when agents create new actions', type: 'toggle' },
    ],
  },
];

export default function SettingsPage() {
  const toast = useToast();
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/config`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config || data || {});
      }
    } catch { /* use defaults */ }
    finally { setLoading(false); }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success('Settings saved');
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('Connection error');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Settings</h2>
            <p className="mt-1 text-slate-500 text-sm">Configure your SAMA platform preferences</p>
          </div>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading settings...</div>
        ) : (
          <div className="space-y-6">
            {SECTIONS.map(section => (
              <div key={section.label} className="rounded-xl border bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b px-6 py-4">
                  <section.icon className="h-5 w-5 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-900">{section.label}</h3>
                </div>
                <div className="px-6 py-4 space-y-5">
                  {section.fields.map(field => (
                    <div key={field.key} className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-slate-700">{field.label}</label>
                        <p className="text-xs text-slate-400">{field.desc}</p>
                      </div>
                      {field.type === 'toggle' ? (
                        <button
                          onClick={() => updateField(field.key, !config[field.key])}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config[field.key] ? 'bg-blue-600' : 'bg-slate-200'}`}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${config[field.key] ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      ) : (
                        <input
                          type={field.type}
                          value={config[field.key] ?? ''}
                          onChange={e => updateField(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                          className="w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
