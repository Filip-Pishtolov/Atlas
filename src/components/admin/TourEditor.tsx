'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { centsToEuroInput, parseEurosToCents } from '@/lib/money';
import type {
  Destination,
  Difficulty,
  Theme,
  TourStatus,
} from '@/lib/types';

export interface TourEditorInitial {
  title: string;
  slug: string;
  destination_id: number;
  summary: string;
  description: string;
  duration_days: number;
  difficulty: Difficulty;
  group_size_min: number;
  group_size_max: number;
  base_price_cents: number;
  hero_image: string;
  meeting_point: string | null;
  status: TourStatus;
  is_featured: number | boolean;
  theme_ids: number[];
  itinerary: {
    title: string;
    description: string;
    meals: string | null;
    accommodation: string | null;
  }[];
  images: { url: string; alt: string }[];
  included: string[];
  excluded: string[];
}

interface DayDraft {
  title: string;
  description: string;
  meals: string;
  accommodation: string;
}

interface ImageDraft {
  url: string;
  alt: string;
}

interface FormState {
  title: string;
  slug: string;
  destination_id: string;
  summary: string;
  description: string;
  duration_days: string;
  difficulty: Difficulty;
  group_size_min: string;
  group_size_max: string;
  price_euros: string;
  hero_image: string;
  meeting_point: string;
  status: TourStatus;
  is_featured: boolean;
  theme_ids: number[];
  itinerary: DayDraft[];
  images: ImageDraft[];
  included: string[];
  excluded: string[];
}

type Tab = 'basics' | 'itinerary' | 'media';

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy — short days, no altitude' },
  { value: 'moderate', label: 'Moderate — 4–6 hours walking' },
  { value: 'challenging', label: 'Challenging — long days, rough ground' },
  { value: 'tough', label: 'Tough — high altitude or remote' },
];

const STATUSES: { value: TourStatus; label: string }[] = [
  { value: 'draft', label: 'Draft — invisible to the public' },
  { value: 'published', label: 'Published — live on the site' },
  { value: 'sold_out', label: 'Sold out — visible, not bookable' },
  { value: 'retired', label: 'Retired — archived' },
];

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'media', label: 'Media & details' },
];

