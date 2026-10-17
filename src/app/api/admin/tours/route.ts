import { NextResponse } from 'next/server';
import { get, query, run, transaction } from '@/lib/db';
import { audit, requireRole } from '@/lib/auth';
import type { Difficulty, Tour, TourStatus } from '@/lib/types';
import {
  flag,
  has,
  int,
  jsonError,
  listOf,
  oneOf,
  optText,
  readBody,
  readMoney,
  readPaging,
  slugify,
  SLUG_RE,
  text,
} from '../_lib/http';
import {
  parseFacts,
  parseImages,
  parseItinerary,
  parseThemeIds,
  writeFacts,
  writeImages,
  writeItinerary,
  writeThemes,
} from '../_lib/tour-children';

export const dynamic = 'force-dynamic';

const TOUR_STATUSES = ['draft', 'published', 'sold_out', 'retired'] as const;
const DIFFICULTIES = ['easy', 'moderate', 'challenging', 'tough'] as const;

interface AdminTourRow extends Tour {
  destination_name: string;
  destination_slug: string;
  country: string;
  departure_count: number;
  booking_count: number;
  review_count: number;
}

export async function GET(req: Request): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const url = new URL(req.url);
  const { limit, offset } = readPaging(url);

  const where: string[] = [];
  const params: (string | number)[] = [];

  const status = url.searchParams.get('status');
  if (status && status !== 'all') {
    const valid = oneOf(status, TOUR_STATUSES);
    if (!valid) return jsonError(`status must be ${listOf(TOUR_STATUSES)}.`);
    where.push('t.status = ?');
    params.push(valid);
  }

  const destinationId = int(url.searchParams.get('destination_id'));
  if (url.searchParams.has('destination_id') && destinationId === null) {
    return jsonError('destination_id must be a whole number.');
  }
  if (destinationId !== null) {
    where.push('t.destination_id = ?');
    params.push(destinationId);
  }

  const q = text(url.searchParams.get('q'));
  if (q) {
    where.push('(t.title LIKE ? OR t.slug LIKE ? OR d.name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const sql = `
    SELECT t.*,
           d.name AS destination_name,
           d.slug AS destination_slug,
           d.country AS country,
           (SELECT COUNT(*) FROM departures dep WHERE dep.tour_id = t.id) AS departure_count,
           (SELECT COUNT(*) FROM bookings b   WHERE b.tour_id   = t.id) AS booking_count,
           (SELECT COUNT(*) FROM reviews r    WHERE r.tour_id   = t.id
              AND r.status = 'approved')                                AS review_count
      FROM tours t
      JOIN destinations d ON d.id = t.destination_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY t.updated_at DESC, t.id DESC
     LIMIT ? OFFSET ?`;

  const items = query<AdminTourRow>(sql, ...params, limit, offset);

  const total = get<{ n: number }>(
    `SELECT COUNT(*) AS n
       FROM tours t
       JOIN destinations d ON d.id = t.destination_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    ...params,
  );

  return NextResponse.json({ items, total: total?.n ?? items.length });
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
  if (get<{ id: number }>('SELECT id FROM tours WHERE slug = ?', slug)) {
    return jsonError(`A tour with the slug "${slug}" already exists.`, 409);
  }

  const destinationId = int(body.destination_id);
  if (destinationId === null) return jsonError('destination_id is required.');
  if (!get<{ id: number }>('SELECT id FROM destinations WHERE id = ?', destinationId)) {
    return jsonError(`Destination ${destinationId} does not exist.`);
  }

  const summary = text(body.summary);
  if (!summary) return jsonError('summary is required.');

  const description = text(body.description);
  if (!description) return jsonError('description is required.');

  const durationDays = int(body.duration_days);
  if (durationDays === null || durationDays < 1) {
    return jsonError('duration_days must be at least 1.');
  }

  const basePriceCents = readMoney(body, 'base_price_cents');
  if (basePriceCents === undefined) return jsonError('base_price is required.');
  if (basePriceCents === null) {
    return jsonError('base_price must be an amount in euros, such as "1299.00".');
  }
  if (basePriceCents < 0) return jsonError('base_price cannot be negative.');

  let difficulty: Difficulty = 'moderate';
  if (has(body, 'difficulty')) {
    const parsed = oneOf(body.difficulty, DIFFICULTIES);
    if (!parsed) return jsonError(`difficulty must be ${listOf(DIFFICULTIES)}.`);
    difficulty = parsed;
  }

  let status: TourStatus = 'draft';
  if (has(body, 'status')) {
    const parsed = oneOf(body.status, TOUR_STATUSES);
    if (!parsed) return jsonError(`status must be ${listOf(TOUR_STATUSES)}.`);
    status = parsed;
  }

  const groupMin = has(body, 'group_size_min') ? int(body.group_size_min) : 2;
  const groupMax = has(body, 'group_size_max') ? int(body.group_size_max) : 16;
  if (groupMin === null || groupMin < 1) {
    return jsonError('group_size_min must be at least 1.');
  }
  if (groupMax === null || groupMax < groupMin) {
    return jsonError('group_size_max must be greater than or equal to group_size_min.');
  }

  const heroImage =
    text(body.hero_image) || `https://picsum.photos/seed/${slug}/1200/800`;

  const itinerary = parseItinerary(body.itinerary);
  if (!itinerary.ok) return jsonError(itinerary.error);

  const facts = parseFacts(body.facts);
  if (!facts.ok) return jsonError(facts.error);

  const images = parseImages(body.images);
  if (!images.ok) return jsonError(images.error);

  const themeIds = parseThemeIds(body.theme_ids);
  if (!themeIds.ok) return jsonError(themeIds.error);

  const tourId = transaction(() => {
    const inserted = run(
      `INSERT INTO tours
         (slug, title, destination_id, summary, description, duration_days,
          difficulty, group_size_min, group_size_max, base_price_cents,
          hero_image, meeting_point, status, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      slug,
      title,
      destinationId,
      summary,
      description,
      durationDays,
      difficulty,
      groupMin,
      groupMax,
      basePriceCents,
      heroImage,
      optText(body.meeting_point),
      status,
      flag(body.is_featured),
    );
    const id = inserted.lastInsertRowid;

    writeItinerary(id, itinerary.value);
    writeFacts(id, facts.value);
    writeImages(id, images.value);
    writeThemes(id, themeIds.value);

    run(
      `INSERT INTO price_history (tour_id, departure_id, price_cents, changed_by)
       VALUES (?, NULL, ?, ?)`,
      id,
      basePriceCents,
      user.id,
    );

    return id;
  });

  audit(user, 'create', 'tour', tourId, `Created "${title}" (${slug}).`);

  const item = get<Tour>('SELECT * FROM tours WHERE id = ?', tourId);
  return NextResponse.json({ id: tourId, item }, { status: 201 });
}
