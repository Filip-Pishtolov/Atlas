import { NextResponse } from 'next/server';
import { get, query, run } from '@/lib/db';
import { audit, requireRole } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import type { Promotion, PromotionScope, PromotionStatus, PromotionType } from '@/lib/types';
import {
  flag,
  int,
  jsonError,
  listOf,
  oneOf,
  optText,
  readBody,
  readMoney,
  readPaging,
  readStamp,
  text,
} from '../_lib/http';
import {
  checkLeadWindow,
  checkScopeTarget,
  codeIsTaken,
  normaliseCode,
  PROMO_SCOPES,
  PROMO_STATUSES,
  PROMO_TYPES,
  readOptionalCount,
  readOptionalDays,
  readPromotionValue,
} from '../_lib/promotions';

export const dynamic = 'force-dynamic';

interface AdminPromotionRow extends Promotion {
  booking_count: number;
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
    const valid = oneOf(status, PROMO_STATUSES);
    if (!valid) return jsonError(`status must be ${listOf(PROMO_STATUSES)}.`);
    where.push('p.status = ?');
    params.push(valid);
  }

  const scope = url.searchParams.get('scope');
  if (scope && scope !== 'all_scopes') {
    const valid = oneOf(scope, PROMO_SCOPES);
    if (!valid) return jsonError(`scope must be ${listOf(PROMO_SCOPES)}.`);
    where.push('p.scope = ?');
    params.push(valid);
  }

  const automatic = url.searchParams.get('automatic');
  if (automatic === 'true') where.push('p.code IS NULL');
  if (automatic === 'false') where.push('p.code IS NOT NULL');

  const q = text(url.searchParams.get('q'));
  if (q) {
    where.push('(p.name LIKE ? OR p.code LIKE ? OR p.badge_text LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const items = query<AdminPromotionRow>(
    `SELECT p.*,
            (SELECT COUNT(*) FROM bookings b WHERE b.promotion_id = p.id) AS booking_count
       FROM promotions p
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.status = 'active' DESC, p.priority DESC, p.id DESC
      LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  return NextResponse.json({ items });
}

export async function POST(req: Request): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await readBody(req);
  if (!body) return jsonError('Request body must be valid JSON.');

  const name = text(body.name);
  if (!name) return jsonError('name is required.');

  const type: PromotionType | null = oneOf(body.type, PROMO_TYPES);
  if (!type) return jsonError(`type must be ${listOf(PROMO_TYPES)}.`);

  const value = readPromotionValue(body, type);
  if (!value.ok) return jsonError(value.error);

  let scope: PromotionScope = 'all';
  if (body.scope !== undefined) {
    const parsed = oneOf(body.scope, PROMO_SCOPES);
    if (!parsed) return jsonError(`scope must be ${listOf(PROMO_SCOPES)}.`);
    scope = parsed;
  }

  const scopeId = scope === 'all' ? null : int(body.scope_id);
  const scopeProblem = checkScopeTarget(scope, scopeId);
  if (scopeProblem) return jsonError(scopeProblem);

  const startsAt = readStamp(body.starts_at);
  if (!startsAt) return jsonError('starts_at must be a date such as "2026-06-01".');

  const endsAt = readStamp(body.ends_at, true);
  if (!endsAt) return jsonError('ends_at must be a date such as "2026-08-31".');
  if (endsAt <= startsAt) return jsonError('ends_at must fall after starts_at.');

  const code = normaliseCode(body.code);
  if (code && codeIsTaken(code)) {
    return jsonError(`The code ${code} is already used by another promotion.`, 409);
  }

  const minBooking = readMoney(body, 'min_booking_cents');
  if (minBooking === null) {
    return jsonError('min_booking must be an amount in euros, such as "500.00".');
  }
  const minBookingCents = minBooking ?? 0;
  if (minBookingCents < 0) return jsonError('min_booking cannot be negative.');

  const minTravellers = body.min_travellers === undefined ? 1 : int(body.min_travellers);
  if (minTravellers === null || minTravellers < 1) {
    return jsonError('min_travellers must be at least 1.');
  }

  const minDaysBefore = readOptionalDays(body, 'min_days_before');
  if (!minDaysBefore.ok) return jsonError(minDaysBefore.error);

  const maxDaysBefore = readOptionalDays(body, 'max_days_before');
  if (!maxDaysBefore.ok) return jsonError(maxDaysBefore.error);

  const leadProblem = checkLeadWindow(minDaysBefore.value, maxDaysBefore.value);
  if (leadProblem) return jsonError(leadProblem);

  const usageLimit = readOptionalCount(body, 'usage_limit');
  if (!usageLimit.ok) return jsonError(usageLimit.error);

  const perCustomerLimit = readOptionalCount(body, 'per_customer_limit');
  if (!perCustomerLimit.ok) return jsonError(perCustomerLimit.error);

  const priority = body.priority === undefined ? 0 : int(body.priority);
  if (priority === null) return jsonError('priority must be a whole number.');

  let status: PromotionStatus = 'draft';
  if (body.status !== undefined) {
    const parsed = oneOf(body.status, PROMO_STATUSES);
    if (!parsed) return jsonError(`status must be ${listOf(PROMO_STATUSES)}.`);
    status = parsed;
  }

  const inserted = run(
    `INSERT INTO promotions
       (name, code, description, badge_text, type, value, scope, scope_id,
        starts_at, ends_at, min_booking_cents, min_travellers,
        min_days_before, max_days_before, usage_limit, per_customer_limit,
        priority, stackable, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    name,
    code,
    optText(body.description),
    optText(body.badge_text),
    type,
    value.value,
    scope,
    scopeId,
    startsAt,
    endsAt,
    minBookingCents,
    minTravellers,
    minDaysBefore.value,
    maxDaysBefore.value,
    usageLimit.value,
    perCustomerLimit.value,
    priority,
    flag(body.stackable),
    status,
  );

  const worth =
    type === 'percentage' ? `${value.value}% off` : `${formatMoney(value.value)} off`;

  audit(
    user,
    'create',
    'promotion',
    inserted.lastInsertRowid,
    `${name}: ${worth}, ${code ? `code ${code}` : 'applied automatically'}, ` +
      `${startsAt.slice(0, 10)} to ${endsAt.slice(0, 10)}, status ${status}.`,
  );

  const item = get<Promotion>(
    'SELECT * FROM promotions WHERE id = ?',
    inserted.lastInsertRowid,
  );
  return NextResponse.json({ id: inserted.lastInsertRowid, item }, { status: 201 });
}
