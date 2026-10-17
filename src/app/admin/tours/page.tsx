import type { Metadata } from 'next';
import Link from 'next/link';
import DataTable, { StatusBadge } from '@/components/admin/DataTable';
import { query } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import type { TourStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tours',
};

interface AdminTourRow {
  id: number;
  slug: string;
  title: string;
  duration_days: number;
  base_price_cents: number;
  status: TourStatus;
  is_featured: number;
  destination_name: string;
  upcoming_departures: number;
  total_departures: number;
}

const STATUSES: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'sold_out', label: 'Sold out' },
  { value: 'retired', label: 'Retired' },
];

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function AdminToursPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const statusRaw = first(sp.status);
  const status = STATUSES.some((s) => s.value === statusRaw)
    ? statusRaw
    : 'all';

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (status !== 'all') {
    where.push('t.status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(t.title LIKE ? OR t.slug LIKE ? OR d.name LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  const rows = query<AdminTourRow>(
    `SELECT t.id, t.slug, t.title, t.duration_days, t.base_price_cents,
            t.status, t.is_featured,
            d.name AS destination_name,
            (SELECT COUNT(*) FROM departures dep
              WHERE dep.tour_id = t.id
                AND dep.status != 'cancelled'
                AND dep.start_date >= date('now')) AS upcoming_departures,
            (SELECT COUNT(*) FROM departures dep
              WHERE dep.tour_id = t.id) AS total_departures
       FROM tours t
       JOIN destinations d ON d.id = t.destination_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY t.is_featured DESC, t.title`,
    ...params,
  );

  const filtered = status !== 'all' || q !== '';

  return (
    <>
      <div className="admin-head">
        <div className="stack stack-sm">
          <p className="eyebrow-accent">Catalogue</p>
          <h1>Tours</h1>
          <p className="muted" style={{ fontSize: '0.92rem' }}>
            Every tour Atlas has ever written, in any state of readiness.
          </p>
        </div>
        <Link href="/admin/tours/new" className="btn btn-primary btn-sm">
          New tour
        </Link>
      </div>

      <div className="stack">
        <form
          method="get"
          action="/admin/tours"
          className="card card-pad cluster"
          style={{ alignItems: 'flex-end' }}
        >
          <div className="field" style={{ flex: '1 1 260px' }}>
            <label className="label" htmlFor="q">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              className="input"
              defaultValue={q}
              placeholder="Title, slug or destination"
            />
          </div>

          <div className="field" style={{ flex: '0 1 200px' }}>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              className="select"
              defaultValue={status}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="cluster cluster-sm">
            <button type="submit" className="btn btn-secondary">
              Apply
            </button>
            {filtered ? (
              <Link href="/admin/tours" className="btn btn-ghost">
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        <p className="muted mono" style={{ fontSize: '0.75rem' }}>
          {rows.length} {rows.length === 1 ? 'tour' : 'tours'}
          {filtered ? ' matching' : ' in the catalogue'}
        </p>

        {rows.length === 0 ? (
          <div className="card empty-state stack">
            <p>
              {filtered
                ? 'No tour matches those filters. Try a broader search or clear the status filter.'
                : 'The catalogue is empty. The first tour is the one that makes every other page worth building.'}
            </p>
            <div className="cluster cluster-sm" style={{ justifyContent: 'center' }}>
              {filtered ? (
                <Link href="/admin/tours" className="btn btn-secondary btn-sm">
                  Clear filters
                </Link>
              ) : null}
              <Link href="/admin/tours/new" className="btn btn-primary btn-sm">
                Create a tour
              </Link>
            </div>
          </div>
        ) : (
          <DataTable
            columns={[
              { key: 'title', label: 'Tour' },
              { key: 'destination', label: 'Destination' },
              { key: 'duration', label: 'Days', align: 'right' },
              { key: 'price', label: 'From', align: 'right' },
              { key: 'departures', label: 'Departures', align: 'right' },
              { key: 'status', label: 'Status' },
              { key: 'featured', label: 'Featured' },
              { key: 'actions', label: 'Actions', align: 'right' },
            ]}
          >
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="stack stack-sm" style={{ gap: '2px' }}>
                    <Link href={`/admin/tours/${t.id}`}>{t.title}</Link>
                    <span className="mono muted" style={{ fontSize: '0.72rem' }}>
                      /tours/{t.slug}
                    </span>
                  </div>
                </td>
                <td>{t.destination_name}</td>
                <td className="num">{t.duration_days}</td>
                <td className="num">{formatMoney(t.base_price_cents)}</td>
                <td className="num">
                  <span className="tabular">{t.upcoming_departures}</span>
                  {t.upcoming_departures === 0 && t.status === 'published' ? (
                    <>
                      {' '}
                      <span className="badge badge-danger">None open</span>
                    </>
                  ) : (
                    <span className="muted" style={{ fontSize: '0.78rem' }}>
                      {' '}
                      of {t.total_departures}
                    </span>
                  )}
                </td>
                <td>
                  <StatusBadge status={t.status} />
                </td>
                <td>
                  {t.is_featured ? (
                    <span className="badge badge-accent">Featured</span>
                  ) : (
                    <span className="muted" aria-label="Not featured">
                      —
                    </span>
                  )}
                </td>
                <td className="num">
                  <div className="cluster cluster-sm" style={{ justifyContent: 'flex-end' }}>
                    <Link
                      href={`/tours/${t.slug}`}
                      className="btn btn-ghost btn-sm"
                    >
                      View
                    </Link>
                    <Link
                      href={`/admin/tours/${t.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </>
  );
}
