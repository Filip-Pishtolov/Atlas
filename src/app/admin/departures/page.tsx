import type { Metadata } from 'next';
import Link from 'next/link';
import DepartureManager, {
  type DepartureRow,
  type DepartureTourOption,
} from '@/components/admin/DepartureManager';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Departures',
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function AdminDeparturesPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const tourParam = Number(first(sp.tour));
  const initialTourFilter =
    Number.isInteger(tourParam) && tourParam > 0 ? tourParam : null;

  const departures = query<DepartureRow>(
    `SELECT d.id, d.tour_id, d.start_date, d.end_date, d.price_cents,
            d.seats_total, d.seats_booked, d.status,
            t.title AS tour_title
       FROM departures d
       JOIN tours t ON t.id = d.tour_id
      WHERE d.start_date >= date('now')
      ORDER BY d.start_date, t.title`,
  );

  const tours = query<DepartureTourOption>(
    `SELECT id, title, duration_days, base_price_cents
       FROM tours
      WHERE status != 'retired'
      ORDER BY title`,
  );

  const seatsTotal = departures.reduce((n, d) => n + d.seats_total, 0);
  const seatsBooked = departures.reduce((n, d) => n + d.seats_booked, 0);

  return (
    <>
      <div className="admin-head">
        <div className="stack stack-sm">
          <p className="eyebrow-accent">Catalogue</p>
          <h1>Departures</h1>
          <p className="muted" style={{ fontSize: '0.92rem' }}>
            {departures.length} upcoming{' '}
            {departures.length === 1 ? 'date' : 'dates'} · {seatsBooked} of{' '}
            {seatsTotal} seats sold. Prices and seats are editable in place.
          </p>
        </div>
        <Link href="/admin/tours" className="btn btn-ghost btn-sm">
          Back to tours
        </Link>
      </div>

      {tours.length === 0 ? (
        <div className="card empty-state stack">
          <p>
            There are no tours to attach a date to yet. Write the tour first,
            then put dates on sale.
          </p>
          <div className="cluster" style={{ justifyContent: 'center' }}>
            <Link href="/admin/tours/new" className="btn btn-primary">
              Create a tour
            </Link>
          </div>
        </div>
      ) : (
        <DepartureManager
          tours={tours}
          departures={departures}
          initialTourFilter={initialTourFilter}
        />
      )}
    </>
  );
}
