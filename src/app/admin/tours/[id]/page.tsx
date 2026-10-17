import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DataTable, {
  OccupancyBar,
  StatusBadge,
} from '@/components/admin/DataTable';
import TourEditor, {
  type TourEditorInitial,
} from '@/components/admin/TourEditor';
import { query } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import {
  getTourById,
  listDestinations,
  listThemes,
  tourFacts,
  tourImages,
  tourItinerary,
  tourThemeIds,
  upcomingDepartures,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tour = getTourById(Number(id));
  return { title: tour ? `Edit ${tour.title}` : 'Tour not found' };
}

const DATE = new Intl.DateTimeFormat('en-IE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function fmtDate(value: string): string {
  const d = new Date(value.slice(0, 10) + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? value : DATE.format(d);
}

export default async function EditTourPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tourId = Number(id);
  if (!Number.isInteger(tourId) || tourId <= 0) notFound();

  const tour = getTourById(tourId);
  if (!tour) notFound();

  const destinations = listDestinations();
  const themes = listThemes();
  const facts = tourFacts(tourId);
  const departures = upcomingDepartures(tourId, 6);

  const bookingCount =
    query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM bookings
        WHERE tour_id = ? AND status != 'cancelled'`,
      tourId,
    )[0]?.n ?? 0;

  const initial: TourEditorInitial = {
    title: tour.title,
    slug: tour.slug,
    destination_id: tour.destination_id,
    summary: tour.summary,
    description: tour.description,
    duration_days: tour.duration_days,
    difficulty: tour.difficulty,
    group_size_min: tour.group_size_min,
    group_size_max: tour.group_size_max,
    base_price_cents: tour.base_price_cents,
    hero_image: tour.hero_image,
    meeting_point: tour.meeting_point,
    status: tour.status,
    is_featured: tour.is_featured,
    theme_ids: tourThemeIds(tourId),
    itinerary: tourItinerary(tourId).map((d) => ({
      title: d.title,
      description: d.description,
      meals: d.meals,
      accommodation: d.accommodation,
    })),
    images: tourImages(tourId).map((i) => ({ url: i.url, alt: i.alt })),
    included: facts.filter((f) => f.kind === 'included').map((f) => f.text),
    excluded: facts.filter((f) => f.kind === 'excluded').map((f) => f.text),
  };

  return (
    <>
      <div className="admin-head">
        <div className="stack stack-sm">
          <p className="eyebrow-accent">Catalogue · tour #{tour.id}</p>
          <h1>{tour.title}</h1>
          <div className="cluster cluster-sm">
            <StatusBadge status={tour.status} />
            {tour.is_featured ? (
              <span className="badge badge-accent">Featured</span>
            ) : null}
            <span className="mono muted" style={{ fontSize: '0.72rem' }}>
              /tours/{tour.slug}
            </span>
            {bookingCount > 0 ? (
              <span className="mono muted" style={{ fontSize: '0.72rem' }}>
                · {bookingCount} booking{bookingCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
        </div>
        <div className="cluster cluster-sm">
          <Link href={`/tours/${tour.slug}`} className="btn btn-ghost btn-sm">
            View public page
          </Link>
          <Link href="/admin/tours" className="btn btn-secondary btn-sm">
            Back to tours
          </Link>
        </div>
      </div>

      <div className="stack stack-lg">
        <TourEditor
          mode="edit"
          tourId={tour.id}
          destinations={destinations}
          themes={themes}
          initial={initial}
        />

        <section>
          <div className="section-head section-head-line">
            <div className="stack stack-sm">
              <h2>Upcoming departures</h2>
              <p className="muted" style={{ fontSize: '0.9rem' }}>
                Dates and seats live on their own screen, because they change
                far more often than the tour text does.
              </p>
            </div>
            <Link
              href={`/admin/departures?tour=${tour.id}`}
              className="btn btn-secondary btn-sm"
            >
              Manage departures
            </Link>
          </div>

          {departures.length === 0 ? (
            <div className="card empty-state">
              <p>
                No dates on sale. A published tour with no departure is a page
                nobody can book.
              </p>
            </div>
          ) : (
            <DataTable
              columns={[
                { key: 'start', label: 'Departs' },
                { key: 'end', label: 'Returns' },
                { key: 'price', label: 'Price', align: 'right' },
                { key: 'occupancy', label: 'Occupancy' },
                { key: 'status', label: 'Status' },
              ]}
            >
              {departures.map((d) => (
                <tr key={d.id}>
                  <td className="tabular">{fmtDate(d.start_date)}</td>
                  <td className="tabular">{fmtDate(d.end_date)}</td>
                  <td className="num">{formatMoney(d.price_cents)}</td>
                  <td>
                    <OccupancyBar
                      booked={d.seats_booked}
                      total={d.seats_total}
                    />
                  </td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      </div>
    </>
  );
}
