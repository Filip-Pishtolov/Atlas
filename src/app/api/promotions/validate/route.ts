import { NextResponse } from 'next/server';
import { get } from '@/lib/db';
import { depositFor, priceFor } from '@/lib/pricing';
import { tourThemeIds } from '@/lib/queries';
import type { Departure, Tour } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MAX_TRAVELLERS = 40;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Request body must be a JSON object' },
      { status: 400 },
    );
  }
  const data = body as Record<string, unknown>;

  const tourId = toInt(data.tour_id);
  if (tourId === null || tourId <= 0) {
    return NextResponse.json(
      { error: 'tour_id must be a positive whole number (field: tour_id).' },
      { status: 400 },
    );
  }

  const travellers = toInt(data.travellers);
  if (travellers === null || travellers < 1 || travellers > MAX_TRAVELLERS) {
    return NextResponse.json(
      {
        error: `travellers must be a whole number from 1 to ${MAX_TRAVELLERS} (field: travellers).`,
      },
      { status: 400 },
    );
  }

  const hasDeparture =
    data.departure_id !== undefined &&
    data.departure_id !== null &&
    data.departure_id !== '';
  const departureId = hasDeparture ? toInt(data.departure_id) : null;
  if (hasDeparture && (departureId === null || departureId <= 0)) {
    return NextResponse.json(
      { error: 'departure_id must be a positive whole number (field: departure_id).' },
      { status: 400 },
    );
  }

  const tour = get<Tour>('SELECT * FROM tours WHERE id = ?', tourId);
  if (!tour) {
    return NextResponse.json({ error: 'Tour not found' }, { status: 404 });
  }

  let departure: Departure | null = null;
  if (departureId !== null) {
    const found = get<Departure>('SELECT * FROM departures WHERE id = ?', departureId);
    if (!found) {
      return NextResponse.json({ error: 'Departure not found' }, { status: 404 });
    }
    if (found.tour_id !== tour.id) {
      return NextResponse.json(
        { error: 'That departure belongs to a different tour (field: departure_id).' },
        { status: 400 },
      );
    }
    departure = found;
  }

  const code = typeof data.code === 'string' ? data.code.trim().slice(0, 60) : null;

  const breakdown = priceFor({
    tour: {
      id: tour.id,
      destination_id: tour.destination_id,
      base_price_cents: tour.base_price_cents,
    },
    departure: departure
      ? {
          id: departure.id,
          price_cents: departure.price_cents,
          start_date: departure.start_date,
        }
      : null,
    travellers,
    themeIds: tourThemeIds(tour.id),
    code: code || null,
  });

  return NextResponse.json(
    {
      baseTotalCents: breakdown.baseTotalCents,
      discountCents: breakdown.discountCents,
      totalCents: breakdown.totalCents,
      perPersonCents: breakdown.perPersonCents,
      depositCents: depositFor(breakdown.totalCents),
      promotionName: breakdown.promotion?.name ?? null,
      badgeText: breakdown.promotion?.badge_text ?? null,
      codeRejected: breakdown.codeRejected,
    },
    { status: 200 },
  );
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    return Number.isInteger(n) ? n : null;
  }
  return null;
}
