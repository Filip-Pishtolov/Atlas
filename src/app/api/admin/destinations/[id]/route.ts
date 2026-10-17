import { NextResponse } from 'next/server';
import { get, query, run } from '@/lib/db';
import { audit, requireRole } from '@/lib/auth';
import type { Destination, Tour } from '@/lib/types';
import {
  flag,
  has,
  jsonError,
  notFound,
  optText,
  readBody,
  readRouteId,
  slugify,
  SLUG_RE,
  text,
  UpdateSet,
} from '../../_lib/http';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Destination id must be a whole number.');

  const item = get<Destination>('SELECT * FROM destinations WHERE id = ?', id);
  if (!item) return notFound('Destination');

  return NextResponse.json({
    item,
    tours: query<Tour>(
      'SELECT id, slug, title, status FROM tours WHERE destination_id = ? ORDER BY title',
      id,
    ),
  });
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Destination id must be a whole number.');

  const destination = get<Destination>('SELECT * FROM destinations WHERE id = ?', id);
  if (!destination) return notFound('Destination');

  const body = await readBody(req);
  if (!body) return jsonError('Request body must be valid JSON.');

  const set = new UpdateSet();

  if (has(body, 'name')) {
    const name = text(body.name);
    if (!name) return jsonError('name cannot be blank.');
    set.add('name', name);
  }

  if (has(body, 'slug')) {
    const slug = slugify(text(body.slug));
    if (!SLUG_RE.test(slug)) {
      return jsonError('slug must contain letters, numbers and single hyphens.');
    }
    const clash = get<{ id: number }>(
      'SELECT id FROM destinations WHERE slug = ? AND id <> ?',
      slug,
      id,
    );
    if (clash) {
      return jsonError(`A destination with the slug "${slug}" already exists.`, 409);
    }
    set.add('slug', slug);
  }

  if (has(body, 'country')) {
    const country = text(body.country);
    if (!country) return jsonError('country cannot be blank.');
    set.add('country', country);
  }

  if (has(body, 'summary')) {
    const summary = text(body.summary);
    if (!summary) return jsonError('summary cannot be blank.');
    set.add('summary', summary);
  }

  if (has(body, 'description')) {
    const description = text(body.description);
    if (!description) return jsonError('description cannot be blank.');
    set.add('description', description);
  }

  if (has(body, 'hero_image')) {
    const heroImage = text(body.hero_image);
    if (!heroImage) return jsonError('hero_image cannot be blank.');
    set.add('hero_image', heroImage);
  }

  if (has(body, 'region')) set.add('region', optText(body.region));
  if (has(body, 'best_time')) set.add('best_time', optText(body.best_time));
  if (has(body, 'is_featured')) set.add('is_featured', flag(body.is_featured));

  if (set.isEmpty) return jsonError('No editable fields were supplied.');

  run(`UPDATE destinations SET ${set.clause} WHERE id = ?`, ...set.params, id);

  audit(
    user,
    'update',
    'destination',
    id,
    `${destination.name}: ${set.columns.join(', ')}.`,
  );

  const item = get<Destination>('SELECT * FROM destinations WHERE id = ?', id);
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Destination id must be a whole number.');

  const destination = get<Destination>('SELECT * FROM destinations WHERE id = ?', id);
  if (!destination) return notFound('Destination');

  const tours = get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM tours WHERE destination_id = ?',
    id,
  );
  if ((tours?.n ?? 0) > 0) {
    return jsonError(
      `${destination.name} still has ${tours?.n} tour(s). Move or retire them first.`,
      409,
    );
  }

  run('DELETE FROM destinations WHERE id = ?', id);

  audit(
    user,
    'delete',
    'destination',
    id,
    `Deleted ${destination.name}, ${destination.country}.`,
  );

  return NextResponse.json({ ok: true });
}
