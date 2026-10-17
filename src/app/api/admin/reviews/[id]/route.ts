import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { audit, requireRole } from '@/lib/auth';
import type { Review, ReviewStatus } from '@/lib/types';
import {
  has,
  jsonError,
  listOf,
  notFound,
  oneOf,
  readBody,
  readRouteId,
} from '../../_lib/http';

export const dynamic = 'force-dynamic';

const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Review id must be a whole number.');

  const item = get<Review>('SELECT * FROM reviews WHERE id = ?', id);
  if (!item) return notFound('Review');

  return NextResponse.json({ item });
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Review id must be a whole number.');

  const review = get<Review>('SELECT * FROM reviews WHERE id = ?', id);
  if (!review) return notFound('Review');

  const body = await readBody(req);
  if (!body) return jsonError('Request body must be valid JSON.');

  if (!has(body, 'status')) {
    return jsonError('status is the only editable field on a review.');
  }

  const status: ReviewStatus | null = oneOf(body.status, REVIEW_STATUSES);
  if (!status) return jsonError(`status must be ${listOf(REVIEW_STATUSES)}.`);

  run('UPDATE reviews SET status = ? WHERE id = ?', status, id);

  audit(
    user,
    'update',
    'review',
    id,
    `"${review.title}" by ${review.author_name} (${review.rating}/5): ` +
      `${review.status} -> ${status}.`,
  );

  const item = get<Review>('SELECT * FROM reviews WHERE id = ?', id);
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Review id must be a whole number.');

  const review = get<Review>('SELECT * FROM reviews WHERE id = ?', id);
  if (!review) return notFound('Review');

  run('DELETE FROM reviews WHERE id = ?', id);

  audit(
    user,
    'delete',
    'review',
    id,
    `Deleted "${review.title}" by ${review.author_name} on tour ${review.tour_id}.`,
  );

  return NextResponse.json({ ok: true });
}
