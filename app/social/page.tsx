"use client";

import { useEffect, useState } from "react";
import { Users, Heart, MessageCircle, Repeat2 } from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

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
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [tweetText, setTweetText] = useState("");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [stats, setStats] = useState({
    followers: 0,
    totalEngagement: 0,
    tweetsThisWeek: 0,
    avgEngagement: 0,
  });

  useEffect(() => {
    fetchTweets();
  }, []);

  const fetchTweets = async () => {
    try {
      const response = await fetch(`${SAMA_API_URL}/api/social/status`);
      if (response.ok) {
        const data = await response.json();
        setStats({
          followers: data.followers || 0,
          totalEngagement: data.total_engagement || 0,
          tweetsThisWeek: data.tweets_this_week || 0,
          avgEngagement: data.avg_engagement || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching social data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTweet = async () => {
    setCreating(true);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/social/post/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: tweetText || 'customer success tips', platform: 'twitter' })
      });
      if (response.ok) {
        const data = await response.json();
        setTweetText(data.content || data.tweet || 'Generated tweet content');
      } else {
        alert('Failed to generate tweet');
      }
    } catch (error) {
      alert('Error generating tweet. Check backend connection.');
    } finally {
      setCreating(false);
    }
  };

  const postTweet = async () => {
    if (!tweetText) return;
    setCreating(true);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/social/post/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: tweetText, platform: 'twitter' })
      });
      if (response.ok) {
        alert('Tweet posted successfully!');
        setTweetText("");
        setShowCreate(false);
      } else {
        const data = await response.json();
        alert(data.detail || 'Failed to post tweet');
      }
    } catch (error) {
      alert('Error posting tweet. Check backend connection.');
    } finally {
      setCreating(false);
    }
  };

  const viewAnalytics = async () => {
    setShowAnalytics(true);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/social/status`);
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      } else {
        setAnalyticsData({ error: 'Could not load analytics.' });
      }
    } catch (error) {
      setAnalyticsData({ error: 'Backend not reachable.' });
    }
  };

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
          <button 
            onClick={() => setShowCreate(!showCreate)}
            className="rounded-lg bg-pink-600 px-6 py-3 font-medium text-white hover:bg-pink-700"
          >
            Create Tweet
          </button>
          <button 
            onClick={viewAnalytics}
            className="rounded-lg border bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            View Analytics
          </button>
        </div>

        {showCreate && (
          <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Compose Tweet</h3>
            <textarea
              value={tweetText}
              onChange={(e) => setTweetText(e.target.value)}
              placeholder="What's on your mind? Or click Generate to create AI content..."
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-pink-500 focus:outline-none mb-3"
            />
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{tweetText.length}/280 characters</span>
              <div className="flex gap-2">
                <button
                  onClick={generateTweet}
                  disabled={creating}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-400"
                >
                  {creating ? 'Generating...' : 'Generate with AI'}
                </button>
                <button
                  onClick={postTweet}
                  disabled={!tweetText || creating}
                  className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:bg-pink-400"
                >
                  Post Tweet
                </button>
              </div>
            </div>
          </div>
        )}

        {showAnalytics && (
          <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Social Analytics</h3>
              <button onClick={() => setShowAnalytics(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>
            {analyticsData?.error ? (
              <p className="text-slate-500">{analyticsData.error}</p>
            ) : analyticsData ? (
              <pre className="rounded bg-slate-50 p-4 text-xs text-slate-600 overflow-auto max-h-64">{JSON.stringify(analyticsData, null, 2)}</pre>
            ) : (
              <p className="text-slate-500">Loading...</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
