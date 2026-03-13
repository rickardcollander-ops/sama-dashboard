"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users, Filter, Search, ChevronDown, ChevronUp, X,
  ExternalLink, Flame, Thermometer, Snowflake,
  Mail, MessageSquare, Calendar, Building2, Briefcase,
  CheckCircle2, XCircle, Clock, ArrowUpDown, RefreshCw,
  Linkedin, Globe, Tag, StickyNote, Zap
} from "lucide-react";
import { useToast } from "@/components/Toast";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "https://web-production-5324a.up.railway.app";

// ── Types ──────────────────────────────────────────────────────────

interface Prospect {
  _id: string;
  name: string;
  title?: string;
  company?: string;
  linkedinUrl?: string;
  email?: string;
  status: string;
  matchScore?: number;
  leadScore?: number;
  seniorityLevel?: string;
  industry?: string;
  location?: string;
  companySize?: number;
  discoveryReason?: string;
  tags?: string[];
  notes?: string;
  lastContactedAt?: number;
  lastInteractionAt?: number;
  firstReplyAt?: number;
  connectionRequestSentAt?: number;
  connectionAcceptedAt?: number;
  firstMessageSentAt?: number;
  responseRate?: number;
  createdAt?: number;
  updatedAt?: number;
  approvedAt?: number;
  rejectedAt?: number;
  rejectionReason?: string;
  accountId?: string;
}

interface ProspectDetail extends Prospect {
  sequenceEnrollments?: SequenceEnrollment[];
  outreachMessages?: OutreachMessage[];
  emailMessages?: EmailMessage[];
  inboundMessages?: InboundMessage[];
  account?: Account | null;
}

interface SequenceEnrollment {
  _id: string;
  sequenceId: string;
  sequenceName: string;
  currentStep: number;
  status: string;
  enrolledAt?: number;
  completedAt?: number;
  lastStepAt?: number;
}

interface OutreachMessage {
  _id: string;
  type: string;
  content: string;
  status: string;
  sentAt?: number;
  repliedAt?: number;
  responseContent?: string;
  createdAt?: number;
}

interface EmailMessage {
  _id: string;
  subject?: string;
  body?: string;
  status: string;
  sentAt?: number;
  openedAt?: number;
  clickedAt?: number;
  repliedAt?: number;
  createdAt?: number;
}

interface InboundMessage {
  _id: string;
  content: string;
  sentiment?: string;
  receivedAt?: number;
  createdAt?: number;
}

interface Account {
  _id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  website?: string;
}

interface Stats {
  prospects?: {
    total: number;
    byStatus: Record<string, number>;
  };
  outreach?: {
    total: number;
    sent: number;
  };
}

// ── Constants ──────────────────────────────────────────────────────

const ACTIVE_STATUSES = ["approved", "new", "researched", "contacted", "replied", "demo_proposed", "demo_booked"];
const PIPELINE_STATUSES = ["new", "researched", "contacted", "replied", "demo_proposed", "demo_booked", "won", "lost"];

const STATUS_COLORS: Record<string, string> = {
  pending_review: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  new: "bg-blue-100 text-blue-800",
  researched: "bg-indigo-100 text-indigo-800",
  contacted: "bg-purple-100 text-purple-800",
  replied: "bg-green-100 text-green-800",
  demo_proposed: "bg-emerald-100 text-emerald-800",
  demo_booked: "bg-teal-100 text-teal-800",
  won: "bg-green-200 text-green-900",
  lost: "bg-red-100 text-red-800",
  paused: "bg-slate-100 text-slate-600",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  new: "New",
  researched: "Researched",
  contacted: "Contacted",
  replied: "Replied",
  demo_proposed: "Demo Proposed",
  demo_booked: "Demo Booked",
  won: "Won",
  lost: "Lost",
  paused: "Paused",
  rejected: "Rejected",
};

// ── Heat Score Calculation ─────────────────────────────────────────

