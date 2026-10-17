import { NextResponse } from 'next/server';
import { get, query } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import type { Booking } from '@/lib/types';
import { int, jsonError, listOf, oneOf, readPaging, text } from '../_lib/http';

export const dynamic = 'force-dynamic';

const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'paid',
  'cancelled',
  'completed',
] as const;

interface AdminBookingRow extends Booking {
  tour_title: string;
  tour_slug: string;
  start_date: string;
  end_date: string;
  promotion_name: string | null;
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
    const valid = oneOf(status, BOOKING_STATUSES);
    if (!valid) return jsonError(`status must be ${listOf(BOOKING_STATUSES)}.`);
    where.push('b.status = ?');
    params.push(valid);
  }

  if (url.searchParams.has('tour_id')) {
    const tourId = int(url.searchParams.get('tour_id'));
    if (tourId === null) return jsonError('tour_id must be a whole number.');
    where.push('b.tour_id = ?');
    params.push(tourId);
  }

  if (url.searchParams.has('departure_id')) {
    const departureId = int(url.searchParams.get('departure_id'));
    if (departureId === null) return jsonError('departure_id must be a whole number.');
    where.push('b.departure_id = ?');
    params.push(departureId);
  }

  const q = text(url.searchParams.get('q'));
  if (q) {
    where.push(
      '(b.reference LIKE ? OR b.contact_name LIKE ? OR b.contact_email LIKE ?)',
    );
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const items = query<AdminBookingRow>(
    `SELECT b.*,
            t.title      AS tour_title,
            t.slug       AS tour_slug,
            dep.start_date,
            dep.end_date,
            p.name       AS promotion_name
       FROM bookings b
       JOIN tours t         ON t.id   = b.tour_id
       JOIN departures dep  ON dep.id = b.departure_id
       LEFT JOIN promotions p ON p.id = b.promotion_id
      ${clause}
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  const totals = get<{ n: number; revenue_cents: number | null }>(
    `SELECT COUNT(*) AS n,
            SUM(CASE WHEN b.status <> 'cancelled' THEN b.total_cents ELSE 0 END)
              AS revenue_cents
       FROM bookings b
       JOIN tours t        ON t.id   = b.tour_id
       JOIN departures dep ON dep.id = b.departure_id
      ${clause}`,
    ...params,
  );

  return NextResponse.json({
    items,
    total: totals?.n ?? items.length,
    revenue_cents: totals?.revenue_cents ?? 0,
  });
}
