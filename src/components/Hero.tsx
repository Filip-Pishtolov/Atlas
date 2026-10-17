import type { CSSProperties } from 'react';
import type { Destination } from '@/lib/types';

const DURATIONS = [
  { value: '', label: 'Any length' },
  { value: '1-6', label: 'Short break (1–6 days)' },
  { value: '7-9', label: 'A week or so (7–9 days)' },
  { value: '10+', label: 'Long journey (10+ days)' },
];

const layer: CSSProperties = { position: 'absolute', inset: 0 };

export default function Hero({ destinations }: { destinations: Destination[] }) {
  return (
    <section
      aria-labelledby="hero-title"
      style={{
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        background: '#051012',
      }}
    >
      <img
        src="https://picsum.photos/seed/atlas-hero-coastline/1920/1080"
        alt=""
        width={1920}
        height={1080}
        decoding="async"
        fetchPriority="high"
        style={{ ...layer, zIndex: -3, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      <div
        style={{
          ...layer,
          zIndex: -2,
          backgroundColor: 'rgba(5, 16, 18, 0.35)',
          backgroundImage:
            'linear-gradient(100deg, rgba(5,16,18,0.93) 0%, rgba(5,16,18,0.82) 52%, rgba(5,16,18,0.45) 100%)',
        }}
      />
      <div className="map-grid" style={{ ...layer, zIndex: -1, opacity: 0.22 }} />

      <div
        className="container"
        style={{
          position: 'relative',
          paddingBlock: 'clamp(var(--s8), 8vw, var(--s9))',
        }}
      >
        <span
          className="eyebrow"
          style={{ color: 'rgba(255,255,255,0.86)', marginBottom: 'var(--s4)' }}
        >
          Skopje · est. 2019 · Licence ATL-2019-0442
        </span>

        <h1 id="hero-title" style={{ color: '#fff', maxWidth: '17ch' }}>
          Sixteen travellers, and a guide who lives there.
        </h1>

        <p
          className="lead"
          style={{
            color: 'rgba(255,255,255,0.92)',
            marginTop: 'var(--s5)',
            maxWidth: '54ch',
          }}
        >
          Small-group journeys across the Mediterranean, the Balkans and North
          Africa — fixed departures, the whole price up front, and itineraries
          written by the people who lead them.
        </p>

        <form
          action="/tours"
          method="get"
          className="card card-pad"
          style={{
            marginTop: 'var(--s7)',
            maxWidth: '820px',
            boxShadow: 'var(--shadow-3)',
          }}
        >
          <span className="eyebrow eyebrow-accent" style={{ marginBottom: 'var(--s4)' }}>
            Find a departure
          </span>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 'var(--s4)',
              alignItems: 'end',
            }}
          >
            <div className="field">
              <label className="label" htmlFor="hero-destination">
                Where to
              </label>
              <select
                id="hero-destination"
                name="destination"
                className="select"
                defaultValue=""
              >
                <option value="">Anywhere we go</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.slug}>
                    {d.name} — {d.country}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor="hero-duration">
                How long
              </label>
              <select
                id="hero-duration"
                name="duration"
                className="select"
                defaultValue=""
              >
                {DURATIONS.map((d) => (
                  <option key={d.value || 'any'} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <button className="btn btn-primary btn-block" type="submit">
              Search tours
            </button>
          </div>

          <p className="hint" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
            Every date on this site is a real departure with seats we hold
            ourselves. Nothing is a placeholder.
          </p>
        </form>
      </div>
    </section>
  );
}
