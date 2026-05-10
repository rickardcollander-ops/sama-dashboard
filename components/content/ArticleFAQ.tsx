"use client";

import { ChevronDown, HelpCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Item {
  q: string;
  a: string;
}

interface Props {
  items: Item[];
}

export default function ArticleFAQ({ items }: Props) {
  if (!items?.length) return null;
  return (
    <section id="faq" className="my-14 scroll-mt-24">
      <div className="flex items-center gap-2 mb-6">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700">
          <HelpCircle className="h-4 w-4" />
        </span>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
          Frequently Asked Questions
        </h2>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <details
            key={i}
            className="group rounded-2xl border border-slate-200 bg-white open:border-orange-200 open:shadow-sm transition-all"
          >
            <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 rounded-2xl">
              <span className="font-medium text-slate-900 leading-snug">{item.q}</span>
              <ChevronDown className="h-5 w-5 text-slate-400 group-open:rotate-180 group-open:text-orange-500 transition-transform shrink-0" />
            </summary>
            <div className="px-5 pb-5 pt-1 prose prose-slate prose-sm max-w-none prose-p:text-slate-700 prose-p:leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.a}</ReactMarkdown>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
