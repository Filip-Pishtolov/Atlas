import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getCurrentUser } from '@/lib/auth';
import { get, query } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import type { Booking, BookingStatus, BookingTraveller } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ reference: string }>;
}

interface BookingRow extends Booking {
  tour_title: string;
  tour_slug: string;
  duration_days: number;
  difficulty: string;
  hero_image: string;
  meeting_point: string | null;
  group_size_max: number;
  destination_name: string;
  country: string;
  start_date: string;
  end_date: string;
  departure_status: string;
  promotion_name: string | null;
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

const STATUS_NOTE: Record<BookingStatus, string> = {
  pending:
    'We have your deposit and your seats are held. Your coordinator confirms the group once minimum numbers are met.',
  confirmed:
    'This departure is going ahead. Book flights now if you have not already — we can advise on timings.',
  paid: 'Paid in full. Nothing else is owed; final documents follow two weeks before you travel.',
  cancelled:
    'This booking was cancelled. If that was not what you intended, email us with the reference and we will sort it out.',
  completed: 'Welcome home. If you have five minutes, a review helps the next traveller enormously.',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { reference } = await params;
  return {
    title: `Booking ${reference.toUpperCase()}`,
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

export default async function AccountBookingPage({ params }: PageProps) {
  const { reference } = await params;
  const ref = decodeURIComponent(reference);

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/account/${encodeURIComponent(ref)}`);

  const booking = get<BookingRow>(
    `SELECT b.*,
            t.title          AS tour_title,
            t.slug           AS tour_slug,
            t.duration_days  AS duration_days,
            t.difficulty     AS difficulty,
            t.hero_image     AS hero_image,
            t.meeting_point  AS meeting_point,
            t.group_size_max AS group_size_max,
            ds.name          AS destination_name,
            ds.country       AS country,
            dep.start_date   AS start_date,
            dep.end_date     AS end_date,
            dep.status       AS departure_status,
            p.name           AS promotion_name
       FROM bookings b
       JOIN tours t         ON t.id  = b.tour_id
       JOIN destinations ds ON ds.id = t.destination_id
       JOIN departures dep  ON dep.id = b.departure_id
       LEFT JOIN promotions p ON p.id = b.promotion_id
      WHERE UPPER(b.reference) = UPPER(?)
        AND b.user_id = ?`,
    ref,
    user.id,
  );
  if (!booking) notFound();

  const travellers = query<BookingTraveller>(
    'SELECT * FROM booking_travellers WHERE booking_id = ? ORDER BY is_lead DESC, id',
    booking.id,
  );

  const today = new Date().toISOString().slice(0, 10);
  const balanceCents = Math.max(0, booking.total_cents - booking.deposit_cents);
  const balanceDue = shiftDays(booking.start_date, -60);
  const balanceOwed = booking.status !== 'paid' && booking.status !== 'cancelled';
  const departed = booking.start_date < today;
  const missingDetails = travellers.filter((t) => !t.dob || !t.nationality).length;

  return (
    <div className="container section">
      <Breadcrumbs
        items={[
          { href: '/', label: 'Home' },
          { href: '/account', label: 'My account' },
          { label: booking.reference },
        ]}
      />

      <div className="section-head section-head-line">
        <div>
          <span className="eyebrow" style={{ margin: 0 }}>
            Booking <span className="mono">{booking.reference}</span>
          </span>
          <h1 style={{ marginTop: 'var(--s2)' }}>{booking.tour_title}</h1>
          <p className="muted" style={{ margin: 'var(--s2) 0 0' }}>
            {booking.destination_name}, {booking.country} · {booking.duration_days} days
            · {booking.difficulty}
          </p>
        </div>
        <span className={`badge ${STATUS_BADGE[booking.status]}`}>
          {STATUS_LABEL[booking.status]}
        </span>
      </div>

      <p
        className={`alert ${
          booking.status === 'cancelled' ? 'alert-danger' : 'alert-info'
        }`}
      >
        {STATUS_NOTE[booking.status]}
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 'var(--s6)',
          marginTop: 'var(--s6)',
        }}
      >
        <div className="stack stack-lg" style={{ flex: '1 1 430px', minWidth: 0 }}>
          <section className="card card-pad stack">
            <h2 style={{ margin: 0 }}>Your departure</h2>
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
                <dt>Group cap</dt>
                <dd className="tabular">{booking.group_size_max}</dd>
              </div>
              <div className="meta-item">
                <dt>Meeting point</dt>
                <dd>{booking.meeting_point ?? 'Sent 30 days before departure'}</dd>
              </div>
              <div className="meta-item">
                <dt>Booked on</dt>
                <dd>{formatDate(booking.created_at.slice(0, 10))}</dd>
              </div>
            </dl>

            {booking.departure_status === 'cancelled' && (
              <p className="alert alert-danger" style={{ margin: 0 }}>
                Atlas has had to cancel this departure. Our team will contact you about
                a transfer or a full refund — nothing is owed in the meantime.
              </p>
            )}

            <div className="cluster">
              <Link className="btn btn-secondary" href={`/tours/${booking.tour_slug}`}>
                Tour page &amp; itinerary
              </Link>
              {departed && booking.status !== 'cancelled' && (
                <Link className="btn btn-ghost" href={`/tours/${booking.tour_slug}#reviews`}>
                  Write a review
                </Link>
              )}
            </div>
          </section>

          <section className="card card-pad stack">
            <div className="between">
              <h2 style={{ margin: 0 }}>Travellers</h2>
              <span className="muted" style={{ fontSize: '0.86rem' }}>
                {travellers.length} on this booking
              </span>
            </div>

            {travellers.length === 0 ? (
              <p className="empty-state" style={{ margin: 0 }}>
                No traveller names are on file. Email us the names as printed on each
                passport and we will add them.
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

          {booking.notes && (
            <section className="card card-pad stack">
              <h2 style={{ margin: 0 }}>Your note to us</h2>
              <p className="muted" style={{ margin: 0 }}>
                {booking.notes}
              </p>
            </section>
          )}

          <section className="card card-pad stack">
            <h2 style={{ margin: 0 }}>What to do next</h2>
            {booking.status === 'cancelled' ? (
              <p className="muted" style={{ margin: 0 }}>
                Nothing to do. Any refund due is processed within ten working days of
                the cancellation date. Quote{' '}
                <span className="mono">{booking.reference}</span> if you get in touch.
              </p>
            ) : departed ? (
              <ol className="prose">
                <li>
                  Share how it went — reviews on the tour page are read by everyone
                  weighing up the same trip.
                </li>
                <li>
                  Your invoice and traveller list stay here for seven years, so you can
                  come back for the paperwork any time.
                </li>
                <li>
                  Ready for the next one? Repeat travellers get first refusal on new
                  departures before they are published.
                </li>
              </ol>
            ) : (
              <ol className="prose">
                {missingDetails > 0 && (
                  <li>
                    <strong>Complete traveller details.</strong> {missingDetails} of{' '}
                    {travellers.length} still need a date of birth or nationality. Reply
                    to your confirmation email and we will fill them in.
                  </li>
                )}
                <li>
                  <strong>Book your flights.</strong> Arrive by early afternoon on{' '}
                  {formatDate(booking.start_date)} — the group briefing is at 18:00.
                </li>
                {balanceOwed && balanceCents > 0 && (
                  <li>
                    <strong>Pay the balance.</strong> {formatMoney(balanceCents)} falls
                    due on {formatDate(balanceDue)}, 60 days before departure. We remind
                    you a week beforehand.
                  </li>
                )}
                <li>
                  <strong>Check your travel insurance.</strong> Cover is a condition of
                  travel on every Atlas trip, including medical repatriation.
                </li>
                <li>
                  <strong>Watch for the final pack</strong> around{' '}
                  {formatDate(shiftDays(booking.start_date, -14))}: your guide&rsquo;s
                  name, the local emergency number and the exact meeting time.
                </li>
              </ol>
            )}
          </section>
        </div>

        <aside
          className="card card-pad stack"
          aria-label="Price breakdown"
          style={{ flex: '1 1 290px', position: 'sticky', top: 'var(--s5)' }}
        >
          <h2 className="card-title" style={{ margin: 0 }}>
            Price breakdown
          </h2>

          <img
            src={booking.hero_image}
            alt={`${booking.tour_title} in ${booking.destination_name}`}
            loading="lazy"
            decoding="async"
            width={600}
            height={400}
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: 'var(--r)',
              display: 'block',
            }}
          />

          <div className="stack stack-sm">
            <div className="between">
              <span className="muted">
                {formatMoney(
                  Math.round(booking.base_total_cents / booking.travellers_count),
                )}{' '}
                × {booking.travellers_count}{' '}
                {booking.travellers_count === 1 ? 'traveller' : 'travellers'}
              </span>
              <span className="tabular">{formatMoney(booking.base_total_cents)}</span>
            </div>

            {booking.discount_cents > 0 && (
              <div className="between">
                <span className="cluster cluster-sm">
                  <span className="badge badge-promo">Saving</span>
                  <span className="muted">
                    {booking.promotion_name ?? 'Promotion applied'}
                  </span>
                </span>
                <span className="tabular" style={{ color: 'var(--good)' }}>
                  −{formatMoney(booking.discount_cents)}
                </span>
              </div>
            )}

            <hr className="divider" style={{ margin: 'var(--s2) 0' }} />

            <div className="between">
              <strong>Total</strong>
              <span className="price price-lg">
                <span className="price-now">{formatMoney(booking.total_cents)}</span>
                {booking.discount_cents > 0 && (
                  <span className="price-was">
                    {formatMoney(booking.base_total_cents)}
                  </span>
                )}
              </span>
            </div>
            <div className="between">
              <span className="muted" style={{ fontSize: '0.86rem' }}>
                Deposit paid
              </span>
              <span className="tabular" style={{ fontSize: '0.86rem' }}>
                {formatMoney(booking.deposit_cents)}
              </span>
            </div>
          </div>

          {balanceOwed && balanceCents > 0 ? (
            <div className="alert alert-warn stack stack-sm">
              <div className="between">
                <span>Balance outstanding</span>
                <strong className="tabular">{formatMoney(balanceCents)}</strong>
              </div>
              <span style={{ fontSize: '0.82rem' }}>
                Due {formatDate(balanceDue)}
                {balanceDue < today ? ' — payable now' : ''}.
              </span>
            </div>
          ) : (
            <div className="alert alert-good">
              Nothing outstanding on this booking.
            </div>
          )}

          {booking.promo_code && (
            <p className="hint" style={{ margin: 0 }}>
              Code applied: <span className="mono">{booking.promo_code}</span>
            </p>
          )}

          <p className="hint" style={{ margin: 0 }}>
            Atlas is a fictional agency built for a university assignment — no real
            payment was ever taken.
          </p>

          <Link className="btn btn-ghost btn-block" href="/account">
            All my bookings
          </Link>
        </aside>
      </div>
    </div>
  );
}
