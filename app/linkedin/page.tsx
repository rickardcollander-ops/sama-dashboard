"use client";

import { useState, useCallback } from "react";
import { Linkedin, Sparkles, Send, BarChart3, Clock, Trash2, Copy, CheckCircle } from "lucide-react";
import { useToast } from "@/components/Toast";

const _RAW_SAMA_API = process.env.NEXT_PUBLIC_SAMA_API_URL || '';
const SAMA_API_URL = /^https?:\/\//.test(_RAW_SAMA_API) ? _RAW_SAMA_API : '/api/sama';

const TOPIC_SUGGESTIONS = [
  "Customer churn prevention strategies for SaaS",
  "How AI is transforming customer success",
  "The importance of health scoring in B2B",
  "Why proactive CS beats reactive support",
  "NRR as the key SaaS growth metric",
  "Onboarding best practices that reduce churn",
];

export default function LinkedInPage() {
  const toast = useToast();
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("thought_leadership");
  const [generatedContent, setGeneratedContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [postHistory, setPostHistory] = useState<Array<{ topic: string; style: string; content: string; created: string }>>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('sama-linkedin-history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const saveHistory = useCallback((entries: typeof postHistory) => {
    setPostHistory(entries);
    try { localStorage.setItem('sama-linkedin-history', JSON.stringify(entries.slice(0, 20))); } catch { /* ignore */ }
  }, []);

  const generatePost = async () => {
    if (!topic) return;

    setGenerating(true);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/social/linkedin/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, style, include_hashtags: true })
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedContent(data.content);
        toast.success('Post generated');
        // Save to history
        saveHistory([
          { topic, style, content: data.content, created: new Date().toISOString() },
          ...postHistory,
        ]);
      } else {
        toast.error('Failed to generate post');
      }
    } catch {
      toast.error('Error generating post');
    } finally {
      setGenerating(false);
    }
  };

  const publishPost = async () => {
    if (!generatedContent) return;

    setPosting(true);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/social/linkedin/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: generatedContent })
      });

      if (response.ok) {
        toast.success('Post published to LinkedIn!');
        setGeneratedContent("");
        setTopic("");
      } else {
        toast.error('Failed to publish post');
      }
    } catch {
      toast.error('Error publishing post');
    } finally {
      setPosting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = generatedContent ? generatedContent.split(/\s+/).length : 0;
  const charCount = generatedContent.length;
  const isOptimalLength = wordCount >= 150 && wordCount <= 300;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-sky-100 p-2">
              <Linkedin className="h-6 w-6 text-sky-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">LinkedIn</h2>
              <p className="text-sm text-slate-500">Generate and publish thought leadership content for Successifier</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Generator */}
          <div className="lg:col-span-2 space-y-6">
            {/* Generate Post */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-slate-900">Generate Post</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Topic
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && generatePost()}
                    placeholder="e.g., Customer churn prevention strategies"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {TOPIC_SUGGESTIONS.slice(0, 4).map(s => (
                      <button key={s} onClick={() => setTopic(s)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600 transition-colors">
                        {s.length > 40 ? s.slice(0, 40) + '...' : s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Style</label>
                    <select value={style} onChange={(e) => setStyle(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-sky-500 focus:outline-none">
                      <option value="thought_leadership">Thought Leadership</option>
                      <option value="professional">Professional</option>
                      <option value="educational">Educational</option>
                      <option value="storytelling">Storytelling</option>
                      <option value="data_driven">Data-Driven</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button onClick={generatePost} disabled={!topic || generating}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-6 py-2.5 font-medium text-white hover:bg-sky-700 disabled:bg-sky-400 disabled:cursor-not-allowed shadow-sm">
                      {generating ? (
                        <><Clock className="h-4 w-4 animate-spin" /> Generating...</>
                      ) : (
                        <><Sparkles className="h-4 w-4" /> Generate</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Generated Content */}
            {generatedContent && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
                  <div className="flex gap-2">
                    <button onClick={copyToClipboard}
                      className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                      {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={() => setGeneratedContent("")}
                      className="rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button onClick={publishPost} disabled={posting}
                      className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:bg-sky-400 shadow-sm">
                      {posting ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {posting ? 'Publishing...' : 'Publish'}
                    </button>
                  </div>
                </div>

                {/* LinkedIn-style preview card */}
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="bg-white p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-bold text-sm">S</div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Successifier</p>
                        <p className="text-xs text-slate-500">AI-Native Customer Success Platform · Just now</p>
                      </div>
                    </div>
                    <textarea
                      value={generatedContent}
                      onChange={(e) => setGeneratedContent(e.target.value)}
                      rows={Math.min(16, Math.max(6, generatedContent.split('\n').length + 2))}
                      className="w-full resize-none border-0 bg-transparent focus:outline-none text-sm text-slate-800 leading-relaxed"
                    />
                  </div>
                  <div className="border-t bg-slate-50 px-4 py-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{charCount} chars · {wordCount} words · ~{Math.ceil(wordCount / 200)} min read</span>
                    <span className={isOptimalLength ? 'text-green-600 font-medium' : wordCount > 300 ? 'text-amber-600' : 'text-slate-400'}>
                      {isOptimalLength ? 'Optimal length' : wordCount > 300 ? 'Consider shortening' : wordCount > 0 ? 'Could be longer' : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: History + Tips */}
          <div className="space-y-6">
            {/* Post History */}
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">Recent Posts</h3>
                {postHistory.length > 0 && (
                  <button onClick={() => saveHistory([])} className="text-xs text-slate-400 hover:text-red-500">Clear</button>
                )}
              </div>
              {postHistory.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Generate a post to see history here</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {postHistory.slice(0, 10).map((post, i) => (
                    <button key={i} onClick={() => { setGeneratedContent(post.content); setTopic(post.topic); setStyle(post.style); }}
                      className="w-full text-left rounded-md border p-3 hover:bg-slate-50 transition-colors">
                      <p className="text-xs font-medium text-slate-800 truncate">{post.topic}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {post.style} · {new Date(post.created).toLocaleDateString('sv-SE')}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{post.content.slice(0, 100)}...</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Best Practices */}
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-sky-600" />
                <h3 className="text-sm font-semibold text-sky-900">LinkedIn Tips</h3>
              </div>
              <ul className="space-y-2 text-xs text-sky-800">
                <li className="flex gap-2"><span className="text-sky-500 font-bold">1.</span> 150-300 words is the sweet spot</li>
                <li className="flex gap-2"><span className="text-sky-500 font-bold">2.</span> Post Tue-Thu, 7-9 AM or 5-6 PM</li>
                <li className="flex gap-2"><span className="text-sky-500 font-bold">3.</span> Use 3-5 relevant hashtags</li>
                <li className="flex gap-2"><span className="text-sky-500 font-bold">4.</span> Open with a hook / bold statement</li>
                <li className="flex gap-2"><span className="text-sky-500 font-bold">5.</span> End with a question or CTA</li>
                <li className="flex gap-2"><span className="text-sky-500 font-bold">6.</span> White space makes posts scannable</li>
              </ul>
            </div>

            {/* Content Pillars */}
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Content Pillars</h3>
              <p className="text-[10px] text-slate-400 mb-2">Click to use as a topic</p>
              <div className="space-y-1">
                {[
                  { pillar: "Churn Prevention", color: "bg-red-100 text-red-700" },
                  { pillar: "Health Scoring", color: "bg-blue-100 text-blue-700" },
                  { pillar: "CS Automation", color: "bg-purple-100 text-purple-700" },
                  { pillar: "NRR Growth", color: "bg-green-100 text-green-700" },
                  { pillar: "Onboarding", color: "bg-amber-100 text-amber-700" },
                  { pillar: "AI in Customer Success", color: "bg-violet-100 text-violet-700" },
                ].map(p => (
                  <button key={p.pillar} onClick={() => setTopic(p.pillar)}
                    className={`w-full text-left rounded-md px-3 py-2 text-xs font-medium ${p.color} hover:opacity-80 transition-opacity`}>
                    {p.pillar}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
