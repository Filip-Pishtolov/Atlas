import { NextResponse } from 'next/server';
import { get, query, run, transaction } from '@/lib/db';
import { audit, requireRole } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import type { Departure, DepartureStatus, Tour } from '@/lib/types';
import {
  int,
  jsonError,
  listOf,
  oneOf,
  readBody,
  readDate,
  readMoney,
  readPaging,
  text,
} from '../_lib/http';

export const dynamic = 'force-dynamic';

const DEPARTURE_STATUSES = ['open', 'guaranteed', 'sold_out', 'cancelled'] as const;

interface AdminDepartureRow extends Departure {
  tour_title: string;
  tour_slug: string;
  seats_left: number;
  booking_count: number;
}

export async function GET(req: Request): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const url = new URL(req.url);
  const { limit, offset } = readPaging(url);

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (url.searchParams.has('tour_id')) {
    const tourId = int(url.searchParams.get('tour_id'));
    if (tourId === null) return jsonError('tour_id must be a whole number.');
    where.push('dep.tour_id = ?');
    params.push(tourId);
  }

  const status = url.searchParams.get('status');
  if (status && status !== 'all') {
    const valid = oneOf(status, DEPARTURE_STATUSES);
    if (!valid) return jsonError(`status must be ${listOf(DEPARTURE_STATUSES)}.`);
    where.push('dep.status = ?');
    params.push(valid);
  }

  if (url.searchParams.has('from')) {
    const from = readDate(url.searchParams.get('from'));
    if (!from) return jsonError('from must be a date in YYYY-MM-DD form.');
    where.push('dep.start_date >= ?');
    params.push(from);
  }

  if (url.searchParams.get('upcoming') === 'true') {
    where.push("dep.start_date >= date('now')");
  }

  const q = text(url.searchParams.get('q'));
  if (q) {
    where.push('(t.title LIKE ? OR t.slug LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const items = query<AdminDepartureRow>(
    `SELECT dep.*,
            t.title AS tour_title,
            t.slug  AS tour_slug,
            (dep.seats_total - dep.seats_booked) AS seats_left,
            (SELECT COUNT(*) FROM bookings b
              WHERE b.departure_id = dep.id
                AND b.status <> 'cancelled')     AS booking_count
       FROM departures dep
       JOIN tours t ON t.id = dep.tour_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY dep.start_date ASC, dep.id ASC
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

  const tourId = int(body.tour_id);
  if (tourId === null) return jsonError('tour_id is required.');

  const tour = get<Tour>('SELECT * FROM tours WHERE id = ?', tourId);
  if (!tour) return jsonError(`Tour ${tourId} does not exist.`);

  const startDate = readDate(body.start_date);
  if (!startDate) return jsonError('start_date must be a date in YYYY-MM-DD form.');

  const endDate = readDate(body.end_date);
  if (!endDate) return jsonError('end_date must be a date in YYYY-MM-DD form.');

  if (endDate < startDate) {
    return jsonError('end_date cannot fall before start_date.');
  }

  const priceInput = readMoney(body, 'price_cents');
  if (priceInput === null) {
    return jsonError('price must be an amount in euros, such as "1299.00".');
  }
  const priceCents = priceInput ?? tour.base_price_cents;
  if (priceCents < 0) return jsonError('price cannot be negative.');

  const seatsTotal = body.seats_total === undefined ? tour.group_size_max : int(body.seats_total);
  if (seatsTotal === null || seatsTotal < 1) {
    return jsonError('seats_total must be at least 1.');
  }

  const seatsBooked = body.seats_booked === undefined ? 0 : int(body.seats_booked);
  if (seatsBooked === null || seatsBooked < 0) {
    return jsonError('seats_booked cannot be negative.');
  }
  if (seatsBooked > seatsTotal) {
    return jsonError('seats_booked cannot exceed seats_total.');
  }

  let status: DepartureStatus = 'open';
  if (body.status !== undefined) {
    const parsed = oneOf(body.status, DEPARTURE_STATUSES);
    if (!parsed) return jsonError(`status must be ${listOf(DEPARTURE_STATUSES)}.`);
    status = parsed;
  }

  const clash = get<{ id: number }>(
    'SELECT id FROM departures WHERE tour_id = ? AND start_date = ?',
    tourId,
    startDate,
  );
  if (clash) {
    return jsonError(
      `${tour.title} already has a departure starting on ${startDate}.`,
      409,
    );
  }

  const departureId = transaction(() => {
    const inserted = run(
      `INSERT INTO departures
         (tour_id, start_date, end_date, price_cents, seats_total, seats_booked, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      tourId,
      startDate,
      endDate,
      priceCents,
      seatsTotal,
      seatsBooked,
      status,
    );
    const id = inserted.lastInsertRowid;

    run(
      `INSERT INTO price_history (tour_id, departure_id, price_cents, changed_by)
       VALUES (?, ?, ?, ?)`,
      tourId,
      id,
      priceCents,
      user.id,
    );

    return id;
  });

  audit(
    user,
    'create',
    'departure',
    departureId,
    `${tour.title} departing ${startDate} at ${formatMoney(priceCents)}, ${seatsTotal} seats.`,
  );

  const item = get<Departure>('SELECT * FROM departures WHERE id = ?', departureId);
  return NextResponse.json({ id: departureId, item }, { status: 201 });
}
