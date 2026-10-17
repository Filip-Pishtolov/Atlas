'use client';

import { useState } from 'react';
import type { ItineraryDay } from '@/lib/types';

export default function ItineraryList({ days }: { days: ItineraryDay[] }) {
  const [open, setOpen] = useState<number[]>(days.length > 0 ? [days[0].id] : []);

  if (days.length === 0) {
    return (
      <div className="empty-state">
        <p>
          The day-by-day plan for this trip is being finalised with our local
          guides. Ask us for the current draft and we will send it over.
        </p>
      </div>
    );
  }

  const allOpen = open.length === days.length;

  function toggle(id: number) {
    setOpen((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="stack">
      <div className="cluster cluster-sm">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setOpen(allOpen ? [] : days.map((d) => d.id))}
        >
          {allOpen ? 'Collapse all days' : 'Expand all days'}
        </button>
        <span className="hint">
          {days.length} days, {days.length - 1} nights
        </span>
      </div>

      <ol className="stack stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {days.map((day) => {
          const isOpen = open.includes(day.id);
          const panelId = `itinerary-day-${day.id}`;

          return (
            <li key={day.id} className="card">
              <h3 style={{ margin: 0, font: 'inherit' }}>
                <button
                  type="button"
                  className="between"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(day.id)}
                  style={{
                    width: '100%',
                    padding: 'var(--s4)',
                    background: 'none',
                    border: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'inherit',
                    font: 'inherit',
                  }}
                >
                  <span className="cluster cluster-sm">
                    <span className="badge badge-neutral">
                      Day {day.day_number}
                    </span>
                    <span style={{ fontWeight: 600 }}>{day.title}</span>
                  </span>
                  <span className="muted" aria-hidden="true" style={{ fontSize: '1.1rem' }}>
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
              </h3>

              <div id={panelId} hidden={!isOpen}>
                <div
                  className="stack stack-sm"
                  style={{ padding: '0 var(--s4) var(--s4)' }}
                >
                  <p className="muted" style={{ margin: 0 }}>
                    {day.description}
                  </p>

                  {(day.meals || day.accommodation) && (
                    <dl className="meta-list">
                      {day.meals && (
                        <div className="meta-item">
                          <dt>Meals included</dt>
                          <dd>{day.meals}</dd>
                        </div>
                      )}
                      {day.accommodation && (
                        <div className="meta-item">
                          <dt>Overnight</dt>
                          <dd>{day.accommodation}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
