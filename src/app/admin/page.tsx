import type { Metadata } from 'next';
import Link from 'next/link';
import DataTable, {
  OccupancyBar,
  StatusBadge,
} from '@/components/admin/DataTable';
import { get, query } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { daysUntil } from '@/lib/pricing';
import { livePromotions } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard',
};

interface MonthTotals {
  bookings: number;
  revenue: number;
}

interface AttentionRow {
  id: number;
  tour_id: number;
  tour_title: string;
  start_date: string;
  price_cents: number;
  seats_total: number;
  seats_booked: number;
  status: string;
}

interface RecentBooking {
  id: number;
  reference: string;
  status: string;
  total_cents: number;
  travellers_count: number;
  contact_name: string;
  created_at: string;
  tour_title: string;
  start_date: string | null;
}

const DATE = new Intl.DateTimeFormat('en-IE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value.slice(0, 10) + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? value : DATE.format(d);
}

export default async function AdminDashboardPage() {
  const thisMonth = get<MonthTotals>(
    `SELECT COUNT(*) AS bookings,
            COALESCE(SUM(CASE WHEN status IN ('confirmed','paid','completed')
                              THEN total_cents ELSE 0 END), 0) AS revenue
       FROM bookings
      WHERE status != 'cancelled'
        AND created_at >= datetime('now','start of month')`,
  ) ?? { bookings: 0, revenue: 0 };

  const lastMonth = get<MonthTotals>(
    `SELECT COUNT(*) AS bookings,
            COALESCE(SUM(CASE WHEN status IN ('confirmed','paid','completed')
                              THEN total_cents ELSE 0 END), 0) AS revenue
       FROM bookings
      WHERE status != 'cancelled'
        AND created_at >= datetime('now','start of month','-1 month')
        AND created_at <  datetime('now','start of month')`,
  ) ?? { bookings: 0, revenue: 0 };

  const openEnquiries =
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'`,
    )?.n ?? 0;

  const oldestEnquiry = get<{ created_at: string }>(
    `SELECT created_at FROM enquiries WHERE status = 'new'
      ORDER BY created_at LIMIT 1`,
  );

  const pendingReviews =
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'`,
    )?.n ?? 0;

  const atRisk = query<AttentionRow>(
    `SELECT d.id, d.tour_id, d.start_date, d.price_cents,
            d.seats_total, d.seats_booked, d.status,
            t.title AS tour_title
       FROM departures d
       JOIN tours t ON t.id = d.tour_id
      WHERE d.status IN ('open','guaranteed')
        AND d.start_date >= date('now')
        AND d.start_date <= date('now','+60 days')
        AND d.seats_total > 0
        AND (CAST(d.seats_booked AS REAL) / d.seats_total) < 0.5
      ORDER BY d.start_date
      LIMIT 8`,
  );

  const recent = query<RecentBooking>(
    `SELECT b.id, b.reference, b.status, b.total_cents, b.travellers_count,
            b.contact_name, b.created_at,
            t.title AS tour_title,
            dep.start_date AS start_date
       FROM bookings b
       JOIN tours t ON t.id = b.tour_id
       LEFT JOIN departures dep ON dep.id = b.departure_id
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT 8`,
  );

  const promotions = livePromotions();
  const today = new Date();

  const revenueDelta = thisMonth.revenue - lastMonth.revenue;

  return (
    <>
      <div className="admin-head">
        <div className="stack stack-sm">
          <p className="eyebrow-accent">Atlas operations</p>
          <h1>Dashboard</h1>
          <p className="muted" style={{ fontSize: '0.92rem' }}>
            Month to date, and everything that needs a decision today.
          </p>
        </div>
        <div className="cluster cluster-sm">
          <Link href="/admin/tours/new" className="btn btn-primary btn-sm">
            New tour
          </Link>
          <Link href="/admin/promotions/new" className="btn btn-secondary btn-sm">
            New promotion
          </Link>
          <Link href="/admin/departures" className="btn btn-secondary btn-sm">
            New departure
          </Link>
        </div>
      </div>

      <div className="stack stack-lg">
        <div className="grid grid-4">
          <div className="kpi kpi-accent">
            <span className="kpi-label">Bookings this month</span>
            <span className="kpi-value">{thisMonth.bookings}</span>
            <span className="kpi-note">
              {lastMonth.bookings} in the same window last month
            </span>
          </div>

          <div className="kpi kpi-accent">
            <span className="kpi-label">Revenue this month</span>
            <span className="kpi-value">{formatMoney(thisMonth.revenue)}</span>
            <span className="kpi-note">
              {revenueDelta === 0
                ? 'Level with last month'
                : `${revenueDelta > 0 ? '+' : '−'}${formatMoney(
                    Math.abs(revenueDelta),
                  )} on last month`}
            </span>
          </div>

          <div className={openEnquiries > 0 ? 'kpi kpi-warn' : 'kpi kpi-good'}>
            <span className="kpi-label">Enquiries waiting</span>
            <span className="kpi-value">{openEnquiries}</span>
            <span className="kpi-note">
              {openEnquiries === 0
                ? 'Inbox clear'
                : `Oldest from ${fmtDate(oldestEnquiry?.created_at ?? null)}`}
            </span>
          </div>

          <div className={pendingReviews > 0 ? 'kpi kpi-warn' : 'kpi kpi-good'}>
            <span className="kpi-label">Reviews to moderate</span>
            <span className="kpi-value">{pendingReviews}</span>
            <span className="kpi-note">
              {pendingReviews === 0
                ? 'Nothing pending'
                : 'Hidden from tour pages until approved'}
            </span>
          </div>
        </div>

        <section>
          <div className="section-head section-head-line">
            <div className="stack stack-sm">
              <h2>Departures needing attention</h2>
              <p className="muted" style={{ fontSize: '0.9rem' }}>
                Leaving within 60 days and under half full. Fill them, discount
                them, or cancel them early enough to be fair to the travellers
                already booked.
              </p>
            </div>
            <Link href="/admin/departures" className="btn btn-ghost btn-sm">
              All departures
            </Link>
          </div>

          {atRisk.length === 0 ? (
            <div className="card empty-state">
              <p>
                Nothing at risk. Every departure inside the next 60 days is at
                least half sold.
              </p>
            </div>
          ) : (
            <DataTable
              columns={[
                { key: 'tour', label: 'Tour' },
                { key: 'departs', label: 'Departs' },
                { key: 'lead', label: 'Lead time', align: 'right' },
                { key: 'occupancy', label: 'Occupancy' },
                { key: 'price', label: 'Price', align: 'right' },
                { key: 'status', label: 'Status' },
              ]}
            >
              {atRisk.map((d) => {
                const lead = daysUntil(d.start_date, today);
                return (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/admin/tours/${d.tour_id}`}>
                        {d.tour_title}
                      </Link>
                    </td>
                    <td className="tabular">{fmtDate(d.start_date)}</td>
                    <td className="num">
                      <span
                        style={{
                          color:
                            lead <= 21 ? 'var(--danger)' : 'var(--ink-2)',
                          fontWeight: lead <= 21 ? 500 : 400,
                        }}
                      >
                        {lead} days
                      </span>
                    </td>
                    <td>
                      <OccupancyBar
                        booked={d.seats_booked}
                        total={d.seats_total}
                      />
                    </td>
                    <td className="num">{formatMoney(d.price_cents)}</td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </section>

        <section>
          <div className="section-head section-head-line">
            <div className="stack stack-sm">
              <h2>Recent bookings</h2>
              <p className="muted" style={{ fontSize: '0.9rem' }}>
                The last eight to come through, newest first.
              </p>
            </div>
            <Link href="/admin/bookings" className="btn btn-ghost btn-sm">
              All bookings
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="card empty-state">
              <p>
                No bookings yet. They will appear here the moment the first one
                comes through the checkout.
              </p>
            </div>
          ) : (
            <DataTable
              columns={[
                { key: 'ref', label: 'Reference' },
                { key: 'tour', label: 'Tour' },
                { key: 'lead', label: 'Lead traveller' },
                { key: 'pax', label: 'Pax', align: 'right' },
                { key: 'departs', label: 'Departs' },
                { key: 'total', label: 'Total', align: 'right' },
                { key: 'status', label: 'Status' },
              ]}
            >
              {recent.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/admin/bookings/${b.id}`} className="mono">
                      {b.reference}
                    </Link>
                  </td>
                  <td>{b.tour_title}</td>
                  <td>{b.contact_name}</td>
                  <td className="num">{b.travellers_count}</td>
                  <td className="tabular">{fmtDate(b.start_date)}</td>
                  <td className="num">{formatMoney(b.total_cents)}</td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        <section>
          <div className="section-head section-head-line">
            <div className="stack stack-sm">
              <h2>Live promotions</h2>
              <p className="muted" style={{ fontSize: '0.9rem' }}>
                Running right now. A promotion with no code applies
                automatically at checkout.
              </p>
            </div>
            <Link href="/admin/promotions" className="btn btn-ghost btn-sm">
              Manage promotions
            </Link>
          </div>

          {promotions.length === 0 ? (
            <div className="card empty-state">
              <p>
                Nothing live. Quiet weeks are what early-bird and last-minute
                rules are for.
              </p>
            </div>
          ) : (
            <DataTable
              columns={[
                { key: 'name', label: 'Promotion' },
                { key: 'code', label: 'Code' },
                { key: 'value', label: 'Discount', align: 'right' },
                { key: 'ends', label: 'Ends' },
                { key: 'usage', label: 'Used', align: 'right' },
                { key: 'status', label: 'Status' },
              ]}
            >
              {promotions.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/promotions/${p.id}`}>{p.name}</Link>
                    {p.badge_text ? (
                      <>
                        {' '}
                        <span className="badge badge-promo">
                          {p.badge_text}
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {p.code ? (
                      <span className="mono">{p.code}</span>
                    ) : (
                      <span className="badge badge-accent">Automatic</span>
                    )}
                  </td>
                  <td className="num">
                    {p.type === 'percentage'
                      ? `${p.value}%`
                      : formatMoney(p.value)}
                  </td>
                  <td className="tabular">{fmtDate(p.ends_at)}</td>
                  <td className="num tabular">
                    {p.usage_count}
                    {p.usage_limit === null ? '' : ` / ${p.usage_limit}`}
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
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
