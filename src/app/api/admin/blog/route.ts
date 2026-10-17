import { NextResponse } from 'next/server';
import { get, query, run } from '@/lib/db';
import { audit, requireRole } from '@/lib/auth';
import type { BlogPost } from '@/lib/types';
import {
  int,
  jsonError,
  listOf,
  nowStamp,
  oneOf,
  readBody,
  readPaging,
  readStamp,
  slugify,
  SLUG_RE,
  text,
} from '../_lib/http';

export const dynamic = 'force-dynamic';

const POST_STATUSES = ['draft', 'published'] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const url = new URL(req.url);
  const { limit, offset } = readPaging(url);

  const where: string[] = [];
  const params: (string | number)[] = [];

  const status = url.searchParams.get('status');
  if (status && status !== 'all') {
    const valid = oneOf(status, POST_STATUSES);
    if (!valid) return jsonError(`status must be ${listOf(POST_STATUSES)}.`);
    where.push('status = ?');
    params.push(valid);
  }

  const q = text(url.searchParams.get('q'));
  if (q) {
    where.push('(title LIKE ? OR excerpt LIKE ? OR author_name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const items = query<BlogPost>(
    `SELECT * FROM blog_posts
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY COALESCE(published_at, created_at) DESC, id DESC
      LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  return NextResponse.json({ items });
}

export async function POST(req: Request): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await readBody(req);
  if (!body) return jsonError('Request body must be valid JSON.');

  const title = text(body.title);
  if (!title) return jsonError('title is required.');

  const slug = slugify(text(body.slug) || title);
  if (!SLUG_RE.test(slug)) {
    return jsonError('slug must contain letters, numbers and single hyphens.');
  }
  if (get<{ id: number }>('SELECT id FROM blog_posts WHERE slug = ?', slug)) {
    return jsonError(`A post with the slug "${slug}" already exists.`, 409);
  }

  const excerpt = text(body.excerpt);
  if (!excerpt) return jsonError('excerpt is required.');

  const postBody = text(body.body);
  if (!postBody) return jsonError('body is required.');

  let status: 'draft' | 'published' = 'draft';
  if (body.status !== undefined) {
    const parsed = oneOf(body.status, POST_STATUSES);
    if (!parsed) return jsonError(`status must be ${listOf(POST_STATUSES)}.`);
    status = parsed;
  }

  let publishedAt: string | null = null;
  if (body.published_at !== undefined && text(body.published_at) !== '') {
    publishedAt = readStamp(body.published_at);
    if (!publishedAt) {
      return jsonError('published_at must be a date such as "2026-08-23".');
    }
  } else if (status === 'published') {
    publishedAt = nowStamp();
  }

  const heroImage =
    text(body.hero_image) || `https://picsum.photos/seed/${slug}/1200/800`;

  const authorName = text(body.author_name) || user.name;
  const authorId = body.author_id === undefined ? user.id : int(body.author_id);

  const inserted = run(
    `INSERT INTO blog_posts
       (slug, title, excerpt, body, hero_image, author_id, author_name,
        status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    slug,
    title,
    excerpt,
    postBody,
    heroImage,
    authorId,
    authorName,
    status,
    publishedAt,
  );

  audit(
    user,
    'create',
    'blog_post',
    inserted.lastInsertRowid,
    `${status === 'published' ? 'Published' : 'Drafted'} "${title}" (${slug}).`,
  );

  const item = get<BlogPost>(
    'SELECT * FROM blog_posts WHERE id = ?',
    inserted.lastInsertRowid,
  );
  return NextResponse.json({ id: inserted.lastInsertRowid, item }, { status: 201 });
}
