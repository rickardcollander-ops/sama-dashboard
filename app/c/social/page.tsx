"use client";

import { useState, useEffect } from "react";
import {
  Share2, Loader2, Calendar, ThumbsUp, MessageCircle,
  Eye, Send, Twitter, Linkedin, AlertCircle, X, PenTool,
  Sparkles, Save,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { tenantApi } from "@/lib/api";
import { IS_DEMO, demoSocialPosts } from "@/lib/demo-data";

interface SocialSuggestion {
  platform: string;
  content: string;
  reason: string;
}

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  status: string;
  scheduled_at?: string;
  published_at?: string;
  likes?: number;
  comments?: number;
  impressions?: number;
}

interface SocialStats {
  total_posts: number;
  total_likes: number;
  total_impressions: number;
  platforms: string[];
}

type SocialPlatform = "twitter" | "linkedin" | "reddit";

const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  twitter: "X / Twitter",
  linkedin: "LinkedIn",
  reddit: "Reddit",
};

export default function CustomerSocialPage() {
  const { user, loading: userLoading } = useUser();
  const { tenantClient } = useSite();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [stats, setStats] = useState<SocialStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create post modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPlatform, setCreatePlatform] = useState<SocialPlatform>("twitter");
  const [createText, setCreateText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const client = tenantClient;
    try {
      const [postsData, statsData] = await Promise.allSettled([
        client.get<{ posts?: SocialPost[] }>("/api/social/posts"),
        client.get<SocialStats>("/api/social/stats"),
      ]);
      if (postsData.status === "fulfilled") {
        const p = postsData.value.posts || [];
        setPosts(p.length > 0 ? p : IS_DEMO ? demoSocialPosts : []);
      } else if (IS_DEMO) {
        setPosts(demoSocialPosts);
      } else {
        setError("Could not load data. Please try again.");
      }
      if (statsData.status === "fulfilled") setStats(statsData.value);
    } catch (err: any) {
      console.error("Failed to fetch social data:", err);
      if (IS_DEMO) {
        setPosts(demoSocialPosts);
      } else {
        setError("Could not load social data. The social agent may not be active yet.");
      }
    }
    setLoading(false);
  };

  const handleGenerateAI = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const client = tenantClient;
      const result = await client.post<{ body?: string; title?: string }>("/api/content/generate", {
        type: "linkedin_post",
        topic: "",
        brand_description: "",
        target_audience: "",
        tone: "professional",
      });
      if (result.body) setCreateText(result.body);
    } catch {
      setError("Could not generate content. Please try again.");
    }
    setGenerating(false);
  };

  const handleSaveDraft = async () => {
    if (!user || !createText.trim()) return;
    setSavingDraft(true);
    try {
      const client = tenantClient;
      await client.post("/api/social/posts", {
        platform: createPlatform,
        content: createText,
        status: "draft",
      });
      await fetchData();
      setShowCreateModal(false);
      setCreateText("");
    } catch {
      // Optimistic local add
      const newPost: SocialPost = {
        id: `local-${Date.now()}`,
        platform: createPlatform,
        content: createText,
        status: "draft",
      };
      setPosts((prev) => [newPost, ...prev]);
      setShowCreateModal(false);
      setCreateText("");
    }
    setSavingDraft(false);
  };

  const platformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "x":
      case "twitter":
        return <Twitter className="h-4 w-4" />;
      case "linkedin":
        return <Linkedin className="h-4 w-4" />;
      default:
        return <Share2 className="h-4 w-4" />;
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Share2 className="h-7 w-7 text-indigo-500" />
              Social Media
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Automated posting and engagement across your social channels
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <PenTool className="h-4 w-4" />
            Create Post
          </button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Send className="h-5 w-5 text-indigo-500" />
              <span className="text-sm text-slate-500">Total Posts</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {stats?.total_posts ?? posts.length}
            </span>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <ThumbsUp className="h-5 w-5 text-pink-500" />
              <span className="text-sm text-slate-500">Total Likes</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {(stats?.total_likes ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Eye className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-slate-500">Impressions</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {(stats?.total_impressions ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError("")} className="ml-auto text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* AI Suggestions */}
        {user && (
          <SuggestionsPanel<SocialSuggestion>
            title="Sociala förslag"
            description="AI föreslår inlägg per plattform. Importera ett förslag så skapas ett utkast som du kan publicera."
            accent="indigo"
            importButtonLabel="Importera till Social"
            importLabel="Importera till Social-agenten"
            fetchSuggestions={async () => {
              const client = tenantClient;
              const res = await client.post<{ suggestions?: SocialSuggestion[] }>("/api/social/suggest-posts", {});
              return res.suggestions || [];
            }}
            renderItem={(item) => (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase text-indigo-700">{item.platform}</span>
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{item.content}</p>
                <p className="text-xs text-slate-500 mt-2 italic">{item.reason}</p>
              </div>
            )}
            importItem={async (item) => {
              const client = tenantClient;
              await client.post("/api/social/posts", {
                platform: item.platform,
                content: item.content,
                status: "draft",
              });
              await fetchData();
              return "Inlägget sparades som utkast.";
            }}
          />
        )}

        {/* Posts */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border bg-white p-16 shadow-sm text-center">
            <Share2 className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">No social posts yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              SAMA will begin posting once your social accounts are connected and the agent is active.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="rounded-xl border bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-slate-100 p-2 text-slate-500">
                    {platformIcon(post.platform)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-slate-500 uppercase">
                        {post.platform}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          post.status === "published"
                            ? "bg-emerald-50 text-emerald-700"
                            : post.status === "scheduled"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {post.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                      {post.published_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.published_at).toLocaleDateString()}
                        </span>
                      )}
                      {(post.likes ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {post.likes}
                        </span>
                      )}
                      {(post.comments ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {post.comments}
                        </span>
                      )}
                      {(post.impressions ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {(post.impressions ?? 0).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Post Modal */}
      {showCreateModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowCreateModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg rounded-2xl border bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-indigo-500" />
                  Create Social Post
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Platform selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Platform</label>
                <div className="flex gap-2">
                  {(Object.entries(SOCIAL_PLATFORM_LABELS) as [SocialPlatform, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setCreatePlatform(key)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        createPlatform === key
                          ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text area */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Post Content</label>
                <textarea
                  value={createText}
                  onChange={(e) => setCreateText(e.target.value)}
                  placeholder="Write your post content here..."
                  rows={6}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateAI}
                  disabled={generating}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300 shadow-sm transition-colors"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generating ? "Generating..." : "Generate with AI"}
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={savingDraft || !createText.trim()}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300 shadow-sm transition-colors"
                >
                  {savingDraft ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save as Draft
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