const FIELD_TAB: Record<string, Tab> = {
  title: 'basics',
  slug: 'basics',
  destination_id: 'basics',
  summary: 'basics',
  description: 'basics',
  duration_days: 'basics',
  group_size: 'basics',
  base_price: 'basics',
  hero_image: 'basics',
  itinerary: 'itinerary',
  images: 'media',
  facts: 'media',
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function emptyForm(): FormState {
  return {
    title: '',
    slug: '',
    destination_id: '',
    summary: '',
    description: '',
    duration_days: '7',
    difficulty: 'moderate',
    group_size_min: '4',
    group_size_max: '14',
    price_euros: '',
    hero_image: '',
    meeting_point: '',
    status: 'draft',
    is_featured: false,
    theme_ids: [],
    itinerary: [],
    images: [],
    included: [],
    excluded: [],
  };
}

function fromInitial(initial: TourEditorInitial): FormState {
  return {
    title: initial.title,
    slug: initial.slug,
    destination_id: String(initial.destination_id),
    summary: initial.summary,
    description: initial.description,
    duration_days: String(initial.duration_days),
    difficulty: initial.difficulty,
    group_size_min: String(initial.group_size_min),
    group_size_max: String(initial.group_size_max),
    price_euros: centsToEuroInput(initial.base_price_cents),
    hero_image: initial.hero_image,
    meeting_point: initial.meeting_point ?? '',
    status: initial.status,
    is_featured: Boolean(initial.is_featured),
    theme_ids: [...initial.theme_ids],
    itinerary: initial.itinerary.map((d) => ({
      title: d.title,
      description: d.description,
      meals: d.meals ?? '',
      accommodation: d.accommodation ?? '',
    })),
    images: initial.images.map((i) => ({ url: i.url, alt: i.alt })),
    included: [...initial.included],
    excluded: [...initial.excluded],
  };
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function TourEditor({
  mode,
  tourId,
  destinations,
  themes,
  initial,
}: {
  mode: 'create' | 'edit';
  tourId?: number;
  destinations: Destination[];
  themes: Theme[];
  initial?: TourEditorInitial;
}) {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(() =>
    initial ? fromInitial(initial) : emptyForm(),
  );
  const [tab, setTab] = useState<Tab>('basics');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [slugLocked, setSlugLocked] = useState(mode === 'edit');

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onTitleChange(value: string) {
    setForm((f) => ({
      ...f,
      title: value,
      slug: slugLocked ? f.slug : slugify(value),
    }));
  }

  function toggleTheme(id: number) {
    setForm((f) => ({
      ...f,
      theme_ids: f.theme_ids.includes(id)
        ? f.theme_ids.filter((t) => t !== id)
        : [...f.theme_ids, id],
    }));
  }

  function addDay() {
    setForm((f) => ({
      ...f,
      itinerary: [
        ...f.itinerary,
        { title: '', description: '', meals: '', accommodation: '' },
      ],
    }));
  }

  function updateDay(index: number, patch: Partial<DayDraft>) {
    setForm((f) => ({
      ...f,
      itinerary: f.itinerary.map((d, i) =>
        i === index ? { ...d, ...patch } : d,
      ),
    }));
  }

  function removeDay(index: number) {
    setForm((f) => ({
      ...f,
      itinerary: f.itinerary.filter((_, i) => i !== index),
    }));
  }

  function moveDay(index: number, delta: number) {
    setForm((f) => ({ ...f, itinerary: move(f.itinerary, index, index + delta) }));
  }

  function addImage() {
    setForm((f) => ({ ...f, images: [...f.images, { url: '', alt: '' }] }));
  }

  function updateImage(index: number, patch: Partial<ImageDraft>) {
    setForm((f) => ({
      ...f,
      images: f.images.map((img, i) => (i === index ? { ...img, ...patch } : img)),
    }));
  }

  function removeImage(index: number) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));
  }

  function moveImage(index: number, delta: number) {
    setForm((f) => ({ ...f, images: move(f.images, index, index + delta) }));
  }

  function addFact(kind: 'included' | 'excluded') {
    setForm((f) => ({ ...f, [kind]: [...f[kind], ''] }));
  }

  function updateFact(kind: 'included' | 'excluded', index: number, text: string) {
    setForm((f) => ({
      ...f,
      [kind]: f[kind].map((t, i) => (i === index ? text : t)),
    }));
  }

  function removeFact(kind: 'included' | 'excluded', index: number) {
    setForm((f) => ({ ...f, [kind]: f[kind].filter((_, i) => i !== index) }));
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};

    if (!form.title.trim()) e.title = 'Give the tour a title.';
    if (!form.slug.trim()) {
      e.slug = 'A slug is required — it becomes the public URL.';
    } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug)) {
      e.slug = 'Lower-case letters, numbers and single hyphens only.';
    }
    if (!form.destination_id) e.destination_id = 'Pick a destination.';
    if (form.summary.trim().length < 20) {
      e.summary = 'Write at least a full sentence — this is the card copy.';
    }
    if (form.description.trim().length < 40) {
      e.description = 'The description carries the tour page. Write it properly.';
    }

    const days = Number(form.duration_days);
    if (!Number.isInteger(days) || days < 1) {
      e.duration_days = 'Duration must be a whole number of days, at least 1.';
    }

    const min = Number(form.group_size_min);
    const max = Number(form.group_size_max);
    if (!Number.isInteger(min) || min < 1 || !Number.isInteger(max) || max < 1) {
      e.group_size = 'Group sizes must be whole numbers of 1 or more.';
    } else if (min > max) {
      e.group_size = 'The minimum group size cannot exceed the maximum.';
    }

    const cents = parseEurosToCents(form.price_euros);
    if (cents === null || cents <= 0) {
      e.base_price = 'Enter a price in euros, for example 1299 or 1299.50.';
    }

    if (!form.hero_image.trim()) {
      e.hero_image = 'A hero image URL is required.';
    }

    if (form.itinerary.some((d) => !d.title.trim() || !d.description.trim())) {
      e.itinerary = 'Every day needs a title and a description.';
    }
    if (form.status === 'published' && form.itinerary.length === 0) {
      e.itinerary = 'A published tour must have a day-by-day itinerary.';
    }

    if (form.images.some((i) => !i.url.trim() || !i.alt.trim())) {
      e.images = 'Every image needs a URL and alt text. Alt text is not optional.';
    }
    if (form.included.some((t) => !t.trim()) || form.excluded.some((t) => !t.trim())) {
      e.facts = 'Remove the blank inclusion lines, or fill them in.';
    }

    return e;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const found = validate();
    setErrors(found);
    const keys = Object.keys(found);
    if (keys.length > 0) {
      const firstTab = FIELD_TAB[keys[0]] ?? 'basics';
      setTab(firstTab);
      setFormError('Some fields need attention before this can be saved.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      destination_id: Number(form.destination_id),
      summary: form.summary.trim(),
      description: form.description.trim(),
      duration_days: Number(form.duration_days),
      difficulty: form.difficulty,
      group_size_min: Number(form.group_size_min),
      group_size_max: Number(form.group_size_max),
      base_price_cents: parseEurosToCents(form.price_euros) ?? 0,
      hero_image: form.hero_image.trim(),
      meeting_point: form.meeting_point.trim() || null,
      status: form.status,
      is_featured: form.is_featured,
      theme_ids: form.theme_ids,
      itinerary: form.itinerary.map((d, i) => ({
        day_number: i + 1,
        title: d.title.trim(),
        description: d.description.trim(),
        meals: d.meals.trim() || null,
        accommodation: d.accommodation.trim() || null,
      })),
      images: form.images.map((img, i) => ({
        url: img.url.trim(),
        alt: img.alt.trim(),
        sort_order: i,
      })),
      facts: [
        ...form.included.map((text, i) => ({
          kind: 'included' as const,
          text: text.trim(),
          sort_order: i,
        })),
        ...form.excluded.map((text, i) => ({
          kind: 'excluded' as const,
          text: text.trim(),
          sort_order: i,
        })),
      ],
    };

    setSaving(true);
    try {
      const res = await fetch(
        mode === 'create' ? '/api/admin/tours' : `/api/admin/tours/${tourId}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFormError(data.error ?? 'The tour could not be saved.');
        setSaving(false);
        return;
      }
      router.push('/admin/tours');
      router.refresh();
    } catch {
      setFormError('The server could not be reached. Nothing was saved.');
      setSaving(false);
    }
  }

  async function onDelete() {
    if (mode !== 'edit' || tourId === undefined) return;
    const ok = window.confirm(
      `Delete "${form.title}"? Its departures, itinerary and photos go with it. ` +
        'If the tour has ever been sold, set it to Retired instead.',
    );
    if (!ok) return;

    setDeleting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/tours/${tourId}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFormError(data.error ?? 'The tour could not be deleted.');
        setDeleting(false);
        return;
      }
      router.push('/admin/tours');
      router.refresh();
    } catch {
      setFormError('The server could not be reached. Nothing was deleted.');
      setDeleting(false);
    }
  }

  const declaredDays = Number(form.duration_days) || 0;
  const dayMismatch =
    form.itinerary.length > 0 && form.itinerary.length !== declaredDays;
  const errorTabs = new Set(
    Object.keys(errors).map((k) => FIELD_TAB[k] ?? 'basics'),
  );
  const busy = saving || deleting;

  return (
    <form onSubmit={onSubmit} className="stack stack-lg">
      <div className="cluster cluster-sm" role="group" aria-label="Editor sections">
        {TAB_LABELS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="chip"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'itinerary' && form.itinerary.length > 0 ? (
              <span className="mono">{form.itinerary.length}</span>
            ) : null}
            {t.id === 'media' && form.images.length > 0 ? (
              <span className="mono">{form.images.length}</span>
            ) : null}
            {errorTabs.has(t.id) ? (
              <span aria-label="has errors" style={{ color: 'var(--danger)' }}>
                !
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {formError ? (
        <div className="alert alert-danger" role="alert">
          {formError}
        </div>
      ) : null}

      {tab === 'basics' ? (
        <div className="card card-pad stack">
          <div className="form-grid">
            <div className="field span-2">
              <label className="label" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                className={errors.title ? 'input input-error' : 'input'}
                value={form.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Peaks of the Balkans, end to end"
              />
              {errors.title ? (
                <p className="error-text">{errors.title}</p>
              ) : null}
            </div>

            <div className="field span-2">
              <label className="label" htmlFor="slug">
                URL slug
              </label>
              <input
                id="slug"
                className={errors.slug ? 'input input-error mono' : 'input mono'}
                value={form.slug}
                onChange={(e) => {
                  setSlugLocked(true);
                  set('slug', e.target.value);
                }}
                placeholder="peaks-of-the-balkans"
              />
              <p className="hint">
                Public address: /tours/{form.slug || 'your-slug'}
                {mode === 'edit'
                  ? ' — changing it breaks existing links and search rankings.'
                  : slugLocked
                    ? ''
                    : ' — following the title until you edit it.'}
              </p>
              {errors.slug ? <p className="error-text">{errors.slug}</p> : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="destination">
                Destination
              </label>
              <select
                id="destination"
                className={errors.destination_id ? 'select input-error' : 'select'}
                value={form.destination_id}
                onChange={(e) => set('destination_id', e.target.value)}
              >
                <option value="">Choose a destination…</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}, {d.country}
                  </option>
                ))}
              </select>
              {errors.destination_id ? (
                <p className="error-text">{errors.destination_id}</p>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="difficulty">
                Difficulty
              </label>
              <select
                id="difficulty"
                className="select"
                value={form.difficulty}
                onChange={(e) => set('difficulty', e.target.value as Difficulty)}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field span-2">
              <label className="label" htmlFor="summary">
                Summary
              </label>
              <textarea
                id="summary"
                className={errors.summary ? 'textarea input-error' : 'textarea'}
                style={{ minHeight: '80px' }}
                value={form.summary}
                onChange={(e) => set('summary', e.target.value)}
                placeholder="One or two sentences. This is what appears on the tour card and in search results."
              />
              {errors.summary ? (
                <p className="error-text">{errors.summary}</p>
              ) : null}
            </div>

            <div className="field span-2">
              <label className="label" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                className={errors.description ? 'textarea input-error' : 'textarea'}
                style={{ minHeight: '200px' }}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="The full pitch: who this trip is for, what the walking is like, what the evenings are like, and what makes it different from every other operator running the same route."
              />
              {errors.description ? (
                <p className="error-text">{errors.description}</p>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="duration">
                Duration (days)
              </label>
              <input
                id="duration"
                type="number"
                min={1}
                max={90}
                className={errors.duration_days ? 'input input-error' : 'input'}
                value={form.duration_days}
                onChange={(e) => set('duration_days', e.target.value)}
              />
              {errors.duration_days ? (
                <p className="error-text">{errors.duration_days}</p>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="price">
                Base price per person (€)
              </label>
              <input
                id="price"
                inputMode="decimal"
                className={errors.base_price ? 'input input-error' : 'input'}
                value={form.price_euros}
                onChange={(e) => set('price_euros', e.target.value)}
                placeholder="1299.00"
              />
              <p className="hint">
                The list price. Individual departures may carry their own price,
                and promotions discount from here — never overwrite this with a
                sale price.
              </p>
              {errors.base_price ? (
                <p className="error-text">{errors.base_price}</p>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="group-min">
                Minimum group size
              </label>
              <input
                id="group-min"
                type="number"
                min={1}
                className={errors.group_size ? 'input input-error' : 'input'}
                value={form.group_size_min}
                onChange={(e) => set('group_size_min', e.target.value)}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="group-max">
                Maximum group size
              </label>
              <input
                id="group-max"
                type="number"
                min={1}
                className={errors.group_size ? 'input input-error' : 'input'}
                value={form.group_size_max}
                onChange={(e) => set('group_size_max', e.target.value)}
              />
              {errors.group_size ? (
                <p className="error-text">{errors.group_size}</p>
              ) : null}
            </div>

            <div className="field span-2">
              <label className="label" htmlFor="hero">
                Hero image URL
              </label>
              <div className="cluster cluster-sm" style={{ flexWrap: 'nowrap' }}>
                <input
                  id="hero"
                  className={errors.hero_image ? 'input input-error' : 'input'}
                  value={form.hero_image}
                  onChange={(e) => set('hero_image', e.target.value)}
                  placeholder="https://picsum.photos/seed/peaks-of-the-balkans/1200/800"
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    set(
                      'hero_image',
                      `https://picsum.photos/seed/${form.slug || 'atlas-tour'}/1200/800`,
                    )
                  }
                >
                  Placeholder
                </button>
              </div>
              {form.hero_image ? (
                <img
                  src={form.hero_image}
                  alt=""
                  width={240}
                  height={160}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: '240px',
                    height: '160px',
                    objectFit: 'cover',
                    borderRadius: 'var(--r)',
                    border: '1px solid var(--line)',
                  }}
                />
              ) : null}
              {errors.hero_image ? (
                <p className="error-text">{errors.hero_image}</p>
              ) : null}
            </div>

            <div className="field span-2">
              <label className="label" htmlFor="meeting">
                Meeting point
              </label>
              <input
                id="meeting"
                className="input"
                value={form.meeting_point}
                onChange={(e) => set('meeting_point', e.target.value)}
                placeholder="Hotel Cardak lobby, Peja, 18:00 on day one"
              />
              <p className="hint">
                Where and when the group actually gathers. Optional, but it
                removes the most common pre-departure email.
              </p>
            </div>

            <div className="field">
              <label className="label" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                className="select"
                value={form.status}
                onChange={(e) => set('status', e.target.value as TourStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <span className="label">Homepage</span>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => set('is_featured', e.target.checked)}
                />
                <span>
                  Feature this tour on the homepage and at the top of listings.
                </span>
              </label>
            </div>
          </div>

          <hr className="divider" />

          <div className="field">
            <span className="label">Themes</span>
            <p className="hint">
              Themes drive the filters on /tours and let a promotion target a
              whole style of trip at once.
            </p>
            {themes.length === 0 ? (
              <p className="muted">
                No themes defined yet. Add them under Destinations first.
              </p>
            ) : (
              <div className="tag-list">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="chip"
                    aria-pressed={form.theme_ids.includes(t.id)}
                    onClick={() => toggleTheme(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'itinerary' ? (
        <div className="stack">
          {dayMismatch ? (
            <div className="alert alert-warn">
              This tour is sold as {declaredDays}{' '}
              {declaredDays === 1 ? 'day' : 'days'} but the itinerary describes{' '}
              {form.itinerary.length}. Travellers notice.
            </div>
          ) : null}

          {errors.itinerary ? (
            <div className="alert alert-danger" role="alert">
              {errors.itinerary}
            </div>
          ) : null}

          {form.itinerary.length === 0 ? (
            <div className="card empty-state stack">
              <p>
                No days yet. The day-by-day itinerary is the part of the page
                people actually read before booking.
              </p>
              <div className="cluster" style={{ justifyContent: 'center' }}>
                <button type="button" className="btn btn-primary" onClick={addDay}>
                  Add day 1
                </button>
              </div>
            </div>
          ) : (
            form.itinerary.map((day, i) => (
              <div key={i} className="card card-pad stack">
                <div className="between">
                  <h3 style={{ fontSize: '1.05rem' }}>
                    <span className="mono muted" style={{ fontSize: '0.72rem' }}>
                      DAY {i + 1}
                    </span>{' '}
                    {day.title || 'Untitled day'}
                  </h3>
                  <div className="cluster cluster-sm">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => moveDay(i, -1)}
                      disabled={i === 0}
                      aria-label={`Move day ${i + 1} earlier`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => moveDay(i, 1)}
                      disabled={i === form.itinerary.length - 1}
                      aria-label={`Move day ${i + 1} later`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeDay(i)}
                      aria-label={`Remove day ${i + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="field span-2">
                    <label className="label" htmlFor={`day-title-${i}`}>
                      Day title
                    </label>
                    <input
                      id={`day-title-${i}`}
                      className="input"
                      value={day.title}
                      onChange={(e) => updateDay(i, { title: e.target.value })}
                      placeholder="Over the Valbona pass to Theth"
                    />
                  </div>

                  <div className="field span-2">
                    <label className="label" htmlFor={`day-desc-${i}`}>
                      What happens
                    </label>
                    <textarea
                      id={`day-desc-${i}`}
                      className="textarea"
                      style={{ minHeight: '110px' }}
                      value={day.description}
                      onChange={(e) =>
                        updateDay(i, { description: e.target.value })
                      }
                      placeholder="Distance, ascent, roughly how long it takes, and what the day feels like."
                    />
                  </div>

                  <div className="field">
                    <label className="label" htmlFor={`day-meals-${i}`}>
                      Meals
                    </label>
                    <input
                      id={`day-meals-${i}`}
                      className="input"
                      value={day.meals}
                      onChange={(e) => updateDay(i, { meals: e.target.value })}
                      placeholder="Breakfast, packed lunch, dinner"
                    />
                  </div>

                  <div className="field">
                    <label className="label" htmlFor={`day-stay-${i}`}>
                      Accommodation
                    </label>
                    <input
                      id={`day-stay-${i}`}
                      className="input"
                      value={day.accommodation}
                      onChange={(e) =>
                        updateDay(i, { accommodation: e.target.value })
                      }
                      placeholder="Guesthouse, twin rooms"
                    />
                  </div>
                </div>
              </div>
            ))
          )}

          {form.itinerary.length > 0 ? (
            <div className="cluster">
              <button type="button" className="btn btn-secondary" onClick={addDay}>
                Add day {form.itinerary.length + 1}
              </button>
              <span className="hint">
                Day numbers renumber themselves when you reorder or remove a day.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'media' ? (
        <div className="stack stack-lg">
          <div className="card card-pad stack">
            <div className="between">
              <h3 style={{ fontSize: '1.05rem' }}>Gallery</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addImage}
              >
                Add image
              </button>
            </div>
            <p className="hint">
              Six to ten photographs sell a trip. Alt text is required — it is
              what a screen reader and a search engine both read.
            </p>

            {errors.images ? (
              <p className="error-text">{errors.images}</p>
            ) : null}

            {form.images.length === 0 ? (
              <div className="empty-state">
                <p>
                  No gallery images yet. The hero alone leaves the tour page
                  looking unfinished.
                </p>
              </div>
            ) : (
              <div className="stack">
                {form.images.map((img, i) => (
                  <div
                    key={i}
                    className="cluster"
                    style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}
                  >
                    {img.url ? (
                      <img
                        src={img.url}
                        alt=""
                        width={96}
                        height={72}
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: '96px',
                          height: '72px',
                          objectFit: 'cover',
                          borderRadius: 'var(--r-sm)',
                          border: '1px solid var(--line)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '96px',
                          height: '72px',
                          borderRadius: 'var(--r-sm)',
                          border: '1px dashed var(--line-strong)',
                          flexShrink: 0,
                        }}
                      />
                    )}

                    <div className="stack stack-sm" style={{ flex: '1 1 auto' }}>
                      <input
                        className="input mono"
                        value={img.url}
                        onChange={(e) => updateImage(i, { url: e.target.value })}
                        placeholder={`https://picsum.photos/seed/${form.slug || 'atlas'}-${i + 1}/1200/800`}
                        aria-label={`Image ${i + 1} URL`}
                      />
                      <input
                        className="input"
                        value={img.alt}
                        onChange={(e) => updateImage(i, { alt: e.target.value })}
                        placeholder="Walkers crossing the ridge above Theth in early light"
                        aria-label={`Image ${i + 1} alt text`}
                      />
                    </div>

                    <div className="cluster cluster-sm" style={{ flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => moveImage(i, -1)}
                        disabled={i === 0}
                        aria-label={`Move image ${i + 1} earlier`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => moveImage(i, 1)}
                        disabled={i === form.images.length - 1}
                        aria-label={`Move image ${i + 1} later`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeImage(i)}
                        aria-label={`Remove image ${i + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errors.facts ? (
            <div className="alert alert-danger" role="alert">
              {errors.facts}
            </div>
          ) : null}

          <div className="grid grid-2">
            <FactList
              kind="included"
              heading="What's included"
              hint="Be specific. 'All accommodation' beats 'accommodation'."
              placeholder="Seven nights' accommodation, twin share"
              items={form.included}
              onAdd={() => addFact('included')}
              onChange={(i, v) => updateFact('included', i, v)}
              onRemove={(i) => removeFact('included', i)}
            />
            <FactList
              kind="excluded"
              heading="What's not included"
              hint="The exclusions prevent the arguments. Name the flights."
              placeholder="International flights to Tirana"
              items={form.excluded}
              onAdd={() => addFact('excluded')}
              onChange={(i, v) => updateFact('excluded', i, v)}
              onRemove={(i) => removeFact('excluded', i)}
            />
          </div>
        </div>
      ) : null}

      <div
        className="card card-pad between"
        style={{ position: 'sticky', bottom: 'var(--s4)', boxShadow: 'var(--shadow-2)' }}
      >
        <div className="stack stack-sm" style={{ gap: '2px' }}>
          <span className="mono muted" style={{ fontSize: '0.7rem' }}>
            {mode === 'create' ? 'NEW TOUR' : `TOUR #${tourId}`}
          </span>
          <span className="hint">
            {form.itinerary.length} day
            {form.itinerary.length === 1 ? '' : 's'} · {form.images.length} photo
            {form.images.length === 1 ? '' : 's'} · {form.included.length}{' '}
            inclusion{form.included.length === 1 ? '' : 's'} ·{' '}
            {form.theme_ids.length} theme
            {form.theme_ids.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="cluster cluster-sm">
          {mode === 'edit' ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={onDelete}
              disabled={busy}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : null}
          <Link href="/admin/tours" className="btn btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {saving
              ? 'Saving…'
              : mode === 'create'
                ? 'Create tour'
                : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  );
}

function FactList({
  kind,
  heading,
  hint,
  placeholder,
  items,
  onAdd,
  onChange,
  onRemove,
}: {
  kind: 'included' | 'excluded';
  heading: string;
  hint: string;
  placeholder: string;
  items: string[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="card card-pad stack">
      <div className="between">
        <h3 style={{ fontSize: '1.05rem' }}>{heading}</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAdd}>
          Add line
        </button>
      </div>
      <p className="hint">{hint}</p>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>Nothing listed yet.</p>
        </div>
      ) : (
        <div className="stack stack-sm">
          {items.map((text, i) => (
            <div key={i} className="cluster cluster-sm" style={{ flexWrap: 'nowrap' }}>
              <input
                className="input"
                value={text}
                onChange={(e) => onChange(i, e.target.value)}
                placeholder={placeholder}
                aria-label={`${heading} line ${i + 1}`}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${kind} line ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
