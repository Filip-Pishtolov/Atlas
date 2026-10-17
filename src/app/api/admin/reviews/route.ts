import { NextResponse } from 'next/server';
import { get, query } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import type { Review } from '@/lib/types';
import { int, jsonError, listOf, oneOf, readPaging, text } from '../_lib/http';

export const dynamic = 'force-dynamic';

const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;

interface AdminReviewRow extends Review {
  tour_title: string;
  tour_slug: string;
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
    const valid = oneOf(status, REVIEW_STATUSES);
    if (!valid) return jsonError(`status must be ${listOf(REVIEW_STATUSES)}.`);
    where.push('r.status = ?');
    params.push(valid);
  }

  if (url.searchParams.has('tour_id')) {
    const tourId = int(url.searchParams.get('tour_id'));
    if (tourId === null) return jsonError('tour_id must be a whole number.');
    where.push('r.tour_id = ?');
    params.push(tourId);
  }

  const q = text(url.searchParams.get('q'));
  if (q) {
    where.push('(r.author_name LIKE ? OR r.title LIKE ? OR r.body LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const items = query<AdminReviewRow>(
    `SELECT r.*, t.title AS tour_title, t.slug AS tour_slug
       FROM reviews r
       JOIN tours t ON t.id = r.tour_id
      ${clause}
      ORDER BY r.status = 'pending' DESC, r.created_at DESC, r.id DESC
      LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  const pending = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'",
  );

  return NextResponse.json({ items, pending_count: pending?.n ?? 0 });
}
