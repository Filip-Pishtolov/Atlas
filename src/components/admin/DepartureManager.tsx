'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import DataTable, { OccupancyBar, StatusBadge } from './DataTable';
import { centsToEuroInput, formatMoney, parseEurosToCents } from '@/lib/money';
import type { DepartureStatus } from '@/lib/types';

export interface DepartureRow {
  id: number;
  tour_id: number;
  tour_title: string;
  start_date: string;
  end_date: string;
  price_cents: number;
  seats_total: number;
  seats_booked: number;
  status: DepartureStatus;
}

export interface DepartureTourOption {
  id: number;
  title: string;
  duration_days: number;
  base_price_cents: number;
}

interface RowEdit {
  price_euros: string;
  seats_total: string;
  status: DepartureStatus;
}

const STATUSES: { value: DepartureStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'guaranteed', label: 'Guaranteed' },
  { value: 'sold_out', label: 'Sold out' },
  { value: 'cancelled', label: 'Cancelled' },
];

const DATE = new Intl.DateTimeFormat('en-IE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function fmtDate(value: string): string {
  const d = new Date(value.slice(0, 10) + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? value : DATE.format(d);
}

function endDateFor(startDate: string, durationDays: number): string {
  if (!startDate) return '';
  const d = new Date(startDate + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + Math.max(0, durationDays - 1));
  return d.toISOString().slice(0, 10);
}

function daysFromToday(startDate: string): number {
  const start = new Date(startDate + 'T00:00:00Z').getTime();
  const now = new Date();
  const base = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.floor((start - base) / 86_400_000);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DepartureManager({
  tours,
  departures,
  initialTourFilter,
}: {
  tours: DepartureTourOption[];
  departures: DepartureRow[];
  initialTourFilter?: number | null;
}) {
  const router = useRouter();

  const [tourFilter, setTourFilter] = useState<string>(
    initialTourFilter ? String(initialTourFilter) : 'all',
  );
  const [edits, setEdits] = useState<Record<number, RowEdit>>({});
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [addTour, setAddTour] = useState<string>(
    initialTourFilter ? String(initialTourFilter) : '',
  );
  const [addStart, setAddStart] = useState<string>('');
  const [addPrice, setAddPrice] = useState<string>('');
  const [addSeats, setAddSeats] = useState<string>('16');
  const [adding, setAdding] = useState(false);

  const visible = useMemo(
    () =>
      tourFilter === 'all'
        ? departures
        : departures.filter((d) => String(d.tour_id) === tourFilter),
    [departures, tourFilter],
  );

  const addTourMeta = tours.find((t) => String(t.id) === addTour) ?? null;
  const addEnd = addTourMeta ? endDateFor(addStart, addTourMeta.duration_days) : '';

  function draftFor(row: DepartureRow): RowEdit {
    return (
      edits[row.id] ?? {
        price_euros: centsToEuroInput(row.price_cents),
        seats_total: String(row.seats_total),
        status: row.status,
      }
    );
  }

  function setDraft(row: DepartureRow, patch: Partial<RowEdit>) {
    setEdits((e) => ({ ...e, [row.id]: { ...draftFor(row), ...patch } }));
  }

  function isDirty(row: DepartureRow): boolean {
    const d = edits[row.id];
    if (!d) return false;
    return (
      parseEurosToCents(d.price_euros) !== row.price_cents ||
      Number(d.seats_total) !== row.seats_total ||
      d.status !== row.status
    );
  }

  function resetRow(id: number) {
    setEdits((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
  }

  async function saveRow(row: DepartureRow) {
    const draft = draftFor(row);
    const cents = parseEurosToCents(draft.price_euros);
    const seats = Number(draft.seats_total);

    setError(null);
    setNotice(null);

    if (cents === null || cents <= 0) {
      setError(`Departure ${fmtDate(row.start_date)}: enter a price in euros.`);
      return;
    }
    if (!Number.isInteger(seats) || seats < 1) {
      setError(
        `Departure ${fmtDate(row.start_date)}: seats must be a whole number of 1 or more.`,
      );
      return;
    }
    if (seats < row.seats_booked) {
      setError(
        `Departure ${fmtDate(row.start_date)} already has ${row.seats_booked} seats booked. ` +
          'Cancel a booking before shrinking the group.',
      );
      return;
    }

    setBusyRow(row.id);
    try {
      const res = await fetch(`/api/admin/departures/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_cents: cents,
          seats_total: seats,
          status: draft.status,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'That departure could not be saved.');
        setBusyRow(null);
        return;
      }
      resetRow(row.id);
      setNotice(
        `${row.tour_title} on ${fmtDate(row.start_date)} updated.` +
          (cents !== row.price_cents
            ? ` Price change recorded: ${formatMoney(row.price_cents)} → ${formatMoney(cents)}.`
            : ''),
      );
      router.refresh();
    } catch {
      setError('The server could not be reached. Nothing was saved.');
    }
    setBusyRow(null);
  }

  async function deleteRow(row: DepartureRow) {
    const warning =
      row.seats_booked > 0
        ? `${row.seats_booked} traveller${row.seats_booked === 1 ? ' is' : 's are'} booked on this date. ` +
          'Deleting it destroys that link. Set the status to Cancelled instead unless you are certain.\n\n'
        : '';
    if (
      !window.confirm(
        `${warning}Delete the ${fmtDate(row.start_date)} departure of ${row.tour_title}?`,
      )
    ) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusyRow(row.id);
    try {
      const res = await fetch(`/api/admin/departures/${row.id}`, {
        method: 'DELETE',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'That departure could not be deleted.');
        setBusyRow(null);
        return;
      }
      resetRow(row.id);
      setNotice(`${fmtDate(row.start_date)} departure deleted.`);
      router.refresh();
    } catch {
      setError('The server could not be reached. Nothing was deleted.');
    }
    setBusyRow(null);
  }

  async function addDeparture(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!addTourMeta) {
      setError('Choose which tour the new date belongs to.');
      return;
    }
    if (!addStart) {
      setError('Pick a start date.');
      return;
    }
    if (daysFromToday(addStart) < 0) {
      setError('That start date is in the past.');
      return;
    }
    const cents = parseEurosToCents(addPrice);
    if (cents === null || cents <= 0) {
      setError('Enter a price in euros for the new departure.');
      return;
    }
    const seats = Number(addSeats);
    if (!Number.isInteger(seats) || seats < 1) {
      setError('Seats must be a whole number of 1 or more.');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/admin/departures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tour_id: addTourMeta.id,
          start_date: addStart,
          end_date: addEnd,
          price_cents: cents,
          seats_total: seats,
          status: 'open',
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'The departure could not be created.');
        setAdding(false);
        return;
      }
      setNotice(
        `${addTourMeta.title} added for ${fmtDate(addStart)}, returning ${fmtDate(addEnd)}.`,
      );
      setAddStart('');
      setAddPrice('');
      setAddSeats('16');
      router.refresh();
    } catch {
      setError('The server could not be reached. Nothing was created.');
    }
    setAdding(false);
  }

  return (
    <div className="stack stack-lg">
      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="alert alert-good" role="status">
          {notice}
        </div>
      ) : null}

      <form onSubmit={addDeparture} className="card card-pad stack">
        <h2 style={{ fontSize: '1.15rem' }}>Add a departure</h2>
        <p className="hint">
          The return date is worked out from the tour&rsquo;s duration, so a
          seven-day tour leaving on a Saturday comes home the following Friday.
        </p>

        <div className="form-grid">
          <div className="field span-2">
            <label className="label" htmlFor="add-tour">
              Tour
            </label>
            <select
              id="add-tour"
              className="select"
              value={addTour}
              onChange={(e) => {
                setAddTour(e.target.value);
                const meta = tours.find((t) => String(t.id) === e.target.value);
                if (meta && !addPrice) {
                  setAddPrice(centsToEuroInput(meta.base_price_cents));
                }
              }}
            >
              <option value="">Choose a tour…</option>
              {tours.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.duration_days} days)
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor="add-start">
              Start date
            </label>
            <input
              id="add-start"
              type="date"
              className="input"
              min={todayIso()}
              value={addStart}
              onChange={(e) => setAddStart(e.target.value)}
            />
          </div>

          <div className="field">
            <span className="label">Returns</span>
            <p className="input tabular" style={{ color: addEnd ? 'var(--ink)' : 'var(--muted)' }}>
              {addEnd ? fmtDate(addEnd) : 'Pick a tour and a start date'}
            </p>
          </div>

          <div className="field">
            <label className="label" htmlFor="add-price">
              Price per person (€)
            </label>
            <input
              id="add-price"
              inputMode="decimal"
              className="input"
              value={addPrice}
              onChange={(e) => setAddPrice(e.target.value)}
              placeholder="1299.00"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="add-seats">
              Seats
            </label>
            <input
              id="add-seats"
              type="number"
              min={1}
              className="input"
              value={addSeats}
              onChange={(e) => setAddSeats(e.target.value)}
            />
          </div>
        </div>

        <div className="cluster">
          <button type="submit" className="btn btn-primary" disabled={adding}>
            {adding ? 'Adding…' : 'Add departure'}
          </button>
          <span className="hint">
            New dates go on sale as <strong>Open</strong>. Mark one{' '}
            <strong>Guaranteed</strong> once it has passed the minimum group
            size — it is the single strongest thing you can put on a tour page.
          </span>
        </div>
      </form>

      <div className="stack">
        <div className="between">
          <div className="field" style={{ flex: '0 1 320px' }}>
            <label className="label" htmlFor="tour-filter">
              Filter by tour
            </label>
            <select
              id="tour-filter"
              className="select"
              value={tourFilter}
              onChange={(e) => setTourFilter(e.target.value)}
            >
              <option value="all">All tours ({departures.length})</option>
              {tours.map((t) => {
                const n = departures.filter((d) => d.tour_id === t.id).length;
                return (
                  <option key={t.id} value={t.id}>
                    {t.title} ({n})
                  </option>
                );
              })}
            </select>
          </div>
          <p className="hint" style={{ maxWidth: '38ch' }}>
            Changing a price writes a row to <span className="mono">price_history</span>{' '}
            with your name against it, so the old price is never lost.
          </p>
        </div>

        {visible.length === 0 ? (
          <div className="card empty-state">
            <p>
              {tourFilter === 'all'
                ? 'No upcoming departures at all. Add the first date above — a tour with no dates cannot be booked.'
                : 'That tour has no upcoming dates. Add one above.'}
            </p>
          </div>
        ) : (
          <DataTable
            columns={[
              { key: 'tour', label: 'Tour' },
              { key: 'dates', label: 'Dates' },
              { key: 'lead', label: 'Lead', align: 'right' },
              { key: 'price', label: 'Price (€)', align: 'right' },
              { key: 'seats', label: 'Seats', align: 'right' },
              { key: 'occupancy', label: 'Occupancy' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: 'Actions', align: 'right' },
            ]}
          >
            {visible.map((row) => {
              const draft = draftFor(row);
              const dirty = isDirty(row);
              const rowBusy = busyRow === row.id;
              const lead = daysFromToday(row.start_date);

              return (
                <tr key={row.id}>
                  <td>{row.tour_title}</td>
                  <td>
                    <div className="stack stack-sm" style={{ gap: '2px' }}>
                      <span className="tabular">{fmtDate(row.start_date)}</span>
                      <span className="muted tabular" style={{ fontSize: '0.78rem' }}>
                        to {fmtDate(row.end_date)}
                      </span>
                    </div>
                  </td>
                  <td className="num tabular">
                    <span
                      style={{
                        color: lead <= 21 ? 'var(--danger)' : 'var(--ink-2)',
                      }}
                    >
                      {lead}d
                    </span>
                  </td>
                  <td className="num">
                    <input
                      className="input tabular"
                      inputMode="decimal"
                      style={{ width: '110px', textAlign: 'right' }}
                      value={draft.price_euros}
                      onChange={(e) =>
                        setDraft(row, { price_euros: e.target.value })
                      }
                      aria-label={`Price for ${row.tour_title} on ${row.start_date}`}
                    />
                  </td>
                  <td className="num">
                    <input
                      className="input tabular"
                      type="number"
                      min={row.seats_booked || 1}
                      style={{ width: '80px', textAlign: 'right' }}
                      value={draft.seats_total}
                      onChange={(e) =>
                        setDraft(row, { seats_total: e.target.value })
                      }
                      aria-label={`Total seats for ${row.tour_title} on ${row.start_date}`}
                    />
                  </td>
                  <td>
                    <OccupancyBar
                      booked={row.seats_booked}
                      total={row.seats_total}
                    />
                  </td>
                  <td>
                    <select
                      className="select"
                      style={{ minWidth: '140px' }}
                      value={draft.status}
                      onChange={(e) =>
                        setDraft(row, {
                          status: e.target.value as DepartureStatus,
                        })
                      }
                      aria-label={`Status for ${row.tour_title} on ${row.start_date}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {!dirty ? (
                      <div style={{ marginTop: '4px' }}>
                        <StatusBadge status={row.status} />
                      </div>
                    ) : null}
                  </td>
                  <td className="num">
                    <div
                      className="cluster cluster-sm"
                      style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}
                    >
                      {dirty ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => saveRow(row)}
                            disabled={rowBusy}
                          >
                            {rowBusy ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => resetRow(row.id)}
                            disabled={rowBusy}
                          >
                            Reset
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteRow(row)}
                          disabled={rowBusy}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>
    </div>
  );
}
