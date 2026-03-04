"use client";

import { useState } from "react";
import { Linkedin, Sparkles, Send, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

export default function LinkedInPage() {
  const toast = useToast();
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("professional");
  const [generatedContent, setGeneratedContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);

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
        toast.success('Post generated successfully');
      } else {
        toast.error('Failed to generate post');
      }
    } catch (error) {
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
        toast.success('Post published successfully!');
        setGeneratedContent("");
        setTopic("");
      } else {
        toast.error('Failed to publish post');
      }
    } catch (error) {
      toast.error('Error publishing post');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
<main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
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
                  placeholder="e.g., Customer churn prevention strategies"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Style
                </label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="professional">Professional</option>
                  <option value="thought_leadership">Thought Leadership</option>
                  <option value="educational">Educational</option>
                </select>
              </div>

              <button
                onClick={generatePost}
                disabled={!topic || generating}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-white hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-5 w-5" />
                {generating ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
          </div>

          {/* Generated Content */}
          {generatedContent && (
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Generated Post</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setGeneratedContent("")}
                    className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Clear
                  </button>
                  <button
                    onClick={publishPost}
                    disabled={posting}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                  >
                    <Send className="h-4 w-4" />
                    {posting ? 'Publishing...' : 'Publish to LinkedIn'}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border bg-slate-50 p-4">
                <textarea
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  rows={12}
                  className="w-full resize-none border-0 bg-transparent focus:outline-none"
                />
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                <span>{generatedContent.length} characters</span>
                <span>•</span>
                <span>~{Math.ceil(generatedContent.split(/\s+/).length / 200)} min read</span>
              </div>
            </div>
          )}

          {/* Quick Tips */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">LinkedIn Best Practices</h3>
            </div>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• Optimal post length: 150-300 words</li>
              <li>• Best posting times: Tue-Thu, 7-9 AM or 5-6 PM</li>
              <li>• Use 3-5 relevant hashtags</li>
              <li>• Ask questions to drive engagement</li>
              <li>• Include a clear call-to-action</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
