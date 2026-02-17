"use client";

import { useState } from "react";
import { FileText, TrendingUp, Calendar, CheckCircle } from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

export default function ContentPage() {
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [genType, setGenType] = useState("blog_post");
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [selectedContent, setSelectedContent] = useState<any>(null);

  const generateContent = async () => {
    if (!genTopic) return;
    setGenerating(true);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/content/blog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: genTopic, content_type: genType })
      });
      if (response.ok) {
        const data = await response.json();
        setGeneratedContent(data);
      } else {
        alert('Failed to generate content. Backend may need Anthropic API key.');
      }
    } catch (error) {
      alert('Error connecting to backend.');
    } finally {
      setGenerating(false);
    }
  };

  const contentPieces = [
    {
      id: "1",
      title: "How to Reduce SaaS Churn by 40% Using AI",
      type: "Blog Post",
      status: "Published",
      wordCount: 2043,
      targetKeyword: "reduce SaaS churn",
      publishedDate: "2026-02-15",
      performance: { clicks: 127, impressions: 1834, position: 8.2 }
    },
    {
      id: "2",
      title: "Customer Health Score: Complete Guide",
      type: "Blog Post",
      status: "Published",
      wordCount: 2891,
      targetKeyword: "customer health score",
      publishedDate: "2026-02-10",
      performance: { clicks: 89, impressions: 1245, position: 12.1 }
    },
    {
      id: "3",
      title: "Successifier vs Gainsight",
      type: "Comparison Page",
      status: "Published",
      wordCount: 2567,
      targetKeyword: "gainsight alternative",
      publishedDate: "2026-02-05",
      performance: { clicks: 234, impressions: 2891, position: 5.3 }
    },
    {
      id: "4",
      title: "AI-Powered Customer Success Automation",
      type: "Landing Page",
      status: "Draft",
      wordCount: 1234,
      targetKeyword: "customer success automation",
      publishedDate: null,
      performance: null
    }
  ];

  const stats = {
    totalPublished: 12,
    avgPosition: 9.8,
    totalClicks: 1834,
    contentInDraft: 3
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Content Agent</h1>
              <p className="text-sm text-slate-500">AI-powered content generation and management</p>
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
        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Published Content</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalPublished}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Avg Position</p>
                <p className="text-3xl font-bold text-slate-900">{stats.avgPosition}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Clicks (30d)</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalClicks}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-500" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">In Draft</p>
                <p className="text-3xl font-bold text-slate-900">{stats.contentInDraft}</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Content Library */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Content Library</h2>
            <button 
              onClick={() => setShowGenerate(!showGenerate)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Generate New Content
            </button>
          </div>

          <div className="space-y-4">
            {contentPieces.map((content) => (
              <div
                key={content.id}
                className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">{content.title}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        content.status === 'Published' 
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {content.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span>{content.type}</span>
                      <span>•</span>
                      <span>{content.wordCount} words</span>
                      <span>•</span>
                      <span>Keyword: {content.targetKeyword}</span>
                      {content.publishedDate && (
                        <>
                          <span>•</span>
                          <span>Published: {content.publishedDate}</span>
                        </>
                      )}
                    </div>

                    {content.performance && (
                      <div className="mt-3 flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-slate-500">Clicks: </span>
                          <span className="font-medium text-slate-900">{content.performance.clicks}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Impressions: </span>
                          <span className="font-medium text-slate-900">{content.performance.impressions}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Position: </span>
                          <span className="font-medium text-slate-900">{content.performance.position}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setSelectedContent(content)}
                    className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content Pillars */}
        <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Content Pillars</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">Churn Prevention</h3>
              <p className="mt-2 text-sm text-slate-500">Content around detecting and reducing churn</p>
              <p className="mt-2 text-xs text-slate-400">4 articles published</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">Health Scoring</h3>
              <p className="mt-2 text-sm text-slate-500">Customer health scoring frameworks</p>
              <p className="mt-2 text-xs text-slate-400">3 articles published</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">CS Automation</h3>
              <p className="mt-2 text-sm text-slate-500">Automating workflows and playbooks</p>
              <p className="mt-2 text-xs text-slate-400">5 articles published</p>
            </div>
          </div>
        </div>
        {/* Generate Content Form */}
        {showGenerate && (
          <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Generate New Content</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Topic / Keyword</label>
                <input
                  type="text"
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  placeholder="e.g., customer success automation"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Content Type</label>
                <select
                  value={genType}
                  onChange={(e) => setGenType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="blog_post">Blog Post</option>
                  <option value="landing_page">Landing Page</option>
                  <option value="comparison">Comparison Page</option>
                  <option value="case_study">Case Study</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={generateContent}
                  disabled={!genTopic || generating}
                  className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {generating ? 'Generating...' : 'Generate with AI'}
                </button>
                <button onClick={() => setShowGenerate(false)} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
                  Cancel
                </button>
              </div>
            </div>
            {generatedContent && (
              <div className="mt-4 p-4 rounded-lg bg-slate-50">
                <h4 className="font-medium text-slate-900 mb-2">Generated Content</h4>
                <pre className="text-xs text-slate-600 overflow-auto max-h-64 whitespace-pre-wrap">{JSON.stringify(generatedContent, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {/* Content Detail Modal */}
        {selectedContent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">{selectedContent.title}</h3>
                <button onClick={() => setSelectedContent(null)} className="text-slate-500 hover:text-slate-700 text-xl">&times;</button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">Type:</span> <span className="font-medium">{selectedContent.type}</span></div>
                  <div><span className="text-slate-500">Status:</span> <span className="font-medium">{selectedContent.status}</span></div>
                  <div><span className="text-slate-500">Words:</span> <span className="font-medium">{selectedContent.wordCount}</span></div>
                  <div><span className="text-slate-500">Keyword:</span> <span className="font-medium">{selectedContent.targetKeyword}</span></div>
                </div>
                {selectedContent.performance && (
                  <div className="p-3 rounded-lg bg-slate-50">
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Performance</h4>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><span className="text-slate-500">Clicks:</span> <span className="font-bold">{selectedContent.performance.clicks}</span></div>
                      <div><span className="text-slate-500">Impressions:</span> <span className="font-bold">{selectedContent.performance.impressions}</span></div>
                      <div><span className="text-slate-500">Position:</span> <span className="font-bold">{selectedContent.performance.position}</span></div>
                    </div>
                  </div>
                )}
                {selectedContent.publishedDate && (
                  <p className="text-sm text-slate-500">Published: {selectedContent.publishedDate}</p>
                )}
              </div>
              <button onClick={() => setSelectedContent(null)} className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
                Close
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
