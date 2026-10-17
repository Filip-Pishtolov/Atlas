import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import Breadcrumbs from '@/components/Breadcrumbs';
import DepartureTable from '@/components/DepartureTable';
import Gallery from '@/components/Gallery';
import ItineraryList from '@/components/ItineraryList';
import ReviewForm from '@/components/ReviewForm';
import Stars from '@/components/Stars';
import TourCard from '@/components/TourCard';

import { getCurrentUser } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { depositFor, priceFor } from '@/lib/pricing';
import {
  getTourBySlug,
  listTours,
  liveAutomaticPromotions,
  tourFacts,
  tourImages,
  tourItinerary,
  tourReviews,
  tourThemes,
  upcomingDepartures,
} from '@/lib/queries';
import type { Departure } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = { slug: string };
type Search = { [key: string]: string | string[] | undefined };

const MAX_TRAVELLER_OPTIONS = 12;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function formatDay(iso: string | null): string {
  if (!iso) return 'Dates on request';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatShortDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function seatsRemaining(departure: Departure): number {
  return Math.max(0, departure.seats_total - departure.seats_booked);
}

function isBookable(departure: Departure): boolean {
  return departure.status !== 'sold_out' && seatsRemaining(departure) > 0;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tour = getTourBySlug(slug);

  if (!tour || tour.status !== 'published') {
    return { title: 'Tour not found' };
  }

  return {
    title: `${tour.title} — ${tour.duration_days} days in ${tour.destination_name}`,
    description: tour.summary,
    alternates: { canonical: `/tours/${tour.slug}` },
    openGraph: {
      type: 'website',
      title: `${tour.title} | Atlas`,
      description: tour.summary,
      images: [{ url: tour.hero_image, alt: tour.title }],
    },
  };
}

export default async function TourDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const tour = getTourBySlug(slug);
  if (!tour || tour.status !== 'published') notFound();

  const images = tourImages(tour.id);
  const itinerary = tourItinerary(tour.id);
  const facts = tourFacts(tour.id);
  const themes = tourThemes(tour.id);
  const departures = upcomingDepartures(tour.id, 12);
  const reviews = tourReviews(tour.id, 12);
  const user = await getCurrentUser();

  const themeIds = themes.map((t) => t.id);

  const promotions = liveAutomaticPromotions();

  const included = facts.filter((f) => f.kind === 'included');
  const excluded = facts.filter((f) => f.kind === 'excluded');

  const related = listTours({
    destination: tour.destination_slug,
    sort: 'popular',
    limit: 4,
  })
    .filter((t) => t.id !== tour.id)
    .slice(0, 3);

  const requestedDepartureId = Number(one(sp.departure));
  const selected =
    departures.find((d) => d.id === requestedDepartureId) ??
    departures.find(isBookable) ??
    departures[0] ??
    null;

  const maxTravellers = Math.min(
    Math.max(tour.group_size_max, 1),
    MAX_TRAVELLER_OPTIONS,
  );
  const requestedTravellers = Number(one(sp.travellers) ?? '2');
  const travellers = Math.min(
    Math.max(1, Number.isFinite(requestedTravellers) ? Math.floor(requestedTravellers) : 2),
    maxTravellers,
  );

  const breakdown = priceFor(
    {
      tour: {
        id: tour.id,
        destination_id: tour.destination_id,
        base_price_cents: tour.base_price_cents,
      },
      departure: selected
        ? {
            id: selected.id,
            price_cents: selected.price_cents,
            start_date: selected.start_date,
          }
        : null,
      travellers,
      themeIds,
      code: null,
    },
    promotions,
  );

  const discounted = breakdown.promotion !== null && breakdown.discountCents > 0;
  const deposit = depositFor(breakdown.totalCents);
  const seatsLeft = selected ? seatsRemaining(selected) : 0;
  const selectedBookable = selected ? isBookable(selected) : false;

  const galleryImages = [
    { url: tour.hero_image, alt: `${tour.title} — ${tour.destination_name}` },
    ...images
      .filter((image) => image.url !== tour.hero_image)
      .map((image) => ({ url: image.url, alt: image.alt })),
  ];

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: tour.title,
    description: tour.summary,
    sku: tour.slug,
    image: galleryImages.slice(0, 6).map((image) => image.url),
    brand: { '@type': 'Brand', name: 'Atlas' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: (breakdown.perPersonCents / 100).toFixed(2),
      availability: departures.some(isBookable)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/SoldOut',
      url: `https://atlas.travel/tours/${tour.slug}`,
      ...(selected ? { validThrough: selected.start_date } : {}),
    },
  };

  if (tour.review_count > 0 && tour.avg_rating !== null) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: tour.avg_rating,
      reviewCount: tour.review_count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return (
    <div className="container section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <Breadcrumbs
        items={[
          { href: '/', label: 'Home' },
          { href: '/tours', label: 'Tours' },
          {
            href: `/destinations/${tour.destination_slug}`,
            label: tour.destination_name,
          },
          { label: tour.title },
        ]}
      />

      <div className="stack" style={{ marginBottom: 'var(--s6)' }}>
        <span className="eyebrow eyebrow-accent">
          {tour.destination_name} · {tour.country}
        </span>
        <h1 style={{ maxWidth: '20ch' }}>{tour.title}</h1>
        <p className="lead" style={{ maxWidth: '62ch' }}>
          {tour.summary}
        </p>
        <div className="cluster">
          <Stars rating={tour.avg_rating} count={tour.review_count} />
          {tour.review_count > 0 && (
            <a href="#reviews" className="muted" style={{ fontSize: '0.86rem' }}>
              Read {tour.review_count}{' '}
              {tour.review_count === 1 ? 'review' : 'reviews'}
            </a>
          )}
        </div>

        <dl className="meta-list">
          <div className="meta-item">
            <dt>Duration</dt>
            <dd>
              {tour.duration_days} days / {Math.max(tour.duration_days - 1, 0)}{' '}
              nights
            </dd>
          </div>
          <div className="meta-item">
            <dt>Pace</dt>
            <dd style={{ textTransform: 'capitalize' }}>{tour.difficulty}</dd>
          </div>
          <div className="meta-item">
            <dt>Group size</dt>
            <dd>
              {tour.group_size_min}–{tour.group_size_max} travellers
            </dd>
          </div>
          <div className="meta-item">
            <dt>Next departure</dt>
            <dd>{formatDay(tour.next_departure)}</dd>
          </div>
          <div className="meta-item">
            <dt>Trip starts</dt>
            <dd>{tour.meeting_point ?? 'Confirmed 30 days before departure'}</dd>
          </div>
        </dl>

        {themes.length > 0 && (
          <div className="tag-list">
            {themes.map((theme) => (
              <Link
                key={theme.id}
                className="chip"
                href={`/tours?theme=${theme.slug}`}
              >
                {theme.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 'var(--s7)' }}>
        <Gallery images={galleryImages} caption={tour.destination_name} />
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 'var(--s6)',
        }}
      >
        <div
          className="stack stack-lg"
          style={{ flex: '999 1 560px', minWidth: 0 }}
        >
          <section aria-labelledby="overview-heading">
            <div className="section-head section-head-line">
              <h2 id="overview-heading">About this trip</h2>
            </div>
            <div className="prose">
              {paragraphs(tour.description).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>

          <section aria-labelledby="itinerary-heading" id="itinerary">
            <div className="section-head section-head-line">
              <h2 id="itinerary-heading">Day by day</h2>
              <span className="hint">Tap a day to open it</span>
            </div>
            <ItineraryList days={itinerary} />
          </section>

          <section aria-labelledby="included-heading">
            <div className="section-head section-head-line">
              <h2 id="included-heading">What your money covers</h2>
            </div>

            {included.length === 0 && excluded.length === 0 ? (
              <div className="empty-state">
                <p>
                  The inclusions list for this departure is being confirmed with
                  our operations team. Ask us and we will send the current
                  version the same day.
                </p>
              </div>
            ) : (
              <div className="grid grid-2">
                <div className="card card-pad stack stack-sm">
                  <h3 style={{ marginBottom: 'var(--s2)' }}>Included</h3>
                  {included.length === 0 ? (
                    <p className="muted">Confirmed on request.</p>
                  ) : (
                    <ul
                      className="stack stack-sm"
                      style={{ listStyle: 'none', padding: 0, margin: 0 }}
                    >
                      {included.map((fact) => (
                        <li
                          key={fact.id}
                          style={{ display: 'flex', gap: 'var(--s3)' }}
                        >
                          <span
                            aria-hidden="true"
                            style={{ color: 'var(--good)', fontWeight: 600 }}
                          >
                            ✓
                          </span>
                          <span>{fact.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="card card-pad stack stack-sm">
                  <h3 style={{ marginBottom: 'var(--s2)' }}>Not included</h3>
                  {excluded.length === 0 ? (
                    <p className="muted">
                      Nothing beyond your flights and personal spending.
                    </p>
                  ) : (
                    <ul
                      className="stack stack-sm"
                      style={{ listStyle: 'none', padding: 0, margin: 0 }}
                    >
                      {excluded.map((fact) => (
                        <li
                          key={fact.id}
                          style={{ display: 'flex', gap: 'var(--s3)' }}
                        >
                          <span
                            aria-hidden="true"
                            style={{ color: 'var(--danger)', fontWeight: 600 }}
                          >
                            ✕
                          </span>
                          <span>{fact.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="departures-heading" id="departures">
            <div className="section-head section-head-line">
              <h2 id="departures-heading">Dates and prices</h2>
              <span className="hint">
                Prices are per person, twin share, with any live offer applied
              </span>
            </div>
            <DepartureTable
              tour={tour}
              departures={departures}
              themeIds={themeIds}
              promotions={promotions}
            />
          </section>

          <section aria-labelledby="reviews-heading" id="reviews">
            <div className="section-head section-head-line">
              <h2 id="reviews-heading">Traveller reviews</h2>
              <Stars rating={tour.avg_rating} count={tour.review_count} />
            </div>

            <div className="stack stack-lg">
              {reviews.length === 0 ? (
                <div className="empty-state">
                  <p>
                    No reviews for this trip yet. If you have travelled with us
                    on it, yours would be the first — and the most useful one on
                    the page.
                  </p>
                </div>
              ) : (
                <div className="stack">
                  {reviews.map((review) => (
                    <article key={review.id} className="card card-pad stack stack-sm">
                      <div className="between">
                        <Stars rating={review.rating} showValue={false} />
                        <span className="muted" style={{ fontSize: '0.84rem' }}>
                          {formatShortDay(review.created_at.slice(0, 10))}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.02rem', margin: 0 }}>
                        {review.title}
                      </h3>
                      <p style={{ margin: 0 }}>{review.body}</p>
                      <p className="muted" style={{ margin: 0, fontSize: '0.86rem' }}>
                        — {review.author_name}
                      </p>
                    </article>
                  ))}
                </div>
              )}

              <ReviewForm
                tourId={tour.id}
                tourTitle={tour.title}
                defaultAuthorName={user?.name}
              />
            </div>
          </section>
        </div>

        <aside
          className="card card-pad stack"
          aria-label="Book this trip"
          style={{
            flex: '1 1 320px',
            position: 'sticky',
            top: 'calc(var(--header-h) + var(--s4))',
          }}
        >
          <div className="stack stack-sm">
            <span className="eyebrow" style={{ margin: 0 }}>
              {selected
                ? `Departing ${formatShortDay(selected.start_date)}`
                : 'From'}
            </span>
            <div className="price price-lg">
              <span className="price-now">
                {formatMoney(breakdown.perPersonCents)}
              </span>
              {discounted && (
                <span className="price-was">
                  {formatMoney(breakdown.basePriceCents)}
                </span>
              )}
            </div>
            <span className="price-unit">per person</span>

            {discounted && breakdown.promotion && (
              <div className="stack stack-sm">
                <span className="badge badge-promo">
                  {breakdown.promotion.badge_text ??
                    `Save ${formatMoney(breakdown.discountCents)}`}
                </span>
                <span className="hint">
                  {breakdown.promotion.description ?? breakdown.promotion.name} —
                  applied automatically, no code needed.
                </span>
              </div>
            )}
          </div>

          <hr className="divider" style={{ margin: 0 }} />

          <form
            className="stack"
            method="get"
            action={`/tours/${tour.slug}`}
            style={{ gap: 'var(--s3)' }}
          >
            <div className="field">
              <label className="label" htmlFor="travellers">
                Travellers
              </label>
              <select
                id="travellers"
                name="travellers"
                className="select"
                defaultValue={String(travellers)}
              >
                {Array.from({ length: maxTravellers }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'traveller' : 'travellers'}
                  </option>
                ))}
              </select>
            </div>

            {departures.length > 0 && (
              <div className="field">
                <label className="label" htmlFor="departure">
                  Departure date
                </label>
                <select
                  id="departure"
                  name="departure"
                  className="select"
                  defaultValue={selected ? String(selected.id) : ''}
                >
                  {departures.map((departure) => (
                    <option
                      key={departure.id}
                      value={departure.id}
                      disabled={!isBookable(departure)}
                    >
                      {formatShortDay(departure.start_date)} ·{' '}
                      {formatMoney(departure.price_cents)}
                      {isBookable(departure) ? '' : ' · sold out'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button type="submit" className="btn btn-secondary btn-sm btn-block">
              Update quote
            </button>
          </form>

          <div className="stack stack-sm">
            <div className="between">
              <span className="muted">
                {formatMoney(breakdown.basePriceCents)} × {breakdown.travellers}
              </span>
              <span className="tabular">
                {formatMoney(breakdown.baseTotalCents)}
              </span>
            </div>

            {discounted && (
              <div className="between">
                <span style={{ color: 'var(--good)' }}>
                  {breakdown.promotion?.name}
                </span>
                <span className="tabular" style={{ color: 'var(--good)' }}>
                  −{formatMoney(breakdown.discountCents)}
                </span>
              </div>
            )}

            <hr className="divider" style={{ margin: 0 }} />

            <div className="between">
              <strong>Trip total</strong>
              <strong className="tabular">
                {formatMoney(breakdown.totalCents)}
              </strong>
            </div>
            <div className="between">
              <span className="muted">Deposit to confirm</span>
              <span className="tabular">{formatMoney(deposit)}</span>
            </div>
            <span className="hint">
              20% deposit today, balance due 60 days before departure.
            </span>
          </div>

          {selected && selectedBookable && seatsLeft < 4 && (
            <div className="alert alert-warn">
              Only {seatsLeft} {seatsLeft === 1 ? 'place' : 'places'} left on{' '}
              {formatShortDay(selected.start_date)}.
              {travellers > seatsLeft
                ? ' That is fewer than the party size you picked — talk to us and we will look at the next date.'
                : ''}
            </div>
          )}

          <div className="stack stack-sm">
            {selected && selectedBookable ? (
              <Link
                className="btn btn-primary btn-block"
                href={`/book/${selected.id}?travellers=${travellers}`}
              >
                Book this trip
              </Link>
            ) : departures.length > 0 ? (
              <a className="btn btn-primary btn-block" href="#departures">
                Choose another date
              </a>
            ) : (
              <Link
                className="btn btn-primary btn-block"
                href={`/contact?tour=${tour.slug}`}
              >
                Request dates
              </Link>
            )}

            <Link
              className="btn btn-secondary btn-block"
              href={`/contact?tour=${tour.slug}`}
            >
              Ask a question
            </Link>
            <span className="hint">
              Not sure yet? Ask us anything — a real person answers, usually
              within a few hours.
            </span>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" style={{ marginTop: 'var(--s8)' }}>
          <div className="section-head section-head-line">
            <h2 id="related-heading">More trips in {tour.destination_name}</h2>
            <Link
              className="btn btn-ghost btn-sm"
              href={`/tours?destination=${tour.destination_slug}`}
            >
              See all
            </Link>
          </div>
          <div className="grid grid-3">
            {related.map((other) => (
              <TourCard key={other.id} tour={other} promotions={promotions} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
