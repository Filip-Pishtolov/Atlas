import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import TourCard from '@/components/TourCard';
import { formatMoney } from '@/lib/money';
import {
  getDestinationBySlug,
  listTours,
  liveAutomaticPromotions,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

const layer: CSSProperties = { position: 'absolute', inset: 0 };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const destination = getDestinationBySlug(slug);

  if (!destination) {
    return {
      title: 'Destination not found',
      description:
        'This destination hub is not on the Atlas map. Browse every country we currently work in.',
    };
  }

  const description = destination.summary.slice(0, 155);

  return {
    title: `${destination.name} tours`,
    description,
    openGraph: {
      title: `${destination.name} — small-group tours with Atlas`,
      description,
      type: 'article',
      images: destination.hero_image ? [destination.hero_image] : undefined,
    },
  };
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const destination = getDestinationBySlug(slug);

  if (!destination) notFound();

  const tours = listTours({ destination: slug });
  const promotions = liveAutomaticPromotions();

  const fromCents = tours.length
    ? Math.min(...tours.map((t) => t.min_price_cents))
    : null;

  const paragraphs = destination.description
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const image =
    destination.hero_image ||
    `https://picsum.photos/seed/${destination.slug}/1600/900`;

  return (
    <>
      <section
        aria-labelledby="destination-title"
        style={{
          position: 'relative',
          isolation: 'isolate',
          overflow: 'hidden',
          background: '#051012',
        }}
      >
        <img
          src={image}
          alt={`${destination.name}, ${destination.country}`}
          width={1600}
          height={900}
          decoding="async"
          fetchPriority="high"
          style={{
            ...layer,
            zIndex: -3,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <div
          style={{
            ...layer,
            zIndex: -2,
            backgroundColor: 'rgba(5, 16, 18, 0.38)',
            backgroundImage:
              'linear-gradient(100deg, rgba(5,16,18,0.92) 0%, rgba(5,16,18,0.8) 55%, rgba(5,16,18,0.45) 100%)',
          }}
        />
        <div className="map-grid" style={{ ...layer, zIndex: -1, opacity: 0.2 }} />

        <div
          className="container"
          style={{
            position: 'relative',
            paddingBlock: 'clamp(var(--s7), 6vw, var(--s8))',
          }}
        >
          <span className="eyebrow" style={{ color: 'rgba(255,255,255,0.86)' }}>
            {destination.country}
            {destination.region ? ` · ${destination.region}` : ''}
          </span>
          <h1 id="destination-title" style={{ color: '#fff', maxWidth: '16ch' }}>
            {destination.name}
          </h1>
          <p
            className="lead"
            style={{
              color: 'rgba(255,255,255,0.92)',
              marginTop: 'var(--s5)',
              marginBottom: 0,
              maxWidth: '56ch',
            }}
          >
            {destination.summary}
          </p>
        </div>
      </section>

      <div className="container" style={{ paddingTop: 'var(--s5)' }}>
        <Breadcrumbs
          items={[
            { href: '/', label: 'Home' },
            { href: '/destinations', label: 'Destinations' },
            { label: destination.name },
          ]}
        />
      </div>

      <section className="section-tight">
        <div className="container">
          <div className="prose">
            {paragraphs.length > 0 ? (
              paragraphs.map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p>
                Our written guide to {destination.name} is being updated by the
                guides who work there. In the meantime, the departures below are
                current and bookable, and the team in Skopje will answer any
                question about the ground the same day.
              </p>
            )}
          </div>

          <dl className="meta-list" style={{ marginTop: 'var(--s6)' }}>
            <div className="meta-item">
              <dt>Best time to visit</dt>
              <dd>{destination.best_time ?? 'Ask us — it depends on the route'}</dd>
            </div>
            <div className="meta-item">
              <dt>Journeys on sale</dt>
              <dd>
                {tours.length === 0
                  ? 'None right now'
                  : `${tours.length} ${tours.length === 1 ? 'tour' : 'tours'}`}
              </dd>
            </div>
            <div className="meta-item">
              <dt>Country</dt>
              <dd>{destination.country}</dd>
            </div>
            <div className="meta-item">
              <dt>Region</dt>
              <dd>{destination.region ?? destination.country}</dd>
            </div>
            <div className="meta-item">
              <dt>Prices from</dt>
              <dd>{fromCents !== null ? formatMoney(fromCents) : '—'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="section-head section-head-line">
            <div>
              <span className="eyebrow eyebrow-accent">Departures</span>
              <h2>Small-group journeys in {destination.name}</h2>
            </div>
            <Link className="btn btn-secondary" href="/tours">
              Compare with every tour
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
                Nothing is on sale in {destination.name} at the moment — usually
                that means the season has closed and next year&rsquo;s dates are
                still being costed with our partners on the ground.
              </p>
              <div className="cluster" style={{ justifyContent: 'center' }}>
                <Link className="btn btn-primary" href="/contact">
                  Ask when dates open
                </Link>
                <Link className="btn btn-secondary" href="/destinations">
                  See other destinations
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
