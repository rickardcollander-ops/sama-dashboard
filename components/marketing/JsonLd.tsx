/**
 * Renders a schema.org JSON-LD block. Server component so the structured data
 * is in the initial HTML for crawlers and AI assistants — the marketing pages
 * themselves are client components, so the schema lives in their server layout.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