function calculateHeatScore(p: Prospect): number {
  let score = 0;
  // Base from matchScore (0-100) and leadScore (0-100)
  if (p.matchScore) score += p.matchScore * 0.3;
  if (p.leadScore) score += p.leadScore * 0.3;
  // Activity signals
  if (p.firstReplyAt) score += 20;
  if (p.lastInteractionAt) {
    const daysSince = (Date.now() - p.lastInteractionAt) / (1000 * 60 * 60 * 24);
    if (daysSince < 1) score += 15;
    else if (daysSince < 3) score += 10;
    else if (daysSince < 7) score += 5;
  }
  if (p.connectionAcceptedAt) score += 5;
  return Math.min(100, Math.round(score));
}

function heatColor(score: number): { bg: string; text: string; icon: React.ElementType } {
  if (score >= 70) return { bg: "bg-red-50 border-red-200", text: "text-red-700", icon: Flame };
  if (score >= 40) return { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: Thermometer };
  return { bg: "bg-blue-50 border-blue-200", text: "text-blue-600", icon: Snowflake };
}

// ── Helpers ────────────────────────────────────────────────────────

function timeAgo(ts?: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatDate(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Component ──────────────────────────────────────────────────────

export default function ProspectCommandCenter() {
  const toast = useToast();

  // Data state
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [seniorityFilter, setSeniorityFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<string>("heat");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProspectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Data Fetching ──────────────────────────────────────────────

  const fetchProspects = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [prospectsRes, statsRes] = await Promise.all([
        fetch(`${SAMA_API_URL}/api/gtm/pipeline/prospects`, { signal: AbortSignal.timeout(15000) }),
        fetch(`${SAMA_API_URL}/api/gtm/pipeline/stats`, { signal: AbortSignal.timeout(10000) }),
      ]);
      if (prospectsRes.ok) {
        const data = await prospectsRes.json();
        setProspects(data.prospects || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats?.data || data.stats || null);
      }
    } catch {
      if (!showRefresh) toast.error("Failed to load prospects");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/gtm/pipeline/prospects/${id}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        setDetail(data.prospect || null);
      }
    } catch {
      toast.error("Failed to load prospect details");
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  // ── Actions ────────────────────────────────────────────────────

  const updateStatus = useCallback(async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/gtm/pipeline/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Status updated to ${STATUS_LABELS[newStatus] || newStatus}`);
        setProspects((prev) => prev.map((p) => p._id === id ? { ...p, status: newStatus } : p));
        if (detail && detail._id === id) setDetail({ ...detail, status: newStatus });
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    }
  }, [toast, detail]);

  const bulkApprove = useCallback(async () => {
    const pending = prospects.filter((p) => p.status === "pending_review" && selectedIds.has(p._id));
    let success = 0;
    for (const p of pending) {
      try {
        const res = await fetch(`${SAMA_API_URL}/api/gtm/pipeline/prospects/${p._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "new" }),
        });
        if (res.ok) success++;
      } catch { /* continue */ }
    }
    if (success > 0) {
      toast.success(`Approved ${success} prospects`);
      setSelectedIds(new Set());
      fetchProspects(true);
    }
  }, [prospects, selectedIds, toast, fetchProspects]);

  const bulkReject = useCallback(async () => {
    const pending = prospects.filter((p) => p.status === "pending_review" && selectedIds.has(p._id));
    let success = 0;
    for (const p of pending) {
      try {
        const res = await fetch(`${SAMA_API_URL}/api/gtm/pipeline/prospects/${p._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "rejected" }),
        });
        if (res.ok) success++;
      } catch { /* continue */ }
    }
    if (success > 0) {
      toast.success(`Rejected ${success} prospects`);
      setSelectedIds(new Set());
      fetchProspects(true);
    }
  }, [prospects, selectedIds, toast, fetchProspects]);

  // ── Derived Data ───────────────────────────────────────────────

  const pendingProspects = useMemo(() =>
    prospects.filter((p) => p.status === "pending_review"),
  [prospects]);

  const activeProspects = useMemo(() =>
    prospects.filter((p) => ACTIVE_STATUSES.includes(p.status)),
  [prospects]);

  const uniqueIndustries = useMemo(() =>
    [...new Set(prospects.map((p) => p.industry).filter(Boolean))] as string[],
  [prospects]);

  const uniqueCompanies = useMemo(() =>
    [...new Set(prospects.map((p) => p.company).filter(Boolean))] as string[],
  [prospects]);

  const prospectsWithHeat = useMemo(() =>
    prospects.map((p) => ({ ...p, heatScore: calculateHeatScore(p) })),
  [prospects]);

  // Filter & sort
  const filteredProspects = useMemo(() => {
    let list = prospectsWithHeat.filter((p) => p.status !== "pending_review" && p.status !== "rejected");

    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (seniorityFilter !== "all") list = list.filter((p) => p.seniorityLevel === seniorityFilter);
    if (industryFilter !== "all") list = list.filter((p) => p.industry === industryFilter);
    if (companyFilter !== "all") list = list.filter((p) => p.company === companyFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.title?.toLowerCase().includes(q) ||
        p.company?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "heat": cmp = a.heatScore - b.heatScore; break;
        case "name": cmp = (a.name || "").localeCompare(b.name || ""); break;
        case "status": cmp = PIPELINE_STATUSES.indexOf(a.status) - PIPELINE_STATUSES.indexOf(b.status); break;
        case "company": cmp = (a.company || "").localeCompare(b.company || ""); break;
        case "lastInteraction": cmp = (a.lastInteractionAt || 0) - (b.lastInteractionAt || 0); break;
        default: cmp = a.heatScore - b.heatScore;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return list;
  }, [prospectsWithHeat, statusFilter, seniorityFilter, industryFilter, companyFilter, searchQuery, sortBy, sortDir]);

  // ── KPIs ───────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const byStatus = stats?.prospects?.byStatus || {};
    return {
      active: activeProspects.length,
      contacted: (byStatus.contacted || 0),
      replied: (byStatus.replied || 0),
      demos: (byStatus.demo_proposed || 0) + (byStatus.demo_booked || 0),
      pending: pendingProspects.length,
    };
  }, [stats, activeProspects, pendingProspects]);

  // ── Sort Handler ───────────────────────────────────────────────

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: string }) => (
    sortBy === col
      ? (sortDir === "desc" ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />)
      : <ArrowUpDown className="h-3 w-3 text-slate-300" />
  );

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500">Loading prospects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Prospect Command Center</h1>
            <p className="text-sm text-slate-500 mt-1">
              {prospects.length} total prospects &middot; {activeProspects.length} active
            </p>
          </div>
          <button
            onClick={() => fetchProspects(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Active", value: kpis.active, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Contacted", value: kpis.contacted, icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Replied", value: kpis.replied, icon: Mail, color: "text-green-600", bg: "bg-green-50" },
            { label: "Demos", value: kpis.demos, icon: Calendar, color: "text-teal-600", bg: "bg-teal-50" },
            { label: "Pending Review", value: kpis.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className={`rounded-lg p-1.5 ${kpi.bg}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* ── Pending Review Section ──────────────────────────────── */}
        {pendingProspects.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Pending Review ({pendingProspects.length})
                </h2>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={bulkApprove}
                    className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve ({selectedIds.size})
                  </button>
                  <button
                    onClick={bulkReject}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject ({selectedIds.size})
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {pendingProspects.map((p) => (
                <div
                  key={p._id}
                  className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white p-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p._id)}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      e.target.checked ? next.add(p._id) : next.delete(p._id);
                      setSelectedIds(next);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 truncate">{p.name}</span>
                      {p.matchScore != null && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          {p.matchScore}% match
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {p.title}{p.title && p.company ? " · " : ""}{p.company}
                    </p>
                    {p.discoveryReason && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{p.discoveryReason}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => updateStatus(p._id, "new")}
                      className="rounded-lg bg-green-50 p-2 text-green-700 hover:bg-green-100"
                      title="Approve"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => updateStatus(p._id, "rejected")}
                      className="rounded-lg bg-red-50 p-2 text-red-700 hover:bg-red-100"
                      title="Reject"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setSelectedId(p._id); fetchDetail(p._id); }}
                      className="rounded-lg bg-slate-50 p-2 text-slate-500 hover:bg-slate-100"
                      title="View details"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Filters & Search ────────────────────────────────────── */}
        <div className="mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, title, company, or email..."
                className="w-full rounded-lg border bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                showFilters ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
              {(statusFilter !== "all" || seniorityFilter !== "all" || industryFilter !== "all" || companyFilter !== "all") && (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] text-white font-bold">
                  {[statusFilter, seniorityFilter, industryFilter, companyFilter].filter((f) => f !== "all").length}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-3 rounded-lg border bg-white p-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                <option value="all">All statuses</option>
                {PIPELINE_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                ))}
              </select>
              <select
                value={seniorityFilter}
                onChange={(e) => setSeniorityFilter(e.target.value)}
                className="rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                <option value="all">All seniority</option>
                {["IC", "Manager", "Director", "VP", "C-Suite"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                className="rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                <option value="all">All industries</option>
                {uniqueIndustries.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                <option value="all">All companies</option>
                {uniqueCompanies.sort().map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setSeniorityFilter("all");
                  setIndustryFilter("all");
                  setCompanyFilter("all");
                }}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* ── Prospect Table ──────────────────────────────────────── */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-4 py-3">
                    <button onClick={() => handleSort("name")} className="flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900">
                      Name <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 hidden sm:table-cell">
                    <button onClick={() => handleSort("company")} className="flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900">
                      Company <SortIcon col="company" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button onClick={() => handleSort("status")} className="flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900">
                      Status <SortIcon col="status" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button onClick={() => handleSort("heat")} className="flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900">
                      Heat <SortIcon col="heat" />
                    </button>
                  </th>
                  <th className="px-4 py-3 hidden md:table-cell">
                    <button onClick={() => handleSort("lastInteraction")} className="flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900">
                      Last Activity <SortIcon col="lastInteraction" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProspects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      No prospects match your filters
                    </td>
                  </tr>
                ) : (
                  filteredProspects.map((p) => {
                    const heat = heatColor(p.heatScore);
                    const HeatIcon = heat.icon;
                    return (
                      <tr
                        key={p._id}
                        onClick={() => { setSelectedId(p._id); fetchDetail(p._id); }}
                        className={`border-b cursor-pointer transition-colors hover:bg-slate-50 ${
                          selectedId === p._id ? "bg-blue-50/50" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[200px]">{p.title || "—"}</div>
                          <div className="text-xs text-slate-400 sm:hidden">{p.company || "—"}</div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="text-slate-700">{p.company || "—"}</div>
                          {p.seniorityLevel && (
                            <div className="text-xs text-slate-400">{p.seniorityLevel}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[p.status] || "bg-slate-100 text-slate-600"}`}>
                            {STATUS_LABELS[p.status] || p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 ${heat.bg}`}>
                            <HeatIcon className={`h-3.5 w-3.5 ${heat.text}`} />
                            <span className={`text-xs font-bold ${heat.text}`}>{p.heatScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-500">
                          {timeAgo(p.lastInteractionAt || p.lastContactedAt || p.updatedAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t bg-slate-50 px-4 py-2 text-xs text-slate-500">
            Showing {filteredProspects.length} of {prospects.filter((p) => p.status !== "pending_review" && p.status !== "rejected").length} prospects
          </div>
        </div>
      </main>

      {/* ── Detail Slide-out Panel ──────────────────────────────── */}
      {selectedId && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setSelectedId(null)} />
          <div className="fixed top-0 right-0 bottom-0 z-40 w-full sm:w-[480px] bg-white border-l shadow-xl overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900 truncate">
                {detail?.name || "Loading..."}
              </h2>
              <button
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />
              </div>
            ) : detail ? (
              <div className="p-5 space-y-6">
                {/* Basic Info */}
                <div className="space-y-2">
                  {detail.title && (
                    <div className="flex items-start gap-2">
                      <Briefcase className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{detail.title}</span>
                    </div>
                  )}
                  {detail.company && (
                    <div className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{detail.company}</span>
                    </div>
                  )}
                  {detail.email && (
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <a href={`mailto:${detail.email}`} className="text-sm text-blue-600 hover:underline">{detail.email}</a>
                    </div>
                  )}
                  {detail.location && (
                    <div className="flex items-start gap-2">
                      <Globe className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-500">{detail.location}</span>
                    </div>
                  )}
                  {detail.seniorityLevel && (
                    <div className="text-xs text-slate-500">Seniority: {detail.seniorityLevel}</div>
                  )}
                  {detail.industry && (
                    <div className="text-xs text-slate-500">Industry: {detail.industry}</div>
                  )}
                </div>

                {/* Quick Links */}
                <div className="flex gap-2">
                  {detail.linkedinUrl && (
                    <a
                      href={detail.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      <Linkedin className="h-3.5 w-3.5" /> LinkedIn Profile
                    </a>
                  )}
                </div>

                {/* Status Control */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                  <select
                    value={detail.status}
                    onChange={(e) => updateStatus(detail._id, e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm font-medium ${STATUS_COLORS[detail.status] || "bg-slate-50"}`}
                  >
                    {[...PIPELINE_STATUSES, "paused"].map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                    ))}
                  </select>
                </div>

                {/* Heat Score */}
                {(() => {
                  const score = calculateHeatScore(detail);
                  const heat = heatColor(score);
                  const HeatIcon = heat.icon;
                  return (
                    <div className={`flex items-center gap-3 rounded-lg border p-3 ${heat.bg}`}>
                      <HeatIcon className={`h-5 w-5 ${heat.text}`} />
                      <div>
                        <div className={`text-lg font-bold ${heat.text}`}>{score}</div>
                        <div className="text-xs text-slate-500">Heat Score</div>
                      </div>
                      <div className="ml-auto text-xs text-slate-500 text-right">
                        {detail.matchScore != null && <div>Match: {detail.matchScore}%</div>}
                        {detail.leadScore != null && <div>Lead: {detail.leadScore}</div>}
                      </div>
                    </div>
                  );
                })()}

                {/* Account Info */}
                {detail.account && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Account</label>
                    <div className="rounded-lg border bg-slate-50 p-3 space-y-1">
                      <div className="font-medium text-slate-900">{detail.account.name}</div>
                      {detail.account.industry && <div className="text-xs text-slate-500">Industry: {detail.account.industry}</div>}
                      {detail.account.size && <div className="text-xs text-slate-500">Size: {detail.account.size}</div>}
                      {detail.account.domain && <div className="text-xs text-slate-500">Domain: {detail.account.domain}</div>}
                    </div>
                  </div>
                )}

                {/* Tags & Notes */}
                {detail.tags && detail.tags.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tags</label>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                          <Tag className="h-3 w-3" /> {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {detail.notes && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
                    <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                      {detail.notes}
                    </div>
                  </div>
                )}

                {detail.discoveryReason && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Discovery Reason</label>
                    <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-600">
                      {detail.discoveryReason}
                    </div>
                  </div>
                )}

                {/* Sequence Enrollments */}
                {detail.sequenceEnrollments && detail.sequenceEnrollments.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Sequences ({detail.sequenceEnrollments.length})
                    </label>
                    <div className="space-y-2">
                      {detail.sequenceEnrollments.map((se) => (
                        <div key={se._id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900 text-sm">{se.sequenceName}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              se.status === "active" ? "bg-green-100 text-green-700" :
                              se.status === "completed" ? "bg-blue-100 text-blue-700" :
                              se.status === "replied" ? "bg-emerald-100 text-emerald-700" :
                              "bg-slate-100 text-slate-600"
                            }`}>
                              {se.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Step {se.currentStep} &middot; Enrolled {formatDate(se.enrolledAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message History */}
                {(() => {
                  const allMessages: { type: string; content: string; time: number; direction: "out" | "in"; status?: string; channel: string }[] = [];

                  detail.outreachMessages?.forEach((m) => {
                    allMessages.push({
                      type: m.type,
                      content: m.content,
                      time: m.sentAt || m.createdAt || 0,
                      direction: "out",
                      status: m.status,
                      channel: "linkedin",
                    });
                    if (m.responseContent) {
                      allMessages.push({
                        type: "reply",
                        content: m.responseContent,
                        time: m.repliedAt || (m.sentAt || 0) + 1,
                        direction: "in",
                        channel: "linkedin",
                      });
                    }
                  });

                  detail.emailMessages?.forEach((m) => {
                    allMessages.push({
                      type: "email",
                      content: m.subject || m.body || "(no content)",
                      time: m.sentAt || m.createdAt || 0,
                      direction: "out",
                      status: m.status,
                      channel: "email",
                    });
                  });

                  detail.inboundMessages?.forEach((m) => {
                    allMessages.push({
                      type: "inbound",
                      content: m.content,
                      time: m.receivedAt || m.createdAt || 0,
                      direction: "in",
                      channel: "linkedin",
                    });
                  });

                  allMessages.sort((a, b) => a.time - b.time);

                  if (allMessages.length === 0) return null;

                  return (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Message History ({allMessages.length})
                      </label>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {allMessages.map((msg, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border p-3 ${
                              msg.direction === "in" ? "bg-green-50 border-green-200 ml-4" : "bg-white mr-4"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                {msg.channel === "email" ? (
                                  <Mail className="h-3 w-3 text-slate-400" />
                                ) : (
                                  <Linkedin className="h-3 w-3 text-blue-500" />
                                )}
                                <span className="text-xs font-medium text-slate-500">
                                  {msg.direction === "in" ? "Received" : msg.type.replace(/_/g, " ")}
                                </span>
                                {msg.status && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    msg.status === "sent" ? "bg-green-100 text-green-700" :
                                    msg.status === "draft" ? "bg-slate-100 text-slate-500" :
                                    msg.status === "approved" ? "bg-blue-100 text-blue-700" :
                                    "bg-slate-100 text-slate-500"
                                  }`}>
                                    {msg.status}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">{timeAgo(msg.time)}</span>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-4">
                              {msg.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Timeline */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Timeline</label>
                  <div className="space-y-1 text-xs text-slate-500">
                    {detail.createdAt && <div>Created: {formatDate(detail.createdAt)}</div>}
                    {detail.approvedAt && <div>Approved: {formatDate(detail.approvedAt)}</div>}
                    {detail.connectionRequestSentAt && <div>Connection sent: {formatDate(detail.connectionRequestSentAt)}</div>}
                    {detail.connectionAcceptedAt && <div>Connection accepted: {formatDate(detail.connectionAcceptedAt)}</div>}
                    {detail.firstMessageSentAt && <div>First message: {formatDate(detail.firstMessageSentAt)}</div>}
                    {detail.firstReplyAt && <div>First reply: {formatDate(detail.firstReplyAt)}</div>}
                    {detail.lastContactedAt && <div>Last contacted: {formatDate(detail.lastContactedAt)}</div>}
                    {detail.lastInteractionAt && <div>Last interaction: {formatDate(detail.lastInteractionAt)}</div>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-20 text-slate-400">
                Could not load prospect details
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
