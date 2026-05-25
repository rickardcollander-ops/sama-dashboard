import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import BlogPostsList from "@/components/marketing/BlogPostsList";
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
        <BlogPostsList posts={posts} />
      </section>

      <MarketingFooter />
    </div>
  );
}
