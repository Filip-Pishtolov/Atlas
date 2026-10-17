import { NextResponse } from 'next/server';
import { get, query, run, transaction } from '@/lib/db';
import { audit, requireRole } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { tourFacts, tourImages, tourItinerary, tourThemeIds } from '@/lib/queries';
import type { Departure, Difficulty, Tour, TourStatus } from '@/lib/types';
import {
  flag,
  has,
  int,
  jsonError,
  listOf,
  notFound,
  oneOf,
  optText,
  readBody,
  readMoney,
  readRouteId,
  slugify,
  SLUG_RE,
  text,
  UpdateSet,
} from '../../_lib/http';
import {
  parseFacts,
  parseImages,
  parseItinerary,
  parseThemeIds,
  writeFacts,
  writeImages,
  writeItinerary,
  writeThemes,
} from '../../_lib/tour-children';

export const dynamic = 'force-dynamic';

const TOUR_STATUSES = ['draft', 'published', 'sold_out', 'retired'] as const;
const DIFFICULTIES = ['easy', 'moderate', 'challenging', 'tough'] as const;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Tour id must be a whole number.');

  const tour = get<Tour>('SELECT * FROM tours WHERE id = ?', id);
  if (!tour) return notFound('Tour');

  return NextResponse.json({
    item: tour,
    itinerary: tourItinerary(id),
    facts: tourFacts(id),
    images: tourImages(id),
    theme_ids: tourThemeIds(id),
    departures: query<Departure>(
      'SELECT * FROM departures WHERE tour_id = ? ORDER BY start_date',
      id,
    ),
    booking_count:
      get<{ n: number }>('SELECT COUNT(*) AS n FROM bookings WHERE tour_id = ?', id)
        ?.n ?? 0,
  });
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Tour id must be a whole number.');

  const tour = get<Tour>('SELECT * FROM tours WHERE id = ?', id);
  if (!tour) return notFound('Tour');

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
      'SELECT id FROM tours WHERE slug = ? AND id <> ?',
      slug,
      id,
    );
    if (clash) return jsonError(`A tour with the slug "${slug}" already exists.`, 409);
    set.add('slug', slug);
  }

  if (has(body, 'destination_id')) {
    const destinationId = int(body.destination_id);
    if (destinationId === null) return jsonError('destination_id must be a whole number.');
    if (!get<{ id: number }>('SELECT id FROM destinations WHERE id = ?', destinationId)) {
      return jsonError(`Destination ${destinationId} does not exist.`);
    }
    set.add('destination_id', destinationId);
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

  if (has(body, 'duration_days')) {
    const durationDays = int(body.duration_days);
    if (durationDays === null || durationDays < 1) {
      return jsonError('duration_days must be at least 1.');
    }
    set.add('duration_days', durationDays);
  }

  if (has(body, 'difficulty')) {
    const difficulty: Difficulty | null = oneOf(body.difficulty, DIFFICULTIES);
    if (!difficulty) return jsonError(`difficulty must be ${listOf(DIFFICULTIES)}.`);
    set.add('difficulty', difficulty);
  }

  if (has(body, 'status')) {
    const status: TourStatus | null = oneOf(body.status, TOUR_STATUSES);
    if (!status) return jsonError(`status must be ${listOf(TOUR_STATUSES)}.`);
    set.add('status', status);
  }

  if (has(body, 'group_size_min') || has(body, 'group_size_max')) {
    const groupMin = has(body, 'group_size_min')
      ? int(body.group_size_min)
      : tour.group_size_min;
    const groupMax = has(body, 'group_size_max')
      ? int(body.group_size_max)
      : tour.group_size_max;
    if (groupMin === null || groupMin < 1) {
      return jsonError('group_size_min must be at least 1.');
    }
    if (groupMax === null || groupMax < groupMin) {
      return jsonError('group_size_max must be greater than or equal to group_size_min.');
    }
    if (has(body, 'group_size_min')) set.add('group_size_min', groupMin);
    if (has(body, 'group_size_max')) set.add('group_size_max', groupMax);
  }

  const newPriceCents = readMoney(body, 'base_price_cents');
  if (newPriceCents === null) {
    return jsonError('base_price must be an amount in euros, such as "1299.00".');
  }
  if (newPriceCents !== undefined) {
    if (newPriceCents < 0) return jsonError('base_price cannot be negative.');
    set.add('base_price_cents', newPriceCents);
  }

  if (has(body, 'hero_image')) {
    const heroImage = text(body.hero_image);
    if (!heroImage) return jsonError('hero_image cannot be blank.');
    set.add('hero_image', heroImage);
  }

  if (has(body, 'meeting_point')) set.add('meeting_point', optText(body.meeting_point));
  if (has(body, 'is_featured')) set.add('is_featured', flag(body.is_featured));

  const itinerary = has(body, 'itinerary') ? parseItinerary(body.itinerary) : null;
  if (itinerary && !itinerary.ok) return jsonError(itinerary.error);

  const facts = has(body, 'facts') ? parseFacts(body.facts) : null;
  if (facts && !facts.ok) return jsonError(facts.error);

  const images = has(body, 'images') ? parseImages(body.images) : null;
  if (images && !images.ok) return jsonError(images.error);

  const themeIds = has(body, 'theme_ids') ? parseThemeIds(body.theme_ids) : null;
  if (themeIds && !themeIds.ok) return jsonError(themeIds.error);

  const touchesChildren = Boolean(itinerary || facts || images || themeIds);
  if (set.isEmpty && !touchesChildren) {
    return jsonError('No editable fields were supplied.');
  }

  let priceNote = '';
  if (newPriceCents !== undefined && newPriceCents !== tour.base_price_cents) {
    priceNote =
      ` Base price ${formatMoney(tour.base_price_cents)} -> ` +
      `${formatMoney(newPriceCents)}.`;
  }
  const priceChanged = priceNote !== '';

  transaction(() => {
    if (!set.isEmpty) {
      set.addRaw("updated_at = datetime('now')");
      run(`UPDATE tours SET ${set.clause} WHERE id = ?`, ...set.params, id);
    }

    if (itinerary && itinerary.ok) writeItinerary(id, itinerary.value);
    if (facts && facts.ok) writeFacts(id, facts.value);
    if (images && images.ok) writeImages(id, images.value);
    if (themeIds && themeIds.ok) writeThemes(id, themeIds.value);

    if (priceChanged) {
      run(
        `INSERT INTO price_history (tour_id, departure_id, price_cents, changed_by)
         VALUES (?, NULL, ?, ?)`,
        id,
        newPriceCents,
        user.id,
      );
    }
  });

  const changed = [...set.columns];
  if (itinerary) changed.push('itinerary');
  if (facts) changed.push('facts');
  if (images) changed.push('images');
  if (themeIds) changed.push('themes');

  audit(
    user,
    'update',
    'tour',
    id,
    `Updated ${tour.title}: ${changed.join(', ')}.${priceNote}`,
  );

  const item = get<Tour>('SELECT * FROM tours WHERE id = ?', id);
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Tour id must be a whole number.');

  const tour = get<Tour>('SELECT * FROM tours WHERE id = ?', id);
  if (!tour) return notFound('Tour');

  const bookings = get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM bookings WHERE tour_id = ?',
    id,
  );
  if ((bookings?.n ?? 0) > 0) {
    return jsonError(
      `"${tour.title}" has ${bookings?.n} booking(s) and cannot be deleted. ` +
        `Set its status to 'retired' instead to take it off the site.`,
      409,
    );
  }

  transaction(() => {
    run('UPDATE enquiries SET tour_id = NULL WHERE tour_id = ?', id);
    run('DELETE FROM tours WHERE id = ?', id);
  });

  audit(user, 'delete', 'tour', id, `Deleted "${tour.title}" (${tour.slug}).`);

  return NextResponse.json({ ok: true });
}
