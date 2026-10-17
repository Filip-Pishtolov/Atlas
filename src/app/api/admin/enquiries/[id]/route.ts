import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { audit, requireRole } from '@/lib/auth';
import type { Enquiry, EnquiryStatus } from '@/lib/types';
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

const ENQUIRY_STATUSES = ['new', 'in_progress', 'closed'] as const;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Enquiry id must be a whole number.');

  const item = get<Enquiry>('SELECT * FROM enquiries WHERE id = ?', id);
  if (!item) return notFound('Enquiry');

  return NextResponse.json({ item });
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Enquiry id must be a whole number.');

  const enquiry = get<Enquiry>('SELECT * FROM enquiries WHERE id = ?', id);
  if (!enquiry) return notFound('Enquiry');

  const body = await readBody(req);
  if (!body) return jsonError('Request body must be valid JSON.');

  if (!has(body, 'status')) {
    return jsonError('status is the only editable field on an enquiry.');
  }

  const status: EnquiryStatus | null = oneOf(body.status, ENQUIRY_STATUSES);
  if (!status) return jsonError(`status must be ${listOf(ENQUIRY_STATUSES)}.`);

  run('UPDATE enquiries SET status = ? WHERE id = ?', status, id);

  audit(
    user,
    'update',
    'enquiry',
    id,
    `"${enquiry.subject}" from ${enquiry.name}: ${enquiry.status} -> ${status}.`,
  );

  const item = get<Enquiry>('SELECT * FROM enquiries WHERE id = ?', id);
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Enquiry id must be a whole number.');

  const enquiry = get<Enquiry>('SELECT * FROM enquiries WHERE id = ?', id);
  if (!enquiry) return notFound('Enquiry');

  run('DELETE FROM enquiries WHERE id = ?', id);

  audit(
    user,
    'delete',
    'enquiry',
    id,
    `Deleted "${enquiry.subject}" from ${enquiry.name} <${enquiry.email}>.`,
  );

  return NextResponse.json({ ok: true });
}
