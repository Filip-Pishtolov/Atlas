import Link from 'next/link';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import type { Promotion } from '@/lib/types';

export const metadata = { title: 'Promotions' };

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

type Phase = 'Live' | 'Scheduled' | 'Used up' | 'Paused' | 'Draft' | 'Expired';

const PHASE_BADGE: Record<Phase, string> = {
  Live: 'badge badge-good',
  Scheduled: 'badge badge-accent',
  'Used up': 'badge badge-danger',
  Paused: 'badge badge-warn',
  Draft: 'badge badge-neutral',
  Expired: 'badge badge-neutral',
};

const PHASE_RANK: Record<Phase, number> = {
  Live: 0,
  Scheduled: 1,
  Paused: 2,
  Draft: 3,
  'Used up': 4,
  Expired: 5,
};

function phaseOf(p: Promotion, nowSql: string): Phase {
  if (p.status === 'draft') return 'Draft';
  if (p.status === 'paused') return 'Paused';
  if (p.status === 'expired' || p.ends_at < nowSql) return 'Expired';
  if (p.usage_limit !== null && p.usage_count >= p.usage_limit) return 'Used up';
  if (p.starts_at > nowSql) return 'Scheduled';
  return 'Live';
}

export default async function AdminPromotionsPage() {
  const user = await requireRole('admin', 'staff');
  if (!user) redirect('/login?next=/admin/promotions');

  const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const promotions = query<Promotion>('SELECT * FROM promotions ORDER BY id DESC');

  const tourNames = new Map(
    query<{ id: number; title: string }>('SELECT id, title FROM tours').map((r) => [
      r.id,
      r.title,
    ]),
  );
  const destNames = new Map(
    query<{ id: number; name: string }>('SELECT id, name FROM destinations').map(
      (r) => [r.id, r.name],
    ),
  );
  const themeNames = new Map(
    query<{ id: number; name: string }>('SELECT id, name FROM themes').map((r) => [
      r.id,
      r.name,
    ]),
  );

  const redemptions = new Map(
    query<{ promotion_id: number; bookings: number; discount: number }>(
      `SELECT promotion_id,
              COUNT(*)             AS bookings,
              SUM(discount_cents)  AS discount
         FROM bookings
        WHERE promotion_id IS NOT NULL
          AND status != 'cancelled'
        GROUP BY promotion_id`,
    ).map((r) => [r.promotion_id, r]),
  );

  function scopeLabel(p: Promotion): string {
    switch (p.scope) {
      case 'all':
        return 'Every Atlas tour';
      case 'tour':
        return p.scope_id
          ? `Tour: ${tourNames.get(p.scope_id) ?? `#${p.scope_id} (deleted)`}`
          : 'Tour: not chosen';
      case 'destination':
        return p.scope_id
          ? `Destination: ${destNames.get(p.scope_id) ?? `#${p.scope_id} (deleted)`}`
          : 'Destination: not chosen';
      case 'theme':
        return p.scope_id
          ? `Theme: ${themeNames.get(p.scope_id) ?? `#${p.scope_id} (deleted)`}`
          : 'Theme: not chosen';
    }
  }

  function conditionsLabel(p: Promotion): string[] {
    const out: string[] = [];
    if (p.min_travellers > 1) out.push(`${p.min_travellers}+ travellers`);
    if (p.min_booking_cents > 0) out.push(`${formatMoney(p.min_booking_cents)}+ basket`);
    if (p.min_days_before !== null) out.push(`${p.min_days_before}+ days ahead`);
    if (p.max_days_before !== null) out.push(`within ${p.max_days_before} days`);
    return out;
  }

  const rows = promotions
    .map((p) => ({ promotion: p, phase: phaseOf(p, nowSql) }))
    .sort((a, b) => {
      const rank = PHASE_RANK[a.phase] - PHASE_RANK[b.phase];
      if (rank !== 0) return rank;
      const priority = b.promotion.priority - a.promotion.priority;
      if (priority !== 0) return priority;
      return b.promotion.id - a.promotion.id;
    });

  const liveCount = rows.filter((r) => r.phase === 'Live').length;
  const scheduledCount = rows.filter((r) => r.phase === 'Scheduled').length;
  const automaticLive = rows.filter(
    (r) => r.phase === 'Live' && r.promotion.code === null,
  ).length;

  let totalBookings = 0;
  let totalDiscount = 0;
  for (const r of redemptions.values()) {
    totalBookings += r.bookings;
    totalDiscount += r.discount ?? 0;
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow eyebrow-accent">Pricing</span>
          <h1>Promotions</h1>
          <p className="muted" style={{ margin: 0, maxWidth: '60ch' }}>
            A promotion is a rule, not a hand-edited price. The list price is never
            overwritten, so &ldquo;was / now&rdquo; stays honest and every offer expires
            by itself on the date you set.
          </p>
        </div>
        <div className="cluster cluster-sm">
          <Link className="btn btn-secondary" href="/deals">
            View public deals page
          </Link>
          <Link className="btn btn-primary" href="/admin/promotions/new">
            New promotion
          </Link>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 'var(--s6)' }}>
        <div className="kpi kpi-good">
          <span className="kpi-label">Live right now</span>
          <span className="kpi-value">{liveCount}</span>
          <span className="kpi-note">
            {automaticLive} applied automatically, {liveCount - automaticLive} need a code
          </span>
        </div>
        <div className="kpi kpi-accent">
          <span className="kpi-label">Scheduled</span>
          <span className="kpi-value">{scheduledCount}</span>
          <span className="kpi-note">Written, dated, waiting to open</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Redemptions</span>
          <span className="kpi-value">{totalBookings}</span>
          <span className="kpi-note">Bookings that carried a discount</span>
        </div>
        <div className="kpi kpi-warn">
          <span className="kpi-label">Discount given</span>
          <span className="kpi-value">{formatMoney(totalDiscount)}</span>
          <span className="kpi-note">Across every non-cancelled booking</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p>
              No promotions yet. The first one takes about a minute: name it, choose a
              percentage, decide whether it needs a code, and set an end date.
            </p>
            <Link className="btn btn-primary" href="/admin/promotions/new">
              Create the first promotion
            </Link>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Promotion</th>
                <th scope="col">Discount</th>
                <th scope="col">Unlocked by</th>
                <th scope="col">Applies to</th>
                <th scope="col">Live window</th>
                <th scope="col" className="num">
                  Usage
                </th>
                <th scope="col" className="num">
                  Priority
                </th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ promotion: p, phase }) => {
                const used = redemptions.get(p.id);
                const conditions = conditionsLabel(p);

                return (
                  <tr key={p.id}>
                    <td>
                      <div className="stack stack-sm">
                        <Link
                          href={`/admin/promotions/${p.id}`}
                          style={{ fontWeight: 600 }}
                        >
                          {p.name}
                        </Link>
                        {p.badge_text && (
                          <span>
                            <span className="badge badge-promo">{p.badge_text}</span>
                          </span>
                        )}
                        {conditions.length > 0 && (
                          <span className="hint">{conditions.join(' · ')}</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="price-now" style={{ fontSize: '1.05rem' }}>
                        {p.type === 'percentage'
                          ? `${p.value}%`
                          : formatMoney(p.value)}
                      </span>
                      <br />
                      <span className="hint">
                        {p.type === 'percentage' ? 'of the basket' : 'off the total'}
                      </span>
                    </td>

                    <td>
                      {p.code ? (
                        <span className="mono">{p.code}</span>
                      ) : (
                        <em className="muted">Automatic</em>
                      )}
                    </td>

                    <td>{scopeLabel(p)}</td>

                    <td>
                      <div className="stack stack-sm">
                        <span className="tabular" style={{ whiteSpace: 'nowrap' }}>
                          {fmtDate(p.starts_at)} → {fmtDate(p.ends_at)}
                        </span>
                        <span>
                          <span className={PHASE_BADGE[phase]}>{phase}</span>
                        </span>
                      </div>
                    </td>

                    <td className="num">
                      <span className="tabular">
                        {p.usage_count} / {p.usage_limit ?? '∞'}
                      </span>
                      <br />
                      <span className="hint">
                        {p.usage_limit === null ? 'unlimited' : 'capped'}
                        {used ? ` · ${formatMoney(used.discount ?? 0)}` : ''}
                      </span>
                    </td>

                    <td className="num tabular">{p.priority}</td>

                    <td>
                      <span
                        className="mono muted"
                        style={{ textTransform: 'capitalize' }}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td>
                      <Link
                        className="btn btn-sm btn-secondary"
                        href={`/admin/promotions/${p.id}`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="hint" style={{ marginTop: 'var(--s5)', maxWidth: '70ch' }}>
        When two promotions are eligible for the same booking, Atlas applies whichever
        one saves the customer more; priority only breaks ties. Percentage discounts are
        never stacked on purpose — 20% and 20% is 36%, and nobody expects that number on
        an invoice.
      </p>
    </>
  );
}
