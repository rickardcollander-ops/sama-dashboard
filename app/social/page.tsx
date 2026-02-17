"use client";

import { useEffect, useState } from "react";
import { Users, Heart, MessageCircle, Repeat2 } from "lucide-react";
import Link from "next/link";

interface Tweet {
  id: string;
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  timestamp: string;
}

export default function SocialPage() {
  const [loading, setLoading] = useState(true);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [stats, setStats] = useState({
    followers: 0,
    totalEngagement: 0,
    tweetsThisWeek: 0,
    avgEngagement: 0,
  });

  useEffect(() => {
    setTimeout(() => {
      setTweets([
        {
          id: "1",
          text: "Just launched SAMA 2.0 - autonomous marketing agents powered by AI! 🚀",
          likes: 0,
          retweets: 0,
          replies: 0,
          timestamp: "2 hours ago",
        },
      ]);
      setStats({
        followers: 0,
        totalEngagement: 0,
        tweetsThisWeek: 1,
        avgEngagement: 0,
      });
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Users className="h-8 w-8 text-pink-600" />
              <h1 className="text-2xl font-bold text-slate-900">Social Agent</h1>
            </Link>
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Twitter Activity</h2>
          <p className="mt-2 text-slate-600">Monitor and engage with your audience on @successifier</p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-6 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Followers</p>
              <Users className="h-5 w-5 text-pink-500" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.followers}</p>
            <p className="mt-1 text-sm text-slate-500">Total followers</p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Engagement</p>
              <Heart className="h-5 w-5 text-red-500" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalEngagement}</p>
            <p className="mt-1 text-sm text-slate-500">This week</p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Tweets</p>
              <MessageCircle className="h-5 w-5 text-blue-500" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.tweetsThisWeek}</p>
            <p className="mt-1 text-sm text-slate-500">This week</p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Avg Engagement</p>
              <Repeat2 className="h-5 w-5 text-green-500" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.avgEngagement}%</p>
            <p className="mt-1 text-sm text-slate-500">Per tweet</p>
          </div>
        </div>

        {/* Recent Tweets */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b p-6">
            <h3 className="text-lg font-semibold text-slate-900">Recent Tweets</h3>
            <p className="mt-1 text-sm text-slate-500">Your latest posts and their performance</p>
          </div>
          <div className="divide-y divide-slate-200">
            {loading ? (
              <div className="px-6 py-8 text-center text-sm text-slate-500">Loading tweets...</div>
            ) : tweets.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-slate-500">No tweets yet</p>
                <p className="mt-1 text-xs text-slate-400">Start posting to see activity here</p>
              </div>
            ) : (
              tweets.map((tweet) => (
                <div key={tweet.id} className="p-6 hover:bg-slate-50">
                  <p className="text-sm text-slate-900">{tweet.text}</p>
                  <div className="mt-4 flex items-center gap-6 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      <span>{tweet.likes}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Repeat2 className="h-4 w-4" />
                      <span>{tweet.retweets}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      <span>{tweet.replies}</span>
                    </div>
                    <span className="ml-auto text-xs">{tweet.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-4">
          <button className="rounded-lg bg-pink-600 px-6 py-3 font-medium text-white hover:bg-pink-700">
            Create Tweet
          </button>
          <button className="rounded-lg border bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">
            View Analytics
          </button>
        </div>
      </main>
    </div>
  );
}
