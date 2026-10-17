import Link from 'next/link';
import Stars from './Stars';
import { formatMoney } from '@/lib/money';
import { bestAutomaticPromotion } from '@/lib/pricing';
import { tourThemeIds } from '@/lib/queries';
import type { Promotion, TourCardData } from '@/lib/types';

function formatDate(iso: string | null): string {
  if (!iso) return 'Dates on request';
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function TourCard({
  tour,
  promotions,
}: {
  tour: TourCardData;
  promotions?: Promotion[];
}) {
  const promo = bestAutomaticPromotion(
    {
      tour: {
        id: tour.id,
        destination_id: tour.destination_id,
        base_price_cents: tour.min_price_cents,
      },
      departure: tour.next_departure
        ? {
            id: 0,
            price_cents: tour.min_price_cents,
            start_date: tour.next_departure,
          }
        : null,
      themeIds: tourThemeIds(tour.id),
    },
    promotions,
  );

  const hasDiscount = promo.promotion !== null && promo.discountCents > 0;

  return (
    <article className="card card-link" style={{ display: 'flex' }}>
      <Link
        href={`/tours/${tour.slug}`}
        style={{ display: 'contents', color: 'inherit' }}
      >
        <div className="card-media">
          {hasDiscount && (
            <span className="badge badge-promo badge-float">
              {promo.promotion?.badge_text ??
                (promo.promotion?.type === 'percentage'
                  ? `-${promo.promotion.value}%`
                  : `Save ${formatMoney(promo.discountCents)}`)}
            </span>
          )}
          <img
            src={tour.hero_image}
            alt={`${tour.title} — ${tour.destination_name}`}
            loading="lazy"
            decoding="async"
            width={600}
            height={400}
          />
        </div>

        <div className="card-body">
          <span className="eyebrow" style={{ margin: 0 }}>
            {tour.destination_name} · {tour.country}
          </span>
          <h3 className="card-title">{tour.title}</h3>

          <div className="cluster cluster-sm" style={{ fontSize: '0.86rem' }}>
            <span className="muted">{tour.duration_days} days</span>
            <span className="muted" aria-hidden="true">·</span>
            <span className="muted" style={{ textTransform: 'capitalize' }}>
              {tour.difficulty}
            </span>
            <span className="muted" aria-hidden="true">·</span>
            <span className="muted">Max {tour.group_size_max}</span>
          </div>

          <Stars rating={tour.avg_rating} count={tour.review_count} />

          <div className="card-foot">
            <div>
              <span className="price-from">From</span>
              <div className="price">
                <span className="price-now">
                  {formatMoney(hasDiscount ? promo.nowCents : tour.min_price_cents)}
                </span>
                {hasDiscount && (
                  <span className="price-was">
                    {formatMoney(promo.wasCents)}
                  </span>
                )}
              </div>
              <span className="price-unit">per person</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="price-from">Next</span>
              <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>
                {formatDate(tour.next_departure)}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
