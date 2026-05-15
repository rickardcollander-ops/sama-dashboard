import Link from "next/link";
import { ArrowRight, Calendar, Tag } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { getAllPosts } from "@/lib/blog";

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingHeader />

      <section className="mx-auto max-w-4xl px-4 pt-16 pb-8 sm:px-6 sm:pt-24">
        <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          Blog
        </span>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          GEO, AI search and content on autopilot
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-600">
          Guides, strategies and research on Generative Engine Optimization — so your brand is the
          one AI cites.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        {posts.length === 0 ? (
          <p className="py-12 text-center text-slate-500">No posts yet.</p>
        ) : (
          <div className="mt-6 divide-y divide-slate-100">
            {posts.map((post) => (
              <article key={post.slug} className="py-8">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(post.date).toLocaleDateString("en-GB", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  {post.language && (
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 font-medium uppercase">
                      {post.language}
                    </span>
                  )}
                  {post.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="mt-3 text-xl font-bold leading-snug sm:text-2xl">
                  <Link href={`/blog/${post.slug}`} className="hover:text-violet-700">
                    {post.title}
                  </Link>
                </h2>
                {post.excerpt && (
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3 sm:text-base">
                    {post.excerpt}
                  </p>
                )}
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900"
                >
                  Read more
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <MarketingFooter />
    </div>
  );
}
