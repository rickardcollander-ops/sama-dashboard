import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { Calendar, ArrowLeft, Tag, User } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { getAllPosts, getPostBySlug } from "@/lib/blog";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.date,
    dateModified: post.date,
    author: post.author
      ? {
          "@type": "Person",
          name: post.author,
          url: "https://sama.successifier.com/about",
        }
      : {
          "@type": "Organization",
          name: "Sama AI",
        },
    publisher: {
      "@type": "Organization",
      name: "Sama AI",
      logo: { "@type": "ImageObject", url: "https://sama.successifier.com/logo.png" },
    },
    mainEntityOfPage: `https://sama.successifier.com/blog/${post.slug}`,
    description: post.excerpt,
  };

  return (
    <div className="mkt-site">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <MarketingHeader />

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
        {/* Back */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Blog
        </Link>

        {/* Meta */}
        <div
          className="mt-6 flex flex-wrap items-center gap-3 text-xs"
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
              style={{ border: "1px solid var(--border-subtle)" }}
            >
              {post.language}
            </span>
          )}
          {post.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {tag}
            </span>
          ))}
        </div>

        {/* Author */}
        {post.author && (
          <div
            className="mt-4 flex items-center gap-2 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            <User className="h-4 w-4" />
            <span>{post.author}</span>
          </div>
        )}

        {/* Title */}
        <h1
          className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "var(--text-primary)" }}
        >
          {post.title}
        </h1>

        {/* Content */}
        <div className="prose prose-invert mt-8 max-w-none prose-headings:font-bold prose-a:text-orange-400 prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:px-1 prose-img:rounded-xl [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto"
          style={{
            "--tw-prose-body": "var(--text-secondary)",
            "--tw-prose-headings": "var(--text-primary)",
            "--tw-prose-code": "var(--neon-blue)",
            "--tw-prose-pre-bg": "rgba(10,10,26,0.8)",
          } as React.CSSProperties}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSlug]}
          >
            {post.content}
          </ReactMarkdown>
        </div>

        {/* CTA */}
        <div className="mt-12 ai-gap-box">
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Ready to see how AI sees your site?
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Run a free 30-second audit and get your first AI Gap angles.
          </p>
          <Link href="/audit" className="mt-4 hero-cta-primary inline-flex">
            Run free audit →
          </Link>
        </div>
      </article>

      <MarketingFooter />
    </div>
  );
}
