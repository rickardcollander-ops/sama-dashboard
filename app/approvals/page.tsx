"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, DollarSign, AlertTriangle } from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://sama-agent-ivory.vercel.app';

interface Approval {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  data: any;
  agent: string;
  timestamp: string;
  status: string;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    try {
      const response = await fetch(`${SAMA_API_URL}/api/alerts/pending`);
      if (response.ok) {
        const data = await response.json();
        setApprovals(data.approvals || []);
      }
    } catch (error) {
      console.error('Error fetching approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approvalId: string) => {
    setProcessing(approvalId);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/alerts/${approvalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: 'Dashboard User' })
      });

      if (response.ok) {
        setApprovals(approvals.filter(a => a.id !== approvalId));
      }
    } catch (error) {
      console.error('Error approving:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    setProcessing(approvalId);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/alerts/${approvalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rejected_by: 'Dashboard User',
          reason 
        })
      });

      if (response.ok) {
        setApprovals(approvals.filter(a => a.id !== approvalId));
      }
    } catch (error) {
      console.error('Error rejecting:', error);
    } finally {
      setProcessing(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'budget_change':
        return <DollarSign className="h-6 w-6 text-green-600" />;
      case 'review_negative':
        return <AlertTriangle className="h-6 w-6 text-red-600" />;
      default:
        return <Clock className="h-6 w-6 text-blue-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Pending Approvals</h1>
              <p className="text-sm text-slate-500">Review and approve agent actions</p>
            </div>
            <Link
              href="/"
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-500">Loading approvals...</p>
          </div>
        ) : approvals.length === 0 ? (
          <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">All caught up!</h3>
            <p className="mt-2 text-sm text-slate-500">No pending approvals at this time.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map((approval) => (
              <div
                key={approval.id}
                className="rounded-lg border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="rounded-lg bg-slate-100 p-3">
                      {getTypeIcon(approval.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900">{approval.title}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          approval.severity === 'critical' 
                            ? 'bg-red-100 text-red-700'
                            : approval.severity === 'warning'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {approval.severity}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {approval.agent}
                        </span>
                      </div>
                      
                      <p className="text-sm text-slate-600 mb-3">{approval.message}</p>
                      
                      {approval.data && (
                        <div className="rounded-md bg-slate-50 p-3 text-xs font-mono">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(approval.data, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      <p className="mt-3 text-xs text-slate-400">
                        {new Date(approval.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleApprove(approval.id)}
                      disabled={processing === approval.id}
                      className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {processing === approval.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(approval.id)}
                      disabled={processing === approval.id}
                      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      {processing === approval.id ? 'Processing...' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
