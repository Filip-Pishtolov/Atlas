import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

  const user = await getCurrentUser();

  const rawTourId = data.tour_id;
  const tourId =
    typeof rawTourId === 'number' ? rawTourId : Number(String(rawTourId ?? '').trim());
  if (!Number.isInteger(tourId) || tourId <= 0) {
    return NextResponse.json(
      { error: 'tour_id must be a positive whole number (field: tour_id).' },
      { status: 400 },
    );
  }

  const rawRating = data.rating;
  const rating =
    typeof rawRating === 'number' ? rawRating : Number(String(rawRating ?? '').trim());
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: 'Please choose a rating from 1 to 5 stars (field: rating).' },
      { status: 400 },
    );
  }

  const title = text(data.title);
  const reviewBody = text(data.body);
  const authorName = text(data.author_name) || user?.name || '';

  if (title.length < 3 || title.length > 120) {
    return NextResponse.json(
      { error: 'Please give your review a headline, 3 to 120 characters (field: title).' },
      { status: 400 },
    );
  }
  if (reviewBody.length < 20) {
    return NextResponse.json(
      {
        error:
          'Please write at least 20 characters so other travellers learn something (field: body).',
      },
      { status: 400 },
    );
  }
  if (reviewBody.length > 4000) {
    return NextResponse.json(
      { error: 'Review must be 4000 characters or fewer (field: body).' },
      { status: 400 },
    );
  }
  if (authorName.length < 2 || authorName.length > 120) {
    return NextResponse.json(
      { error: 'Please give a display name, 2 to 120 characters (field: author_name).' },
      { status: 400 },
    );
  }

  const tour = get<{ id: number }>('SELECT id FROM tours WHERE id = ?', tourId);
  if (!tour) {
    return NextResponse.json(
      { error: 'That tour no longer exists (field: tour_id).' },
      { status: 404 },
    );
  }

  if (user) {
    const duplicate = get<{ id: number }>(
      'SELECT id FROM reviews WHERE tour_id = ? AND user_id = ?',
      tourId,
      user.id,
    );
    if (duplicate) {
      return NextResponse.json(
        { error: 'You have already reviewed this tour.' },
        { status: 409 },
      );
    }
  }

  const booking = user
    ? get<{ id: number }>(
        `SELECT id FROM bookings
          WHERE user_id = ? AND tour_id = ? AND status != 'cancelled'
          ORDER BY created_at DESC
          LIMIT 1`,
        user.id,
        tourId,
      )
    : undefined;

  run(
    `INSERT INTO reviews (tour_id, user_id, booking_id, author_name, rating, title, body, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    tourId,
    user?.id ?? null,
    booking?.id ?? null,
    authorName,
    rating,
    title,
    reviewBody,
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
