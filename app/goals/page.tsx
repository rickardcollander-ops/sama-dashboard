"use client";

import { useState, useEffect } from "react";
import { Target, Plus, TrendingUp, Clock, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useToast } from "@/components/Toast";

const _RAW_SAMA_API = process.env.NEXT_PUBLIC_SAMA_API_URL || '';
const SAMA_API_URL = /^https?:\/\//.test(_RAW_SAMA_API) ? _RAW_SAMA_API : '/api/sama';

interface Goal {
  id: string;
  goal_text: string;
  target_metric: string;
  target_value: number;
  baseline_value: number;
  current_value: number;
  deadline: string;
  owner_agent: string;
  status: string;
  progress_status?: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  on_track: { icon: TrendingUp, color: "text-green-600", bg: "bg-green-100", label: "On Track" },
  behind: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-100", label: "Behind" },
  achieved: { icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-100", label: "Achieved" },
  failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-100", label: "Failed" },
  unknown: { icon: Clock, color: "text-slate-500", bg: "bg-slate-100", label: "Unknown" },
};

export default function GoalsPage() {
  const toast = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    goal_text: "", target_metric: "", target_value: "", baseline_value: "",
    deadline: "", owner_agent: "seo",
  });

  useEffect(() => { fetchGoals(); }, []);

  const fetchGoals = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/goals`);
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || []);
      }
    } catch (error) {
      console.error('Failed to fetch goals:', error);
      toast.error('Failed to load goals');
    }
    finally { setLoading(false); }
  };

  const createGoal = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          target_value: parseFloat(form.target_value),
          baseline_value: parseFloat(form.baseline_value),
        }),
      });
      if (res.ok) {
        toast.success('Goal created');
        setShowCreate(false);
        setForm({ goal_text: "", target_metric: "", target_value: "", baseline_value: "", deadline: "", owner_agent: "seo" });
        fetchGoals();
      }
    } catch {
      toast.error('Failed to create goal');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Goals</h2>
            <p className="mt-1 text-slate-500 text-sm">Set measurable targets for your agents to work toward.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> New Goal
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12"><p className="text-slate-500">Loading goals...</p></div>
        ) : goals.length === 0 ? (
          <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
            <Target className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No goals yet</h3>
            <p className="mt-2 text-sm text-slate-500">Create your first goal to give your agents direction.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {goals.map(goal => {
              const progress = goal.target_value !== goal.baseline_value
                ? Math.min(100, Math.max(0, ((goal.current_value - goal.baseline_value) / (goal.target_value - goal.baseline_value)) * 100))
                : 0;
              const statusKey = goal.progress_status || "unknown";
              const sc = STATUS_CONFIG[statusKey] || STATUS_CONFIG.unknown;
              const StatusIcon = sc.icon;

              return (
                <div key={goal.id} className="rounded-lg border bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900">{goal.goal_text}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">{goal.owner_agent} agent · {goal.target_metric}</p>
                    </div>
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sc.bg} ${sc.color}`}>
                      <StatusIcon className="h-3 w-3" /> {sc.label}
                    </span>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{goal.current_value} / {goal.target_value}</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          statusKey === 'achieved' ? 'bg-blue-500' :
                          statusKey === 'behind' ? 'bg-amber-500' :
                          statusKey === 'failed' ? 'bg-red-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Baseline: {goal.baseline_value}</span>
                    <span>Deadline: {goal.deadline?.slice(0, 10)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Goal Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Create Goal</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Goal Description</label>
                  <input value={form.goal_text} onChange={e => setForm({...form, goal_text: e.target.value})}
                    placeholder="e.g. Increase organic traffic 50% by Q3"
                    className="w-full rounded-md border p-2.5 text-sm mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500">Metric</label>
                    <input value={form.target_metric} onChange={e => setForm({...form, target_metric: e.target.value})}
                      placeholder="e.g. monthly_clicks" className="w-full rounded-md border p-2.5 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Owner Agent</label>
                    <select value={form.owner_agent} onChange={e => setForm({...form, owner_agent: e.target.value})}
                      className="w-full rounded-md border p-2.5 text-sm mt-1">
                      {["seo", "content", "ads", "social", "reviews", "analytics"].map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500">Baseline</label>
                    <input type="number" value={form.baseline_value} onChange={e => setForm({...form, baseline_value: e.target.value})}
                      className="w-full rounded-md border p-2.5 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Target</label>
                    <input type="number" value={form.target_value} onChange={e => setForm({...form, target_value: e.target.value})}
                      className="w-full rounded-md border p-2.5 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Deadline</label>
                    <input type="date" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})}
                      className="w-full rounded-md border p-2.5 text-sm mt-1" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <button onClick={() => setShowCreate(false)} className="rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-600 hover:bg-slate-200">Cancel</button>
                <button onClick={createGoal} disabled={!form.goal_text || !form.target_value}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300">Create</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
