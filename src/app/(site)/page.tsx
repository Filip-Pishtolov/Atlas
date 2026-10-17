import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import DestinationCard from '@/components/DestinationCard';
import Hero from '@/components/Hero';
import Stars from '@/components/Stars';
import TourCard from '@/components/TourCard';
import { get, query } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import {
  featuredTours,
  listBlogPosts,
  listDestinations,
  listTours,
  liveAutomaticPromotions,
  livePromotions,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    absolute: 'Atlas — Small-group journeys across the Mediterranean and Balkans',
  },
  description:
    'Atlas runs small-group journeys across the Mediterranean, the Balkans and North Africa. Sixteen travellers maximum, resident guides, fixed departures and the full price shown before you book.',
};

const clamp3: CSSProperties = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 3,
  overflow: 'hidden',
};

function formatDay(value: string | null): string {
  if (!value) return '';
  const raw = value.trim();
  const iso = raw.includes('T')
    ? raw
    : raw.includes(' ')
      ? `${raw.replace(' ', 'T')}Z`
      : `${raw}T00:00:00Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

interface DestinationStat {
  destination_id: number;
  tour_count: number;
  from_cents: number | null;
}

interface HomeReview {
  id: number;
  author_name: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  tour_title: string;
  tour_slug: string;
  destination_name: string;
}

export default function HomePage() {
  const destinations = listDestinations();
  const featuredDestinations = listDestinations(true);
  const strip = (featuredDestinations.length ? featuredDestinations : destinations).slice(0, 4);

  const stats = query<DestinationStat>(
    `SELECT t.destination_id,
            COUNT(*)                  AS tour_count,
            MIN(t.base_price_cents)   AS from_cents
       FROM tours t
      WHERE t.status = 'published'
      GROUP BY t.destination_id`,
  );
  const statFor = new Map(stats.map((s) => [s.destination_id, s]));

  const promotions = liveAutomaticPromotions();
  const featured = featuredTours(6);
  const tours = featured.length ? featured : listTours({ limit: 6 });
  const tourTotal = stats.reduce((sum, s) => sum + s.tour_count, 0);

  const ratings = get<{ review_total: number; avg_rating: number | null }>(
    `SELECT COUNT(*) AS review_total, ROUND(AVG(rating), 1) AS avg_rating
       FROM reviews WHERE status = 'approved'`,
  );
  const reviewTotal = ratings?.review_total ?? 0;
  const avgRating = ratings?.avg_rating ?? null;

  const groupCap = get<{ cap: number | null }>(
    `SELECT MAX(group_size_max) AS cap FROM tours WHERE status = 'published'`,
  )?.cap;

  const offers = livePromotions().slice(0, 3);

  const reviews = query<HomeReview>(
    `SELECT r.id, r.author_name, r.rating, r.title, r.body, r.created_at,
            t.title AS tour_title, t.slug AS tour_slug,
            d.name  AS destination_name
       FROM reviews r
       JOIN tours t        ON t.id = r.tour_id
       JOIN destinations d ON d.id = t.destination_id
      WHERE r.status = 'approved'
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 3`,
  );

  const posts = listBlogPosts(3);

  const trust = [
    {
      label: 'Group size',
      value: `${groupCap ?? 16} travellers, maximum`,
      note: 'Usually twelve. Never a coach, never two groups merged at the airport.',
    },
    {
      label: 'Guiding',
      value: 'Resident guides, on salary',
      note: 'Paid by us, not by the shops they take you to. No handover at the border.',
    },
    {
      label: 'Licensed operator',
      value: 'ATL-2019-0442',
      note: 'Bonded under EU package travel rules. Your deposit is protected.',
    },
    {
      label: 'Traveller rating',
      value:
        reviewTotal > 0 && avgRating !== null
          ? `${avgRating.toFixed(1)} average from ${reviewTotal} reviews`
          : 'Reviews from verified travellers',
      note:
        reviewTotal > 0
          ? 'Written after travelling, published unedited — the poor ones too.'
          : 'Collected the week you get home and published unedited.',
    },
  ];

  const differentiators = [
    {
      n: '01',
      title: 'Sixteen seats, and we mean it',
      body: 'Every departure is capped, and each date on the site shows how many seats are left. When a date fills, it closes. We do not add a second minibus or quietly merge two groups to make the numbers work.',
    },
    {
      n: '02',
      title: 'The price on the page is the price you pay',
      body: 'Guiding, listed transfers, entrance fees and local taxes are inside the figure you see. Single supplements and optional excursions are listed before you book, never invoiced afterwards.',
    },
    {
      n: '03',
      title: 'Written by the people who lead it',
      body: 'Every itinerary is drafted by the guide who runs it, day by day, with the accommodation and the meals named. If a day is a long drive, the page says it is a long drive.',
    },
  ];

  return (
    <>
      <Hero destinations={destinations} />

      <section
        className="section-tight"
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div className="container">
          <ul
            className="grid grid-4"
            style={{ listStyle: 'none', margin: 0, padding: 0 }}
          >
            {trust.map((t) => (
              <li
                key={t.label}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s1)' }}
              >
                <span className="eyebrow" style={{ margin: 0 }}>
                  {t.label}
                </span>
                <strong style={{ fontSize: '1.02rem', fontWeight: 600 }}>
                  {t.value}
                </strong>
                <span className="muted" style={{ fontSize: '0.86rem' }}>
                  {t.note}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head section-head-line">
            <div>
              <span className="eyebrow eyebrow-accent">Featured departures</span>
              <h2>Journeys we would take ourselves</h2>
            </div>
            <Link className="btn btn-secondary" href="/tours">
              {tourTotal > 0 ? `See all ${tourTotal} tours` : 'See all tours'}
            </Link>
          </div>

          {tours.length > 0 ? (
            <div className="grid grid-3">
              {tours.map((tour) => (
                <TourCard key={tour.id} tour={tour} promotions={promotions} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>
                Next season&rsquo;s departures are still being costed. Tell us
                where you would like to go and we will write to you the day the
                dates open.
              </p>
              <Link className="btn btn-primary" href="/contact">
                Register your interest
              </Link>
            </div>
          )}
        </div>
      </section>

      <section
        className="section"
        style={{
          background: 'var(--surface)',
          borderBlock: '1px solid var(--line)',
        }}
      >
        <div className="container">
          <div className="section-head section-head-line">
            <div>
              <span className="eyebrow eyebrow-accent">Where we work</span>
              <h2>Four coastlines, one afternoon of planning</h2>
            </div>
            <Link className="btn btn-secondary" href="/destinations">
              All destinations
            </Link>
          </div>

          {strip.length > 0 ? (
            <div className="grid grid-4">
              {strip.map((d) => {
                const s = statFor.get(d.id);
                return (
                  <DestinationCard
                    key={d.id}
                    destination={d}
                    tourCount={s?.tour_count ?? 0}
                    fromCents={s?.from_cents ?? null}
                  />
                );
              })}
            </div>
          ) : (
            <p className="empty-state">
              Our destination guides are being rewritten for the coming season.
            </p>
          )}
        </div>
      </section>

      {offers.length > 0 && (
        <section
          className="section"
          style={{
            background: 'var(--accent-soft)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow eyebrow-accent">Running right now</span>
                <h2>Live offers</h2>
              </div>
              <Link className="btn btn-secondary" href="/deals">
                All deals and terms
              </Link>
            </div>

            <div className="grid grid-3">
              {offers.map((promo) => (
                <article key={promo.id} className="card card-pad stack">
                  <span
                    className="badge badge-promo"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {promo.badge_text ??
                      (promo.type === 'percentage'
                        ? `${promo.value}% off`
                        : `Save ${formatMoney(promo.value)}`)}
                  </span>
                  <h3 style={{ fontSize: '1.3rem' }}>{promo.name}</h3>
                  <p className="muted" style={{ margin: 0, fontSize: '0.94rem' }}>
                    {promo.description ??
                      'Applied to every eligible departure at checkout — no small print beyond the dates below.'}
                  </p>
                  <p className="mono muted" style={{ margin: 0 }}>
                    {promo.code
                      ? `Code ${promo.code}`
                      : 'Applied automatically'}{' '}
                    · until {formatDay(promo.ends_at)}
                  </p>
                  <Link
                    className="btn btn-secondary btn-sm"
                    href="/deals"
                    style={{ alignSelf: 'flex-start', marginTop: 'auto' }}
                  >
                    Read the conditions
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="container">
          <div className="section-head section-head-line">
            <div>
              <span className="eyebrow eyebrow-accent">Why Atlas</span>
              <h2>Three promises we can actually keep</h2>
            </div>
          </div>

          <div className="grid grid-3">
            {differentiators.map((d) => (
              <div key={d.n} className="stack">
                <span
                  className="mono"
                  style={{
                    fontSize: '1.6rem',
                    color: 'var(--accent)',
                    lineHeight: 1,
                  }}
                >
                  {d.n}
                </span>
                <h3 style={{ fontSize: '1.35rem' }}>{d.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {d.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="section"
        style={{
          background: 'var(--surface-2)',
          borderBlock: '1px solid var(--line)',
        }}
      >
        <div className="container">
          <div className="section-head section-head-line">
            <div>
              <span className="eyebrow eyebrow-accent">From the group</span>
              <h2>
                {reviewTotal > 0 && avgRating !== null
                  ? `${avgRating.toFixed(1)} out of 5, across ${reviewTotal} reviews`
                  : 'What travellers tell us'}
              </h2>
            </div>
          </div>

          {reviews.length > 0 ? (
            <div className="grid grid-3">
              {reviews.map((r) => (
                <article key={r.id} className="card card-pad stack">
                  <Stars rating={r.rating} />
                  <h3 style={{ fontSize: '1.15rem' }}>{r.title}</h3>
                  <p className="muted" style={{ ...clamp3, margin: 0, fontSize: '0.94rem' }}>
                    {r.body}
                  </p>
                  <div style={{ marginTop: 'auto', paddingTop: 'var(--s3)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                      {r.author_name}
                    </div>
                    <Link
                      href={`/tours/${r.tour_slug}`}
                      style={{ fontSize: '0.88rem' }}
                    >
                      {r.tour_title}
                    </Link>
                    <div className="muted" style={{ fontSize: '0.82rem' }}>
                      {r.destination_name} · reviewed {formatDay(r.created_at)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">
              No reviews have been published yet. Every one we receive goes up
              unedited once the traveller is home.
            </p>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head section-head-line">
            <div>
              <span className="eyebrow eyebrow-accent">The Journal</span>
              <h2>Notes from the road</h2>
            </div>
            <Link className="btn btn-secondary" href="/blog">
              Read the Journal
            </Link>
          </div>

          {posts.length > 0 ? (
            <div className="grid grid-3">
              {posts.map((post) => (
                <article key={post.id} className="card card-link">
                  <Link
                    href={`/blog/${post.slug}`}
                    style={{ display: 'contents', color: 'inherit' }}
                  >
                    <div className="card-media">
                      <img
                        src={
                          post.hero_image ||
                          `https://picsum.photos/seed/${post.slug}/1200/800`
                        }
                        alt={post.title}
                        loading="lazy"
                        decoding="async"
                        width={600}
                        height={400}
                      />
                    </div>
                    <div className="card-body">
                      <span className="eyebrow" style={{ margin: 0 }}>
                        {formatDay(post.published_at ?? post.created_at)}
                      </span>
                      <h3 className="card-title">{post.title}</h3>
                      <p
                        className="muted"
                        style={{ ...clamp3, margin: 0, fontSize: '0.9rem' }}
                      >
                        {post.excerpt}
                      </p>
                      <div className="card-foot">
                        <span className="muted" style={{ fontSize: '0.84rem' }}>
                          {post.author_name}
                        </span>
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">
              The first dispatches of the season are still being written.
            </p>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div
            className="card card-pad map-grid"
            style={{ padding: 'var(--s8) var(--s5)', textAlign: 'center' }}
          >
            <span className="eyebrow eyebrow-accent">Still deciding</span>
            <h2 style={{ maxWidth: '20ch', marginInline: 'auto' }}>
              Tell us roughly what you want
            </h2>
            <p
              className="lead"
              style={{
                marginInline: 'auto',
                marginTop: 'var(--s4)',
                marginBottom: 'var(--s6)',
              }}
            >
              Dates that half work, a group that will not agree, a country you
              cannot pronounce yet — send it over. A real person in Skopje reads
              every enquiry and answers within the working day, even when the
              answer is that we are not the right agency for it.
            </p>
            <div className="cluster" style={{ justifyContent: 'center' }}>
              <Link className="btn btn-primary btn-lg" href="/contact">
                Ask us a question
              </Link>
              <Link className="btn btn-secondary btn-lg" href="/tours">
                Browse the catalogue
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
