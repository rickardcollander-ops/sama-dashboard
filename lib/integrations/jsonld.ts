interface ArticleJsonLdInput {
  title: string;
  description?: string;
  url?: string;
  image?: string;
  author_name?: string;
  publisher_name?: string;
  publisher_logo?: string;
  date_published?: string;
  date_modified?: string;
  language?: string;
  keywords?: string[];
}

export function buildArticleJsonLd(input: ArticleJsonLdInput): Record<string, unknown> {
  const now = new Date().toISOString();
  const published = input.date_published || now;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    datePublished: published,
    dateModified: input.date_modified || published,
  };
  if (input.description) data.description = input.description;
  if (input.url) data.mainEntityOfPage = { "@type": "WebPage", "@id": input.url };
  if (input.image) data.image = [input.image];
  if (input.language) data.inLanguage = input.language;
  if (input.keywords?.length) data.keywords = input.keywords.join(", ");
  if (input.author_name) {
    data.author = { "@type": "Person", name: input.author_name };
  }
  if (input.publisher_name) {
    const publisher: Record<string, unknown> = {
      "@type": "Organization",
      name: input.publisher_name,
    };
    if (input.publisher_logo) {
      publisher.logo = { "@type": "ImageObject", url: input.publisher_logo };
    }
    data.publisher = publisher;
  }
  return data;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function buildFaqJsonLd(items: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
