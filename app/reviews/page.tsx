"use client";

import { Star, MessageSquare, TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function ReviewsPage() {
  const platforms = [
    {
      name: "G2",
      rating: 4.7,
      totalReviews: 23,
      pendingResponses: 2,
      trend: "+3 this month",
      color: "bg-orange-500"
    },
    {
      name: "Capterra",
      rating: 4.6,
      totalReviews: 18,
      pendingResponses: 1,
      trend: "+2 this month",
      color: "bg-blue-500"
    },
    {
      name: "Trustpilot",
      rating: 4.5,
      totalReviews: 12,
      pendingResponses: 0,
      trend: "+1 this month",
      color: "bg-green-500"
    },
    {
      name: "Product Hunt",
      rating: 4.8,
      totalReviews: 34,
      pendingResponses: 3,
      trend: "+5 this month",
      color: "bg-red-500"
    }
  ];

  const recentReviews = [
    {
      id: "1",
      platform: "G2",
      rating: 5,
      author: "Sarah M.",
      title: "Game changer for our CS team",
      excerpt: "Successifier has completely transformed how we manage customer success. The AI predictions are incredibly accurate...",
      date: "2 days ago",
      responded: true
    },
    {
      id: "2",
      platform: "Capterra",
      rating: 4,
      author: "John D.",
      title: "Great product, minor issues",
      excerpt: "Overall very happy with Successifier. The health scoring is excellent, though we'd love to see more customization...",
      date: "5 days ago",
      responded: false
    },
    {
      id: "3",
      platform: "Product Hunt",
      rating: 5,
      author: "Emily R.",
      title: "Best CS platform we've used",
      excerpt: "We switched from Gainsight and couldn't be happier. The setup was incredibly fast and the AI features actually work...",
      date: "1 week ago",
      responded: true
    }
  ];

  const stats = {
    avgRating: 4.6,
    totalReviews: 87,
    responseRate: 94,
    avgResponseTime: "18h"
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Review Agent</h1>
              <p className="text-sm text-slate-500">Monitor and manage reviews across all platforms</p>
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
                <p className="text-sm text-slate-500">Average Rating</p>
                <p className="text-3xl font-bold text-slate-900">{stats.avgRating}</p>
              </div>
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Reviews</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalReviews}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Response Rate</p>
                <p className="text-3xl font-bold text-slate-900">{stats.responseRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Avg Response Time</p>
                <p className="text-3xl font-bold text-slate-900">{stats.avgResponseTime}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Platforms */}
        <div className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-slate-900">Review Platforms</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {platforms.map((platform) => (
              <div key={platform.name} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">{platform.name}</h3>
                  <div className={`h-3 w-3 rounded-full ${platform.color}`}></div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-2xl font-bold text-slate-900">{platform.rating}</span>
                  </div>
                  
                  <p className="text-sm text-slate-500">{platform.totalReviews} reviews</p>
                  
                  {platform.pendingResponses > 0 && (
                    <p className="text-sm font-medium text-orange-600">
                      {platform.pendingResponses} pending response{platform.pendingResponses > 1 ? 's' : ''}
                    </p>
                  )}
                  
                  <p className="text-xs text-slate-400">{platform.trend}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Reviews */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Recent Reviews</h2>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Request Reviews
            </button>
          </div>

          <div className="space-y-4">
            {recentReviews.map((review) => (
              <div
                key={review.id}
                className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {review.platform}
                      </span>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                        ))}
                      </div>
                      {review.responded ? (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                          Responded
                        </span>
                      ) : (
                        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                          Needs Response
                        </span>
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-slate-900 mb-1">{review.title}</h3>
                    <p className="text-sm text-slate-600 mb-2">{review.excerpt}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>By {review.author}</span>
                      <span>•</span>
                      <span>{review.date}</span>
                    </div>
                  </div>

                  <button className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
                    {review.responded ? 'View' : 'Respond'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
