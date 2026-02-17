"use client";

import { useState, useEffect } from "react";
import { Star, MessageSquare, TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface Review {
  id: string;
  platform: string;
  rating: number;
  author: string;
  title: string;
  content: string;
  created_at: string;
  responded: boolean;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    avgRating: 0,
    totalReviews: 0,
    responseRate: 0,
    avgResponseTime: "0h"
  });
  const [platforms, setPlatforms] = useState<any[]>([]);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      // Fetch reviews from backend API
      const response = await fetch(`${SAMA_API_URL}/api/reviews/recent?limit=20`);
      let reviewList: Review[] = [];
      
      if (response.ok) {
        const data = await response.json();
        reviewList = data.reviews || data || [];
      } else {
        console.error('Error fetching reviews:', response.status);
      }
      setReviews(reviewList);

      // Calculate stats
      if (reviewList.length > 0) {
        const avgRating = reviewList.reduce((sum, r) => sum + r.rating, 0) / reviewList.length;
        const respondedCount = reviewList.filter(r => r.responded).length;
        const responseRate = (respondedCount / reviewList.length) * 100;

        setStats({
          avgRating: parseFloat(avgRating.toFixed(1)),
          totalReviews: reviewList.length,
          responseRate: Math.round(responseRate),
          avgResponseTime: "18h" // TODO: Calculate from actual response times
        });

        // Group by platform
        const platformMap = new Map();
        reviewList.forEach(review => {
          if (!platformMap.has(review.platform)) {
            platformMap.set(review.platform, {
              name: review.platform,
              ratings: [],
              total: 0,
              pending: 0
            });
          }
          const platform = platformMap.get(review.platform);
          platform.ratings.push(review.rating);
          platform.total++;
          if (!review.responded) platform.pending++;
        });

        const platformList = Array.from(platformMap.values()).map(p => ({
          name: p.name,
          rating: parseFloat((p.ratings.reduce((a: number, b: number) => a + b, 0) / p.ratings.length).toFixed(1)),
          totalReviews: p.total,
          pendingResponses: p.pending,
          trend: `${p.total} total`,
          color: p.name === 'G2' ? 'bg-orange-500' : 
                 p.name === 'Capterra' ? 'bg-blue-500' : 
                 p.name === 'Trustpilot' ? 'bg-green-500' : 'bg-purple-500'
        }));

        setPlatforms(platformList);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
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

          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No reviews found. Run the review scraper to fetch reviews.</div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review: Review) => (
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
                      <p className="text-sm text-slate-600 mb-2">{review.content?.substring(0, 150)}...</p>
                      
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>By {review.author}</span>
                        <span>•</span>
                        <span>{formatDate(review.created_at)}</span>
                      </div>
                    </div>

                    <button className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
                      {review.responded ? 'View' : 'Respond'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
