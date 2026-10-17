import { NextResponse } from 'next/server';
import { get, query, run } from '@/lib/db';
import { audit, requireRole } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import type { Promotion, PromotionScope, PromotionStatus, PromotionType } from '@/lib/types';
import {
  flag,
  has,
  int,
  jsonError,
  listOf,
  notFound,
  oneOf,
  optText,
  readBody,
  readMoney,
  readRouteId,
  readStamp,
  text,
  UpdateSet,
} from '../../_lib/http';
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
} from '../../_lib/promotions';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Promotion id must be a whole number.');

  const item = get<Promotion>('SELECT * FROM promotions WHERE id = ?', id);
  if (!item) return notFound('Promotion');

  return NextResponse.json({
    item,
    bookings: query(
      `SELECT id, reference, contact_name, total_cents, discount_cents, created_at
         FROM bookings
        WHERE promotion_id = ?
        ORDER BY created_at DESC
        LIMIT 50`,
      id,
    ),
  });
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Promotion id must be a whole number.');

  const promo = get<Promotion>('SELECT * FROM promotions WHERE id = ?', id);
  if (!promo) return notFound('Promotion');

  const body = await readBody(req);
  if (!body) return jsonError('Request body must be valid JSON.');

  const set = new UpdateSet();

  if (has(body, 'name')) {
    const name = text(body.name);
    if (!name) return jsonError('name cannot be blank.');
    set.add('name', name);
  }

  if (has(body, 'description')) set.add('description', optText(body.description));
  if (has(body, 'badge_text')) set.add('badge_text', optText(body.badge_text));

  let type: PromotionType = promo.type;
  if (has(body, 'type')) {
    const parsed: PromotionType | null = oneOf(body.type, PROMO_TYPES);
    if (!parsed) return jsonError(`type must be ${listOf(PROMO_TYPES)}.`);
    type = parsed;
    set.add('type', parsed);
  }

  if (has(body, 'value') || has(body, 'value_cents')) {
    const value = readPromotionValue(body, type);
    if (!value.ok) return jsonError(value.error);
    set.add('value', value.value);
  } else if (has(body, 'type') && type !== promo.type) {
    return jsonError(
      'Changing type also changes what `value` means, so send the new value too.',
    );
  }

  if (has(body, 'scope') || has(body, 'scope_id')) {
    let scope: PromotionScope = promo.scope;
    if (has(body, 'scope')) {
      const parsed: PromotionScope | null = oneOf(body.scope, PROMO_SCOPES);
      if (!parsed) return jsonError(`scope must be ${listOf(PROMO_SCOPES)}.`);
      scope = parsed;
    }

    let scopeId: number | null;
    if (scope === 'all') {
      scopeId = null;
    } else if (has(body, 'scope_id')) {
      scopeId = int(body.scope_id);
    } else {
      scopeId = promo.scope_id;
    }

    const scopeProblem = checkScopeTarget(scope, scopeId);
    if (scopeProblem) return jsonError(scopeProblem);

    set.add('scope', scope);
    set.add('scope_id', scopeId);
  }

  if (has(body, 'starts_at') || has(body, 'ends_at')) {
    const startsAt = has(body, 'starts_at')
      ? readStamp(body.starts_at)
      : promo.starts_at;
    const endsAt = has(body, 'ends_at') ? readStamp(body.ends_at, true) : promo.ends_at;

    if (!startsAt) return jsonError('starts_at must be a date such as "2026-06-01".');
    if (!endsAt) return jsonError('ends_at must be a date such as "2026-08-31".');
    if (endsAt <= startsAt) return jsonError('ends_at must fall after starts_at.');

    if (has(body, 'starts_at')) set.add('starts_at', startsAt);
    if (has(body, 'ends_at')) set.add('ends_at', endsAt);
  }

  if (has(body, 'code')) {
    const code = normaliseCode(body.code);
    if (code && codeIsTaken(code, id)) {
      return jsonError(`The code ${code} is already used by another promotion.`, 409);
    }
    set.add('code', code);
  }

  const minBooking = readMoney(body, 'min_booking_cents');
  if (minBooking === null) {
    return jsonError('min_booking must be an amount in euros, such as "500.00".');
  }
  if (minBooking !== undefined) {
    if (minBooking < 0) return jsonError('min_booking cannot be negative.');
    set.add('min_booking_cents', minBooking);
  }

  if (has(body, 'min_travellers')) {
    const minTravellers = int(body.min_travellers);
    if (minTravellers === null || minTravellers < 1) {
      return jsonError('min_travellers must be at least 1.');
    }
    set.add('min_travellers', minTravellers);
  }

  if (has(body, 'min_days_before') || has(body, 'max_days_before')) {
    let minDays = promo.min_days_before;
    let maxDays = promo.max_days_before;

    if (has(body, 'min_days_before')) {
      const parsed = readOptionalDays(body, 'min_days_before');
      if (!parsed.ok) return jsonError(parsed.error);
      minDays = parsed.value;
    }
    if (has(body, 'max_days_before')) {
      const parsed = readOptionalDays(body, 'max_days_before');
      if (!parsed.ok) return jsonError(parsed.error);
      maxDays = parsed.value;
    }

    const leadProblem = checkLeadWindow(minDays, maxDays);
    if (leadProblem) return jsonError(leadProblem);

    if (has(body, 'min_days_before')) set.add('min_days_before', minDays);
    if (has(body, 'max_days_before')) set.add('max_days_before', maxDays);
  }

  if (has(body, 'usage_limit')) {
    const parsed = readOptionalCount(body, 'usage_limit');
    if (!parsed.ok) return jsonError(parsed.error);
    if (parsed.value !== null && parsed.value < promo.usage_count) {
      return jsonError(
        `usage_limit cannot be below the ${promo.usage_count} use(s) already recorded.`,
      );
    }
    set.add('usage_limit', parsed.value);
  }

  if (has(body, 'per_customer_limit')) {
    const parsed = readOptionalCount(body, 'per_customer_limit');
    if (!parsed.ok) return jsonError(parsed.error);
    set.add('per_customer_limit', parsed.value);
  }

  if (has(body, 'priority')) {
    const priority = int(body.priority);
    if (priority === null) return jsonError('priority must be a whole number.');
    set.add('priority', priority);
  }

  if (has(body, 'stackable')) set.add('stackable', flag(body.stackable));

  if (has(body, 'status')) {
    const status: PromotionStatus | null = oneOf(body.status, PROMO_STATUSES);
    if (!status) return jsonError(`status must be ${listOf(PROMO_STATUSES)}.`);
    set.add('status', status);
  }

  if (set.isEmpty) return jsonError('No editable fields were supplied.');

  run(`UPDATE promotions SET ${set.clause} WHERE id = ?`, ...set.params, id);

  audit(user, 'update', 'promotion', id, `${promo.name}: ${set.columns.join(', ')}.`);

  const item = get<Promotion>('SELECT * FROM promotions WHERE id = ?', id);
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireRole('admin', 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: raw } = await params;
  const id = readRouteId(raw);
  if (id === null) return jsonError('Promotion id must be a whole number.');

  const promo = get<Promotion>('SELECT * FROM promotions WHERE id = ?', id);
  if (!promo) return notFound('Promotion');

  const used = get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM bookings WHERE promotion_id = ?',
    id,
  );
  if ((used?.n ?? 0) > 0) {
    return jsonError(
      `"${promo.name}" has been applied to ${used?.n} booking(s) and cannot be ` +
        `deleted. Set its status to 'expired' to stop it from applying again.`,
      409,
    );
  }

  run('DELETE FROM promotions WHERE id = ?', id);

  const worth =
    promo.type === 'percentage'
      ? `${promo.value}% off`
      : `${formatMoney(promo.value)} off`;
  audit(user, 'delete', 'promotion', id, `Deleted "${promo.name}" (${worth}).`);

  return NextResponse.json({ ok: true });
}
