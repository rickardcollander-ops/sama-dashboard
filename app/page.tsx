import Link from "next/link";
import { Activity, BarChart3, MessageSquare, Search, TrendingUp, Users } from "lucide-react";

export default function Home() {
  const agents = [
    { name: "SEO Agent", icon: Search, status: "active", color: "bg-blue-500" },
    { name: "Content Agent", icon: MessageSquare, status: "active", color: "bg-purple-500" },
    { name: "Ads Agent", icon: TrendingUp, status: "active", color: "bg-green-500" },
    { name: "Social Agent", icon: Users, status: "active", color: "bg-pink-500" },
    { name: "Reviews Agent", icon: MessageSquare, status: "active", color: "bg-orange-500" },
    { name: "Analytics Agent", icon: BarChart3, status: "active", color: "bg-indigo-500" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">SAMA 2.0</h1>
            </div>
            <div className="flex gap-4">
              <Link href="/seo" className="text-sm font-medium text-slate-600 hover:text-slate-900">SEO</Link>
              <Link href="/ads" className="text-sm font-medium text-slate-600 hover:text-slate-900">Ads</Link>
              <Link href="/social" className="text-sm font-medium text-slate-600 hover:text-slate-900">Social</Link>
              <Link href="/logs" className="text-sm font-medium text-slate-600 hover:text-slate-900">Logs</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Agent Overview</h2>
          <p className="mt-2 text-slate-600">Monitor and control your autonomous marketing agents</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const agentPath = agent.name.toLowerCase().split(' ')[0]; // "SEO Agent" -> "seo"
            return (
              <div key={agent.name} className="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg ${agent.color} p-3`}>
                      <agent.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{agent.name}</h3>
                      <p className="text-sm text-slate-500">{agent.status}</p>
                    </div>
                  </div>
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/${agentPath}`} className="flex-1 rounded-md bg-slate-100 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-200">
                    View Details
                  </Link>
                  <button className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    Run
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Quick Stats</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-slate-500">SEO Position</p>
              <p className="text-2xl font-bold text-slate-900">1.6</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Clicks</p>
              <p className="text-2xl font-bold text-slate-900">34</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">CTR</p>
              <p className="text-2xl font-bold text-slate-900">29%</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Impressions</p>
              <p className="text-2xl font-bold text-slate-900">117</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
