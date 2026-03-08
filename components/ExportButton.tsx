"use client";

import { useState, useRef, useEffect } from "react";
import { Download } from "lucide-react";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

export default function ExportButton() {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const exportCSV = async (type: string) => {
    setExporting(true);
    try {
      let data: any[] = [];
      let filename = `sama_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

      if (type === 'keywords') {
        const res = await fetch(`${SAMA_API_URL}/api/seo/keywords`);
        if (res.ok) {
          const json = await res.json();
          data = json.keywords || [];
        }
      } else if (type === 'analytics') {
        const res = await fetch(`${SAMA_API_URL}/api/analytics/metrics?days=30`);
        if (res.ok) {
          const json = await res.json();
          data = json.metrics || [];
        }
      } else if (type === 'content') {
        const res = await fetch(`${SAMA_API_URL}/api/content/library`);
        if (res.ok) {
          const json = await res.json();
          data = json.library || json.pieces || [];
        }
      } else if (type === 'reviews') {
        const res = await fetch(`${SAMA_API_URL}/api/reviews/dashboard`);
        if (res.ok) {
          const json = await res.json();
          data = json.reviews || [];
        }
      }

      if (data.length === 0) {
        alert('No data to export');
        return;
      }

      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(','),
        ...data.map(row =>
          headers.map(h => {
            const val = row[h];
            const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"` : str;
          }).join(',')
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed');
    } finally {
      setExporting(false);
      setOpen(false);
    }
  };

  const exports = [
    { type: 'keywords', label: 'SEO Keywords' },
    { type: 'analytics', label: 'Analytics (30d)' },
    { type: 'content', label: 'Content Library' },
    { type: 'reviews', label: 'Reviews' },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        title="Export data"
      >
        <Download className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border bg-white shadow-xl z-50">
          <div className="px-3 py-2 border-b">
            <p className="text-xs font-semibold text-slate-500">Export as CSV</p>
          </div>
          {exports.map(e => (
            <button
              key={e.type}
              onClick={() => exportCSV(e.type)}
              disabled={exporting}
              className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {e.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
