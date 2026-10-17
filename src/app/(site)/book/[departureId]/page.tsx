import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import BookingForm from '@/components/BookingForm';
import { getCurrentUser } from '@/lib/auth';
import { get } from '@/lib/db';
import { getDeparture, getTourById, tourThemeIds } from '@/lib/queries';
import type { Destination } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ departureId: string }>;
}

function loadDeparture(rawId: string) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const departure = getDeparture(id);
  if (!departure) return null;
  if (departure.status === 'cancelled') return null;

  const today = new Date().toISOString().slice(0, 10);
  if (departure.start_date < today) return null;

  const tour = getTourById(departure.tour_id);
  if (!tour || tour.status === 'draft' || tour.status === 'retired') return null;

  const destination = get<Destination>(
    'SELECT * FROM destinations WHERE id = ?',
    tour.destination_id,
  );
  if (!destination) return null;

  return { departure, tour, destination };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { departureId } = await params;
  const data = loadDeparture(departureId);
  if (!data) return { title: 'Departure not available' };
  return {
    title: `Book ${data.tour.title}`,
    description: `Reserve your place on the ${data.departure.start_date} departure of ${data.tour.title} with Atlas. 20% deposit today, balance 60 days before you travel.`,
  };
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function BookDeparturePage({ params }: PageProps) {
  const { departureId } = await params;
  const data = loadDeparture(departureId);
  if (!data) notFound();

  const { departure, tour, destination } = data;
  const seatsLeft = Math.max(0, departure.seats_total - departure.seats_booked);
  const soldOut = departure.status === 'sold_out' || seatsLeft === 0;

  const user = await getCurrentUser();
  const themeIds = tourThemeIds(tour.id);

  return (
    <div className="container section">
      <Breadcrumbs
        items={[
          { href: '/', label: 'Home' },
          { href: '/tours', label: 'Tours' },
          { href: `/tours/${tour.slug}`, label: tour.title },
          { label: 'Book' },
        ]}
      />

      <div className="section-head section-head-line">
        <div>
          <span className="eyebrow-accent">Secure your place</span>
          <h1>{tour.title}</h1>
          <p className="lead" style={{ marginTop: 'var(--s3)' }}>
            {formatDate(departure.start_date)} – {formatDate(departure.end_date)} ·{' '}
            {destination.name}, {destination.country}
          </p>
        </div>
      </div>

      {soldOut ? (
        <div className="card card-pad stack" style={{ maxWidth: '46rem' }}>
          <span className="badge badge-danger" style={{ alignSelf: 'flex-start' }}>
            Sold out
          </span>
          <h2>This departure is full</h2>
          <p className="muted" style={{ margin: 0 }}>
            Every seat on the {formatDate(departure.start_date)} group has gone. Atlas
            caps groups at {tour.group_size_max} people and we do not add extra places,
            because the guide-to-traveller ratio is the whole point of a small group.
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Other dates for this trip are usually released a season ahead — or tell us
            what you had in mind and we will let you know the moment a place opens up.
          </p>
          <div className="cluster">
            <Link className="btn btn-primary" href={`/tours/${tour.slug}`}>
              See other dates
            </Link>
            <Link className="btn btn-secondary" href={`/contact?tour=${tour.id}`}>
              Ask about a waiting list
            </Link>
          </div>
        </div>
      ) : (
        <>
          {!user && (
            <p className="alert alert-info" style={{ marginBottom: 'var(--s6)' }}>
              You can book as a guest.{' '}
              <Link href={`/login?next=/book/${departure.id}`}>Sign in</Link> first and
              this trip lands straight in your Atlas account, alongside your other
              bookings.
            </p>
          )}

          <BookingForm
            tour={{
              id: tour.id,
              slug: tour.slug,
              title: tour.title,
              duration_days: tour.duration_days,
              group_size_max: tour.group_size_max,
              meeting_point: tour.meeting_point,
              hero_image: tour.hero_image,
              destination_name: destination.name,
              country: destination.country,
            }}
            departure={departure}
            themeIds={themeIds}
            seatsLeft={seatsLeft}
            contact={
              user
                ? { name: user.name, email: user.email, phone: user.phone }
                : null
            }
          />
        </>
      )}
    </div>
  );
}
