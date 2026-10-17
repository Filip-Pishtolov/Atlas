import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { query, get } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { discountFor } from '@/lib/pricing';
import PromotionEditor from '@/components/admin/PromotionEditor';
import type { Promotion } from '@/lib/types';

export const metadata = { title: 'Edit promotion' };

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

interface UsedRow {
  id: number;
  reference: string;
  contact_name: string;
  status: string;
  travellers_count: number;
  base_total_cents: number;
  discount_cents: number;
  total_cents: number;
  created_at: string;
  tour_title: string;
}

interface ScopedTour {
  id: number;
  title: string;
  base_price_cents: number;
  destination_name: string;
}

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole('admin', 'staff');
  if (!user) redirect('/login?next=/admin/promotions');

  const { id } = await params;
  const promotionId = Number(id);
  if (!Number.isInteger(promotionId)) notFound();

  const promotion = get<Promotion>('SELECT * FROM promotions WHERE id = ?', promotionId);
  if (!promotion) notFound();

  const tours = query<{ id: number; label: string }>(
    `SELECT t.id AS id, t.title || ' (' || d.name || ')' AS label
       FROM tours t
       JOIN destinations d ON d.id = t.destination_id
      ORDER BY t.title`,
  );
  const destinations = query<{ id: number; label: string }>(
    `SELECT id, name || ', ' || country AS label FROM destinations ORDER BY name`,
  );
  const themes = query<{ id: number; label: string }>(
    'SELECT id, name AS label FROM themes ORDER BY name',
  );

  const used = query<UsedRow>(
    `SELECT b.id, b.reference, b.contact_name, b.status, b.travellers_count,
            b.base_total_cents, b.discount_cents, b.total_cents, b.created_at,
            t.title AS tour_title
       FROM bookings b
       JOIN tours t ON t.id = b.tour_id
      WHERE b.promotion_id = ?
      ORDER BY b.created_at DESC, b.id DESC`,
    promotionId,
  );

  const givenAway = used
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.discount_cents, 0);

  const scopeWhere =
    promotion.scope === 'tour'
      ? 't.id = ?'
      : promotion.scope === 'destination'
        ? 't.destination_id = ?'
        : promotion.scope === 'theme'
          ? 'EXISTS (SELECT 1 FROM tour_themes tt WHERE tt.tour_id = t.id AND tt.theme_id = ?)'
          : '1 = 1';

  const scopedTours = query<ScopedTour>(
    `SELECT t.id, t.title, t.base_price_cents, d.name AS destination_name
       FROM tours t
       JOIN destinations d ON d.id = t.destination_id
      WHERE t.status = 'published' AND ${scopeWhere}
      ORDER BY t.title
      LIMIT 6`,
    ...(promotion.scope === 'all' ? [] : [promotion.scope_id ?? -1]),
  );

  const travellers = Math.max(1, promotion.min_travellers);

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow eyebrow-accent">Pricing</span>
          <h1>{promotion.name}</h1>
          <div className="cluster cluster-sm">
            {promotion.code ? (
              <span className="badge badge-accent">Code {promotion.code}</span>
            ) : (
              <span className="badge badge-good">Automatic</span>
            )}
            <span className="badge badge-neutral">{promotion.status}</span>
            <span className="hint">
              Created {fmtDate(promotion.created_at)} · runs{' '}
              {fmtDate(promotion.starts_at)} → {fmtDate(promotion.ends_at)}
            </span>
          </div>
        </div>
        <Link className="btn btn-secondary" href="/admin/promotions">
          Back to promotions
        </Link>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 'var(--s6)' }}>
        <div className="kpi kpi-accent">
          <span className="kpi-label">Redemptions</span>
          <span className="kpi-value">{promotion.usage_count}</span>
          <span className="kpi-note">
            {promotion.usage_limit === null
              ? 'No cap set'
              : `of ${promotion.usage_limit} allowed`}
          </span>
        </div>
        <div className="kpi kpi-warn">
          <span className="kpi-label">Discount given</span>
          <span className="kpi-value">{formatMoney(givenAway)}</span>
          <span className="kpi-note">Excludes cancelled bookings</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Tours covered</span>
          <span className="kpi-value">
            {promotion.scope === 'all' ? 'All' : scopedTours.length}
          </span>
          <span className="kpi-note">
            {promotion.scope === 'all'
              ? 'Every published tour qualifies'
              : `Published tours matching this ${promotion.scope}`}
          </span>
        </div>
      </div>

      <PromotionEditor
        promotion={promotion}
        tours={tours}
        destinations={destinations}
        themes={themes}
      />

      <section className="section-tight">
        <div className="section-head section-head-line">
          <div>
            <span className="eyebrow">Sanity check</span>
            <h2 style={{ fontSize: '1.6rem' }}>What a customer would pay</h2>
          </div>
          <span className="hint">
            Computed live from the rule above, for a party of {travellers}
            {travellers === 1 ? ' traveller' : ' travellers'}.
          </span>
        </div>

        {scopedTours.length === 0 ? (
          <div className="card">
            <p className="empty-state">
              No published tour currently matches this scope, so nobody can see the
              offer yet. Publish a matching tour, or widen the scope.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Tour</th>
                  <th scope="col" className="num">
                    List price pp
                  </th>
                  <th scope="col" className="num">
                    Basket
                  </th>
                  <th scope="col" className="num">
                    Discount
                  </th>
                  <th scope="col" className="num">
                    Customer pays
                  </th>
                </tr>
              </thead>
              <tbody>
                {scopedTours.map((t) => {
                  const basket = t.base_price_cents * travellers;
                  const discount = discountFor(promotion, basket);
                  const now = basket - discount;
                  return (
                    <tr key={t.id}>
                      <td>
                        {t.title}
                        <br />
                        <span className="hint">{t.destination_name}</span>
                      </td>
                      <td className="num tabular">{formatMoney(t.base_price_cents)}</td>
                      <td className="num tabular">
                        <span className="price-was">{formatMoney(basket)}</span>
                      </td>
                      <td className="num tabular">−{formatMoney(discount)}</td>
                      <td className="num tabular" style={{ fontWeight: 600 }}>
                        {formatMoney(now)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint" style={{ marginTop: 'var(--s3)' }}>
          Departure-specific prices override the list price shown here, and the customer
          always receives whichever eligible promotion is worth the most.
        </p>
      </section>

      <section className="section-tight">
        <div className="section-head section-head-line">
          <div>
            <span className="eyebrow">Audit</span>
            <h2 style={{ fontSize: '1.6rem' }}>Bookings that used this offer</h2>
          </div>
          <span className="hint">{used.length} in total</span>
        </div>

        {used.length === 0 ? (
          <div className="card">
            <p className="empty-state">
              Nobody has booked with this promotion yet.
              {promotion.code
                ? ` Customers need to type ${promotion.code} at checkout — check the code is in the campaign copy.`
                : ' It applies automatically, so it will appear here as soon as a matching booking is taken.'}
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
                  <th scope="col">Booked</th>
                  <th scope="col" className="num">
                    Before
                  </th>
                  <th scope="col" className="num">
                    Saved
                  </th>
                  <th scope="col" className="num">
                    Paid
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {used.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link className="mono" href={`/admin/bookings/${b.id}`}>
                        {b.reference}
                      </Link>
                    </td>
                    <td>{b.contact_name}</td>
                    <td>{b.tour_title}</td>
                    <td className="tabular">{fmtDate(b.created_at)}</td>
                    <td className="num tabular">{formatMoney(b.base_total_cents)}</td>
                    <td className="num tabular">−{formatMoney(b.discount_cents)}</td>
                    <td className="num tabular">{formatMoney(b.total_cents)}</td>
                    <td>
                      <span
                        className={
                          b.status === 'cancelled'
                            ? 'badge badge-danger'
                            : b.status === 'paid' || b.status === 'completed'
                              ? 'badge badge-good'
                              : 'badge badge-neutral'
                        }
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
