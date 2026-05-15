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
    <div className="min-h-screen bg-white text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <MarketingHeader />

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
        {/* Back */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Blog
        </Link>

        {/* Meta */}
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-500">
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
          {post.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {tag}
            </span>
          ))}
        </div>

        {/* Author */}
        {post.author && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <User className="h-4 w-4" />
            <span>{post.author}</span>
          </div>
        )}

        {/* Content */}
        <div className="prose prose-slate mt-8 max-w-none prose-headings:font-bold prose-a:text-violet-700 prose-a:no-underline hover:prose-a:underline prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-img:rounded-xl">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSlug]}
          >
            {post.content}
          </ReactMarkdown>
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-violet-200 bg-violet-50 p-6 sm:p-8">
          <p className="text-base font-semibold text-slate-900">
            Ready to see how AI sees your site?
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Run a free 30-second audit and get your first AI Gap angles.
          </p>
          <Link
            href="/audit"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Run free audit →
          </Link>
        </div>
      </article>

      <MarketingFooter />
    </div>
  );
}
