import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { bestAutomaticPromotion } from '@/lib/pricing';
import type { Departure, Promotion, Tour } from '@/lib/types';

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function DepartureTable({
  tour,
  departures,
  themeIds,
  promotions,
}: {
  tour: Pick<Tour, 'id' | 'slug' | 'destination_id' | 'base_price_cents'>;
  departures: Departure[];
  themeIds: number[];
  promotions?: Promotion[];
}) {
  if (departures.length === 0) {
    return (
      <div className="card empty-state">
        <p style={{ marginBottom: 'var(--s4)' }}>
          No dates are on sale for this trip at the moment. We usually release
          the next season around eight months ahead — tell us roughly when you
          would like to travel and we will hold a place as soon as dates open.
        </p>
        <Link className="btn btn-secondary" href={`/contact?tour=${tour.slug}`}>
          Ask about future dates
        </Link>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">
          Upcoming departures for this tour, with prices per person and
          remaining availability.
        </caption>
        <thead>
          <tr>
            <th scope="col">Departs</th>
            <th scope="col">Returns</th>
            <th scope="col" className="num">
              Price per person
            </th>
            <th scope="col">Availability</th>
            <th scope="col">
              <span className="sr-only">Book</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {departures.map((departure) => {
            const seatsLeft = Math.max(
              0,
              departure.seats_total - departure.seats_booked,
            );
            const soldOut = departure.status === 'sold_out' || seatsLeft === 0;

            const priced = bestAutomaticPromotion(
              {
                tour: {
                  id: tour.id,
                  destination_id: tour.destination_id,
                  base_price_cents: tour.base_price_cents,
                },
                departure: {
                  id: departure.id,
                  price_cents: departure.price_cents,
                  start_date: departure.start_date,
                },
                themeIds,
              },
              promotions,
            );
            const discounted = priced.promotion !== null && priced.discountCents > 0;

            return (
              <tr
                key={departure.id}
                style={soldOut ? { opacity: 0.55 } : undefined}
              >
                <td>
                  <strong>{formatDay(departure.start_date)}</strong>
                </td>
                <td className="muted">{formatDay(departure.end_date)}</td>
                <td className="num">
                  <span className="price" style={{ justifyContent: 'flex-end' }}>
                    <span className="price-now tabular">
                      {formatMoney(discounted ? priced.nowCents : departure.price_cents)}
                    </span>
                    {discounted && (
                      <span className="price-was tabular">
                        {formatMoney(priced.wasCents)}
                      </span>
                    )}
                  </span>
                  {discounted && priced.promotion && (
                    <div>
                      <span className="badge badge-promo">
                        {priced.promotion.badge_text ??
                          `Save ${formatMoney(priced.discountCents)}`}
                      </span>
                    </div>
                  )}
                </td>
                <td>
                  <div className="stack stack-sm">
                    {soldOut ? (
                      <span className="badge badge-danger">Sold out</span>
                    ) : departure.status === 'guaranteed' ? (
                      <span className="badge badge-good">Guaranteed to run</span>
                    ) : (
                      <span className="badge badge-neutral">Open</span>
                    )}

                    {!soldOut &&
                      (seatsLeft < 4 ? (
                        <span className="badge badge-warn">
                          Only {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: '0.84rem' }}>
                          {seatsLeft} of {departure.seats_total} places free
                        </span>
                      ))}
                  </div>
                </td>
                <td>
                  {soldOut ? (
                    <Link
                      className="btn btn-secondary btn-sm"
                      href={`/contact?tour=${tour.slug}`}
                    >
                      Join waitlist
                    </Link>
                  ) : (
                    <Link
                      className="btn btn-primary btn-sm"
                      href={`/book/${departure.id}`}
                    >
                      Book
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
