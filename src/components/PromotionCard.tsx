import Link from 'next/link';
import { get } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import type { Promotion } from '@/lib/types';

export function formatDateLabel(value: string | null): string {
  if (!value) return 'no end date';
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function discountInWords(promo: Promotion): string {
  return promo.type === 'percentage'
    ? `${promo.value}% off`
    : `${formatMoney(promo.value)} off`;
}

export interface PromotionScopeInfo {
  label: string;
  href: string;
}

export function describePromotionScope(promo: Promotion): PromotionScopeInfo {
  const fallback: PromotionScopeInfo = {
    label: 'on selected Atlas trips',
    href: '/tours',
  };

  if (promo.scope === 'all') {
    return { label: 'on every Atlas departure', href: '/tours' };
  }
  if (!promo.scope_id) return fallback;

  if (promo.scope === 'tour') {
    const tour = get<{ title: string; slug: string }>(
      'SELECT title, slug FROM tours WHERE id = ?',
      promo.scope_id,
    );
    return tour
      ? { label: `on ${tour.title}`, href: `/tours/${tour.slug}` }
      : fallback;
  }

  if (promo.scope === 'destination') {
    const dest = get<{ name: string; slug: string }>(
      'SELECT name, slug FROM destinations WHERE id = ?',
      promo.scope_id,
    );
    return dest
      ? {
          label: `on every trip to ${dest.name}`,
          href: `/tours?destination=${dest.slug}`,
        }
      : fallback;
  }

  if (promo.scope === 'theme') {
    const theme = get<{ name: string; slug: string }>(
      'SELECT name, slug FROM themes WHERE id = ?',
      promo.scope_id,
    );
    return theme
      ? {
          label: `on every ${theme.name.toLowerCase()} trip`,
          href: `/tours?theme=${theme.slug}`,
        }
      : fallback;
  }

  return fallback;
}

export function promotionConditions(promo: Promotion): string[] {
  const lines: string[] = [];

  if (promo.min_travellers > 1) {
    lines.push(`${promo.min_travellers} or more travellers on the same booking`);
  }
  if (promo.min_booking_cents > 0) {
    lines.push(`Booking value of at least ${formatMoney(promo.min_booking_cents)}`);
  }
  if (promo.min_days_before !== null) {
    lines.push(`Booked at least ${promo.min_days_before} days before departure`);
  }
  if (promo.max_days_before !== null) {
    lines.push(`Departure within ${promo.max_days_before} days of booking`);
  }
  if (promo.usage_limit !== null) {
    const left = Math.max(0, promo.usage_limit - promo.usage_count);
    lines.push(
      left > 0
        ? `${left} of ${promo.usage_limit} places still available`
        : `All ${promo.usage_limit} places have been taken`,
    );
  }
  if (promo.per_customer_limit !== null) {
    lines.push(
      `${promo.per_customer_limit} use${promo.per_customer_limit === 1 ? '' : 's'} per customer`,
    );
  }

  lines.push(`Runs until ${formatDateLabel(promo.ends_at)}`);
  return lines;
}

export default function PromotionCard({ promotion }: { promotion: Promotion }) {
  const scope = describePromotionScope(promotion);
  const conditions = promotionConditions(promotion);
  const automatic = !promotion.code;

  return (
    <article className="card card-pad stack" style={{ height: '100%' }}>
      <div className="cluster cluster-sm">
        <span className="badge badge-promo">
          {promotion.badge_text ?? discountInWords(promotion)}
        </span>
        {automatic ? (
          <span className="badge badge-good">Automatic</span>
        ) : (
          <span className="badge badge-accent">Code required</span>
        )}
      </div>

      <div className="stack stack-sm">
        <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.18rem', fontWeight: 600 }}>
          {promotion.name}
        </h3>
        <p style={{ margin: 0, fontSize: '1.32rem', fontWeight: 600 }}>
          {discountInWords(promotion)}{' '}
          <Link href={scope.href} style={{ fontWeight: 400, fontSize: '1rem' }}>
            {scope.label}
          </Link>
        </p>
      </div>

      {promotion.description && (
        <p className="muted" style={{ margin: 0, fontSize: '0.94rem' }}>
          {promotion.description}
        </p>
      )}

      <div
        style={{
          padding: 'var(--s3) var(--s4)',
          borderRadius: 'var(--r)',
          background: automatic ? 'var(--good-soft)' : 'var(--surface-2)',
          border: automatic
            ? '1px solid color-mix(in srgb, var(--good) 30%, transparent)'
            : '1px dashed var(--line-strong)',
        }}
      >
        {automatic ? (
          <span style={{ fontSize: '0.92rem', color: 'var(--good)' }}>
            Applied automatically — no code needed
          </span>
        ) : (
          <>
            <span className="price-from" style={{ display: 'block', marginBottom: '2px' }}>
              Use code at checkout
            </span>
            <span
              className="mono"
              style={{
                fontSize: '1.15rem',
                fontWeight: 500,
                letterSpacing: '0.14em',
                color: 'var(--ink)',
              }}
            >
              {promotion.code}
            </span>
          </>
        )}
      </div>

      <div className="stack stack-sm">
        <span className="eyebrow" style={{ margin: 0 }}>
          Conditions
        </span>
        <ul
          className="muted"
          style={{ margin: 0, paddingLeft: '1.1em', fontSize: '0.9rem' }}
        >
          {conditions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="card-foot" style={{ marginTop: 'auto' }}>
        <span className="muted" style={{ fontSize: '0.84rem' }}>
          {promotion.stackable
            ? 'Can be combined with other offers'
            : 'One offer per booking'}
        </span>
        <Link className="btn btn-secondary btn-sm" href={scope.href}>
          See the trips
        </Link>
      </div>
    </article>
  );
}
