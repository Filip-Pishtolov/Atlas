import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import DestinationCard from '@/components/DestinationCard';
import { query } from '@/lib/db';
import { listDestinations } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Destinations',
  description:
    'Every country Atlas works in, with the number of small-group journeys running there and the price they start from. Morocco, Albania, Greece and the rest of the Atlas map.',
};

interface DestinationStat {
  destination_id: number;
  tour_count: number;
  from_cents: number | null;
}

export default function DestinationsPage() {
  const destinations = listDestinations();

  const stats = query<DestinationStat>(
    `SELECT t.destination_id,
            COUNT(*)                AS tour_count,
            MIN(t.base_price_cents) AS from_cents
       FROM tours t
      WHERE t.status = 'published'
      GROUP BY t.destination_id`,
  );
  const statFor = new Map(stats.map((s) => [s.destination_id, s]));
  const tourTotal = stats.reduce((sum, s) => sum + s.tour_count, 0);

  const countries = new Set(destinations.map((d) => d.country));

  return (
    <>
      <section className="section-tight">
        <div className="container">
          <Breadcrumbs
            items={[{ href: '/', label: 'Home' }, { label: 'Destinations' }]}
          />

          <span className="eyebrow eyebrow-accent">The Atlas map</span>
          <h1 style={{ maxWidth: '20ch' }}>Where we go, and why we stopped there</h1>

          <p className="lead" style={{ marginTop: 'var(--s5)' }}>
            Atlas works in a deliberately short list of places. We open a
            destination only once we have a guide living there, a driver we have
            used for a full season, and enough beds held in our own name to run
            a group in high summer. That is why there are{' '}
            {countries.size > 0 ? countries.size : 'a handful of'} countries on
            this page rather than forty.
          </p>

          <p className="muted" style={{ marginTop: 'var(--s4)', maxWidth: '62ch' }}>
            Each hub below carries the practical detail: when the weather
            actually behaves, how long you need, and every departure currently
            on sale.{' '}
            {tourTotal > 0 && (
              <>
                {tourTotal} journeys are live across the map today —{' '}
                <Link href="/tours">see them all in one list</Link>.
              </>
            )}
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          {destinations.length > 0 ? (
            <div className="grid grid-3">
              {destinations.map((d) => {
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
            <div className="empty-state">
              <p>
                No destination hubs are published yet. We are rewriting them for
                the coming season — tell us where you are thinking of and we
                will send the itinerary as soon as it is costed.
              </p>
              <Link className="btn btn-primary" href="/contact">
                Ask about a country
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
