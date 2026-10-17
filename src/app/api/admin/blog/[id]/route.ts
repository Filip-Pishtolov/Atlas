import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { audit, requireRole } from '@/lib/auth';
import type { BlogPost } from '@/lib/types';
import {
  has,
  int,
  jsonError,
  listOf,
  notFound,
  nowStamp,
  oneOf,
  readBody,
  readRouteId,
  readStamp,
  slugify,
  SLUG_RE,
  text,
  UpdateSet,
} from '../../_lib/http';

export const dynamic = 'force-dynamic';

const POST_STATUSES = ['draft', 'published'] as const;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Post id must be a whole number.');

  const item = get<BlogPost>('SELECT * FROM blog_posts WHERE id = ?', id);
  if (!item) return notFound('Post');

  return NextResponse.json({ item });
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Post id must be a whole number.');

  const post = get<BlogPost>('SELECT * FROM blog_posts WHERE id = ?', id);
  if (!post) return notFound('Post');

  const body = await readBody(req);
  if (!body) return jsonError('Request body must be valid JSON.');

  const set = new UpdateSet();

  if (has(body, 'title')) {
    const title = text(body.title);
    if (!title) return jsonError('title cannot be blank.');
    set.add('title', title);
  }

  if (has(body, 'slug')) {
    const slug = slugify(text(body.slug));
    if (!SLUG_RE.test(slug)) {
      return jsonError('slug must contain letters, numbers and single hyphens.');
    }
    const clash = get<{ id: number }>(
      'SELECT id FROM blog_posts WHERE slug = ? AND id <> ?',
      slug,
      id,
    );
    if (clash) return jsonError(`A post with the slug "${slug}" already exists.`, 409);
    set.add('slug', slug);
  }

  if (has(body, 'excerpt')) {
    const excerpt = text(body.excerpt);
    if (!excerpt) return jsonError('excerpt cannot be blank.');
    set.add('excerpt', excerpt);
  }

  if (has(body, 'body')) {
    const postBody = text(body.body);
    if (!postBody) return jsonError('body cannot be blank.');
    set.add('body', postBody);
  }

  if (has(body, 'hero_image')) {
    const heroImage = text(body.hero_image);
    if (!heroImage) return jsonError('hero_image cannot be blank.');
    set.add('hero_image', heroImage);
  }

  if (has(body, 'author_name')) {
    const authorName = text(body.author_name);
    if (!authorName) return jsonError('author_name cannot be blank.');
    set.add('author_name', authorName);
  }

  if (has(body, 'author_id')) set.add('author_id', int(body.author_id));

  let publishedNow = false;

  if (has(body, 'status')) {
    const status = oneOf(body.status, POST_STATUSES);
    if (!status) return jsonError(`status must be ${listOf(POST_STATUSES)}.`);
    set.add('status', status);

    if (status === 'published' && !post.published_at && !has(body, 'published_at')) {
      set.add('published_at', nowStamp());
      publishedNow = true;
    }
  }

  if (has(body, 'published_at')) {
    if (text(body.published_at) === '') {
      set.add('published_at', null);
    } else {
      const publishedAt = readStamp(body.published_at);
      if (!publishedAt) {
        return jsonError('published_at must be a date such as "2026-08-23".');
      }
      set.add('published_at', publishedAt);
    }
  }

  if (set.isEmpty) return jsonError('No editable fields were supplied.');

  run(`UPDATE blog_posts SET ${set.clause} WHERE id = ?`, ...set.params, id);

  audit(
    user,
    'update',
    'blog_post',
    id,
    `"${post.title}": ${set.columns.join(', ')}.` +
      (publishedNow ? ' Published for the first time.' : ''),
  );

  const item = get<BlogPost>('SELECT * FROM blog_posts WHERE id = ?', id);
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Post id must be a whole number.');

  const post = get<BlogPost>('SELECT * FROM blog_posts WHERE id = ?', id);
  if (!post) return notFound('Post');

  run('DELETE FROM blog_posts WHERE id = ?', id);

  audit(user, 'delete', 'blog_post', id, `Deleted "${post.title}" (${post.slug}).`);

  return NextResponse.json({ ok: true });
}
