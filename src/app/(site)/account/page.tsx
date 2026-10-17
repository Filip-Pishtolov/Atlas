import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import type { Booking, BookingStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My account',
  description: 'Your Atlas bookings, departure dates and balance reminders.',
  robots: { index: false, follow: false },
};

interface BookingRow extends Booking {
  tour_title: string;
  tour_slug: string;
  destination_name: string;
  country: string;
  duration_days: number;
  start_date: string;
  end_date: string;
}

const STATUS_BADGE: Record<BookingStatus, string> = {
  pending: 'badge-warn',
  confirmed: 'badge-accent',
  paid: 'badge-good',
  cancelled: 'badge-danger',
  completed: 'badge-neutral',
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Deposit received',
  confirmed: 'Confirmed',
  paid: 'Paid in full',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account');

  const bookings = query<BookingRow>(
    `SELECT b.*,
            t.title         AS tour_title,
            t.slug          AS tour_slug,
            t.duration_days AS duration_days,
            ds.name         AS destination_name,
            ds.country      AS country,
            dep.start_date  AS start_date,
            dep.end_date    AS end_date
       FROM bookings b
       JOIN tours t         ON t.id  = b.tour_id
       JOIN destinations ds ON ds.id = t.destination_id
       JOIN departures dep  ON dep.id = b.departure_id
      WHERE b.user_id = ?
      ORDER BY dep.start_date DESC`,
    user.id,
  );

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter(
    (b) => b.start_date >= today && b.status !== 'cancelled',
  );
  const nextTrip = upcoming.length > 0 ? upcoming[upcoming.length - 1] : null;
  const outstanding = upcoming.reduce(
    (sum, b) => sum + Math.max(0, b.total_cents - b.deposit_cents),
    0,
  );

  return (
    <div className="container section">
      <div className="section-head section-head-line">
        <div>
          <span className="eyebrow-accent">Your account</span>
          <h1>Hello, {user.name.split(' ')[0]}</h1>
          <p className="muted" style={{ margin: 'var(--s2) 0 0' }}>
            Signed in as {user.email}
            {user.role !== 'customer' && ` · ${user.role}`}
          </p>
        </div>
        {user.role !== 'customer' && (
          <Link className="btn btn-secondary" href="/admin">
            Open the admin panel
          </Link>
        )}
      </div>

      {bookings.length === 0 ? (
        <div className="card card-pad">
          <div className="empty-state stack">
            <h2 style={{ margin: 0 }}>No trips yet</h2>
            <p style={{ margin: 0 }}>
              Once you reserve a place, it appears here with your reference, traveller
              details and the date your balance falls due.
            </p>
            <div className="cluster" style={{ justifyContent: 'center' }}>
              <Link className="btn btn-primary" href="/tours">
                Browse our tours
              </Link>
              <Link className="btn btn-ghost" href="/destinations">
                Start from a destination
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-3" style={{ marginBottom: 'var(--s6)' }}>
            <div className="kpi kpi-accent">
              <span className="kpi-label">Trips booked</span>
              <span className="kpi-value">{bookings.length}</span>
              <span className="kpi-note">
                {upcoming.length} still to come
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Next departure</span>
              <span className="kpi-value" style={{ fontSize: '1.35rem' }}>
                {nextTrip ? formatDate(nextTrip.start_date) : 'Nothing booked'}
              </span>
              <span className="kpi-note">
                {nextTrip ? nextTrip.tour_title : 'Your next one is waiting'}
              </span>
            </div>
            <div className="kpi kpi-warn">
              <span className="kpi-label">Balance outstanding</span>
              <span className="kpi-value">{formatMoney(outstanding)}</span>
              <span className="kpi-note">
                Due 60 days before each departure
              </span>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Your Atlas bookings</caption>
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Tour</th>
                  <th scope="col">Dates</th>
                  <th scope="col" className="num">
                    Travellers
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">
                    Total
                  </th>
                  <th scope="col">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="mono">{b.reference}</td>
                    <td>
                      <Link href={`/account/${b.reference}`}>{b.tour_title}</Link>
                      <div className="muted" style={{ fontSize: '0.84rem' }}>
                        {b.destination_name}, {b.country} · {b.duration_days} days
                      </div>
                    </td>
                    <td className="tabular">
                      {formatDate(b.start_date)} – {formatDate(b.end_date)}
                    </td>
                    <td className="num tabular">{b.travellers_count}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[b.status]}`}>
                        {STATUS_LABEL[b.status]}
                      </span>
                    </td>
                    <td className="num tabular">{formatMoney(b.total_cents)}</td>
                    <td className="num">
                      <Link className="btn btn-ghost btn-sm" href={`/account/${b.reference}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="hint" style={{ marginTop: 'var(--s5)' }}>
            Need to change a booking? Email hello@atlas.travel with the reference, or
            use the <Link href="/contact">contact form</Link>. Changes made more than 60
            days before departure are free.
          </p>
        </>
      )}
    </div>
  );
}
