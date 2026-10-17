import Link from 'next/link';
import type { CSSProperties } from 'react';
import { formatMoney } from '@/lib/money';
import type { Destination } from '@/lib/types';

const clamp2: CSSProperties = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
};

export default function DestinationCard({
  destination,
  tourCount = 0,
  fromCents = null,
}: {
  destination: Destination;
  tourCount?: number;
  fromCents?: number | null;
}) {
  const image =
    destination.hero_image ||
    `https://picsum.photos/seed/${destination.slug}/1200/800`;

  return (
    <article className="card card-link">
      <Link
        href={`/destinations/${destination.slug}`}
        style={{ display: 'contents', color: 'inherit' }}
      >
        <div className="card-media">
          {destination.is_featured === 1 && (
            <span className="badge badge-accent badge-float">Signature</span>
          )}
          <img
            src={image}
            alt={`${destination.name}, ${destination.country}`}
            loading="lazy"
            decoding="async"
            width={600}
            height={400}
          />
        </div>

        <div className="card-body">
          <span className="eyebrow" style={{ margin: 0 }}>
            {destination.region ?? destination.country}
          </span>
          <h3 className="card-title">{destination.name}</h3>
          <p className="muted" style={{ ...clamp2, fontSize: '0.9rem', margin: 0 }}>
            {destination.summary}
          </p>

          <div className="card-foot">
            <span className="muted" style={{ fontSize: '0.86rem' }}>
              {tourCount === 0
                ? 'Itineraries in progress'
                : `${tourCount} ${tourCount === 1 ? 'journey' : 'journeys'}`}
            </span>
            {fromCents !== null && tourCount > 0 && (
              <span style={{ textAlign: 'right' }}>
                <span className="price-from">From</span>
                <span
                  className="tabular"
                  style={{ display: 'block', fontWeight: 600 }}
                >
                  {formatMoney(fromCents)}
                </span>
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
