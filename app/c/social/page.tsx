"use client";

import { useState, useEffect } from "react";
import {
  Share2, Loader2, Calendar, ThumbsUp, MessageCircle,
  Eye, Send, Twitter, Linkedin, AlertCircle, X, PenTool,
} from "lucide-react";
import Link from "next/link";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { tenantApi } from "@/lib/api";
import { IS_DEMO, demoSocialPosts } from "@/lib/demo-data";

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

export default function CustomerSocialPage() {
  const { user, loading: userLoading } = useUser();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [stats, setStats] = useState<SocialStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateMsg, setShowCreateMsg] = useState(false);

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
    const client = tenantApi(user.id);
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
        setError("Kunde inte ladda data. Försök igen.");
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
          <Link
            href="/c/content"
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <PenTool className="h-4 w-4" />
            Skapa inlägg
          </Link>
        </div>

        {showCreateMsg && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 flex items-center gap-2">
            <PenTool className="h-4 w-4 flex-shrink-0" />
            Automatisk publicering kommer snart. Skapa content i Content-fliken och publicera manuellt.
            <button onClick={() => setShowCreateMsg(false)} className="ml-auto text-blue-500 hover:text-blue-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

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
    </div>
  );
}
