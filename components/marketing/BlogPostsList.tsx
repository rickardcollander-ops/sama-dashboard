"use client";

import Link from "next/link";
import { ArrowRight, Calendar, Tag } from "lucide-react";
import { useLanguage } from "@/lib/hooks/useLanguage";
import type { BlogPost } from "@/lib/blog";

export default function BlogPostsList({ posts }: { posts: BlogPost[] }) {
  const { language } = useLanguage();
  const filtered = posts.filter((p) => p.language === language);

  if (filtered.length === 0) {
    return (
      <p className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
        No posts yet.
      </p>
    );
  }

  return (
    <div className="mt-6 divide-y" style={{ borderColor: "var(--border-subtle)" }}>
      {filtered.map((post) => (
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
              className="transition-colors hover:text-[var(--neon-orange)]"
              style={{ color: "var(--text-primary)" }}
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
  );
}
