import Link from "next/link";
import { ArrowRight, Calendar, Tag } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { getAllPosts } from "@/lib/blog";

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="mkt-site">
      <MarketingHeader />

      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(184,79,255,0.1) 0%, transparent 60%)",
          }}
        />
        <div className="mx-auto max-w-4xl px-4 pt-16 pb-8 sm:px-6 sm:pt-24">
          <span className="neon-eyebrow">Blog</span>
          <h1
            className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ color: "var(--text-primary)" }}
          >
            GEO, AI search and content on autopilot
          </h1>
          <p
            className="mt-4 max-w-2xl text-base"
            style={{ color: "var(--text-secondary)" }}
          >
            Guides, strategies and research on Generative Engine Optimization — so your brand is the
            one AI cites.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        {posts.length === 0 ? (
          <p className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
            No posts yet.
          </p>
        ) : (
          <div className="mt-6 divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {posts.map((post) => (
              <article key={post.slug} className="py-8">
                <div
                  className="flex flex-wrap items-center gap-3 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(post.date).toLocaleDateString("en-GB", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  {post.language && (
                    <span
                      className="rounded-full px-2 py-0.5 font-medium uppercase"
                      style={{
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-muted)",
                      }}
                    >
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
                <h2
                  className="mt-3 text-xl font-bold leading-snug sm:text-2xl"
                  style={{ color: "var(--text-primary)" }}
                >
                  <Link
                    href={`/blog/${post.slug}`}
                    className="transition-colors"
                    style={{ color: "var(--text-primary)" }}
                    onMouseEnter={(e) =>
                      ((e.target as HTMLElement).style.color = "var(--neon-orange)")
                    }
                    onMouseLeave={(e) =>
                      ((e.target as HTMLElement).style.color = "var(--text-primary)")
                    }
                  >
                    {post.title}
                  </Link>
                </h2>
                {post.excerpt && (
                  <p
                    className="mt-2 text-sm line-clamp-3 sm:text-base"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {post.excerpt}
                  </p>
                )}
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold transition"
                  style={{ color: "var(--neon-orange)" }}
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
