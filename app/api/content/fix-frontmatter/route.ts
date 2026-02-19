import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sanitizeFrontMatter, hasFrontMatterIssues } from '@/lib/yaml-sanitizer';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Use service role key for write access; fall back to anon key (read-only in most setups)
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Table and column names – override via env vars if your schema differs
const TABLE = process.env.BLOG_POSTS_TABLE || 'blog_posts';
const CONTENT_COL = process.env.BLOG_POSTS_CONTENT_COL || 'content';

// Minimal row shape returned by Supabase queries
interface PostRow {
  id: string;
  title?: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json(
      { error: 'Supabase credentials not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 500 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Optional: pass specific post IDs to fix; otherwise fix all
  let postIds: string[] | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body.ids) && body.ids.length > 0) postIds = body.ids;
  } catch {
    // No body – fix all
  }

  // Fetch posts
  let query = supabase.from(TABLE).select(`id, title, ${CONTENT_COL}`);
  if (postIds) query = query.in('id', postIds);

  const { data: posts, error: fetchError } = await query;
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!posts || posts.length === 0) {
    return NextResponse.json({ fixed: 0, skipped: 0, errors: 0, details: [] });
  }

  let fixed = 0;
  let skipped = 0;
  let errors = 0;
  const details: Array<{ id: string; title?: string; result: string; error?: string }> = [];

  for (const post of posts as unknown as PostRow[]) {
    const rawContent: string | null = (post[CONTENT_COL] as string | null) ?? null;
    if (!rawContent || typeof rawContent !== 'string') {
      skipped++;
      details.push({ id: post.id, title: post.title, result: 'skipped – no content' });
      continue;
    }

    if (!hasFrontMatterIssues(rawContent)) {
      skipped++;
      details.push({ id: post.id, title: post.title, result: 'skipped – front matter OK' });
      continue;
    }

    const fixedContent = sanitizeFrontMatter(rawContent);

    const { error: updateError } = await supabase
      .from(TABLE)
      .update({ [CONTENT_COL]: fixedContent })
      .eq('id', post.id);

    if (updateError) {
      errors++;
      details.push({ id: post.id, title: post.title, result: 'error', error: updateError.message });
    } else {
      fixed++;
      details.push({ id: post.id, title: post.title, result: 'fixed' });
    }
  }

  return NextResponse.json({ fixed, skipped, errors, details });
}

/**
 * GET – preview which posts have front matter issues without fixing them.
 */
export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json(
      { error: 'Supabase credentials not configured' },
      { status: 500 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: posts, error } = await supabase
    .from(TABLE)
    .select(`id, title, ${CONTENT_COL}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!posts) return NextResponse.json({ affected: [] });

  const affected = (posts as unknown as PostRow[])
    .filter((p) => typeof p[CONTENT_COL] === 'string' && hasFrontMatterIssues(p[CONTENT_COL] as string))
    .map((p) => ({ id: p.id, title: p.title }));

  return NextResponse.json({ affected, count: affected.length });
}
