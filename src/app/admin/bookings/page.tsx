import Link from 'next/link';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import type { BookingStatus } from '@/lib/types';

export const metadata = { title: 'Bookings' };

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

const STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'paid',
  'completed',
  'cancelled',
];

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge badge-warn',
  confirmed: 'badge badge-accent',
  paid: 'badge badge-good',
  completed: 'badge badge-neutral',
  cancelled: 'badge badge-danger',
};

interface Row {
  id: number;
  reference: string;
  status: BookingStatus;
  travellers_count: number;
  base_total_cents: number;
  discount_cents: number;
  total_cents: number;
  deposit_cents: number;
  contact_name: string;
  contact_email: string;
  created_at: string;
  tour_title: string;
  start_date: string;
  end_date: string;
  promotion_name: string | null;
  promo_code: string | null;
}

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireRole('admin', 'staff');
  if (!user) redirect('/login?next=/admin/bookings');

  const sp = await searchParams;
  const rawStatus = first(sp.status);
  const status = (STATUSES as string[]).includes(rawStatus) ? rawStatus : '';
  const search = first(sp.q).trim();

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (status) {
    where.push('b.status = ?');
    params.push(status);
  }
  if (search) {
    where.push(
      '(b.reference LIKE ? OR b.contact_name LIKE ? OR b.contact_email LIKE ?)',
    );
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const rows = query<Row>(
    `SELECT b.id, b.reference, b.status, b.travellers_count,
            b.base_total_cents, b.discount_cents, b.total_cents, b.deposit_cents,
            b.contact_name, b.contact_email, b.created_at, b.promo_code,
            t.title      AS tour_title,
            d.start_date AS start_date,
            d.end_date   AS end_date,
            p.name       AS promotion_name
       FROM bookings b
       JOIN tours t       ON t.id = b.tour_id
       JOIN departures d  ON d.id = b.departure_id
       LEFT JOIN promotions p ON p.id = b.promotion_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY b.created_at DESC, b.id DESC`,
    ...params,
  );

  const counts = new Map(
    query<{ status: string; c: number }>(
      'SELECT status, COUNT(*) AS c FROM bookings GROUP BY status',
    ).map((r) => [r.status, r.c]),
  );
  const totalBookings = [...counts.values()].reduce((a, b) => a + b, 0);

  function chipHref(next: string): string {
    const qs = new URLSearchParams();
    if (next) qs.set('status', next);
    if (search) qs.set('q', search);
    const s = qs.toString();
    return s ? `/admin/bookings?${s}` : '/admin/bookings';
  }

  const shownValue = rows.reduce(
    (sum, r) => (r.status === 'cancelled' ? sum : sum + r.total_cents),
    0,
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow eyebrow-accent">Operations</span>
          <h1>Bookings</h1>
          <p className="muted" style={{ margin: 0 }}>
            {rows.length === totalBookings
              ? `${totalBookings} bookings on file`
              : `${rows.length} of ${totalBookings} bookings shown`}
            {' · '}
            {formatMoney(shownValue)} in this view
          </p>
        </div>
      </div>

      <div className="cluster" style={{ marginBottom: 'var(--s4)' }}>
        <Link className={status === '' ? 'chip active' : 'chip'} href={chipHref('')}>
          All <span className="tabular">{totalBookings}</span>
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            className={status === s ? 'chip active' : 'chip'}
            href={chipHref(s)}
          >
            <span style={{ textTransform: 'capitalize' }}>{s}</span>{' '}
            <span className="tabular">{counts.get(s) ?? 0}</span>
          </Link>
        ))}
      </div>

      <form
        method="get"
        action="/admin/bookings"
        className="cluster cluster-sm"
        style={{ marginBottom: 'var(--s5)' }}
      >
        {status && <input type="hidden" name="status" value={status} />}
        <label className="sr-only" htmlFor="booking-search">
          Search bookings
        </label>
        <input
          id="booking-search"
          className="input"
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Reference, name or email — e.g. ATL-2027 or maria@"
          style={{ maxWidth: '26rem' }}
        />
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
        {(search || status) && (
          <Link className="btn btn-ghost" href="/admin/bookings">
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="card">
          <p className="empty-state">
            {search || status
              ? 'No booking matches that filter. Try clearing the search, or pick a different status.'
              : 'No bookings yet. They will appear here the moment a customer completes checkout.'}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Customer</th>
                <th scope="col">Tour</th>
                <th scope="col">Departs</th>
                <th scope="col" className="num">
                  Travellers
                </th>
                <th scope="col" className="num">
                  Total
                </th>
                <th scope="col">Discount</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link className="mono" href={`/admin/bookings/${b.id}`}>
                      {b.reference}
                    </Link>
                    <br />
                    <span className="hint">booked {fmtDate(b.created_at)}</span>
                  </td>
                  <td>
                    {b.contact_name}
                    <br />
                    <span className="hint">{b.contact_email}</span>
                  </td>
                  <td>{b.tour_title}</td>
                  <td className="tabular" style={{ whiteSpace: 'nowrap' }}>
                    {fmtDate(b.start_date)}
                  </td>
                  <td className="num tabular">{b.travellers_count}</td>
                  <td className="num tabular" style={{ fontWeight: 600 }}>
                    {formatMoney(b.total_cents)}
                  </td>
                  <td>
                    {b.discount_cents > 0 ? (
                      <div className="stack stack-sm">
                        <span className="tabular">−{formatMoney(b.discount_cents)}</span>
                        <span className="hint">
                          {b.promotion_name ?? 'Promotion removed'}
                          {b.promo_code ? ` · ${b.promo_code}` : ''}
                        </span>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className={STATUS_BADGE[b.status] ?? 'badge badge-neutral'}>
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <Link
                      className="btn btn-sm btn-secondary"
                      href={`/admin/bookings/${b.id}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
