"use client";

import { useState, useEffect } from "react";
import {
  Users, MessageCircle, Repeat2, Zap, Clock, Play, ChevronDown, ChevronUp,
  CheckCircle, Calendar, AlertTriangle, Send, Twitter, ExternalLink, FileText,
  TrendingUp, RefreshCw, Sparkles, Trash2, Search, X, ArrowUpRight
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface Action {
  id: string;
  db_id?: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  action: string;
  topic?: string;
  style?: string;
  is_thread?: boolean;
  original_tweet?: string;
  tweet_id?: string;
  tweet_url?: string;
  username?: string;
  scheduled_date?: string;
  status: string;
}

interface Draft {
  id: string;
  title: string;
  content_type: string;
  content: string;
  status: string;
  word_count: number;
  created_at: string;
}

interface InterestingTweet {
  id: string;
  text: string;
  created_at: string;
  user: { username: string; followers_count: number; description?: string };
  engagement_score: number;
  tweet_url: string;
}

interface RedditStatus {
  configured: boolean;
  target_subreddits: string[];
  status: string;
  message: string | null;
}

interface RedditPost {
  id: string;
  fullname: string;
  title: string;
  selftext: string;
  subreddit: string;
  author: string;
  score: number;
  num_comments: number;
  permalink: string;
  created_utc: number;
}

interface RedditMention {
  id: string;
  subject: string;
  body: string;
  author: string;
  subreddit: string;
  created_utc: number;
  context: string;
}

interface RedditDraft {
  title: string;
  body: string;
  subreddit: string;
  post_type: string;
  status: string;
}

type TabId = 'actions' | 'interesting' | 'drafts' | 'calendar' | 'mentions' | 'reddit';

export default function SocialPage() {
  const toast = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<TabId>('actions');
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [interestingTweets, setInterestingTweets] = useState<InterestingTweet[]>([]);
  const [loadingTweets, setLoadingTweets] = useState(false);
  const [dbActions, setDbActions] = useState<Action[]>([]);

  // Reddit state
  const [redditStatus, setRedditStatus] = useState<RedditStatus | null>(null);
  const [redditSubreddits, setRedditSubreddits] = useState<string[]>([]);
  const [redditTopic, setRedditTopic] = useState('');
  const [redditSubreddit, setRedditSubreddit] = useState('');
  const [redditPostType, setRedditPostType] = useState<'educational' | 'case_study' | 'question' | 'tips'>('educational');
  const [redditGenerating, setRedditGenerating] = useState(false);
  const [redditDraft, setRedditDraft] = useState<RedditDraft | null>(null);
  const [redditPublishing, setRedditPublishing] = useState(false);
  const [redditQuickPublishing, setRedditQuickPublishing] = useState(false);
  const [redditRelevant, setRedditRelevant] = useState<RedditPost[]>([]);
  const [redditLoadingRelevant, setRedditLoadingRelevant] = useState(false);
  const [redditCompetitors, setRedditCompetitors] = useState<RedditPost[]>([]);
  const [redditLoadingCompetitors, setRedditLoadingCompetitors] = useState(false);
  const [redditMentions, setRedditMentions] = useState<RedditMention[]>([]);
  const [redditLoadingMentions, setRedditLoadingMentions] = useState(false);
  const [hotSubredditInput, setHotSubredditInput] = useState('');
  const [hotSubredditSearch, setHotSubredditSearch] = useState('');
  const [hotPosts, setHotPosts] = useState<RedditPost[]>([]);
  const [loadingHotPosts, setLoadingHotPosts] = useState(false);
  const [commentModal, setCommentModal] = useState<{ post: RedditPost; generatedComment: string; submitting: boolean } | null>(null);
  const [generatingComment, setGeneratingComment] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    fetchDrafts();
    fetchDbActions();
    fetchRedditStatus();
    fetchRedditSubreddits();
  }, []);

  const fetchDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/drafts?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts || []);
      }
    } catch (err) {
      toast.error('Failed to load drafts');
    }
    finally { setLoadingDrafts(false); }
  };

  const fetchDbActions = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/actions?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setDbActions(data.actions || []);
      }
    } catch {
      console.error('Failed to fetch social actions');
    }
  };

  const fetchInterestingTweets = async () => {
    setLoadingTweets(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/interesting-tweets`);
      if (res.ok) {
        const data = await res.json();
        setInterestingTweets(data.tweets || []);
      }
    } catch {
      toast.error('Failed to load interesting tweets');
    }
    finally { setLoadingTweets(false); }
  };

  const fetchRedditStatus = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/reddit/status`);
      if (res.ok) {
        const data = await res.json();
        setRedditStatus(data);
      }
    } catch {
      console.error('Failed to fetch Reddit status');
    }
  };

  const fetchRedditSubreddits = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/reddit/subreddits`);
      if (res.ok) {
        const data = await res.json();
        setRedditSubreddits(data.subreddits || []);
        if (data.subreddits?.length > 0) setRedditSubreddit(data.subreddits[0]);
      }
    } catch {
      console.error('Failed to fetch subreddits');
    }
  };

  const fetchRedditRelevant = async () => {
    setRedditLoadingRelevant(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/reddit/search/relevant?limit=25`);
      if (res.ok) {
        const data = await res.json();
        setRedditRelevant(data.posts || []);
      }
    } catch {
      toast.error('Failed to load relevant Reddit posts');
    }
    finally { setRedditLoadingRelevant(false); }
  };

  const fetchRedditCompetitors = async () => {
    setRedditLoadingCompetitors(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/reddit/search/competitors?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setRedditCompetitors(data.posts || []);
      }
    } catch {
      toast.error('Failed to load competitor posts');
    }
    finally { setRedditLoadingCompetitors(false); }
  };

  const fetchRedditMentions = async () => {
    setRedditLoadingMentions(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/reddit/mentions?limit=25`);
      if (res.ok) {
        const data = await res.json();
        setRedditMentions(data.mentions || []);
      }
    } catch {
      toast.error('Failed to load Reddit mentions');
    }
    finally { setRedditLoadingMentions(false); }
  };

  const fetchHotPosts = async (subreddit: string) => {
    if (!subreddit.trim()) return;
    setLoadingHotPosts(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/reddit/subreddit/${subreddit.trim()}/hot?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setHotPosts(data.posts || []);
        setHotSubredditSearch(subreddit.trim());
      }
    } catch {
      toast.error('Failed to load hot posts');
    }
    finally { setLoadingHotPosts(false); }
  };

  const generateRedditPost = async () => {
    if (!redditTopic.trim() || !redditSubreddit) return;
    setRedditGenerating(true);
    setRedditDraft(null);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/reddit/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: redditTopic, subreddit: redditSubreddit, post_type: redditPostType }),
      });
      if (res.ok) {
        const data = await res.json();
        setRedditDraft(data.post);
      }
    } catch {
      toast.error('Failed to generate Reddit post');
    }
    finally { setRedditGenerating(false); }
  };

  const publishRedditDraft = async () => {
    if (!redditDraft) return;
    setRedditPublishing(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/reddit/submit/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subreddit: redditDraft.subreddit, title: redditDraft.title, text: redditDraft.body }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success(`Post published! ${data.result?.post_url || ''}`);
          setRedditDraft(null);
          setRedditTopic('');
        }
      }
    } catch {
      toast.error('Failed to publish Reddit post');
    }
    finally { setRedditPublishing(false); }
  };

  const generateAndPublishReddit = async () => {
    if (!redditTopic.trim() || !redditSubreddit) return;
    setRedditQuickPublishing(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/reddit/generate-and-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: redditTopic, subreddit: redditSubreddit, post_type: redditPostType }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const status = data.result?.status === 'published' ? 'Published' : 'Saved as draft';
          toast.success(`${status}! ${data.result?.post_url || ''}`);
          setRedditTopic('');
        }
      }
    } catch {
      toast.error('Error connecting to backend');
    }
    finally { setRedditQuickPublishing(false); }
  };

  const openCommentModal = async (post: RedditPost) => {
    setGeneratingComment(post.id);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/reddit/generate-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_title: post.title, post_body: post.selftext, subreddit: post.subreddit }),
      });
      if (res.ok) {
        const data = await res.json();
        setCommentModal({ post, generatedComment: data.comment || '', submitting: false });
      }
    } catch {
      toast.error('Failed to generate comment');
    }
    finally { setGeneratingComment(null); }
  };

  const submitComment = async () => {
    if (!commentModal) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/social/reddit/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: commentModal.post.fullname, text: commentModal.generatedComment }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success('Comment published!');
          setCommentModal(null);
        }
      }
    } catch {
      toast.error('Error publishing comment');
    }
    finally { setSubmittingComment(false); }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setActiveTab('actions');
    try {
      const response = await fetch(`${SAMA_API_URL}/api/social/analyze`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
        // Merge db_id from saved actions
        const savedActions = (data.actions || []).map((a: Action, i: number) => ({
          ...a,
          db_id: data.action_ids?.[i]
        }));
        setActions(savedActions);
        if (data.interesting_tweets?.length) {
          setInterestingTweets(data.interesting_tweets);
        }
        await fetchDbActions();
      } else {
        toast.error('Analysis failed. Check backend connection.');
      }
    } catch {
      toast.error('Error connecting to backend.');
    } finally {
      setAnalyzing(false);
    }
  };

  const executeAction = async (action: Action) => {
    setExecuting(action.id);
    try {
      const response = await fetch(`${SAMA_API_URL}/api/social/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      if (response.ok) {
        const result = await response.json();
        setExecutionResults(prev => ({ ...prev, [action.id]: result }));
        setActions(prev => prev.map(a => a.id === action.id ? { ...a, status: 'completed' } : a));
        // Refresh drafts after generation
        if (['generate_post', 'generate_thread'].includes(action.type)) {
          setTimeout(fetchDrafts, 1000);
        }
      } else {
        setExecutionResults(prev => ({ ...prev, [action.id]: { error: 'Execution failed' } }));
      }
    } catch {
      setExecutionResults(prev => ({ ...prev, [action.id]: { error: 'Backend not reachable' } }));
    } finally {
      setExecuting(null);
    }
  };

  const executeAll = async () => {
    for (const action of actions.filter(a => a.status === 'pending')) {
      await executeAction(action);
    }
  };

  const dismissAction = (id: string) => {
    const action = actions.find(a => a.id === id);
    if (action?.db_id) {
      fetch(`${SAMA_API_URL}/api/social/actions/${action.db_id}`, { method: 'DELETE' }).catch(() => {});
    }
    setActions(prev => prev.filter(a => a.id !== id));
  };

  const dismissTweet = (id: string) => {
    setInterestingTweets(prev => prev.filter(t => t.id !== id));
  };

  const getPriorityColor = (p: string) => {
    if (p === 'critical') return 'bg-red-100 text-red-800 border-red-200';
    if (p === 'high') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (p === 'medium') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getTypeIcon = (t: string) => {
    if (t === 'generate_post') return <Send className="h-5 w-5 text-blue-600" />;
    if (t === 'generate_thread') return <MessageCircle className="h-5 w-5 text-purple-600" />;
    if (t === 'reply') return <Repeat2 className="h-5 w-5 text-green-600" />;
    if (t === 'competitor_engage') return <AlertTriangle className="h-5 w-5 text-orange-600" />;
    if (t === 'engage_interesting') return <Sparkles className="h-5 w-5 text-violet-600" />;
    if (t === 'config') return <AlertTriangle className="h-5 w-5 text-red-600" />;
    return <Twitter className="h-5 w-5 text-slate-600" />;
  };

  const pendingCount = actions.filter(a => a.status === 'pending').length;
  const completedCount = actions.filter(a => a.status === 'completed').length;
  const calendarActions = actions.filter(a => a.type === 'generate_post');
  const mentionActions = actions.filter(a => a.type === 'reply' || a.type === 'competitor_engage');
  const engageActions = actions.filter(a => a.type === 'engage_interesting');

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number; dot?: 'green' | 'red' }[] = [
    { id: 'actions', label: 'All Actions', icon: <Zap className="h-4 w-4" />, count: pendingCount || undefined },
    { id: 'interesting', label: 'Interesting Tweets', icon: <Sparkles className="h-4 w-4" />, count: interestingTweets.length || engageActions.length || undefined },
    { id: 'drafts', label: 'Saved Drafts', icon: <FileText className="h-4 w-4" />, count: drafts.length || undefined },
    { id: 'calendar', label: 'Content Calendar', icon: <Calendar className="h-4 w-4" />, count: calendarActions.length || undefined },
    { id: 'mentions', label: 'Mentions & Replies', icon: <MessageCircle className="h-4 w-4" />, count: mentionActions.length || undefined },
    {
      id: 'reddit',
      label: 'Reddit',
      icon: <RedditIcon className="h-4 w-4" />,
      dot: redditStatus ? (redditStatus.configured ? 'green' : 'red') : undefined,
    },
  ];

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    if (tabId === 'reddit') {
      if (redditRelevant.length === 0) fetchRedditRelevant();
      if (redditCompetitors.length === 0) fetchRedditCompetitors();
      if (redditMentions.length === 0) fetchRedditMentions();
    }
  };

  // DB completed actions count
  const dbCompletedCount = dbActions.filter((a: any) => a.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Social Strategy</h2>
            <p className="mt-2 text-slate-600">Analyze → Discover tweets → Generate content → Engage → Publish</p>
          </div>
          <button onClick={runAnalysis} disabled={analyzing}
            className="flex items-center gap-2 rounded-lg bg-pink-600 px-6 py-3 font-medium text-white hover:bg-pink-700 disabled:bg-pink-400 shadow-lg shadow-pink-600/20">
            {analyzing ? <><Clock className="h-5 w-5 animate-spin" /> Analyzing...</> : <><Zap className="h-5 w-5" /> Run Social Analysis</>}
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-5">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Pending Actions</p>
            <p className="mt-1 text-2xl font-bold text-orange-600">{pendingCount}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Completed</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{completedCount + dbCompletedCount}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Saved Drafts</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{drafts.length}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Tweet Opportunities</p>
            <p className="mt-1 text-2xl font-bold text-violet-600">{interestingTweets.length || engageActions.length}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Twitter API</p>
            <p className="mt-1 text-2xl font-bold">
              {analysis?.summary?.twitter_configured
                ? <span className="text-green-600">Connected</span>
                : <span className="text-red-600">Not Set</span>
              }
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-white p-1 border shadow-sm overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'bg-pink-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-pink-100 text-pink-700'
                }`}>{tab.count}</span>
              )}
              {tab.dot && (
                <span className={`h-2 w-2 rounded-full ${tab.dot === 'green' ? 'bg-green-400' : 'bg-red-400'}`} />
              )}
            </button>
          ))}
        </div>

        {/* Summary bar */}
        {analysis && (
          <div className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 text-sm flex-wrap">
                <span className="font-medium text-slate-900">{analysis.summary?.total_actions || 0} actions generated</span>
                {analysis.actions_saved > 0 && <span className="text-blue-600">{analysis.actions_saved} saved to DB</span>}
                <span className="text-orange-600">{analysis.summary?.competitor_opportunities || 0} competitor opportunities</span>
                <span className="text-violet-600">{analysis.interesting_tweets?.length || 0} interesting tweets found</span>
              </div>
              {pendingCount > 0 && (
                <button onClick={executeAll} disabled={executing !== null}
                  className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:bg-pink-400">
                  <Play className="h-4 w-4" /> Execute All ({pendingCount})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab content */}

        {/* ACTIONS TAB */}
        {activeTab === 'actions' && (
          <ActionsList
            actions={actions}
            executing={executing}
            executionResults={executionResults}
            expandedAction={expandedAction}
            setExpandedAction={setExpandedAction}
            executeAction={executeAction}
            dismissAction={dismissAction}
            getPriorityColor={getPriorityColor}
            getTypeIcon={getTypeIcon}
          />
        )}

        {/* INTERESTING TWEETS TAB */}
        {activeTab === 'interesting' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Tweets about customer success pain points, churn challenges, and CS leadership topics.
                {!analysis?.summary?.twitter_configured && <span className="text-orange-600 ml-2">Configure Twitter API to enable live search.</span>}
              </p>
              <button onClick={fetchInterestingTweets} disabled={loadingTweets}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${loadingTweets ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Engage actions from analysis */}
            {engageActions.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">From last analysis ({engageActions.length} opportunities)</h3>
                <ActionsList
                  actions={engageActions}
                  executing={executing}
                  executionResults={executionResults}
                  expandedAction={expandedAction}
                  setExpandedAction={setExpandedAction}
                  executeAction={executeAction}
                  dismissAction={dismissAction}
                  getPriorityColor={getPriorityColor}
                  getTypeIcon={getTypeIcon}
                />
              </div>
            )}

            {/* Live interesting tweets */}
            {interestingTweets.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Live Tweet Feed ({interestingTweets.length})</h3>
                {interestingTweets.map(tweet => (
                  <div key={tweet.id} className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-slate-900">@{tweet.user.username}</span>
                          <span className="text-xs text-slate-400">{tweet.user.followers_count.toLocaleString()} followers</span>
                          {tweet.engagement_score > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
                              <TrendingUp className="h-3 w-3" /> {tweet.engagement_score} engagements
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700">{tweet.text}</p>
                        {tweet.user.description && (
                          <p className="mt-1 text-xs text-slate-400 italic">{tweet.user.description.slice(0, 100)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a href={tweet.tweet_url} target="_blank" rel="noopener noreferrer"
                          className="rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> View
                        </a>
                        <button onClick={() => dismissTweet(tweet.id)}
                          className="rounded-lg border px-2 py-1.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <Sparkles className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Interesting Tweets Loaded</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Run Social Analysis to find customer success pain point tweets automatically, or click Refresh.
                </p>
              </div>
            )}
          </div>
        )}

        {/* DRAFTS TAB */}
        {activeTab === 'drafts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Content generated by the Social Agent, saved as drafts.</p>
              <button onClick={fetchDrafts} disabled={loadingDrafts}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${loadingDrafts ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {drafts.length > 0 ? (
              <div className="space-y-3">
                {drafts.map(draft => (
                  <div key={draft.id} className="rounded-lg border bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
                            draft.content_type === 'thread' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                          }`}>
                            {draft.content_type === 'thread' ? '🧵 Thread' : '🐦 Tweet'}
                          </span>
                          <span className="text-xs text-slate-400">{new Date(draft.created_at).toLocaleDateString('sv-SE')}</span>
                          {draft.word_count > 0 && <span className="text-xs text-slate-400">{draft.word_count} words</span>}
                        </div>
                        <h4 className="font-medium text-slate-900 mb-2">{draft.title}</h4>
                        <div className="rounded-lg bg-slate-50 p-3 space-y-2">
                          {draft.content?.split('\n\n').filter(Boolean).map((tweet, i) => (
                            <div key={i} className="rounded bg-white p-2 text-sm text-slate-700 border">
                              {draft.content_type === 'thread' && (
                                <span className="text-xs text-slate-400 font-medium mr-2">{i + 1}.</span>
                              )}
                              {tweet}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <FileText className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Drafts Yet</h3>
                <p className="mt-2 text-sm text-slate-500">Execute "Generate Post" or "Generate Thread" actions to create saved drafts.</p>
              </div>
            )}
          </div>
        )}

        {/* CALENDAR TAB */}
        {activeTab === 'calendar' && (
          <div className="space-y-3">
            {calendarActions.length > 0 ? (
              calendarActions.map(action => (
                <div key={action.id} className={`rounded-lg border bg-white p-4 shadow-sm ${action.status === 'completed' ? 'opacity-75' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {action.status === 'completed' ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Calendar className="h-5 w-5 text-blue-600" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-slate-900">{action.title}</h4>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${getPriorityColor(action.priority)}`}>{action.priority}</span>
                          {action.is_thread && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">Thread</span>}
                        </div>
                        <p className="text-sm text-slate-500">{action.description}</p>
                      </div>
                    </div>
                    {action.status === 'pending' && (
                      <button onClick={() => executeAction(action)} disabled={executing === action.id}
                        className="flex items-center gap-1 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-700 disabled:bg-pink-400">
                        {executing === action.id ? <><Clock className="h-3 w-3 animate-spin" /> Generating...</> : <><Play className="h-3 w-3" /> Generate</>}
                      </button>
                    )}
                  </div>
                  {executionResults[action.id]?.result?.tweets && (
                    <div className="mt-3 ml-8 space-y-2">
                      {executionResults[action.id].result.tweets.map((tweet: string, i: number) => (
                        <div key={i} className="rounded bg-slate-50 p-2 text-sm text-slate-700 border">
                          <span className="text-xs text-slate-400 mr-2">{i + 1}.</span>{tweet}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <Calendar className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Calendar Posts Yet</h3>
                <p className="mt-2 text-sm text-slate-500">Run Social Analysis to generate your 7-day content calendar.</p>
              </div>
            )}
          </div>
        )}

        {/* REDDIT TAB */}
        {activeTab === 'reddit' && (
          <RedditTab
            status={redditStatus}
            subreddits={redditSubreddits}
            topic={redditTopic}
            setTopic={setRedditTopic}
            subreddit={redditSubreddit}
            setSubreddit={setRedditSubreddit}
            postType={redditPostType}
            setPostType={setRedditPostType}
            generating={redditGenerating}
            draft={redditDraft}
            setDraft={setRedditDraft}
            publishing={redditPublishing}
            quickPublishing={redditQuickPublishing}
            onGenerate={generateRedditPost}
            onPublish={publishRedditDraft}
            onGenerateAndPublish={generateAndPublishReddit}
            relevantPosts={redditRelevant}
            loadingRelevant={redditLoadingRelevant}
            onRefreshRelevant={fetchRedditRelevant}
            competitorPosts={redditCompetitors}
            loadingCompetitors={redditLoadingCompetitors}
            onRefreshCompetitors={fetchRedditCompetitors}
            mentions={redditMentions}
            loadingMentions={redditLoadingMentions}
            onRefreshMentions={fetchRedditMentions}
            hotSubredditInput={hotSubredditInput}
            setHotSubredditInput={setHotSubredditInput}
            hotPosts={hotPosts}
            loadingHotPosts={loadingHotPosts}
            onFetchHot={() => fetchHotPosts(hotSubredditInput)}
            hotSubredditSearch={hotSubredditSearch}
            commentModal={commentModal}
            setCommentModal={setCommentModal}
            generatingComment={generatingComment}
            onOpenCommentModal={openCommentModal}
            submittingComment={submittingComment}
            onSubmitComment={submitComment}
          />
        )}

        {/* MENTIONS TAB */}
        {activeTab === 'mentions' && (
          <div className="space-y-3">
            {mentionActions.length > 0 ? (
              mentionActions.map(action => (
                <div key={action.id} className={`rounded-lg border bg-white p-4 shadow-sm ${action.status === 'completed' ? 'opacity-75' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      {action.status === 'completed' ? <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" /> : getTypeIcon(action.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-slate-900">{action.title}</h4>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${getPriorityColor(action.priority)}`}>{action.priority}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{action.type.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-sm text-slate-500 italic">"{action.description}"</p>
                        {executionResults[action.id]?.result?.reply && (
                          <div className="mt-2 rounded-lg bg-green-50 p-3">
                            <p className="text-xs font-medium text-green-700 mb-1">Generated Reply</p>
                            <p className="text-sm text-slate-700">{executionResults[action.id].result.reply}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {action.tweet_url && (
                        <a href={action.tweet_url} target="_blank" rel="noopener noreferrer"
                          className="rounded-lg border px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {action.status === 'pending' && (
                        <button onClick={() => executeAction(action)} disabled={executing === action.id}
                          className="flex items-center gap-1 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-700 disabled:bg-pink-400">
                          {executing === action.id ? <><Clock className="h-3 w-3 animate-spin" /> Running...</> : <><Play className="h-3 w-3" /> Reply</>}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <MessageCircle className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Mentions Found</h3>
                <p className="mt-2 text-sm text-slate-500">Configure Twitter API and run analysis to monitor mentions.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}


// Reddit brand icon (inline SVG)
function RedditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" style={{ color: '#FF4500' }}>
      <circle cx="10" cy="10" r="10" fill="#FF4500" />
      <path fill="white" d="M16.67 10a1.46 1.46 0 00-2.47-1 7.12 7.12 0 00-3.85-1.23l.65-3.08 2.13.45a1 1 0 101.07-1 1 1 0 00-.96.68l-2.38-.5a.17.17 0 00-.2.13l-.73 3.44a7.14 7.14 0 00-3.89 1.23 1.46 1.46 0 10-1.61 2.39 2.87 2.87 0 000 .44c0 2.24 2.61 4.06 5.83 4.06s5.83-1.82 5.83-4.06a2.87 2.87 0 000-.44 1.46 1.46 0 00.49-1.51zm-9.06 1.27a1 1 0 111 1 1 1 0 01-1-1zm5.55 2.65a3.47 3.47 0 01-4.32 0 .17.17 0 01.24-.24 3.13 3.13 0 003.84 0 .17.17 0 11.24.24zm-.18-1.65a1 1 0 111-1 1 1 0 01-1 1z" />
    </svg>
  );
}

// Reddit Tab component
function RedditTab({
  status, subreddits, topic, setTopic, subreddit, setSubreddit, postType, setPostType,
  generating, draft, setDraft, publishing, quickPublishing,
  onGenerate, onPublish, onGenerateAndPublish,
  relevantPosts, loadingRelevant, onRefreshRelevant,
  competitorPosts, loadingCompetitors, onRefreshCompetitors,
  mentions, loadingMentions, onRefreshMentions,
  hotSubredditInput, setHotSubredditInput, hotPosts, loadingHotPosts, onFetchHot, hotSubredditSearch,
  commentModal, setCommentModal, generatingComment, onOpenCommentModal, submittingComment, onSubmitComment,
}: {
  status: RedditStatus | null;
  subreddits: string[];
  topic: string; setTopic: (v: string) => void;
  subreddit: string; setSubreddit: (v: string) => void;
  postType: 'educational' | 'case_study' | 'question' | 'tips';
  setPostType: (v: 'educational' | 'case_study' | 'question' | 'tips') => void;
  generating: boolean;
  draft: RedditDraft | null; setDraft: (d: RedditDraft | null) => void;
  publishing: boolean; quickPublishing: boolean;
  onGenerate: () => void; onPublish: () => void; onGenerateAndPublish: () => void;
  relevantPosts: RedditPost[]; loadingRelevant: boolean; onRefreshRelevant: () => void;
  competitorPosts: RedditPost[]; loadingCompetitors: boolean; onRefreshCompetitors: () => void;
  mentions: RedditMention[]; loadingMentions: boolean; onRefreshMentions: () => void;
  hotSubredditInput: string; setHotSubredditInput: (v: string) => void;
  hotPosts: RedditPost[]; loadingHotPosts: boolean; onFetchHot: () => void; hotSubredditSearch: string;
  commentModal: { post: RedditPost; generatedComment: string; submitting: boolean } | null;
  setCommentModal: (m: { post: RedditPost; generatedComment: string; submitting: boolean } | null) => void;
  generatingComment: string | null;
  onOpenCommentModal: (post: RedditPost) => void;
  submittingComment: boolean;
  onSubmitComment: () => void;
}) {
  const configured = status?.configured ?? false;

  const publishDisabledProps = !configured
    ? { disabled: true, title: 'Configure Reddit API keys' }
    : {};

  const postTypeLabels: Record<string, string> = {
    educational: 'Educational', case_study: 'Case Study', question: 'Question', tips: 'Tips',
  };

  return (
    <div className="space-y-8">
      {/* Status banner */}
      {status && !configured && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Reddit ej konfigurerat</p>
            {status.message && <p className="mt-0.5 text-sm text-yellow-700">{status.message}</p>}
          </div>
        </div>
      )}

      {/* --- GENERATE POST --- */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <RedditIcon className="h-5 w-5" />
            <h3 className="font-semibold text-slate-900">Generate Post</h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="t.ex. Hur vi minskade churn med 30%..."
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Subreddit</label>
              <select
                value={subreddit}
                onChange={e => setSubreddit(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {subreddits.map(s => <option key={s} value={s}>r/{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Typ</label>
              <select
                value={postType}
                onChange={e => setPostType(e.target.value as typeof postType)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="educational">Educational</option>
                <option value="case_study">Case Study</option>
                <option value="question">Question</option>
                <option value="tips">Tips</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={onGenerate}
                disabled={generating || !topic.trim() || !subreddit}
                className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:bg-orange-300"
              >
                {generating ? <><Clock className="h-4 w-4 animate-spin" /> Genererar...</> : <><Sparkles className="h-4 w-4" /> Generera</>}
              </button>
              <button
                onClick={onGenerateAndPublish}
                disabled={quickPublishing || !topic.trim() || !subreddit || !configured}
                {...(!configured ? { title: 'Configure Reddit API keys' } : {})}
                className="flex items-center gap-2 rounded-lg border border-orange-300 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
              >
                {quickPublishing ? <><Clock className="h-4 w-4 animate-spin" /> Publicerar...</> : <><Send className="h-4 w-4" /> Generera & Publicera direkt</>}
              </button>
            </div>
          </div>

          {/* Draft preview */}
          {draft && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-orange-600">Preview – r/{draft.subreddit} · {postTypeLabels[draft.post_type] ?? draft.post_type}</span>
                <button onClick={() => setDraft(null)} className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div>
                <p className="font-semibold text-slate-900 mb-2">{draft.title}</p>
                <textarea
                  value={draft.body}
                  onChange={e => setDraft({ ...draft, body: e.target.value })}
                  rows={6}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onPublish}
                  disabled={publishing}
                  {...publishDisabledProps}
                  className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {publishing ? <><Clock className="h-4 w-4 animate-spin" /> Publicerar...</> : <><Send className="h-4 w-4" /> Publicera</>}
                </button>
                <button onClick={() => setDraft(null)} className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Kassera
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- RELEVANT DISCUSSIONS --- */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Relevanta diskussioner</h3>
          <button onClick={onRefreshRelevant} disabled={loadingRelevant}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loadingRelevant ? 'animate-spin' : ''}`} /> Fetch
          </button>
        </div>
        <RedditPostTable posts={relevantPosts} loading={loadingRelevant} configured={configured}
          generatingComment={generatingComment} onOpenCommentModal={onOpenCommentModal}
          emptyMessage="Click Fetch to load relevant discussions." />
      </div>

      {/* --- COMPETITOR MONITORING --- */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Konkurrentbevakning</h3>
            <p className="text-xs text-slate-500 mt-0.5">Gainsight / Totango / ChurnZero – mentions</p>
          </div>
          <button onClick={onRefreshCompetitors} disabled={loadingCompetitors}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loadingCompetitors ? 'animate-spin' : ''}`} /> Fetch
          </button>
        </div>
        <RedditPostTable posts={competitorPosts} loading={loadingCompetitors} configured={configured}
          generatingComment={generatingComment} onOpenCommentModal={onOpenCommentModal}
          emptyMessage="Click Fetch to load competitor mentions." />
      </div>

      {/* --- MENTIONS --- */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">My Mentions</h3>
          <button onClick={onRefreshMentions} disabled={loadingMentions}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loadingMentions ? 'animate-spin' : ''}`} /> Fetch
          </button>
        </div>
        <div className="divide-y">
          {loadingMentions ? (
            <div className="p-8 text-center"><Clock className="mx-auto h-8 w-8 animate-spin text-slate-300" /></div>
          ) : mentions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Click Fetch to load mentions.</div>
          ) : (
            mentions.map(m => (
              <div key={m.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-slate-900 text-sm">u/{m.author}</span>
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">r/{m.subreddit}</span>
                      <span className="text-xs text-slate-400">{new Date(m.created_utc * 1000).toLocaleDateString('sv-SE')}</span>
                    </div>
                    {m.subject && <p className="text-xs font-medium text-slate-500 mb-1">{m.subject}</p>}
                    <p className="text-sm text-slate-700 line-clamp-2">{m.body}</p>
                  </div>
                  {m.context && (
                    <a href={`https://reddit.com${m.context}`} target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                      <ArrowUpRight className="h-3.5 w-3.5" /> Visa
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- SUBREDDIT EXPLORATION --- */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h3 className="font-semibold text-slate-900">Utforska subreddit</h3>
        </div>
        <div className="p-6">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={hotSubredditInput}
                onChange={e => setHotSubredditInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onFetchHot()}
                placeholder="Subredditnamn, t.ex. CustomerSuccess"
                className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <button onClick={onFetchHot} disabled={loadingHotPosts || !hotSubredditInput.trim()}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:bg-orange-300">
              {loadingHotPosts ? <Clock className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>
          {hotPosts.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-500">Hot posts i r/{hotSubredditSearch}</p>
              {hotPosts.map(post => (
                <div key={post.id} className="rounded-lg border bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 line-clamp-2">{post.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-400">u/{post.author}</span>
                        <span className="flex items-center gap-0.5 text-xs text-orange-600"><TrendingUp className="h-3 w-3" />{post.score}</span>
                        <span className="flex items-center gap-0.5 text-xs text-slate-500"><MessageCircle className="h-3 w-3" />{post.num_comments}</span>
                      </div>
                    </div>
                    <a href={`https://reddit.com${post.permalink}`} target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs text-slate-600 hover:bg-white">
                      <ExternalLink className="h-3 w-3" /> Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- COMMENT MODAL --- */}
      {commentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h4 className="font-semibold text-slate-900">Genererat svar</h4>
              <button onClick={() => setCommentModal(null)} className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500 mb-1">Replying to</p>
                <p className="text-sm font-medium text-slate-900 line-clamp-2">{commentModal.post.title}</p>
                <p className="text-xs text-slate-400 mt-1">r/{commentModal.post.subreddit} · u/{commentModal.post.author}</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Ditt svar (redigerbart)</label>
                <textarea
                  value={commentModal.generatedComment}
                  onChange={e => setCommentModal({ ...commentModal, generatedComment: e.target.value })}
                  rows={6}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onSubmitComment}
                  disabled={submittingComment || !configured}
                  {...(!configured ? { title: 'Configure Reddit API keys' } : {})}
                  className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {submittingComment ? <><Clock className="h-4 w-4 animate-spin" /> Publicerar...</> : <><Send className="h-4 w-4" /> Publicera kommentar</>}
                </button>
                <button onClick={() => setCommentModal(null)} className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable Reddit post table
function RedditPostTable({
  posts, loading, configured, generatingComment, onOpenCommentModal, emptyMessage,
}: {
  posts: RedditPost[];
  loading: boolean;
  configured: boolean;
  generatingComment: string | null;
  onOpenCommentModal: (post: RedditPost) => void;
  emptyMessage: string;
}) {
  if (loading) {
    return <div className="p-8 text-center"><Clock className="mx-auto h-8 w-8 animate-spin text-slate-300" /></div>;
  }
  if (posts.length === 0) {
    return <div className="p-8 text-center text-sm text-slate-500">{emptyMessage}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left">
            <th className="px-4 py-3 font-medium text-slate-600">Titel</th>
            <th className="px-4 py-3 font-medium text-slate-600">Subreddit</th>
            <th className="px-4 py-3 font-medium text-slate-600 text-right">Score</th>
            <th className="px-4 py-3 font-medium text-slate-600 text-right">Kommentarer</th>
            <th className="px-4 py-3 font-medium text-slate-600">Link</th>
            <th className="px-4 py-3 font-medium text-slate-600">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {posts.map(post => (
            <tr key={post.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 max-w-xs">
                <p className="font-medium text-slate-900 line-clamp-2 text-sm">{post.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">u/{post.author}</p>
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">r/{post.subreddit}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="flex items-center justify-end gap-1 text-orange-600 font-medium">
                  <TrendingUp className="h-3 w-3" />{post.score.toLocaleString()}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="flex items-center justify-end gap-1 text-slate-600">
                  <MessageCircle className="h-3 w-3" />{post.num_comments.toLocaleString()}
                </span>
              </td>
              <td className="px-4 py-3">
                <a href={`https://reddit.com${post.permalink}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                  <ExternalLink className="h-3 w-3" /> Reddit
                </a>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onOpenCommentModal(post)}
                  disabled={generatingComment === post.id || !configured}
                  title={!configured ? 'Configure Reddit API keys' : undefined}
                  className="flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {generatingComment === post.id
                    ? <><Clock className="h-3 w-3 animate-spin" /> Genererar...</>
                    : <><MessageCircle className="h-3 w-3" /> Generera svar</>}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Extracted ActionsList component
function ActionsList({
  actions, executing, executionResults, expandedAction, setExpandedAction, executeAction, dismissAction, getPriorityColor, getTypeIcon
}: {
  actions: Action[];
  executing: string | null;
  executionResults: Record<string, any>;
  expandedAction: string | null;
  setExpandedAction: (id: string | null) => void;
  executeAction: (a: Action) => void;
  dismissAction: (id: string) => void;
  getPriorityColor: (p: string) => string;
  getTypeIcon: (t: string) => React.ReactNode;
}) {
  if (actions.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
        <Zap className="mx-auto h-12 w-12 text-slate-300" />
        <h3 className="mt-4 text-lg font-semibold text-slate-900">No Actions Yet</h3>
        <p className="mt-2 text-sm text-slate-500">Click "Run Social Analysis" to generate your content calendar and find engagement opportunities.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actions.map((action) => (
        <div key={action.id} className={`rounded-lg border bg-white shadow-sm transition-all ${action.status === 'completed' ? 'opacity-75' : ''}`}>
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {action.status === 'completed' ? <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" /> : getTypeIcon(action.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium text-slate-900">{action.title}</h4>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${getPriorityColor(action.priority)}`}>{action.priority}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{action.type.replace(/_/g, ' ')}</span>
                    {action.scheduled_date && <span className="text-xs text-slate-400">{action.scheduled_date}</span>}
                    {action.status === 'completed' && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Done</span>}
                  </div>
                  <p className="text-sm text-slate-600">{action.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                {action.tweet_url && (
                  <a href={action.tweet_url} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg border p-1.5 text-slate-500 hover:bg-slate-50">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {action.status === 'pending' && action.type !== 'config' && (
                  <button onClick={() => executeAction(action)} disabled={executing === action.id}
                    className="flex items-center gap-1 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-700 disabled:bg-pink-400">
                    {executing === action.id ? <><Clock className="h-3 w-3 animate-spin" /> Running...</> : <><Play className="h-3 w-3" /> Execute</>}
                  </button>
                )}
                <button onClick={() => dismissAction(action.id)}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                  className="rounded p-1 hover:bg-slate-100">
                  {expandedAction === action.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {expandedAction === action.id && (
              <div className="mt-3 ml-8 space-y-2">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">Recommended Action</p>
                  <p className="text-sm text-slate-700">{action.action}</p>
                </div>
                {action.original_tweet && (
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs font-medium text-blue-600 mb-1">Original Tweet</p>
                    <p className="text-sm text-slate-700 italic">"{action.original_tweet}"</p>
                    {action.username && <p className="text-xs text-slate-500 mt-1">— @{action.username}</p>}
                    {action.tweet_url && (
                      <a href={action.tweet_url} target="_blank" rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <ExternalLink className="h-3 w-3" /> View on Twitter
                      </a>
                    )}
                  </div>
                )}
                {executionResults[action.id] && (
                  <div className={`rounded-lg p-3 ${executionResults[action.id].error ? 'bg-red-50' : 'bg-green-50'}`}>
                    <p className="text-xs font-medium mb-1">{executionResults[action.id].error ? 'Error' : 'Result'}</p>
                    {executionResults[action.id].result ? (
                      <div>
                        {executionResults[action.id].result.tweets && (
                          <div className="space-y-2">
                            {executionResults[action.id].result.tweets.map((tweet: string, i: number) => (
                              <div key={i} className="rounded bg-white p-2 text-sm text-slate-700 border">
                                <span className="text-xs text-slate-400 mr-2">{i + 1}.</span>{tweet}
                              </div>
                            ))}
                          </div>
                        )}
                        {executionResults[action.id].result.reply && (
                          <p className="text-sm text-slate-700">{executionResults[action.id].result.reply}</p>
                        )}
                        {!executionResults[action.id].result.tweets && !executionResults[action.id].result.reply && (
                          <pre className="text-xs text-slate-700 whitespace-pre-wrap overflow-auto max-h-48">
                            {JSON.stringify(executionResults[action.id].result, null, 2)}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">{executionResults[action.id].message || executionResults[action.id].error || 'Done'}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
