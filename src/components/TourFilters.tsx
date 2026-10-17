'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { Destination, Theme } from '@/lib/types';

type Option = { value: string; label: string };

const DURATION_OPTIONS: Option[] = [
  { value: '1-6', label: 'Short break (1–6 days)' },
  { value: '7-9', label: 'A week or so (7–9 days)' },
  { value: '10+', label: 'Long journey (10+ days)' },
];

const DIFFICULTY_OPTIONS: Option[] = [
  { value: 'easy', label: 'Easy — gentle walking' },
  { value: 'moderate', label: 'Moderate — full days' },
  { value: 'challenging', label: 'Challenging — long hikes' },
  { value: 'tough', label: 'Tough — high altitude' },
];

const PRICE_OPTIONS: Option[] = [
  { value: '90000', label: 'Under €900' },
  { value: '130000', label: 'Under €1,300' },
  { value: '180000', label: 'Under €1,800' },
  { value: '250000', label: 'Under €2,500' },
];

const SORT_OPTIONS: Option[] = [
  { value: 'popular', label: 'Most popular' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'duration_asc', label: 'Duration: shortest first' },
  { value: 'soonest', label: 'Departing soonest' },
];

function labelFor(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export default function TourFilters({
  destinations,
  themes,
}: {
  destinations: Destination[];
  themes: Theme[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const current = (key: string): string => searchParams.get(key) ?? '';

  function push(next: URLSearchParams) {
    next.delete('page');
    const qs = next.toString();
    router.push(qs ? `/tours?${qs}` : '/tours', { scroll: false });
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  function onSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setParam('search', String(data.get('search') ?? '').trim());
  }

  const active: { key: string; label: string }[] = [];
  if (current('destination')) {
    active.push({
      key: 'destination',
      label: `Destination: ${
        destinations.find((d) => d.slug === current('destination'))?.name ??
        current('destination')
      }`,
    });
  }
  if (current('theme')) {
    active.push({
      key: 'theme',
      label: `Theme: ${
        themes.find((t) => t.slug === current('theme'))?.name ?? current('theme')
      }`,
    });
  }
  if (current('difficulty')) {
    active.push({
      key: 'difficulty',
      label: `Pace: ${current('difficulty')}`,
    });
  }
  if (current('duration')) {
    active.push({
      key: 'duration',
      label: labelFor(DURATION_OPTIONS, current('duration')),
    });
  }
  if (current('maxPrice')) {
    active.push({
      key: 'maxPrice',
      label: labelFor(PRICE_OPTIONS, current('maxPrice')),
    });
  }
  if (current('search')) {
    active.push({ key: 'search', label: `Search: “${current('search')}”` });
  }

  return (
    <form
      className="card card-pad stack"
      onSubmit={onSearchSubmit}
      aria-label="Filter tours"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 'var(--s4)',
        }}
      >
        <div className="field">
          <label className="label" htmlFor="f-search">
            Keyword
          </label>
          <input
            id="f-search"
            name="search"
            type="search"
            className="input"
            placeholder="Atlas Mountains, Crete…"
            key={current('search')}
            defaultValue={current('search')}
          />
          <span className="hint">Press Enter to search</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="f-destination">
            Destination
          </label>
          <select
            id="f-destination"
            className="select"
            value={current('destination')}
            onChange={(e) => setParam('destination', e.target.value)}
          >
            <option value="">Anywhere</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.slug}>
                {d.name} · {d.country}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="f-theme">
            Travel style
          </label>
          <select
            id="f-theme"
            className="select"
            value={current('theme')}
            onChange={(e) => setParam('theme', e.target.value)}
          >
            <option value="">Any style</option>
            {themes.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="f-difficulty">
            Pace
          </label>
          <select
            id="f-difficulty"
            className="select"
            value={current('difficulty')}
            onChange={(e) => setParam('difficulty', e.target.value)}
          >
            <option value="">Any pace</option>
            {DIFFICULTY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="f-duration">
            Trip length
          </label>
          <select
            id="f-duration"
            className="select"
            value={current('duration')}
            onChange={(e) => setParam('duration', e.target.value)}
          >
            <option value="">Any length</option>
            {DURATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="f-price">
            Budget
          </label>
          <select
            id="f-price"
            className="select"
            value={current('maxPrice')}
            onChange={(e) => setParam('maxPrice', e.target.value)}
          >
            <option value="">Any price</option>
            {PRICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="f-sort">
            Sort by
          </label>
          <select
            id="f-sort"
            className="select"
            value={current('sort') || 'popular'}
            onChange={(e) =>
              setParam('sort', e.target.value === 'popular' ? '' : e.target.value)
            }
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button type="submit" className="sr-only">
        Apply keyword search
      </button>

      {active.length > 0 && (
        <>
          <hr className="divider" style={{ margin: 0 }} />
          <div className="cluster cluster-sm">
            <span className="eyebrow" style={{ margin: 0 }}>
              Filtering by
            </span>
            {active.map((f) => (
              <button
                key={f.key}
                type="button"
                className="chip active"
                aria-label={`Remove filter ${f.label}`}
                onClick={() => setParam(f.key, '')}
              >
                <span>{f.label}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => push(new URLSearchParams())}
            >
              Clear all
            </button>
          </div>
        </>
      )}
    </form>
  );
}
