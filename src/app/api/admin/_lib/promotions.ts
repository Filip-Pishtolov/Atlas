import { get } from '@/lib/db';
import type { PromotionScope, PromotionType } from '@/lib/types';
import { fail, int, intInRange, ok, readMoney, text } from './http';
import type { Parsed } from './http';

export const PROMO_TYPES = ['percentage', 'fixed'] as const;
export const PROMO_SCOPES = ['all', 'tour', 'destination', 'theme'] as const;
export const PROMO_STATUSES = ['draft', 'active', 'paused', 'expired'] as const;

export function normaliseCode(raw: unknown): string | null {
  const code = text(raw).toUpperCase().replace(/\s+/g, '');
  return code === '' ? null : code;
}

export function codeIsTaken(code: string, exceptId?: number): boolean {
  const row = exceptId
    ? get<{ id: number }>(
        'SELECT id FROM promotions WHERE UPPER(code) = ? AND id <> ?',
        code,
        exceptId,
      )
    : get<{ id: number }>('SELECT id FROM promotions WHERE UPPER(code) = ?', code);
  return Boolean(row);
}

export function checkScopeTarget(
  scope: PromotionScope,
  scopeId: number | null,
): string | null {
  if (scope === 'all') return null;
  if (scopeId === null) {
    return `scope_id is required when scope is '${scope}'.`;
  }

  const table =
    scope === 'tour' ? 'tours' : scope === 'destination' ? 'destinations' : 'themes';
  const row = get<{ id: number }>(`SELECT id FROM ${table} WHERE id = ?`, scopeId);

  return row ? null : `No ${scope} with id ${scopeId} exists.`;
}

export function readPromotionValue(
  body: Record<string, unknown>,
  type: PromotionType,
): Parsed<number> {
  if (type === 'percentage') {
    const percent = intInRange(body.value, 1, 100);
    if (percent === null) {
      return fail('A percentage promotion needs a value between 1 and 100.');
    }
    return ok(percent);
  }

  const cents = readMoney(body, 'value_cents');
  if (cents === undefined) {
    return fail('A fixed promotion needs a value in euros, such as "150.00".');
  }
  if (cents === null) {
    return fail('value must be an amount in euros, such as "150.00".');
  }
  if (cents <= 0) {
    return fail('A fixed promotion must be worth more than zero.');
  }
  return ok(cents);
}

export function readOptionalCount(
  body: Record<string, unknown>,
  key: string,
): Parsed<number | null> {
  const raw = body[key];
  if (raw === null || raw === undefined || raw === '') return ok(null);

  const n = int(raw);
  if (n === null || n < 1) return fail(`${key} must be a whole number of 1 or more.`);
  return ok(n);
}

export function readOptionalDays(
  body: Record<string, unknown>,
  key: string,
): Parsed<number | null> {
  const raw = body[key];
  if (raw === null || raw === undefined || raw === '') return ok(null);

  const n = int(raw);
  if (n === null || n < 0) return fail(`${key} must be 0 or more days.`);
  return ok(n);
}

export function checkLeadWindow(
  minDaysBefore: number | null,
  maxDaysBefore: number | null,
): string | null {
  if (minDaysBefore === null || maxDaysBefore === null) return null;
  if (minDaysBefore > maxDaysBefore) {
    return (
      'min_days_before cannot be greater than max_days_before - ' +
      'no departure could ever satisfy both.'
    );
  }
  return null;
}
