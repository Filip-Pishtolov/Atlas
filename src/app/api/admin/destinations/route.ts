import { NextResponse } from 'next/server';
import { get, query, run } from '@/lib/db';
import { audit, requireRole } from '@/lib/auth';
import type { Destination } from '@/lib/types';
import {
  flag,
  jsonError,
  optText,
  readBody,
  readPaging,
  slugify,
  SLUG_RE,
  text,
} from '../_lib/http';

export const dynamic = 'force-dynamic';

interface AdminDestinationRow extends Destination {
  tour_count: number;
}

export async function GET(req: Request): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const url = new URL(req.url);
  const { limit, offset } = readPaging(url);

  const where: string[] = [];
  const params: (string | number)[] = [];

  const q = text(url.searchParams.get('q'));
  if (q) {
    where.push('(d.name LIKE ? OR d.country LIKE ? OR d.region LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const featured = url.searchParams.get('featured');
  if (featured === 'true') where.push('d.is_featured = 1');
  if (featured === 'false') where.push('d.is_featured = 0');

  const items = query<AdminDestinationRow>(
    `SELECT d.*,
            (SELECT COUNT(*) FROM tours t WHERE t.destination_id = d.id) AS tour_count
       FROM destinations d
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY d.name ASC
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

  const name = text(body.name);
  if (!name) return jsonError('name is required.');

  const slug = slugify(text(body.slug) || name);
  if (!SLUG_RE.test(slug)) {
    return jsonError('slug must contain letters, numbers and single hyphens.');
  }
  if (get<{ id: number }>('SELECT id FROM destinations WHERE slug = ?', slug)) {
    return jsonError(`A destination with the slug "${slug}" already exists.`, 409);
  }

  const country = text(body.country);
  if (!country) return jsonError('country is required.');

  const summary = text(body.summary);
  if (!summary) return jsonError('summary is required.');

  const description = text(body.description);
  if (!description) return jsonError('description is required.');

  const heroImage =
    text(body.hero_image) || `https://picsum.photos/seed/${slug}/1200/800`;

  const inserted = run(
    `INSERT INTO destinations
       (slug, name, country, region, summary, description, hero_image,
        best_time, is_featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    slug,
    name,
    country,
    optText(body.region),
    summary,
    description,
    heroImage,
    optText(body.best_time),
    flag(body.is_featured),
  );

  audit(
    user,
    'create',
    'destination',
    inserted.lastInsertRowid,
    `Added ${name}, ${country} (${slug}).`,
  );

  const item = get<Destination>(
    'SELECT * FROM destinations WHERE id = ?',
    inserted.lastInsertRowid,
  );
  return NextResponse.json({ id: inserted.lastInsertRowid, item }, { status: 201 });
}
