import { CmsAdapter, CmsKind } from "./types";
import { wordpressAdapter } from "./wordpress";
import { webflowAdapter } from "./webflow";
import { ghostAdapter } from "./ghost";
import { notionAdapter } from "./notion";
import { webhookAdapter } from "./webhook";

const ADAPTERS: Record<CmsKind, CmsAdapter> = {
  wordpress: wordpressAdapter,
  webflow: webflowAdapter,
  ghost: ghostAdapter,
  notion: notionAdapter,
  webhook: webhookAdapter,
};

export function getAdapter(kind: CmsKind): CmsAdapter {
  const a = ADAPTERS[kind];
  if (!a) throw new Error(`Unknown CMS kind: ${kind}`);
  return a;
}

export const SUPPORTED_KINDS: CmsKind[] = [
  "wordpress",
  "webflow",
  "ghost",
  "notion",
  "webhook",
];

export const KIND_META: Record<CmsKind, { label: string; fields: { key: string; label: string; placeholder?: string; type?: "text" | "password" | "url"; required?: boolean }[] }> = {
  wordpress: {
    label: "WordPress",
    fields: [
      { key: "site_url", label: "Site URL", placeholder: "https://example.com", type: "url", required: true },
      { key: "username", label: "Username", required: true },
      { key: "app_password", label: "Application Password", type: "password", required: true },
    ],
  },
  webflow: {
    label: "Webflow",
    fields: [
      { key: "api_token", label: "API Token", type: "password", required: true },
      { key: "collection_id", label: "Collection ID", required: true },
      { key: "site_id", label: "Site ID (för auto-publish)", required: false },
      { key: "site_url", label: "Site URL", placeholder: "https://example.com", required: false },
      { key: "field_title", label: "Title fält slug", placeholder: "name" },
      { key: "field_slug", label: "Slug fält slug", placeholder: "slug" },
      { key: "field_body", label: "Body fält slug", placeholder: "post-body" },
      { key: "field_excerpt", label: "Excerpt fält slug", placeholder: "post-summary" },
      { key: "field_image", label: "Image fält slug", placeholder: "main-image" },
    ],
  },
  ghost: {
    label: "Ghost",
    fields: [
      { key: "api_url", label: "API URL", placeholder: "https://blog.example.com", type: "url", required: true },
      { key: "admin_api_key", label: "Admin API Key (id:secret)", type: "password", required: true },
    ],
  },
  notion: {
    label: "Notion",
    fields: [
      { key: "integration_token", label: "Integration Token", type: "password", required: true },
      { key: "database_id", label: "Database ID", required: true },
      { key: "title_property", label: "Title property", placeholder: "Name" },
      { key: "status_property", label: "Status property (optional)" },
      { key: "tags_property", label: "Tags property (optional)" },
    ],
  },
  webhook: {
    label: "Custom Webhook",
    fields: [
      { key: "url", label: "Webhook URL", type: "url", required: true },
      { key: "bearer_token", label: "Bearer token (optional)", type: "password" },
      { key: "secret", label: "HMAC secret (optional)", type: "password" },
    ],
  },
};
