import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { get, run, transaction } from '@/lib/db';
import { audit, getCurrentUser } from '@/lib/auth';
import { depositFor, priceFor } from '@/lib/pricing';
import { tourThemeIds } from '@/lib/queries';
import type { Departure, PublicUser, Tour } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TRAVELLERS = 40;

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface TravellerInput {
  full_name: string;
  dob: string | null;
  nationality: string | null;
  dietary: string | null;
}

type Outcome =
  | { ok: true; reference: string; totalCents: number; depositCents: number }
  | { ok: false; status: number; error: string };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    return Number.isInteger(n) ? n : null;
  }
  return null;
}

function isCalendarDate(value: string): boolean {
  if (!DOB_RE.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function makeReference(): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  }
  return `ATL-${out}`;
}

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

  const departureId = toInt(data.departure_id);
  if (departureId === null || departureId <= 0) {
    return NextResponse.json(
      { error: 'departure_id must be a positive whole number (field: departure_id).' },
      { status: 400 },
    );
  }

  if (!Array.isArray(data.travellers) || data.travellers.length === 0) {
    return NextResponse.json(
      { error: 'Please add at least one traveller (field: travellers).' },
      { status: 400 },
    );
  }
  if (data.travellers.length > MAX_TRAVELLERS) {
    return NextResponse.json(
      {
        error: `A single booking can hold at most ${MAX_TRAVELLERS} travellers. Call us on +353 1 555 0142 for a larger group (field: travellers).`,
      },
      { status: 400 },
    );
  }

  const travellers: TravellerInput[] = [];
  for (let i = 0; i < data.travellers.length; i += 1) {
    const raw = data.travellers[i];
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return NextResponse.json(
        { error: `Traveller ${i + 1} is not a valid object (field: travellers).` },
        { status: 400 },
      );
    }
    const t = raw as Record<string, unknown>;

    const fullName = text(t.full_name);
    if (fullName.length < 2 || fullName.length > 120) {
      return NextResponse.json(
        {
          error: `Traveller ${i + 1} needs a full name of 2 to 120 characters (field: travellers[${i}].full_name).`,
        },
        { status: 400 },
      );
    }

    const dob = text(t.dob);
    if (dob && !isCalendarDate(dob)) {
      return NextResponse.json(
        {
          error: `Traveller ${i + 1} has a date of birth that is not a real date in YYYY-MM-DD form (field: travellers[${i}].dob).`,
        },
        { status: 400 },
      );
    }
    if (dob && dob > new Date().toISOString().slice(0, 10)) {
      return NextResponse.json(
        {
          error: `Traveller ${i + 1} has a date of birth in the future (field: travellers[${i}].dob).`,
        },
        { status: 400 },
      );
    }

    const nationality = text(t.nationality);
    if (nationality.length > 80) {
      return NextResponse.json(
        {
          error: `Traveller ${i + 1}: nationality must be 80 characters or fewer (field: travellers[${i}].nationality).`,
        },
        { status: 400 },
      );
    }

    const dietary = text(t.dietary);
    if (dietary.length > 300) {
      return NextResponse.json(
        {
          error: `Traveller ${i + 1}: dietary notes must be 300 characters or fewer (field: travellers[${i}].dietary).`,
        },
        { status: 400 },
      );
    }

    travellers.push({
      full_name: fullName,
      dob: dob || null,
      nationality: nationality || null,
      dietary: dietary || null,
    });
  }

  const contactName = text(data.contact_name);
  if (contactName.length < 2 || contactName.length > 120) {
    return NextResponse.json(
      { error: 'Please give a contact name, 2 to 120 characters (field: contact_name).' },
      { status: 400 },
    );
  }

  const contactEmail = text(data.contact_email).toLowerCase();
  if (!EMAIL_RE.test(contactEmail) || contactEmail.length > 190) {
    return NextResponse.json(
      {
        error:
          'Please give a valid email address — the confirmation goes there (field: contact_email).',
      },
      { status: 400 },
    );
  }

  const contactPhone = text(data.contact_phone);
  if (contactPhone.length > 40) {
    return NextResponse.json(
      { error: 'Phone number must be 40 characters or fewer (field: contact_phone).' },
      { status: 400 },
    );
  }

  const notes = text(data.notes);
  if (notes.length > 2000) {
    return NextResponse.json(
      { error: 'Notes must be 2000 characters or fewer (field: notes).' },
      { status: 400 },
    );
  }

  const code = typeof data.code === 'string' ? data.code.trim().slice(0, 60) : '';

  const user: PublicUser | null = await getCurrentUser();

  let outcome: Outcome;
  try {
    outcome = transaction<Outcome>(() =>
      createBooking({
        departureId,
        travellers,
        contactName,
        contactEmail,
        contactPhone: contactPhone || null,
        notes: notes || null,
        code: code || null,
        user,
      }),
    );
  } catch {
    return NextResponse.json(
      { error: 'The booking could not be saved. Please try again.' },
      { status: 500 },
    );
  }

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  return NextResponse.json(
    {
      reference: outcome.reference,
      total_cents: outcome.totalCents,
      deposit_cents: outcome.depositCents,
    },
    { status: 201 },
  );
}

