"use client";

import { useState, useEffect } from "react";
import { Calendar as CalIcon, ChevronLeft, ChevronRight, FileText, MessageSquare, Users, Linkedin } from "lucide-react";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface CalendarItem {
  id: string;
  title: string;
  date: string;
  channel: 'blog' | 'twitter' | 'linkedin' | 'social';
  status: 'scheduled' | 'published' | 'draft';
}

const CHANNEL_STYLES: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  blog: { icon: FileText, color: 'text-purple-600', bg: 'bg-purple-100' },
  twitter: { icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-100' },
  linkedin: { icon: Linkedin, color: 'text-blue-700', bg: 'bg-blue-100' },
  social: { icon: Users, color: 'text-pink-600', bg: 'bg-pink-100' },
};

export default function ContentCalendarPage() {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetchCalendarItems();
  }, []);

  const fetchCalendarItems = async () => {
    const calItems: CalendarItem[] = [];

    // Fetch content pieces
    try {
      const res = await fetch(`${SAMA_API_URL}/api/content/library`);
      if (res.ok) {
        const data = await res.json();
        (data.library || data.pieces || []).forEach((p: any) => {
          if (p.created_at) {
            calItems.push({
              id: p.id || p.title,
              title: p.title,
              date: p.created_at.slice(0, 10),
              channel: 'blog',
              status: p.status === 'published' ? 'published' : 'draft',
            });
          }
        });
      }
    } catch { /* silent */ }

    // Fetch social scheduled posts
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/actions`);
      if (res.ok) {
        const data = await res.json();
        (data.actions || []).forEach((a: any) => {
          if (a.scheduled_date) {
            calItems.push({
              id: a.id || a.title,
              title: a.title || a.description?.slice(0, 50) || 'Social post',
              date: a.scheduled_date.slice(0, 10),
              channel: 'twitter',
              status: 'scheduled',
            });
          }
        });
      }
    } catch { /* silent */ }

    setItems(calItems);
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const dayItems = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return items.filter(i => i.date === dateStr);
  };

  const STATUS_DOT: Record<string, string> = {
    published: 'bg-green-500',
    scheduled: 'bg-blue-500',
    draft: 'bg-slate-400',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Content Calendar</h2>
            <p className="mt-1 text-slate-500 text-sm">Planned and published content across all channels</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {Object.entries(STATUS_DOT).map(([s, c]) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${c}`} /> {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="rounded-lg p-2 hover:bg-white border text-slate-600">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-lg font-semibold text-slate-900">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={nextMonth} className="rounded-lg p-2 hover:bg-white border text-slate-600">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="px-2 py-3 text-center text-xs font-medium text-slate-500 uppercase">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] border-b border-r bg-slate-50/50" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === today;
              const dayContent = dayItems(day);

              return (
                <div key={day} className={`min-h-[100px] border-b border-r p-1.5 ${isToday ? 'bg-blue-50/50' : ''}`}>
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                    {isToday ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">{day}</span>
                    ) : day}
                  </div>
                  <div className="space-y-0.5">
                    {dayContent.slice(0, 3).map(item => {
                      const ch = CHANNEL_STYLES[item.channel] || CHANNEL_STYLES.blog;
                      return (
                        <div key={item.id} className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] ${ch.bg}`} title={item.title}>
                          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[item.status]}`} />
                          <span className={`truncate font-medium ${ch.color}`}>{item.title}</span>
                        </div>
                      );
                    })}
                    {dayContent.length > 3 && (
                      <p className="text-[10px] text-slate-400 pl-1">+{dayContent.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
