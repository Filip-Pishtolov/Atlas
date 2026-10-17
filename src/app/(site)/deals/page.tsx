import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import TourCard from '@/components/TourCard';
import PromotionCard, { formatDateLabel } from '@/components/PromotionCard';
import { query } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { bestAutomaticPromotion } from '@/lib/pricing';
import {
  listTours,
  liveAutomaticPromotions,
  livePromotions,
  tourThemeIds,
} from '@/lib/queries';
import type { Promotion, TourCardData } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Deals & offers',
  description:
    'Every Atlas offer currently running, the trips each one applies to, and the departures whose price has already come down. Base prices are never edited — discounts are rules that expire by themselves.',
};

const LAST_MINUTE_WINDOW_DAYS = 45;

interface LastMinuteRow {
  departure_id: number;
  tour_id: number;
  start_date: string;
  end_date: string;
  price_cents: number;
  seats_total: number;
  seats_booked: number;
  departure_status: string;
  tour_slug: string;
  tour_title: string;
  duration_days: number;
  destination_id: number;
  base_price_cents: number;
  destination_name: string;
  country: string;
}

function shortDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function DealsPage() {
  const allPromotions: Promotion[] = livePromotions();
  const autoPromotions: Promotion[] = liveAutomaticPromotions();
  const codedCount = allPromotions.filter((p) => p.code).length;

  const discountedTours: { tour: TourCardData; discountCents: number }[] = listTours({})
    .map((tour) => {
      const result = bestAutomaticPromotion(
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
        autoPromotions,
      );
      return { tour, discountCents: result.discountCents };
    })
    .filter((row) => row.discountCents > 0)
    .sort((a, b) => b.discountCents - a.discountCents);

  const lastMinute = query<LastMinuteRow>(
    `SELECT dep.id            AS departure_id,
            dep.tour_id       AS tour_id,
            dep.start_date    AS start_date,
            dep.end_date      AS end_date,
            dep.price_cents   AS price_cents,
            dep.seats_total   AS seats_total,
            dep.seats_booked  AS seats_booked,
            dep.status        AS departure_status,
            t.slug            AS tour_slug,
            t.title           AS tour_title,
            t.duration_days   AS duration_days,
            t.destination_id  AS destination_id,
            t.base_price_cents AS base_price_cents,
            d.name            AS destination_name,
            d.country         AS country
       FROM departures dep
       JOIN tours t        ON t.id = dep.tour_id
       JOIN destinations d ON d.id = t.destination_id
      WHERE t.status = 'published'
        AND dep.status IN ('open','guaranteed')
        AND dep.start_date >= date('now')
        AND dep.start_date <= date('now', ?)
        AND dep.seats_booked < dep.seats_total
      ORDER BY dep.start_date`,
    `+${LAST_MINUTE_WINDOW_DAYS} day`,
  );

  const lastMinutePriced = lastMinute.map((row) => {
    const result = bestAutomaticPromotion(
      {
        tour: {
          id: row.tour_id,
          destination_id: row.destination_id,
          base_price_cents: row.base_price_cents,
        },
        departure: {
          id: row.departure_id,
          price_cents: row.price_cents,
          start_date: row.start_date,
        },
        themeIds: tourThemeIds(row.tour_id),
      },
      autoPromotions,
    );
    return { row, result };
  });

  const lows = query<{ departure_id: number; lowest_cents: number }>(
    `SELECT departure_id, MIN(price_cents) AS lowest_cents
       FROM price_history
      WHERE departure_id IS NOT NULL
        AND changed_at >= datetime('now','-30 day')
      GROUP BY departure_id`,
  );
  const lowByDeparture = new Map(lows.map((r) => [r.departure_id, r.lowest_cents]));
  const showReferenceColumn = lastMinutePriced.some(({ row }) =>
    lowByDeparture.has(row.departure_id),
  );

  const biggestSaving = Math.max(
    0,
    ...discountedTours.map((r) => r.discountCents),
    ...lastMinutePriced.map(({ result }) => result.discountCents),
  );
  const soonestEnd = allPromotions
    .map((p) => p.ends_at)
    .sort()
    .at(0);

  return (
    <>
      <section className="section-tight map-grid" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Deals & offers' }]} />
          <span className="eyebrow eyebrow-accent">Current offers</span>
          <h1>Every discount we are running, and exactly how it works</h1>
          <p className="lead" style={{ marginTop: 'var(--s4)' }}>
            Atlas does not edit prices down and call it a sale. An offer is a rule
            sitting beside the price — who it applies to, how many people have to
            travel, how far ahead you book — and the site recalculates the total
            every time anyone loads a page. When the rule expires, the original
            price comes back on its own, because it never went anywhere.
          </p>
          <div className="cluster" style={{ marginTop: 'var(--s5)' }}>
            <Link className="btn btn-primary" href="/tours">
              Browse all trips
            </Link>
            <Link className="btn btn-secondary" href="/contact">
              Ask us which offer fits
            </Link>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="grid grid-4">
            <div className="kpi kpi-accent">
              <span className="kpi-label">Offers live now</span>
              <span className="kpi-value">{allPromotions.length}</span>
              <span className="kpi-note">
                {allPromotions.length - codedCount} automatic · {codedCount} need a code
              </span>
            </div>
            <div className="kpi kpi-good">
              <span className="kpi-label">Trips reduced today</span>
              <span className="kpi-value">{discountedTours.length}</span>
              <span className="kpi-note">Price already lowered, nothing to type</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Best single saving</span>
              <span className="kpi-value">
                {biggestSaving > 0 ? formatMoney(biggestSaving) : '—'}
              </span>
              <span className="kpi-note">Per person, on one traveller</span>
            </div>
            <div className="kpi kpi-warn">
              <span className="kpi-label">Next offer to close</span>
              <span className="kpi-value" style={{ fontSize: '1.3rem' }}>
                {soonestEnd ? formatDateLabel(soonestEnd) : '—'}
              </span>
              <span className="kpi-note">Offers end at 23:59 CET on the date shown</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="section-head section-head-line">
            <div>
              <span className="eyebrow">Section A</span>
              <h2>Current offers</h2>
            </div>
            <p className="muted" style={{ margin: 0, maxWidth: '38ch', fontSize: '0.92rem' }}>
              Where several offers could apply to one booking, Atlas applies the
              single one that saves you the most. We never quietly pick the
              cheaper discount.
            </p>
          </div>

          {allPromotions.length === 0 ? (
            <div className="card empty-state">
              <p style={{ marginBottom: 'var(--s4)' }}>
                No offers are running at the moment — the last one has closed and
                the next season&rsquo;s early-booking discount opens in the autumn.
              </p>
              <Link className="btn btn-secondary" href="/tours">
                See our trips at their standard price
              </Link>
            </div>
          ) : (
            <div className="grid grid-3">
              {allPromotions.map((promotion) => (
                <PromotionCard key={promotion.id} promotion={promotion} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="section-head section-head-line">
            <div>
              <span className="eyebrow">Section B</span>
              <h2>Trips that are cheaper right now</h2>
            </div>
            <p className="muted" style={{ margin: 0, maxWidth: '38ch', fontSize: '0.92rem' }}>
              These prices are produced by the same calculation the booking form
              uses. What you see here is what you pay.
            </p>
          </div>

          {discountedTours.length === 0 ? (
            <div className="card empty-state">
              <p style={{ marginBottom: 'var(--s4)' }}>
                Nothing is discounted today. Every trip is at its standard price —
                which, for what it is worth, is the price we would rather sell at.
              </p>
              <Link className="btn btn-secondary" href="/tours">
                Browse the full range
              </Link>
            </div>
          ) : (
            <div className="grid grid-3">
              {discountedTours.map(({ tour }) => (
                <TourCard key={tour.id} tour={tour} promotions={autoPromotions} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="section-head section-head-line">
            <div>
              <span className="eyebrow">Section C</span>
              <h2>Leaving within {LAST_MINUTE_WINDOW_DAYS} days</h2>
            </div>
            <p className="muted" style={{ margin: 0, maxWidth: '38ch', fontSize: '0.92rem' }}>
              Confirmed departures with seats still open. The guide is booked and
              the group is running whether the last places sell or not.
            </p>
          </div>

          {lastMinutePriced.length === 0 ? (
            <div className="card empty-state">
              <p style={{ marginBottom: 'var(--s4)' }}>
                Nothing departs in the next {LAST_MINUTE_WINDOW_DAYS} days with
                seats left. Our groups cap at sixteen, so they do close early.
              </p>
              <Link className="btn btn-secondary" href="/tours?sort=soonest">
                See the next departures
              </Link>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">
                  Departures leaving within {LAST_MINUTE_WINDOW_DAYS} days that
                  still have seats available
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Trip</th>
                    <th scope="col">Departs</th>
                    <th scope="col">Returns</th>
                    <th scope="col" className="num">
                      Seats left
                    </th>
                    <th scope="col">Offer</th>
                    {showReferenceColumn && (
                      <th scope="col" className="num">
                        30-day low
                      </th>
                    )}
                    <th scope="col" className="num">
                      Price pp
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lastMinutePriced.map(({ row, result }) => {
                    const seatsLeft = row.seats_total - row.seats_booked;
                    const discounted = result.discountCents > 0;
                    const reference = lowByDeparture.get(row.departure_id);
                    return (
                      <tr key={row.departure_id}>
                        <td>
                          <Link href={`/tours/${row.tour_slug}`}>{row.tour_title}</Link>
                          <br />
                          <span className="muted" style={{ fontSize: '0.82rem' }}>
                            {row.destination_name}, {row.country} · {row.duration_days} days
                          </span>
                        </td>
                        <td className="mono">{shortDate(row.start_date)}</td>
                        <td className="mono">{shortDate(row.end_date)}</td>
                        <td className="num">
                          {seatsLeft <= 3 ? (
                            <span className="badge badge-warn">{seatsLeft} left</span>
                          ) : (
                            seatsLeft
                          )}
                        </td>
                        <td>
                          {discounted ? (
                            <span className="badge badge-promo">
                              {result.promotion?.badge_text ??
                                `Save ${formatMoney(result.discountCents)}`}
                            </span>
                          ) : (
                            <span className="muted" style={{ fontSize: '0.84rem' }}>
                              Standard price
                            </span>
                          )}
                        </td>
                        {showReferenceColumn && (
                          <td className="num mono">
                            {reference !== undefined ? formatMoney(reference) : '—'}
                          </td>
                        )}
                        <td className="num">
                          <span className="price" style={{ justifyContent: 'flex-end' }}>
                            <span className="price-now" style={{ fontSize: '1.05rem' }}>
                              {formatMoney(discounted ? result.nowCents : row.price_cents)}
                            </span>
                            {discounted && (
                              <span className="price-was">{formatMoney(result.wasCents)}</span>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="card card-pad stack" style={{ maxWidth: '78ch' }}>
            <span className="eyebrow eyebrow-accent">How we price</span>
            <h3>What &ldquo;was&rdquo; means on this page</h3>
            <p className="muted" style={{ margin: 0 }}>
              The struck-through figure is the price Atlas was actually selling
              that departure at — the published price held in the departure
              record, not an inflated number invented to make a discount look
              bigger. Every change to a tour price or a departure price is written
              to a <span className="mono">price_history</span> row with the date
              and the member of staff who made it, so a previous price can be
              proved months later.
            </p>
            <p className="muted" style={{ margin: 0 }}>
              {showReferenceColumn
                ? 'The 30-day low column reads that log directly: it is the lowest price we charged for that departure in the previous thirty days, which is the reference the EU Omnibus Directive expects a price-reduction claim to be measured against.'
                : 'Where a departure has had a price change in the last thirty days, this page also shows the lowest price charged in that window — the reference the EU Omnibus Directive expects a price-reduction claim to be measured against. None of the departures listed above have changed price recently, so there is nothing to disclose.'}
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Offers are never stacked. If two apply, the engine takes the larger
              saving and ignores the other, which is why a code sometimes appears
              to do nothing: an automatic discount was already worth more than the
              code you typed.
            </p>
            <div className="cluster" style={{ marginTop: 'var(--s2)' }}>
              <Link className="btn btn-secondary btn-sm" href="/legal/booking-conditions">
                Booking conditions
              </Link>
              <Link className="btn btn-ghost btn-sm" href="/faq">
                Common questions
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
