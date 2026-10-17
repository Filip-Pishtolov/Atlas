import { NextResponse } from 'next/server';
import { get, query, run, transaction } from '@/lib/db';
import { audit, requireRole } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import type { Departure, DepartureStatus, Tour } from '@/lib/types';
import {
  has,
  int,
  jsonError,
  listOf,
  notFound,
  oneOf,
  readBody,
  readDate,
  readMoney,
  readRouteId,
  UpdateSet,
} from '../../_lib/http';

export const dynamic = 'force-dynamic';

const DEPARTURE_STATUSES = ['open', 'guaranteed', 'sold_out', 'cancelled'] as const;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Departure id must be a whole number.');

  const item = get<Departure>('SELECT * FROM departures WHERE id = ?', id);
  if (!item) return notFound('Departure');

  return NextResponse.json({
    item,
    price_history: query(
      `SELECT ph.*, u.name AS changed_by_name
         FROM price_history ph
         LEFT JOIN users u ON u.id = ph.changed_by
        WHERE ph.departure_id = ?
        ORDER BY ph.changed_at DESC, ph.id DESC`,
      id,
    ),
  });
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Departure id must be a whole number.');

  const departure = get<Departure>('SELECT * FROM departures WHERE id = ?', id);
  if (!departure) return notFound('Departure');

  const body = await readBody(req);
  if (!body) return jsonError('Request body must be valid JSON.');

  const set = new UpdateSet();

  if (has(body, 'start_date') || has(body, 'end_date')) {
    const startDate = has(body, 'start_date')
      ? readDate(body.start_date)
      : departure.start_date;
    const endDate = has(body, 'end_date') ? readDate(body.end_date) : departure.end_date;

    if (!startDate) return jsonError('start_date must be a date in YYYY-MM-DD form.');
    if (!endDate) return jsonError('end_date must be a date in YYYY-MM-DD form.');
    if (endDate < startDate) return jsonError('end_date cannot fall before start_date.');

    if (has(body, 'start_date')) set.add('start_date', startDate);
    if (has(body, 'end_date')) set.add('end_date', endDate);
  }

  if (has(body, 'seats_total') || has(body, 'seats_booked')) {
    const seatsTotal = has(body, 'seats_total')
      ? int(body.seats_total)
      : departure.seats_total;
    const seatsBooked = has(body, 'seats_booked')
      ? int(body.seats_booked)
      : departure.seats_booked;

    if (seatsTotal === null || seatsTotal < 1) {
      return jsonError('seats_total must be at least 1.');
    }
    if (seatsBooked === null || seatsBooked < 0) {
      return jsonError('seats_booked cannot be negative.');
    }
    if (seatsBooked > seatsTotal) {
      return jsonError(
        `seats_total cannot be lower than the ${seatsBooked} seat(s) already booked.`,
      );
    }

    if (has(body, 'seats_total')) set.add('seats_total', seatsTotal);
    if (has(body, 'seats_booked')) set.add('seats_booked', seatsBooked);
  }

  if (has(body, 'status')) {
    const status: DepartureStatus | null = oneOf(body.status, DEPARTURE_STATUSES);
    if (!status) return jsonError(`status must be ${listOf(DEPARTURE_STATUSES)}.`);
    set.add('status', status);
  }

  const newPriceCents = readMoney(body, 'price_cents');
  if (newPriceCents === null) {
    return jsonError('price must be an amount in euros, such as "1299.00".');
  }
  if (newPriceCents !== undefined) {
    if (newPriceCents < 0) return jsonError('price cannot be negative.');
    set.add('price_cents', newPriceCents);
  }

  if (set.isEmpty) return jsonError('No editable fields were supplied.');

  let priceNote = '';
  if (newPriceCents !== undefined && newPriceCents !== departure.price_cents) {
    priceNote =
      ` Price ${formatMoney(departure.price_cents)} -> ` +
      `${formatMoney(newPriceCents)}.`;
  }
  const priceChanged = priceNote !== '';

  transaction(() => {
    run(`UPDATE departures SET ${set.clause} WHERE id = ?`, ...set.params, id);

    if (priceChanged) {
      run(
        `INSERT INTO price_history (tour_id, departure_id, price_cents, changed_by)
         VALUES (?, ?, ?, ?)`,
        departure.tour_id,
        id,
        newPriceCents,
        user.id,
      );
    }
  });

  const tour = get<Tour>('SELECT title FROM tours WHERE id = ?', departure.tour_id);
  audit(
    user,
    'update',
    'departure',
    id,
    `${tour?.title ?? 'Tour'} ${departure.start_date}: ` +
      `${set.columns.join(', ')}.${priceNote}`,
  );

  const item = get<Departure>('SELECT * FROM departures WHERE id = ?', id);
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Departure id must be a whole number.');

  const departure = get<Departure>('SELECT * FROM departures WHERE id = ?', id);
  if (!departure) return notFound('Departure');

  const bookings = get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM bookings WHERE departure_id = ?',
    id,
  );
  if ((bookings?.n ?? 0) > 0) {
    return jsonError(
      `This departure has ${bookings?.n} booking(s) and cannot be deleted. ` +
        `Set its status to 'cancelled' instead so travellers keep their record.`,
      409,
    );
  }

  run('DELETE FROM departures WHERE id = ?', id);

  audit(
    user,
    'delete',
    'departure',
    id,
    `Deleted the ${departure.start_date} departure of tour ${departure.tour_id}.`,
  );

  return NextResponse.json({ ok: true });
}
