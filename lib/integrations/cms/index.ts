import { CmsAdapter, CmsKind } from "./types";
import { wordpressAdapter } from "./wordpress";
import { webflowAdapter } from "./webflow";
import { ghostAdapter } from "./ghost";
import { notionAdapter } from "./notion";
import { webhookAdapter } from "./webhook";
import { shopifyAdapter } from "./shopify";
import { framerAdapter } from "./framer";
import { wixAdapter } from "./wix";
import { gohighlevelAdapter } from "./gohighlevel";
import { dudaAdapter } from "./duda";
import { bigcommerceAdapter } from "./bigcommerce";
import { githubAdapter } from "./github";

const ADAPTERS: Record<CmsKind, CmsAdapter> = {
  wordpress: wordpressAdapter,
  webflow: webflowAdapter,
  ghost: ghostAdapter,
  notion: notionAdapter,
  webhook: webhookAdapter,
  shopify: shopifyAdapter,
  framer: framerAdapter,
  wix: wixAdapter,
  gohighlevel: gohighlevelAdapter,
  duda: dudaAdapter,
  bigcommerce: bigcommerceAdapter,
  github: githubAdapter,
};

export function getAdapter(kind: CmsKind): CmsAdapter {
  const a = ADAPTERS[kind];
  if (!a) throw new Error(`Unknown CMS kind: ${kind}`);
  return a;
}

export const SUPPORTED_KINDS: CmsKind[] = [
  "wordpress",
  "shopify",
  "webflow",
  "framer",
  "ghost",
  "wix",
  "gohighlevel",
  "duda",
  "bigcommerce",
  "notion",
  "github",
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
      { key: "site_id", label: "Site ID (for auto-publish)", required: false },
      { key: "site_url", label: "Site URL", placeholder: "https://example.com", required: false },
      { key: "field_title", label: "Title field slug", placeholder: "name" },
      { key: "field_slug", label: "Slug field slug", placeholder: "slug" },
      { key: "field_body", label: "Body field slug", placeholder: "post-body" },
      { key: "field_excerpt", label: "Excerpt field slug", placeholder: "post-summary" },
      { key: "field_image", label: "Image field slug", placeholder: "main-image" },
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
  shopify: {
    label: "Shopify",
    fields: [
      { key: "shop_domain", label: "Shop domain", placeholder: "my-shop.myshopify.com", required: true },
      { key: "access_token", label: "Admin API access token", type: "password", required: true },
      { key: "blog_id", label: "Blog ID", placeholder: "123456789", required: true },
      { key: "api_version", label: "API version", placeholder: "2024-10" },
      { key: "author", label: "Author (optional)" },
    ],
  },
  framer: {
    label: "Framer",
    fields: [
      { key: "api_token", label: "API Token", type: "password", required: true },
      { key: "collection_id", label: "Collection ID", required: true },
      { key: "site_url", label: "Site URL (for links)", placeholder: "https://example.com" },
      { key: "field_title", label: "Title field slug", placeholder: "title" },
      { key: "field_slug", label: "Slug field slug", placeholder: "slug" },
      { key: "field_body", label: "Body field slug", placeholder: "content" },
      { key: "field_excerpt", label: "Excerpt field slug", placeholder: "excerpt" },
      { key: "field_image", label: "Image field slug", placeholder: "image" },
    ],
  },
  wix: {
    label: "Wix",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "site_id", label: "Site ID", required: true },
      { key: "account_id", label: "Account ID (optional)" },
      { key: "member_id", label: "Author Member ID (optional)" },
    ],
  },
  gohighlevel: {
    label: "GoHighLevel",
    fields: [
      { key: "api_token", label: "Private Integration token", type: "password", required: true },
      { key: "location_id", label: "Location ID", required: true },
      { key: "blog_id", label: "Blog ID", required: true },
      { key: "author_id", label: "Author ID (optional)" },
      { key: "version", label: "API version", placeholder: "2021-07-28" },
    ],
  },
  duda: {
    label: "Duda",
    fields: [
      { key: "site_name", label: "Site name (alias)", required: true },
      { key: "api_user", label: "API username", required: true },
      { key: "api_pass", label: "API password", type: "password", required: true },
      { key: "region", label: "Region (us / eu / ca)", placeholder: "us" },
    ],
  },
  bigcommerce: {
    label: "BigCommerce",
    fields: [
      { key: "store_hash", label: "Store hash", required: true },
      { key: "access_token", label: "API access token", type: "password", required: true },
      { key: "store_url", label: "Store URL (for links)", placeholder: "https://example.com" },
      { key: "author", label: "Author (optional)" },
    ],
  },
  github: {
    label: "GitHub",
    fields: [
      { key: "token", label: "Personal access token", type: "password", required: true },
      { key: "repo_owner", label: "Owner (user or org)", placeholder: "acme", required: true },
      { key: "repo_name", label: "Repository", placeholder: "site", required: true },
      { key: "branch", label: "Branch", placeholder: "main" },
      { key: "blog_path", label: "Posts path", placeholder: "content/blog" },
    ],
  },
};
