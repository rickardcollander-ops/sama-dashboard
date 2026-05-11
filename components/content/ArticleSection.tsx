"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";

interface SectionImage {
  url?: string;
  alt?: string;
  credit?: string;
  credit_url?: string | null;
  source?: string;
}

interface Section {
  id: string;
  heading: string;
  body_md: string;
  image?: SectionImage | null;
}

interface Props {
  section: Section;
}

const PROSE_CLASSES = [
  "prose prose-slate max-w-none",
  "prose-headings:scroll-mt-24",
  "prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-8 prose-h3:mb-3",
  "prose-h4:text-base prose-h4:font-semibold prose-h4:mt-6 prose-h4:mb-2",
  "prose-p:text-slate-700 prose-p:leading-relaxed prose-p:my-4",
  "prose-li:text-slate-700 prose-li:my-1",
  "prose-strong:text-slate-900",
  "prose-a:text-orange-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline",
  "prose-blockquote:border-l-4 prose-blockquote:border-orange-300 prose-blockquote:bg-orange-50/40 prose-blockquote:py-2 prose-blockquote:px-5 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-slate-700",
  "prose-table:my-6 prose-table:text-sm",
  "prose-thead:border-b-2 prose-thead:border-slate-200",
  "prose-th:text-left prose-th:font-semibold prose-th:text-slate-900 prose-th:py-2 prose-th:px-3",
  "prose-td:align-top prose-td:py-2 prose-td:px-3 prose-td:border-b prose-td:border-slate-100",
  "prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
].join(" ");

export default function ArticleSection({ section }: Props) {
  const image = section.image;
  return (
    <section id={section.id} className="my-14 scroll-mt-24">
      <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-6">
        {section.heading}
      </h2>
      {image?.url && (
        <figure className="my-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.alt || section.heading}
            loading="lazy"
            className="w-full rounded-2xl border border-slate-200 object-cover shadow-sm"
            style={{ aspectRatio: "16/9" }}
          />
          {image.credit && (
            <figcaption className="text-xs text-slate-400 mt-2 text-center">
              {image.credit_url ? (
                <a
                  href={image.credit_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-600 hover:underline"
                >
                  {image.credit}
                </a>
              ) : (
                image.credit
              )}
            </figcaption>
          )}
        </figure>
      )}
      <div className={PROSE_CLASSES}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSlug, rehypeRaw]}
          components={{
            a: ({ href, children, ...rest }) => {
              const isExternal = !!href && /^https?:\/\//.test(href);
              return (
                <a
                  href={href}
                  {...rest}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {section.body_md}
        </ReactMarkdown>
      </div>
    </section>
  );
}
