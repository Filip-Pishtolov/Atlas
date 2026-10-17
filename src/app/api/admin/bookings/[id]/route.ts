import { NextResponse } from 'next/server';
import { get, query, run, transaction } from '@/lib/db';
import { audit, requireRole } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import type {
  Booking,
  BookingStatus,
  BookingTraveller,
  Departure,
  Promotion,
  Tour,
} from '@/lib/types';
import {
  has,
  jsonError,
  listOf,
  notFound,
  oneOf,
  optText,
  readBody,
  readRouteId,
  UpdateSet,
} from '../../_lib/http';

export const dynamic = 'force-dynamic';

const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'paid',
  'cancelled',
  'completed',
] as const;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Booking id must be a whole number.');

  const item = get<Booking>('SELECT * FROM bookings WHERE id = ?', id);
  if (!item) return notFound('Booking');

  return NextResponse.json({
    item,
    travellers: query<BookingTraveller>(
      'SELECT * FROM booking_travellers WHERE booking_id = ? ORDER BY is_lead DESC, id',
      id,
    ),
    tour: get<Tour>('SELECT * FROM tours WHERE id = ?', item.tour_id) ?? null,
    departure:
      get<Departure>('SELECT * FROM departures WHERE id = ?', item.departure_id) ?? null,
    promotion: item.promotion_id
      ? (get<Promotion>('SELECT * FROM promotions WHERE id = ?', item.promotion_id) ??
        null)
      : null,
  });
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Booking id must be a whole number.');

  const booking = get<Booking>('SELECT * FROM bookings WHERE id = ?', id);
  if (!booking) return notFound('Booking');

  const body = await readBody(req);
  if (!body) return jsonError('Request body must be valid JSON.');

  const set = new UpdateSet();
  let nextStatus: BookingStatus = booking.status;

  if (has(body, 'status')) {
    const status: BookingStatus | null = oneOf(body.status, BOOKING_STATUSES);
    if (!status) return jsonError(`status must be ${listOf(BOOKING_STATUSES)}.`);
    nextStatus = status;
    set.add('status', status);
  }

  if (has(body, 'notes')) set.add('notes', optText(body.notes));

  if (set.isEmpty) {
    return jsonError('Only status and notes can be edited on a booking.');
  }

  const cancelling = nextStatus === 'cancelled' && booking.status !== 'cancelled';
  const reinstating = booking.status === 'cancelled' && nextStatus !== 'cancelled';

  const departure = get<Departure>(
    'SELECT * FROM departures WHERE id = ?',
    booking.departure_id,
  );

  if (reinstating && departure) {
    const seatsLeft = departure.seats_total - departure.seats_booked;
    if (seatsLeft < booking.travellers_count) {
      return jsonError(
        `Cannot reinstate ${booking.reference}: the ${departure.start_date} departure ` +
          `has ${seatsLeft} seat(s) left and this booking needs ` +
          `${booking.travellers_count}.`,
        409,
      );
    }
  }

  transaction(() => {
    run(`UPDATE bookings SET ${set.clause} WHERE id = ?`, ...set.params, id);

    if (cancelling) {
      run(
        'UPDATE departures SET seats_booked = MAX(0, seats_booked - ?) WHERE id = ?',
        booking.travellers_count,
        booking.departure_id,
      );
      run(
        "UPDATE departures SET status = 'open' WHERE id = ? AND status = 'sold_out'",
        booking.departure_id,
      );
    }

    if (reinstating) {
      run(
        'UPDATE departures SET seats_booked = seats_booked + ? WHERE id = ?',
        booking.travellers_count,
        booking.departure_id,
      );
      run(
        `UPDATE departures
            SET status = 'sold_out'
          WHERE id = ?
            AND seats_booked >= seats_total
            AND status IN ('open', 'guaranteed')`,
        booking.departure_id,
      );
    }
  });

  let detail = `${booking.reference} (${formatMoney(booking.total_cents)}): ${set.columns.join(', ')}.`;
  if (cancelling) {
    detail += ` Cancelled from '${booking.status}'; ${booking.travellers_count} seat(s) released.`;
  }
  if (reinstating) {
    detail += ` Reinstated as '${nextStatus}'; ${booking.travellers_count} seat(s) taken again.`;
  }

  audit(user, 'update', 'booking', id, detail);

  const item = get<Booking>('SELECT * FROM bookings WHERE id = ?', id);
  return NextResponse.json({ item });
}
