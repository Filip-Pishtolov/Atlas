import Link from 'next/link';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import StatusSelect from '@/components/admin/StatusSelect';
import type { EnquiryStatus } from '@/lib/types';

export const metadata = { title: 'Enquiries' };

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmtDateTime(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  if (!m) return value;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}, ${m[4]}:${m[5]}`;
}

const STATUSES: EnquiryStatus[] = ['new', 'in_progress', 'closed'];

const STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  closed: 'Closed',
};

const STATUS_BADGE: Record<string, string> = {
  new: 'badge badge-warn',
  in_progress: 'badge badge-accent',
  closed: 'badge badge-neutral',
};

const UNREAD_RULE = { borderLeft: '3px solid var(--accent)' };

interface Row {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  tour_id: number | null;
  subject: string;
  message: string;
  status: EnquiryStatus;
  created_at: string;
  tour_title: string | null;
  tour_slug: string | null;
}

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireRole('admin', 'staff');
  if (!user) redirect('/login?next=/admin/enquiries');

  const sp = await searchParams;
  const raw = first(sp.status);
  const status = (STATUSES as string[]).includes(raw) ? raw : '';

  const rows = query<Row>(
    `SELECT e.*, t.title AS tour_title, t.slug AS tour_slug
       FROM enquiries e
       LEFT JOIN tours t ON t.id = e.tour_id
      ${status ? 'WHERE e.status = ?' : ''}
      ORDER BY CASE e.status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
               e.created_at DESC, e.id DESC`,
    ...(status ? [status] : []),
  );

  const counts = new Map(
    query<{ status: string; c: number }>(
      'SELECT status, COUNT(*) AS c FROM enquiries GROUP BY status',
    ).map((r) => [r.status, r.c]),
  );
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const newCount = counts.get('new') ?? 0;

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow eyebrow-accent">Inbox</span>
          <h1>Enquiries</h1>
          <p className="muted" style={{ margin: 0 }}>
            {newCount === 0
              ? 'Nothing waiting. Every enquiry has been picked up.'
              : `${newCount} waiting for a first reply. Atlas answers within one working day.`}
          </p>
        </div>
      </div>

      <div className="cluster" style={{ marginBottom: 'var(--s5)' }}>
        <Link
          className={status === '' ? 'chip active' : 'chip'}
          href="/admin/enquiries"
        >
          All <span className="tabular">{total}</span>
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            className={status === s ? 'chip active' : 'chip'}
            href={`/admin/enquiries?status=${s}`}
          >
            {STATUS_LABEL[s]} <span className="tabular">{counts.get(s) ?? 0}</span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <p className="empty-state">
            {status
              ? 'No enquiry has that status right now.'
              : 'No enquiries yet. Messages sent from the contact form and from any tour page land here.'}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">From</th>
                <th scope="col">Subject and message</th>
                <th scope="col">About</th>
                <th scope="col">Received</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const isNew = e.status === 'new';
                return (
                  <tr key={e.id}>
                    <td style={isNew ? UNREAD_RULE : undefined}>
                      <span style={{ fontWeight: isNew ? 600 : 400 }}>{e.name}</span>
                      <br />
                      <a className="hint" href={`mailto:${e.email}`}>
                        {e.email}
                      </a>
                      {e.phone && (
                        <>
                          <br />
                          <span className="hint mono">{e.phone}</span>
                        </>
                      )}
                    </td>

                    <td style={{ minWidth: '22rem' }}>
                      <details>
                        <summary
                          style={{
                            cursor: 'pointer',
                            fontWeight: isNew ? 600 : 400,
                            color: 'var(--ink)',
                          }}
                        >
                          {e.subject}
                        </summary>
                        <div className="stack stack-sm" style={{ marginTop: 'var(--s3)' }}>
                          <p
                            className="prose"
                            style={{ margin: 0, whiteSpace: 'pre-wrap' }}
                          >
                            {e.message}
                          </p>
                          <div className="cluster cluster-sm">
                            <a
                              className="btn btn-sm btn-primary"
                              href={`mailto:${e.email}?subject=${encodeURIComponent(
                                `Re: ${e.subject}`,
                              )}&body=${encodeURIComponent(
                                `Hello ${e.name.split(' ')[0]},\n\nThank you for getting in touch with Atlas.\n\n`,
                              )}`}
                            >
                              Reply by email
                            </a>
                            {e.tour_slug && (
                              <Link
                                className="btn btn-sm btn-secondary"
                                href={`/tours/${e.tour_slug}`}
                              >
                                Open the tour
                              </Link>
                            )}
                          </div>
                        </div>
                      </details>
                    </td>

                    <td>
                      {e.tour_title ? (
                        e.tour_title
                      ) : (
                        <span className="muted">General enquiry</span>
                      )}
                    </td>

                    <td className="tabular" style={{ whiteSpace: 'nowrap' }}>
                      {fmtDateTime(e.created_at)}
                      <br />
                      <span className={STATUS_BADGE[e.status] ?? 'badge badge-neutral'}>
                        {STATUS_LABEL[e.status]}
                      </span>
                    </td>

                    <td>
                      <StatusSelect
                        endpoint={`/api/admin/enquiries/${e.id}`}
                        value={e.status}
                        label={`Status of the enquiry from ${e.name}`}
                        options={STATUSES.map((s) => ({
                          value: s,
                          label: STATUS_LABEL[s],
                        }))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
