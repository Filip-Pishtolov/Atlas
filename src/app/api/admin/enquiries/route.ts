import { NextResponse } from 'next/server';
import { get, query } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import type { Enquiry } from '@/lib/types';
import { int, jsonError, listOf, oneOf, readPaging, text } from '../_lib/http';

export const dynamic = 'force-dynamic';

const ENQUIRY_STATUSES = ['new', 'in_progress', 'closed'] as const;

interface AdminEnquiryRow extends Enquiry {
  tour_title: string | null;
  tour_slug: string | null;
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
    const valid = oneOf(status, ENQUIRY_STATUSES);
    if (!valid) return jsonError(`status must be ${listOf(ENQUIRY_STATUSES)}.`);
    where.push('e.status = ?');
    params.push(valid);
  }

  if (url.searchParams.has('tour_id')) {
    const tourId = int(url.searchParams.get('tour_id'));
    if (tourId === null) return jsonError('tour_id must be a whole number.');
    where.push('e.tour_id = ?');
    params.push(tourId);
  }

  const q = text(url.searchParams.get('q'));
  if (q) {
    where.push('(e.name LIKE ? OR e.email LIKE ? OR e.subject LIKE ? OR e.message LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  const items = query<AdminEnquiryRow>(
    `SELECT e.*, t.title AS tour_title, t.slug AS tour_slug
       FROM enquiries e
       LEFT JOIN tours t ON t.id = e.tour_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY e.status = 'new' DESC, e.created_at DESC, e.id DESC
      LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  const unread = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'",
  );

  return NextResponse.json({ items, new_count: unread?.n ?? 0 });
}
