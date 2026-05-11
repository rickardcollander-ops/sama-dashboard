export type CmsKind =
  | "wordpress"
  | "webflow"
  | "ghost"
  | "notion"
  | "webhook"
  | "shopify"
  | "framer"
  | "wix"
  | "gohighlevel"
  | "duda"
  | "bigcommerce"
  | "github";

export interface CmsDestination {
  id: string;
  kind: CmsKind;
  name: string;
  config: Record<string, string>;
  created_at: string;
}

export interface PublishInput {
  title: string;
  body_markdown: string;
  body_html?: string;
  excerpt?: string;
  slug?: string;
  tags?: string[];
  canonical_url?: string;
  featured_image_url?: string;
  meta_description?: string;
  language?: string;
  jsonld?: Record<string, unknown>;
  status?: "draft" | "published";
}

export interface PublishResult {
  url?: string;
  external_id?: string;
  raw?: unknown;
}

export interface CmsAdapter {
  kind: CmsKind;
  publish(config: Record<string, string>, input: PublishInput): Promise<PublishResult>;
  validate?(config: Record<string, string>): Promise<{ ok: boolean; message?: string }>;
}

export class PublishError extends Error {
  status: number;
  detail?: unknown;
  constructor(message: string, status = 500, detail?: unknown) {
    super(message);
    this.name = "PublishError";
    this.status = status;
    this.detail = detail;
  }
}
