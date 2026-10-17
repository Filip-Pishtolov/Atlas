import type { ReactNode } from 'react';

export interface DataTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export default function DataTable({
  columns,
  children,
}: {
  columns: DataTableColumn[];
  children: ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.align === 'right' ? 'num' : undefined}
                scope="col"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const BADGE_CLASS: Record<string, string> = {
  published: 'badge-good',
  draft: 'badge-neutral',
  sold_out: 'badge-warn',
  retired: 'badge-neutral',
  open: 'badge-accent',
  guaranteed: 'badge-good',
  cancelled: 'badge-danger',
  pending: 'badge-warn',
  confirmed: 'badge-accent',
  paid: 'badge-good',
  completed: 'badge-neutral',
  active: 'badge-good',
  paused: 'badge-warn',
  expired: 'badge-neutral',
  new: 'badge-warn',
  in_progress: 'badge-accent',
  closed: 'badge-neutral',
  rejected: 'badge-danger',
  approved: 'badge-good',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${BADGE_CLASS[status] ?? 'badge-neutral'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function OccupancyBar({
  booked,
  total,
}: {
  booked: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((booked / total) * 100)) : 0;
  const colour =
    pct >= 70 ? 'var(--good)' : pct >= 40 ? 'var(--warn)' : 'var(--danger)';

  return (
    <div style={{ minWidth: '128px' }}>
      <div
        className="between"
        style={{ gap: 'var(--s3)', fontSize: '0.78rem' }}
      >
        <span className="tabular muted">
          {booked}/{total} seats
        </span>
        <span className="tabular" style={{ color: colour, fontWeight: 500 }}>
          {pct}%
        </span>
      </div>
      <div
        role="img"
        aria-label={`${pct} percent booked, ${booked} of ${total} seats`}
        style={{
          height: '6px',
          marginTop: '4px',
          borderRadius: '999px',
          background: 'var(--surface-3)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{ width: `${pct}%`, height: '100%', background: colour }}
        />
      </div>
    </div>
  );
}
