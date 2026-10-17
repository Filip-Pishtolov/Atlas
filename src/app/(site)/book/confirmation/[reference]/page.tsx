import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { get, query } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import type { Booking, BookingTraveller } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ reference: string }>;
}

interface BookingRow extends Booking {
  tour_title: string;
  tour_slug: string;
  duration_days: number;
  hero_image: string;
  meeting_point: string | null;
  destination_name: string;
  country: string;
  start_date: string;
  end_date: string;
  promotion_name: string | null;
}

function loadBooking(reference: string): BookingRow | undefined {
  return get<BookingRow>(
    `SELECT b.*,
            t.title          AS tour_title,
            t.slug           AS tour_slug,
            t.duration_days  AS duration_days,
            t.hero_image     AS hero_image,
            t.meeting_point  AS meeting_point,
            ds.name          AS destination_name,
            ds.country       AS country,
            dep.start_date   AS start_date,
            dep.end_date     AS end_date,
            p.name           AS promotion_name
       FROM bookings b
       JOIN tours t         ON t.id  = b.tour_id
       JOIN destinations ds ON ds.id = t.destination_id
       JOIN departures dep  ON dep.id = b.departure_id
       LEFT JOIN promotions p ON p.id = b.promotion_id
      WHERE UPPER(b.reference) = UPPER(?)`,
    reference,
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { reference } = await params;
  return {
    title: `Booking ${reference.toUpperCase()} confirmed`,
    description: 'Your Atlas booking is confirmed. Reference, price breakdown and what happens next.',
    robots: { index: false, follow: false },
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

function shiftDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function BookingConfirmationPage({ params }: PageProps) {
  const { reference } = await params;
  const booking = loadBooking(decodeURIComponent(reference));
  if (!booking) notFound();

  const travellers = query<BookingTraveller>(
    'SELECT * FROM booking_travellers WHERE booking_id = ? ORDER BY is_lead DESC, id',
    booking.id,
  );

  const balanceCents = Math.max(0, booking.total_cents - booking.deposit_cents);
  const balanceDue = shiftDays(booking.start_date, -60);
  const balanceOverdue = balanceDue < new Date().toISOString().slice(0, 10);

  return (
    <div className="container-narrow section">
      <p className="alert alert-good" role="status">
        <strong>You are booked.</strong> A confirmation is on its way to{' '}
        {booking.contact_email}. Keep the reference below — it is how we find you.
      </p>

      <div className="card card-pad stack" style={{ marginTop: 'var(--s6)' }}>
        <div className="between">
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>
              Booking reference
            </span>
            <p
              className="mono"
              style={{
                margin: 'var(--s2) 0 0',
                fontSize: '1.9rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
              }}
            >
              {booking.reference}
            </p>
          </div>
          <span className="badge badge-good">
            {booking.status === 'pending' ? 'Deposit received' : booking.status}
          </span>
        </div>

        <hr className="divider" style={{ margin: 0 }} />

        <div>
          <h1 style={{ marginBottom: 'var(--s2)' }}>{booking.tour_title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {booking.destination_name}, {booking.country} · {booking.duration_days} days
          </p>
        </div>

        <dl className="meta-list">
          <div className="meta-item">
            <dt>Departs</dt>
            <dd>{formatDate(booking.start_date)}</dd>
          </div>
          <div className="meta-item">
            <dt>Returns</dt>
            <dd>{formatDate(booking.end_date)}</dd>
          </div>
          <div className="meta-item">
            <dt>Travellers</dt>
            <dd className="tabular">{booking.travellers_count}</dd>
          </div>
          <div className="meta-item">
            <dt>Meeting point</dt>
            <dd>{booking.meeting_point ?? 'Sent 30 days before departure'}</dd>
          </div>
        </dl>
      </div>

      <section className="section-tight">
        <div className="section-head section-head-line">
          <h2>What it costs</h2>
        </div>

        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Price breakdown for this booking</caption>
            <tbody>
              <tr>
                <td>
                  Trip price ·{' '}
                  {formatMoney(
                    Math.round(booking.base_total_cents / booking.travellers_count),
                  )}{' '}
                  × {booking.travellers_count}{' '}
                  {booking.travellers_count === 1 ? 'traveller' : 'travellers'}
                </td>
                <td className="num tabular">{formatMoney(booking.base_total_cents)}</td>
              </tr>

              {booking.discount_cents > 0 && (
                <tr>
                  <td>
                    <span className="cluster cluster-sm">
                      <span className="badge badge-promo">Saving</span>
                      <span>{booking.promotion_name ?? 'Promotion applied'}</span>
                      {booking.promo_code && (
                        <span className="mono muted">{booking.promo_code}</span>
                      )}
                    </span>
                  </td>
                  <td className="num tabular" style={{ color: 'var(--good)' }}>
                    −{formatMoney(booking.discount_cents)}
                  </td>
                </tr>
              )}

              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td className="num tabular">
                  <strong>{formatMoney(booking.total_cents)}</strong>
                </td>
              </tr>
              <tr>
                <td>Deposit paid today (20%)</td>
                <td className="num tabular">{formatMoney(booking.deposit_cents)}</td>
              </tr>
              <tr>
                <td>
                  Balance, due {formatDate(balanceDue)}{' '}
                  <span className="muted">(60 days before departure)</span>
                </td>
                <td className="num tabular">{formatMoney(balanceCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {balanceOverdue && (
          <p className="alert alert-warn" style={{ marginTop: 'var(--s4)' }}>
            You booked inside the 60-day window, so the balance of{' '}
            {formatMoney(balanceCents)} is payable straight away. Our team will be in
            touch within one working day.
          </p>
        )}

        <p className="alert alert-info" style={{ marginTop: 'var(--s4)' }}>
          <strong>No money has actually moved.</strong> Atlas is a fictional tour
          operator built for a university assignment — there is no payment gateway
          behind this page and no card details were collected.
        </p>
      </section>

      <section className="section-tight">
        <div className="section-head section-head-line">
          <h2>Who is travelling</h2>
        </div>

        {travellers.length === 0 ? (
          <p className="empty-state">
            No traveller names are on file yet. Reply to your confirmation email with
            the names as they appear on each passport.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Date of birth</th>
                  <th scope="col">Nationality</th>
                  <th scope="col">Dietary</th>
                </tr>
              </thead>
              <tbody>
                {travellers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="cluster cluster-sm">
                        <span>{t.full_name}</span>
                        {t.is_lead === 1 && (
                          <span className="badge badge-accent">Lead</span>
                        )}
                      </span>
                    </td>
                    <td className="tabular">{t.dob ?? '—'}</td>
                    <td>{t.nationality ?? '—'}</td>
                    <td>{t.dietary ?? 'None noted'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section-tight">
        <div className="section-head section-head-line">
          <h2>What happens next</h2>
        </div>

        <ol className="prose">
          <li>
            <strong>Today.</strong> A confirmation email lands at{' '}
            {booking.contact_email} with this reference and your receipt for the{' '}
            {formatMoney(booking.deposit_cents)} deposit.
          </li>
          <li>
            <strong>Within two working days.</strong> Your trip coordinator emails the
            joining pack: kit list, vaccination notes, the flights we recommend and the
            exact meeting time.
          </li>
          <li>
            <strong>Any time before {formatDate(balanceDue)}.</strong> Send us passport
            details and any dietary requirements you have not added yet — you can do it
            from your Atlas account.
          </li>
          <li>
            <strong>{formatDate(balanceDue)}.</strong> The remaining{' '}
            {formatMoney(balanceCents)} falls due. We will remind you a week beforehand.
          </li>
          <li>
            <strong>{formatDate(shiftDays(booking.start_date, -14))}.</strong> Final
            documents, your guide&rsquo;s name and a local emergency number.
          </li>
        </ol>

        <div className="cluster" style={{ marginTop: 'var(--s5)' }}>
          <Link className="btn btn-primary" href="/account">
            View this in my account
          </Link>
          <Link className="btn btn-secondary" href={`/tours/${booking.tour_slug}`}>
            Back to the tour
          </Link>
          <Link className="btn btn-ghost" href="/tours">
            Browse more trips
          </Link>
        </div>

        <p className="hint" style={{ marginTop: 'var(--s4)' }}>
          Questions? Email hello@atlas.travel quoting{' '}
          <span className="mono">{booking.reference}</span>, or use the{' '}
          <Link href="/contact">contact form</Link>.
        </p>
      </section>
    </div>
  );
}