function createBooking(input: {
  departureId: number;
  travellers: TravellerInput[];
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  notes: string | null;
  code: string | null;
  user: PublicUser | null;
}): Outcome {
  const departure = get<Departure>(
    'SELECT * FROM departures WHERE id = ?',
    input.departureId,
  );
  if (!departure) {
    return { ok: false, status: 404, error: 'Departure not found' };
  }

  const tour = get<Tour>('SELECT * FROM tours WHERE id = ?', departure.tour_id);
  if (!tour) {
    return { ok: false, status: 404, error: 'Tour not found' };
  }

  if (departure.status === 'cancelled') {
    return {
      ok: false,
      status: 409,
      error: 'That departure has been cancelled. Please choose another date.',
    };
  }
  if (departure.status === 'sold_out') {
    return {
      ok: false,
      status: 409,
      error: 'That departure is sold out. Please choose another date.',
    };
  }
  if (tour.status === 'draft' || tour.status === 'retired') {
    return {
      ok: false,
      status: 409,
      error: 'This tour is not open for booking at the moment.',
    };
  }
  if (departure.start_date < new Date().toISOString().slice(0, 10)) {
    return {
      ok: false,
      status: 409,
      error: 'That departure has already left. Please choose another date.',
    };
  }

  const count = input.travellers.length;
  if (count > tour.group_size_max) {
    return {
      ok: false,
      status: 409,
      error: `This tour runs with at most ${tour.group_size_max} travellers. Call us on +353 1 555 0142 to arrange a private departure.`,
    };
  }

  const seatsLeft = departure.seats_total - departure.seats_booked;
  if (seatsLeft < count) {
    return { ok: false, status: 409, error: 'Not enough seats remaining' };
  }

  const breakdown = priceFor({
    tour: {
      id: tour.id,
      destination_id: tour.destination_id,
      base_price_cents: tour.base_price_cents,
    },
    departure: {
      id: departure.id,
      price_cents: departure.price_cents,
      start_date: departure.start_date,
    },
    travellers: count,
    themeIds: tourThemeIds(tour.id),
    code: input.code,
  });
  const depositCents = depositFor(breakdown.totalCents);

  let reference = '';
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = makeReference();
    const clash = get<{ id: number }>(
      'SELECT id FROM bookings WHERE reference = ?',
      candidate,
    );
    if (!clash) {
      reference = candidate;
      break;
    }
  }
  if (!reference) {
    return {
      ok: false,
      status: 500,
      error: 'Could not allocate a booking reference. Please try again.',
    };
  }

  const inserted = run(
    `INSERT INTO bookings (
       reference, user_id, tour_id, departure_id, status, travellers_count,
       base_total_cents, discount_cents, total_cents, deposit_cents,
       promotion_id, promo_code, contact_name, contact_email, contact_phone, notes
     ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    reference,
    input.user?.id ?? null,
    tour.id,
    departure.id,
    count,
    breakdown.baseTotalCents,
    breakdown.discountCents,
    breakdown.totalCents,
    depositCents,
    breakdown.promotion?.id ?? null,
    breakdown.promotion?.code ?? null,
    input.contactName,
    input.contactEmail,
    input.contactPhone,
    input.notes,
  );
  const bookingId = inserted.lastInsertRowid;

  input.travellers.forEach((t, index) => {
    run(
      `INSERT INTO booking_travellers (booking_id, full_name, dob, nationality, dietary, is_lead)
       VALUES (?, ?, ?, ?, ?, ?)`,
      bookingId,
      t.full_name,
      t.dob,
      t.nationality,
      t.dietary,
      index === 0 ? 1 : 0,
    );
  });

  run('UPDATE departures SET seats_booked = seats_booked + ? WHERE id = ?', count, departure.id);

  if (departure.seats_booked + count >= departure.seats_total) {
    run("UPDATE departures SET status = 'sold_out' WHERE id = ?", departure.id);
  }

  if (breakdown.promotion) {
    run(
      'UPDATE promotions SET usage_count = usage_count + 1 WHERE id = ?',
      breakdown.promotion.id,
    );
  }

  audit(
    input.user,
    'create',
    'booking',
    bookingId,
    `${reference} · ${tour.title} · ${count} traveller${count === 1 ? '' : 's'}`,
  );

  return { ok: true, reference, totalCents: breakdown.totalCents, depositCents };
}
