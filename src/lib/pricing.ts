import { query } from './db';
import type { Promotion, Tour, Departure } from './types';

export interface PriceContext {
  tour: Pick<Tour, 'id' | 'destination_id' | 'base_price_cents'>;
  departure?: Pick<Departure, 'id' | 'price_cents' | 'start_date'> | null;
  travellers: number;
  themeIds?: number[];
  code?: string | null;
  bookingDate?: Date;
}

export interface PriceBreakdown {
  basePriceCents: number;
  travellers: number;
  baseTotalCents: number;
  promotion: Promotion | null;
  candidates: Promotion[];
  discountCents: number;
  totalCents: number;
  perPersonCents: number;
  codeRejected: boolean;
}

export function daysUntil(startDate: string, from: Date): number {
  const start = new Date(startDate + 'T00:00:00Z').getTime();
  const base = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.floor((start - base) / 86_400_000);
}

export function loadActivePromotions(now: Date = new Date()): Promotion[] {
  const iso = now.toISOString().slice(0, 19).replace('T', ' ');
  return query<Promotion>(
    `SELECT * FROM promotions
      WHERE status = 'active'
        AND starts_at <= ?
        AND ends_at   >= ?
      ORDER BY priority DESC, id ASC`,
    iso,
    iso,
  );
}

export function isEligible(
  promo: Promotion,
  ctx: PriceContext,
  baseTotalCents: number,
): boolean {
  const now = ctx.bookingDate ?? new Date();

  if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) {
    return false;
  }

  if (promo.code) {
    const supplied = (ctx.code ?? '').trim().toUpperCase();
    if (supplied !== promo.code.trim().toUpperCase()) return false;
  }

  switch (promo.scope) {
    case 'all':
      break;
    case 'tour':
      if (promo.scope_id !== ctx.tour.id) return false;
      break;
    case 'destination':
      if (promo.scope_id !== ctx.tour.destination_id) return false;
      break;
    case 'theme':
      if (!promo.scope_id) return false;
      if (!(ctx.themeIds ?? []).includes(promo.scope_id)) return false;
      break;
  }

  if (ctx.travellers < promo.min_travellers) return false;
  if (baseTotalCents < promo.min_booking_cents) return false;

  if (promo.min_days_before !== null || promo.max_days_before !== null) {
    if (!ctx.departure) return false;
    const lead = daysUntil(ctx.departure.start_date, now);
    if (promo.min_days_before !== null && lead < promo.min_days_before) return false;
    if (promo.max_days_before !== null && lead > promo.max_days_before) return false;
  }

  return true;
}

export function discountFor(promo: Promotion, baseTotalCents: number): number {
  const raw =
    promo.type === 'percentage'
      ? Math.round((baseTotalCents * promo.value) / 100)
      : promo.value;
  return Math.max(0, Math.min(raw, baseTotalCents));
}

export function priceFor(
  ctx: PriceContext,
  promotions?: Promotion[],
): PriceBreakdown {
  const now = ctx.bookingDate ?? new Date();
  const basePriceCents = ctx.departure?.price_cents ?? ctx.tour.base_price_cents;
  const travellers = Math.max(1, ctx.travellers);
  const baseTotalCents = basePriceCents * travellers;

  const pool = promotions ?? loadActivePromotions(now);

  const candidates = pool
    .filter((p) => isEligible(p, ctx, baseTotalCents))
    .sort((a, b) => {
      const d = discountFor(b, baseTotalCents) - discountFor(a, baseTotalCents);
      return d !== 0 ? d : b.priority - a.priority;
    });

  const winner = candidates[0] ?? null;
  const discountCents = winner ? discountFor(winner, baseTotalCents) : 0;
  const totalCents = baseTotalCents - discountCents;

  const suppliedCode = (ctx.code ?? '').trim();
  const codeRejected =
    suppliedCode.length > 0 &&
    !candidates.some(
      (p) => p.code && p.code.trim().toUpperCase() === suppliedCode.toUpperCase(),
    );

  return {
    basePriceCents,
    travellers,
    baseTotalCents,
    promotion: winner,
    candidates,
    discountCents,
    totalCents,
    perPersonCents: Math.round(totalCents / travellers),
    codeRejected,
  };
}

export function bestAutomaticPromotion(
  ctx: Omit<PriceContext, 'travellers' | 'code'>,
  promotions?: Promotion[],
): { promotion: Promotion | null; discountCents: number; wasCents: number; nowCents: number } {
  const pool = (promotions ?? loadActivePromotions(ctx.bookingDate ?? new Date()))
    .filter((p) => !p.code);

  const result = priceFor({ ...ctx, travellers: 1, code: null }, pool);

  return {
    promotion: result.promotion,
    discountCents: result.discountCents,
    wasCents: result.baseTotalCents,
    nowCents: result.totalCents,
  };
}

export function depositFor(totalCents: number): number {
  return Math.round((totalCents * 0.2) / 100) * 100;
}
