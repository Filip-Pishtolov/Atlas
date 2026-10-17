import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { query, get } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatMoney, formatMoneyPrecise } from '@/lib/money';
import StatusSelect from '@/components/admin/StatusSelect';
import type { Booking, BookingTraveller } from '@/lib/types';

export const metadata = { title: 'Booking' };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

function fmtDateTime(value: string | null): string {
  if (!value) return '—';
  const t = /\d{2}:\d{2}/.exec(value.slice(10));
  return t ? `${fmtDate(value)}, ${t[0]}` : fmtDate(value);
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge badge-warn',
  confirmed: 'badge badge-accent',
  paid: 'badge badge-good',
  completed: 'badge badge-neutral',
  cancelled: 'badge badge-danger',
};

interface Detail extends Booking {
  tour_title: string;
  tour_slug: string;
  duration_days: number;
  meeting_point: string | null;
  destination_name: string;
  country: string;
  start_date: string;
  end_date: string;
  seats_total: number;
  seats_booked: number;
  departure_status: string;
  promotion_name: string | null;
  promotion_type: string | null;
  promotion_value: number | null;
  account_name: string | null;
  account_email: string | null;
}

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole('admin', 'staff');
  if (!user) redirect('/login?next=/admin/bookings');

  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId)) notFound();

  const booking = get<Detail>(
    `SELECT b.*,
            t.title         AS tour_title,
            t.slug          AS tour_slug,
            t.duration_days AS duration_days,
            t.meeting_point AS meeting_point,
            dst.name        AS destination_name,
            dst.country     AS country,
            d.start_date    AS start_date,
            d.end_date      AS end_date,
            d.seats_total   AS seats_total,
            d.seats_booked  AS seats_booked,
            d.status        AS departure_status,
            p.name          AS promotion_name,
            p.type          AS promotion_type,
            p.value         AS promotion_value,
            u.name          AS account_name,
            u.email         AS account_email
       FROM bookings b
       JOIN tours t          ON t.id = b.tour_id
       JOIN destinations dst ON dst.id = t.destination_id
       JOIN departures d     ON d.id = b.departure_id
       LEFT JOIN promotions p ON p.id = b.promotion_id
       LEFT JOIN users u      ON u.id = b.user_id
      WHERE b.id = ?`,
    bookingId,
  );
  if (!booking) notFound();

  const travellers = query<BookingTraveller>(
    'SELECT * FROM booking_travellers WHERE booking_id = ? ORDER BY is_lead DESC, id',
    bookingId,
  );

  const balance = booking.total_cents - booking.deposit_cents;
  const perPerson = Math.round(booking.total_cents / Math.max(1, booking.travellers_count));
  const savedPercent =
    booking.base_total_cents > 0
      ? Math.round((booking.discount_cents / booking.base_total_cents) * 100)
      : 0;

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow eyebrow-accent">Booking</span>
          <h1 className="mono" style={{ fontSize: '2rem' }}>
            {booking.reference}
          </h1>
          <div className="cluster cluster-sm">
            <span className={STATUS_BADGE[booking.status] ?? 'badge badge-neutral'}>
              {booking.status}
            </span>
            <span className="hint">
              Taken {fmtDateTime(booking.created_at)} · {booking.travellers_count}{' '}
              {booking.travellers_count === 1 ? 'traveller' : 'travellers'}
            </span>
          </div>
        </div>
        <Link className="btn btn-secondary" href="/admin/bookings">
          Back to bookings
        </Link>
      </div>

      <section className="card card-pad stack" style={{ marginBottom: 'var(--s6)' }}>
        <div className="between">
          <div>
            <span className="eyebrow">Change status</span>
            <p className="muted" style={{ margin: 0 }}>
              Moves take effect immediately and are written to the audit log.
            </p>
          </div>
          <StatusSelect
            endpoint={`/api/admin/bookings/${booking.id}`}
            value={booking.status}
            label={`Status of booking ${booking.reference}`}
            confirmOn={['cancelled']}
            confirmMessage={`Cancel ${booking.reference}?\n\nThe ${booking.travellers_count} seat(s) held on this departure are released back to general sale, and the customer keeps their cancellation rights under the booking conditions.`}
            options={[
              { value: 'pending', label: 'Pending — awaiting deposit' },
              { value: 'confirmed', label: 'Confirmed — deposit received' },
              { value: 'paid', label: 'Paid — balance settled' },
              { value: 'completed', label: 'Completed — travelled' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>

        <div className="alert alert-warn">
          <strong>Cancelling releases seats.</strong> Setting this booking to cancelled
          returns {booking.travellers_count}{' '}
          {booking.travellers_count === 1 ? 'seat' : 'seats'} to the{' '}
          {fmtDate(booking.start_date)} departure, which currently shows{' '}
          {booking.seats_booked} of {booking.seats_total} sold. Refunds are handled
          separately — this control does not move money.
        </div>
      </section>

      <div className="grid grid-2" style={{ marginBottom: 'var(--s6)' }}>
        <section className="card card-pad stack">
          <span className="eyebrow">Customer</span>
          <h2 style={{ fontSize: '1.4rem' }}>{booking.contact_name}</h2>
          <dl className="meta-list">
            <div className="meta-item">
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${booking.contact_email}`}>{booking.contact_email}</a>
              </dd>
            </div>
            <div className="meta-item">
              <dt>Phone</dt>
              <dd>
                {booking.contact_phone ? (
                  <a href={`tel:${booking.contact_phone.replace(/\s/g, '')}`}>
                    {booking.contact_phone}
                  </a>
                ) : (
                  <span className="muted">Not given</span>
                )}
              </dd>
            </div>
            <div className="meta-item">
              <dt>Account</dt>
              <dd>
                {booking.account_email ? (
                  <>
                    {booking.account_name}
                    <br />
                    <span className="hint">{booking.account_email}</span>
                  </>
                ) : (
                  <span className="muted">Guest checkout</span>
                )}
              </dd>
            </div>
          </dl>
          <a
            className="btn btn-secondary btn-sm"
            href={`mailto:${booking.contact_email}?subject=${encodeURIComponent(
              `Atlas booking ${booking.reference}`,
            )}`}
          >
            Email {booking.contact_name.split(' ')[0]}
          </a>
        </section>

        <section className="card card-pad stack">
          <span className="eyebrow">Departure</span>
          <h2 style={{ fontSize: '1.4rem' }}>{booking.tour_title}</h2>
          <dl className="meta-list">
            <div className="meta-item">
              <dt>Dates</dt>
              <dd>
                {fmtDate(booking.start_date)} → {fmtDate(booking.end_date)}
              </dd>
            </div>
            <div className="meta-item">
              <dt>Length</dt>
              <dd>{booking.duration_days} days</dd>
            </div>
            <div className="meta-item">
              <dt>Destination</dt>
              <dd>
                {booking.destination_name}, {booking.country}
              </dd>
            </div>
            <div className="meta-item">
              <dt>Seats sold</dt>
              <dd className="tabular">
                {booking.seats_booked} / {booking.seats_total}
              </dd>
            </div>
            <div className="meta-item">
              <dt>Departure status</dt>
              <dd style={{ textTransform: 'capitalize' }}>
                {booking.departure_status}
              </dd>
            </div>
            <div className="meta-item">
              <dt>Meeting point</dt>
              <dd>{booking.meeting_point ?? 'To be confirmed'}</dd>
            </div>
          </dl>
          <Link className="btn btn-secondary btn-sm" href={`/tours/${booking.tour_slug}`}>
            View the public tour page
          </Link>
        </section>
      </div>

      <section className="section-tight">
        <div className="section-head section-head-line">
          <div>
            <span className="eyebrow">Money</span>
            <h2 style={{ fontSize: '1.6rem' }}>Price breakdown</h2>
          </div>
          <span className="hint">
            Every figure was computed by the pricing engine at the moment of booking and
            frozen onto the record.
          </span>
        </div>

        <div className="grid grid-2">
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <tr>
                  <td>
                    List price × {booking.travellers_count}{' '}
                    {booking.travellers_count === 1 ? 'traveller' : 'travellers'}
                  </td>
                  <td className="num tabular">
                    {formatMoneyPrecise(booking.base_total_cents)}
                  </td>
                </tr>
                <tr>
                  <td>
                    Promotion applied
                    {booking.promotion_name && (
                      <>
                        <br />
                        <span className="hint">
                          {booking.promotion_name}
                          {booking.promotion_type === 'percentage'
                            ? ` — ${booking.promotion_value}% off`
                            : booking.promotion_value !== null
                              ? ` — ${formatMoney(booking.promotion_value)} off`
                              : ''}
                          {booking.promo_code ? ` · code ${booking.promo_code}` : ' · automatic'}
                        </span>
                      </>
                    )}
                    {!booking.promotion_name && booking.discount_cents > 0 && (
                      <>
                        <br />
                        <span className="hint">
                          The promotion has since been deleted; the discount stands.
                        </span>
                      </>
                    )}
                    {!booking.promotion_name && booking.discount_cents === 0 && (
                      <>
                        <br />
                        <span className="hint">None — booked at the list price.</span>
                      </>
                    )}
                  </td>
                  <td className="num tabular">
                    {booking.discount_cents > 0
                      ? `−${formatMoneyPrecise(booking.discount_cents)}`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Total payable</td>
                  <td className="num tabular" style={{ fontWeight: 600 }}>
                    {formatMoneyPrecise(booking.total_cents)}
                  </td>
                </tr>
                <tr>
                  <td>
                    Deposit taken
                    <br />
                    <span className="hint">20% of the total, rounded to whole euros</span>
                  </td>
                  <td className="num tabular">
                    {formatMoneyPrecise(booking.deposit_cents)}
                  </td>
                </tr>
                <tr>
                  <td>
                    Balance outstanding
                    <br />
                    <span className="hint">
                      Due 56 days before departure under the booking conditions
                    </span>
                  </td>
                  <td className="num tabular" style={{ fontWeight: 600 }}>
                    {formatMoneyPrecise(balance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-2" style={{ alignContent: 'start' }}>
            <div className="kpi kpi-accent">
              <span className="kpi-label">Per person</span>
              <span className="kpi-value">{formatMoney(perPerson)}</span>
              <span className="kpi-note">after discount</span>
            </div>
            <div className="kpi kpi-good">
              <span className="kpi-label">Customer saved</span>
              <span className="kpi-value">{formatMoney(booking.discount_cents)}</span>
              <span className="kpi-note">
                {booking.discount_cents > 0 ? `${savedPercent}% off the basket` : 'No promotion'}
              </span>
            </div>
            <div className="kpi kpi-warn">
              <span className="kpi-label">Balance</span>
              <span className="kpi-value">{formatMoney(balance)}</span>
              <span className="kpi-note">
                {balance <= 0 ? 'Settled in full' : 'Still to collect'}
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Departs</span>
              <span className="kpi-value" style={{ fontSize: '1.2rem' }}>
                {fmtDate(booking.start_date)}
              </span>
              <span className="kpi-note">{booking.duration_days} days</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="section-head section-head-line">
          <div>
            <span className="eyebrow">Passenger manifest</span>
            <h2 style={{ fontSize: '1.6rem' }}>
              {booking.tour_title} — {fmtDate(booking.start_date)}
            </h2>
          </div>
          <span className="hint">
            Print this page for the departure folder. Reference {booking.reference}.
          </span>
        </div>

        {travellers.length === 0 ? (
          <div className="card">
            <p className="empty-state">
              No traveller names were captured on this booking. Call{' '}
              {booking.contact_name} on {booking.contact_phone ?? 'the number on file'} —
              the guide needs full names as they appear on passports before check-in.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col" className="num">
                    #
                  </th>
                  <th scope="col">Full name</th>
                  <th scope="col">Date of birth</th>
                  <th scope="col">Nationality</th>
                  <th scope="col">Dietary / medical</th>
                  <th scope="col">Role</th>
                </tr>
              </thead>
              <tbody>
                {travellers.map((t, i) => (
                  <tr key={t.id}>
                    <td className="num tabular">{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{t.full_name}</td>
                    <td className="tabular">{fmtDate(t.dob)}</td>
                    <td>{t.nationality ?? <span className="muted">—</span>}</td>
                    <td>
                      {t.dietary ? (
                        <span className="badge badge-warn">{t.dietary}</span>
                      ) : (
                        <span className="muted">None declared</span>
                      )}
                    </td>
                    <td>
                      {t.is_lead ? (
                        <span className="badge badge-accent">Lead traveller</span>
                      ) : (
                        <span className="muted">Traveller</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="hint" style={{ marginTop: 'var(--s3)' }}>
          Emergency contact for this party: {booking.contact_name},{' '}
          {booking.contact_phone ?? booking.contact_email}. Traveller data is personal
          data — do not forward this manifest outside the guiding team.
        </p>
      </section>

      <section className="section-tight">
        <div className="section-head section-head-line">
          <div>
            <span className="eyebrow">Internal</span>
            <h2 style={{ fontSize: '1.6rem' }}>Notes</h2>
          </div>
        </div>
        <div className="card card-pad">
          {booking.notes ? (
            <p className="prose" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {booking.notes}
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Nothing recorded. Anything the customer wrote at checkout — flight times,
              room-sharing requests, mobility needs — would appear here.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
