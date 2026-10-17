import Link from 'next/link';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import Stars from '@/components/Stars';
import { StatusActions } from '@/components/admin/StatusSelect';
import type { ReviewStatus } from '@/lib/types';

export const metadata = { title: 'Reviews' };

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmtDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

const STATUSES: ReviewStatus[] = ['pending', 'approved', 'rejected'];

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge badge-warn',
  approved: 'badge badge-good',
  rejected: 'badge badge-danger',
};

interface Row {
  id: number;
  tour_id: number;
  author_name: string;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  created_at: string;
  booking_id: number | null;
  booking_reference: string | null;
  tour_title: string;
  tour_slug: string;
}

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireRole('admin', 'staff');
  if (!user) redirect('/login?next=/admin/reviews');

  const sp = await searchParams;
  const raw = first(sp.status);
  const status = (STATUSES as string[]).includes(raw) ? raw : '';

  const rows = query<Row>(
    `SELECT r.id, r.tour_id, r.author_name, r.rating, r.title, r.body, r.status,
            r.created_at, r.booking_id,
            b.reference AS booking_reference,
            t.title     AS tour_title,
            t.slug      AS tour_slug
       FROM reviews r
       JOIN tours t ON t.id = r.tour_id
       LEFT JOIN bookings b ON b.id = r.booking_id
      ${status ? 'WHERE r.status = ?' : ''}
      ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
               r.created_at DESC, r.id DESC`,
    ...(status ? [status] : []),
  );

  const counts = new Map(
    query<{ status: string; c: number }>(
      'SELECT status, COUNT(*) AS c FROM reviews GROUP BY status',
    ).map((r) => [r.status, r.c]),
  );
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const pending = counts.get('pending') ?? 0;

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow eyebrow-accent">Moderation</span>
          <h1>Reviews</h1>
          <p className="muted" style={{ margin: 0, maxWidth: '62ch' }}>
            {pending === 0
              ? 'The queue is clear. Nothing is waiting for a decision.'
              : `${pending} ${pending === 1 ? 'review is' : 'reviews are'} waiting for a decision. Only approved reviews count towards a tour's rating.`}
          </p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 'var(--s6)' }}>
        <div className={pending > 0 ? 'kpi kpi-warn' : 'kpi kpi-good'}>
          <span className="kpi-label">Awaiting moderation</span>
          <span className="kpi-value">{pending}</span>
          <span className="kpi-note">Hidden from the public site</span>
        </div>
        <div className="kpi kpi-good">
          <span className="kpi-label">Approved</span>
          <span className="kpi-value">{counts.get('approved') ?? 0}</span>
          <span className="kpi-note">Live on tour pages</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Rejected</span>
          <span className="kpi-value">{counts.get('rejected') ?? 0}</span>
          <span className="kpi-note">Kept for the record</span>
        </div>
        <div className="kpi kpi-accent">
          <span className="kpi-label">Total received</span>
          <span className="kpi-value">{total}</span>
          <span className="kpi-note">Since launch</span>
        </div>
      </div>

      <div className="cluster" style={{ marginBottom: 'var(--s5)' }}>
        <Link className={status === '' ? 'chip active' : 'chip'} href="/admin/reviews">
          All <span className="tabular">{total}</span>
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            className={status === s ? 'chip active' : 'chip'}
            href={`/admin/reviews?status=${s}`}
          >
            <span style={{ textTransform: 'capitalize' }}>{s}</span>{' '}
            <span className="tabular">{counts.get(s) ?? 0}</span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <p className="empty-state">
            {status
              ? 'No review has that status right now.'
              : 'No reviews yet. Travellers can leave one from any tour page once they are back.'}
          </p>
        </div>
      ) : (
        <div className="stack stack-lg">
          {rows.map((r) => (
            <article
              key={r.id}
              className="card card-pad stack"
              style={
                r.status === 'pending'
                  ? { borderLeft: '3px solid var(--warn)' }
                  : undefined
              }
            >
              <div className="between">
                <div className="stack stack-sm">
                  <div className="cluster cluster-sm">
                    <Stars rating={r.rating} showValue={false} />
                    <span className={STATUS_BADGE[r.status] ?? 'badge badge-neutral'}>
                      {r.status}
                    </span>
                    {r.booking_reference ? (
                      <span className="badge badge-good">Verified booking</span>
                    ) : (
                      <span className="badge badge-neutral">Unverified</span>
                    )}
                  </div>
                  <h2 style={{ fontSize: '1.35rem' }}>{r.title}</h2>
                  <p className="hint" style={{ margin: 0 }}>
                    {r.author_name} · {fmtDate(r.created_at)} ·{' '}
                    <Link href={`/tours/${r.tour_slug}`}>{r.tour_title}</Link>
                    {r.booking_reference && (
                      <>
                        {' · '}
                        <span className="mono">{r.booking_reference}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <p className="prose" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {r.body}
              </p>

              <div className="divider" />

              <div className="between">
                <StatusActions
                  endpoint={`/api/admin/reviews/${r.id}`}
                  current={r.status}
                  actions={[
                    { value: 'approved', label: 'Approve', variant: 'primary' },
                    { value: 'rejected', label: 'Reject', variant: 'secondary' },
                    { value: 'pending', label: 'Send back to queue', variant: 'ghost' },
                  ]}
                  deleteConfirm={`Delete the review "${r.title}" by ${r.author_name}? Rejecting it hides it from the site and keeps the record; deleting removes it for good.`}
                />
                <span className="hint">
                  Approving publishes it immediately and recalculates the rating on{' '}
                  {r.tour_title}.
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
