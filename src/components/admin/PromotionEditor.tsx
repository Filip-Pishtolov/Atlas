'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney, parseEurosToCents, centsToEuroInput } from '@/lib/money';
import type { Promotion, PromotionScope, PromotionStatus, PromotionType } from '@/lib/types';

export interface ScopeOption {
  id: number;
  label: string;
}

interface FormState {
  name: string;
  description: string;
  badge_text: string;
  type: PromotionType;
  value: string;
  code: string;
  scope: PromotionScope;
  scope_id: string;
  min_booking: string;
  min_travellers: string;
  min_days_before: string;
  max_days_before: string;
  starts_at: string;
  ends_at: string;
  usage_limit: string;
  per_customer_limit: string;
  priority: string;
  stackable: boolean;
  status: PromotionStatus;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toInputDateTime(sql: string | null | undefined): string {
  if (!sql) return '';
  return sql.replace(' ', 'T').slice(0, 16);
}

function toSqlDateTime(input: string): string {
  if (!input) return '';
  const [date, time = '00:00'] = input.split('T');
  return `${date} ${time.length === 5 ? `${time}:00` : time}`;
}

function prettyDate(input: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!m) return '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

function localDateTimeValue(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function intOrNull(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function intOr(raw: string, fallback: number): number {
  const v = intOrNull(raw);
  return v === null ? fallback : v;
}

function initialState(promotion: Promotion | null | undefined): FormState {
  if (!promotion) {
    return {
      name: '',
      description: '',
      badge_text: '',
      type: 'percentage',
      value: '',
      code: '',
      scope: 'all',
      scope_id: '',
      min_booking: '',
      min_travellers: '1',
      min_days_before: '',
      max_days_before: '',
      starts_at: '',
      ends_at: '',
      usage_limit: '',
      per_customer_limit: '',
      priority: '0',
      stackable: false,
      status: 'draft',
    };
  }

  return {
    name: promotion.name,
    description: promotion.description ?? '',
    badge_text: promotion.badge_text ?? '',
    type: promotion.type,
    value:
      promotion.type === 'percentage'
        ? String(promotion.value)
        : centsToEuroInput(promotion.value),
    code: promotion.code ?? '',
    scope: promotion.scope,
    scope_id: promotion.scope_id === null ? '' : String(promotion.scope_id),
    min_booking:
      promotion.min_booking_cents > 0
        ? centsToEuroInput(promotion.min_booking_cents)
        : '',
    min_travellers: String(promotion.min_travellers),
    min_days_before:
      promotion.min_days_before === null ? '' : String(promotion.min_days_before),
    max_days_before:
      promotion.max_days_before === null ? '' : String(promotion.max_days_before),
    starts_at: toInputDateTime(promotion.starts_at),
    ends_at: toInputDateTime(promotion.ends_at),
    usage_limit: promotion.usage_limit === null ? '' : String(promotion.usage_limit),
    per_customer_limit:
      promotion.per_customer_limit === null ? '' : String(promotion.per_customer_limit),
    priority: String(promotion.priority),
    stackable: promotion.stackable === 1,
    status: promotion.status,
  };
}

export default function PromotionEditor({
  promotion,
  tours,
  destinations,
  themes,
}: {
  promotion?: Promotion | null;
  tours: ScopeOption[];
  destinations: ScopeOption[];
  themes: ScopeOption[];
}) {
  const router = useRouter();
  const isEdit = Boolean(promotion);

  const [form, setForm] = useState<FormState>(() => initialState(promotion));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isEdit) return;
    setForm((f) =>
      f.starts_at || f.ends_at
        ? f
        : { ...f, starts_at: localDateTimeValue(0), ends_at: localDateTimeValue(90) },
    );
  }, [isEdit]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }

  function changeType(next: PromotionType) {
    setForm((f) => ({ ...f, type: next }));
    setErrors((e) => {
      const rest = { ...e };
      delete rest.value;
      return rest;
    });
  }

  const scopeOptions: ScopeOption[] =
    form.scope === 'tour'
      ? tours
      : form.scope === 'destination'
        ? destinations
        : form.scope === 'theme'
          ? themes
          : [];

  const scopeName =
    scopeOptions.find((o) => String(o.id) === form.scope_id)?.label ?? '';

  const normalisedCode = form.code.trim().toUpperCase();

  const sentence = useMemo(() => {
    const amount =
      form.type === 'percentage'
        ? `${form.value.trim() === '' ? '0' : form.value.trim()}% off`
        : `${formatMoney(parseEurosToCents(form.value) ?? 0)} off`;

    const target =
      form.scope === 'all'
        ? 'every Atlas tour'
        : form.scope === 'tour'
          ? scopeName
            ? `the ${scopeName} tour`
            : 'one tour (not chosen yet)'
          : form.scope === 'destination'
            ? scopeName
              ? `every tour in ${scopeName}`
              : 'one destination (not chosen yet)'
            : scopeName
              ? `every ${scopeName} tour`
              : 'one theme (not chosen yet)';

    const parts: string[] = [`${amount} ${target}`];

    const travellers = intOr(form.min_travellers, 1);
    if (travellers > 1) parts.push(`for bookings of ${travellers}+ travellers`);

    const minBooking = parseEurosToCents(form.min_booking);
    if (minBooking && minBooking > 0) {
      parts.push(`on bookings of ${formatMoney(minBooking)} or more`);
    }

    const early = intOrNull(form.min_days_before);
    if (early !== null && early > 0) {
      parts.push(`made at least ${early} days before departure`);
    }

    const late = intOrNull(form.max_days_before);
    if (late !== null && late > 0) {
      parts.push(`made within ${late} days of departure`);
    }

    if (normalisedCode) {
      parts.push(`when the code ${normalisedCode} is entered at checkout`);
    }

    const limit = intOrNull(form.usage_limit);
    if (limit !== null && limit > 0) {
      parts.push(`limited to the first ${limit} bookings`);
    }

    if (form.ends_at) parts.push(`until ${prettyDate(form.ends_at)}`);

    const text = parts.join(', ');
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
  }, [form, scopeName, normalisedCode]);

  const badgePreview =
    form.badge_text.trim() ||
    (form.type === 'percentage'
      ? `-${form.value.trim() || '0'}%`
      : `-${formatMoney(parseEurosToCents(form.value) ?? 0)}`);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};

    if (!form.name.trim()) next.name = 'Give the promotion an internal name.';

    if (form.type === 'percentage') {
      const pct = intOrNull(form.value);
      if (pct === null) next.value = 'Enter a percentage.';
      else if (!/^\d+$/.test(form.value.trim()))
        next.value = 'Use a whole percentage, for example 15.';
      else if (pct < 1 || pct > 100) next.value = 'A percentage must be between 1 and 100.';
    } else {
      const cents = parseEurosToCents(form.value);
      if (cents === null) next.value = 'Enter an amount in euros, for example 150.00';
      else if (cents < 1) next.value = 'A fixed discount must be more than zero.';
    }

    if (form.scope !== 'all' && !form.scope_id) {
      next.scope_id = 'Choose what the promotion applies to.';
    }

    if (form.code.trim() && !/^[A-Z0-9-]{3,24}$/.test(normalisedCode)) {
      next.code = 'Use 3-24 letters, numbers or hyphens, for example ATLAS25.';
    }

    if (form.min_booking.trim() && parseEurosToCents(form.min_booking) === null) {
      next.min_booking = 'Enter an amount in euros, or leave it blank.';
    }

    if (!form.starts_at) next.starts_at = 'Set the date the offer opens.';
    if (!form.ends_at) next.ends_at = 'Set the date the offer closes.';
    if (form.starts_at && form.ends_at && form.ends_at <= form.starts_at) {
      next.ends_at = 'The end must come after the start.';
    }

    const early = intOrNull(form.min_days_before);
    const late = intOrNull(form.max_days_before);
    if (early !== null && late !== null && early > late) {
      next.max_days_before =
        'The early-bird window starts after the last-minute window ends, so nothing can qualify.';
    }

    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const value =
      form.type === 'percentage'
        ? intOr(form.value, 0)
        : (parseEurosToCents(form.value) ?? 0);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      badge_text: form.badge_text.trim() || null,
      type: form.type,
      value,
      code: normalisedCode || null,
      scope: form.scope,
      scope_id: form.scope === 'all' ? null : intOrNull(form.scope_id),
      starts_at: toSqlDateTime(form.starts_at),
      ends_at: toSqlDateTime(form.ends_at),
      min_booking_cents: parseEurosToCents(form.min_booking) ?? 0,
      min_travellers: Math.max(1, intOr(form.min_travellers, 1)),
      min_days_before: intOrNull(form.min_days_before),
      max_days_before: intOrNull(form.max_days_before),
      usage_limit: intOrNull(form.usage_limit),
      per_customer_limit: intOrNull(form.per_customer_limit),
      priority: intOr(form.priority, 0),
      stackable: form.stackable ? 1 : 0,
      status: form.status,
    };

    setBusy(true);
    try {
      const res = await fetch(
        isEdit ? `/api/admin/promotions/${promotion!.id}` : '/api/admin/promotions',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setSubmitError(data?.error ?? `Could not save the promotion (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }

      router.push('/admin/promotions');
      router.refresh();
    } catch {
      setSubmitError('Network error — the promotion was not saved.');
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!promotion) return;
    const ok = window.confirm(
      `Delete "${promotion.name}" permanently?\n\nBookings already taken keep their discount, but the rule disappears from the deals page. To stop an offer without deleting it, set its status to Paused instead.`,
    );
    if (!ok) return;

    setBusy(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/admin/promotions/${promotion.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setSubmitError(data?.error ?? `Could not delete the promotion (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }
      router.push('/admin/promotions');
      router.refresh();
    } catch {
      setSubmitError('Network error — the promotion was not deleted.');
      setBusy(false);
    }
  }

  const err = (key: string) =>
    errors[key] ? <span className="error-text">{errors[key]}</span> : null;
  const cls = (key: string, base: string) =>
    errors[key] ? `${base} input-error` : base;

  return (
    <form onSubmit={onSubmit} className="stack-lg" style={{ display: 'flex', flexDirection: 'column' }}>
      {submitError && (
        <div className="alert alert-danger" role="alert">
          {submitError}
        </div>
      )}

      <section className="card card-pad stack">
        <div>
          <span className="eyebrow eyebrow-accent">Step 1</span>
          <h2 style={{ fontSize: '1.5rem' }}>What it is</h2>
        </div>

        <div className="form-grid">
          <div className="field span-2">
            <label className="label" htmlFor="promo-name">
              Internal name
            </label>
            <input
              id="promo-name"
              className={cls('name', 'input')}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Morocco early bird 2027"
              maxLength={120}
            />
            <span className="hint">
              Only staff see this. Name it so a colleague can find it in a hurry.
            </span>
            {err('name')}
          </div>

          <div className="field span-2">
            <label className="label" htmlFor="promo-description">
              Customer-facing description
            </label>
            <textarea
              id="promo-description"
              className="textarea"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Book your Atlas Mountains trek by the end of March and save 15% on every 2027 departure."
              style={{ minHeight: '90px' }}
            />
            <span className="hint">Shown on the deals page. Plain language, no jargon.</span>
          </div>

          <div className="field">
            <label className="label" htmlFor="promo-badge">
              Badge text
            </label>
            <input
              id="promo-badge"
              className="input"
              value={form.badge_text}
              onChange={(e) => set('badge_text', e.target.value)}
              placeholder="-15%"
              maxLength={20}
            />
            <span className="hint">Shown on tour cards, e.g. -15%</span>
          </div>

          <div className="field">
            <span className="label">Badge preview</span>
            <div className="cluster cluster-sm" style={{ minHeight: '2.4rem' }}>
              <span className="badge badge-promo">{badgePreview}</span>
              <span className="hint">This is what a customer sees on the card.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card card-pad stack">
        <div>
          <span className="eyebrow eyebrow-accent">Step 2</span>
          <h2 style={{ fontSize: '1.5rem' }}>The discount</h2>
        </div>

        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="label" style={{ marginBottom: 'var(--s2)' }}>
            How is it calculated?
          </legend>
          <div className="cluster">
            <label className="checkbox-row">
              <input
                type="radio"
                name="promo-type"
                checked={form.type === 'percentage'}
                onChange={() => changeType('percentage')}
              />
              <span>
                <strong>Percentage</strong>
                <br />
                <span className="hint">A share of the basket, e.g. 15% off.</span>
              </span>
            </label>
            <label className="checkbox-row">
              <input
                type="radio"
                name="promo-type"
                checked={form.type === 'fixed'}
                onChange={() => changeType('fixed')}
              />
              <span>
                <strong>Fixed amount</strong>
                <br />
                <span className="hint">A flat sum off the total, e.g. €150 off.</span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="field" style={{ maxWidth: '22rem' }}>
          <label className="label" htmlFor="promo-value">
            {form.type === 'percentage' ? 'Percentage off' : 'Amount off the booking'}
          </label>
          <div className="cluster cluster-sm">
            <input
              id="promo-value"
              className={cls('value', 'input')}
              inputMode="decimal"
              value={form.value}
              onChange={(e) => set('value', e.target.value)}
              placeholder={form.type === 'percentage' ? '15' : '150.00'}
              style={{ maxWidth: '10rem' }}
            />
            <span className="price-now" aria-hidden="true">
              {form.type === 'percentage' ? '%' : '€'}
            </span>
          </div>
          <span className="hint">
            {form.type === 'percentage'
              ? 'Between 1 and 100. Applied to the whole basket, not per person.'
              : 'Taken off the basket total once, never multiplied by the traveller count.'}
          </span>
          {err('value')}
        </div>
      </section>

      <section className="card card-pad stack">
        <div>
          <span className="eyebrow eyebrow-accent">Step 3</span>
          <h2 style={{ fontSize: '1.5rem' }}>How customers get it</h2>
        </div>

        <div className="field" style={{ maxWidth: '26rem' }}>
          <label className="label" htmlFor="promo-code">
            Discount code
          </label>
          <input
            id="promo-code"
            className={cls('code', 'input mono')}
            value={form.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())}
            placeholder="ATLAS25"
            maxLength={24}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="hint">
            Leave empty to apply the discount automatically, with no code to type.
          </span>
          {err('code')}
        </div>

        <p
          className="alert alert-info"
          style={{ margin: 0 }}
          aria-live="polite"
        >
          {normalisedCode
            ? `Customers must enter ${normalisedCode} at checkout`
            : 'Applies automatically to every matching booking.'}
        </p>
      </section>

      <section className="card card-pad stack">
        <div>
          <span className="eyebrow eyebrow-accent">Step 4</span>
          <h2 style={{ fontSize: '1.5rem' }}>What it applies to</h2>
        </div>

        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="label" style={{ marginBottom: 'var(--s2)' }}>
            Scope
          </legend>
          <div className="cluster">
            {(
              [
                ['all', 'All tours'],
                ['tour', 'One tour'],
                ['destination', 'A destination'],
                ['theme', 'A theme'],
              ] as [PromotionScope, string][]
            ).map(([value, label]) => (
              <label className="checkbox-row" key={value}>
                <input
                  type="radio"
                  name="promo-scope"
                  checked={form.scope === value}
                  onChange={() => {
                    set('scope', value);
                    set('scope_id', '');
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {form.scope !== 'all' && (
          <div className="field" style={{ maxWidth: '30rem' }}>
            <label className="label" htmlFor="promo-scope-id">
              {form.scope === 'tour'
                ? 'Which tour?'
                : form.scope === 'destination'
                  ? 'Which destination?'
                  : 'Which theme?'}
            </label>
            <select
              id="promo-scope-id"
              className={cls('scope_id', 'select')}
              value={form.scope_id}
              onChange={(e) => set('scope_id', e.target.value)}
            >
              <option value="">Choose one…</option>
              {scopeOptions.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.label}
                </option>
              ))}
            </select>
            {scopeOptions.length === 0 && (
              <span className="hint">
                Nothing to choose from yet — add one first, then come back.
              </span>
            )}
            {err('scope_id')}
          </div>
        )}
      </section>

      <section className="card card-pad stack">
        <div>
          <span className="eyebrow eyebrow-accent">Step 5</span>
          <h2 style={{ fontSize: '1.5rem' }}>Conditions</h2>
          <p className="hint" style={{ marginTop: 'var(--s2)' }}>
            Every condition must be met for the discount to apply. Leave a field blank
            for no limit.
          </p>
        </div>

        <div className="form-grid">
          <div className="field">
            <label className="label" htmlFor="promo-min-booking">
              Minimum booking value (€)
            </label>
            <input
              id="promo-min-booking"
              className={cls('min_booking', 'input')}
              inputMode="decimal"
              value={form.min_booking}
              onChange={(e) => set('min_booking', e.target.value)}
              placeholder="1000.00"
            />
            <span className="hint">Measured before the discount, across all travellers.</span>
            {err('min_booking')}
          </div>

          <div className="field">
            <label className="label" htmlFor="promo-min-travellers">
              Minimum travellers
            </label>
            <input
              id="promo-min-travellers"
              className="input"
              type="number"
              min={1}
              value={form.min_travellers}
              onChange={(e) => set('min_travellers', e.target.value)}
            />
            <span className="hint">Use 2 for a couples or friends offer.</span>
          </div>

          <div className="field">
            <label className="label" htmlFor="promo-min-days">
              Book at least N days ahead
            </label>
            <input
              id="promo-min-days"
              className="input"
              type="number"
              min={0}
              value={form.min_days_before}
              onChange={(e) => set('min_days_before', e.target.value)}
              placeholder="90"
            />
            <span className="hint">
              Early bird: booking made at least N days before departure.
            </span>
          </div>

          <div className="field">
            <label className="label" htmlFor="promo-max-days">
              Book within N days of departure
            </label>
            <input
              id="promo-max-days"
              className={cls('max_days_before', 'input')}
              type="number"
              min={0}
              value={form.max_days_before}
              onChange={(e) => set('max_days_before', e.target.value)}
              placeholder="21"
            />
            <span className="hint">
              Last minute: booking made within N days of departure.
            </span>
            {err('max_days_before')}
          </div>
        </div>
      </section>

      <section className="card card-pad stack">
        <div>
          <span className="eyebrow eyebrow-accent">Step 6</span>
          <h2 style={{ fontSize: '1.5rem' }}>Limits and lifetime</h2>
        </div>

        <div className="form-grid">
          <div className="field">
            <label className="label" htmlFor="promo-starts">
              Starts
            </label>
            <input
              id="promo-starts"
              className={cls('starts_at', 'input')}
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => set('starts_at', e.target.value)}
            />
            {err('starts_at')}
          </div>

          <div className="field">
            <label className="label" htmlFor="promo-ends">
              Ends
            </label>
            <input
              id="promo-ends"
              className={cls('ends_at', 'input')}
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => set('ends_at', e.target.value)}
            />
            <span className="hint">The offer stops by itself — no need to come back.</span>
            {err('ends_at')}
          </div>

          <div className="field">
            <label className="label" htmlFor="promo-usage-limit">
              Total usage limit
            </label>
            <input
              id="promo-usage-limit"
              className="input"
              type="number"
              min={1}
              value={form.usage_limit}
              onChange={(e) => set('usage_limit', e.target.value)}
              placeholder="Unlimited"
            />
            <span className="hint">
              {isEdit
                ? `Redeemed ${promotion!.usage_count} times so far.`
                : 'Blank means unlimited.'}
            </span>
          </div>

          <div className="field">
            <label className="label" htmlFor="promo-per-customer">
              Per-customer limit
            </label>
            <input
              id="promo-per-customer"
              className="input"
              type="number"
              min={1}
              value={form.per_customer_limit}
              onChange={(e) => set('per_customer_limit', e.target.value)}
              placeholder="Unlimited"
            />
            <span className="hint">How many times one account may use it.</span>
          </div>

          <div className="field">
            <label className="label" htmlFor="promo-priority">
              Priority
            </label>
            <input
              id="promo-priority"
              className="input"
              type="number"
              value={form.priority}
              onChange={(e) => set('priority', e.target.value)}
            />
            <span className="hint">
              Only breaks ties. When two offers are worth the same, the higher priority
              wins.
            </span>
          </div>

          <div className="field">
            <label className="label" htmlFor="promo-status">
              Status
            </label>
            <select
              id="promo-status"
              className="select"
              value={form.status}
              onChange={(e) => set('status', e.target.value as PromotionStatus)}
            >
              <option value="draft">Draft — invisible to customers</option>
              <option value="active">Active — live inside its dates</option>
              <option value="paused">Paused — temporarily off</option>
              <option value="expired">Expired — archived</option>
            </select>
          </div>

          <div className="field span-2">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.stackable}
                onChange={(e) => set('stackable', e.target.checked)}
              />
              <span>
                <strong>Allow this offer to stack with others</strong>
                <br />
                <span className="hint">
                  Off by default. Atlas applies one promotion per booking — whichever
                  saves the customer the most — because 20% plus 20% is 36%, and no
                  member of staff has ever expected that number.
                </span>
              </span>
            </label>
          </div>
        </div>
      </section>

      <section
        className="card card-pad stack"
        style={{ borderLeft: '3px solid var(--accent)' }}
        aria-live="polite"
      >
        <span className="eyebrow eyebrow-accent">Rule preview</span>
        <p className="lead" style={{ margin: 0 }}>
          {sentence}
        </p>

        <dl className="meta-list">
          <div className="meta-item">
            <dt>Window</dt>
            <dd>
              {form.starts_at && form.ends_at
                ? `${prettyDate(form.starts_at)} → ${prettyDate(form.ends_at)}`
                : 'Not set'}
            </dd>
          </div>
          <div className="meta-item">
            <dt>Unlocked by</dt>
            <dd>{normalisedCode ? normalisedCode : 'No code'}</dd>
          </div>
          <div className="meta-item">
            <dt>Status</dt>
            <dd style={{ textTransform: 'capitalize' }}>{form.status}</dd>
          </div>
          <div className="meta-item">
            <dt>Stacking</dt>
            <dd>{form.stackable ? 'Allowed' : 'One promotion per booking'}</dd>
          </div>
        </dl>

        <p className="hint" style={{ margin: 0 }}>
          If another promotion is also eligible for the same booking, Atlas applies
          whichever one saves the customer more money. The list price is never
          overwritten, so the &ldquo;was&rdquo; figure stays true and the offer switches
          itself off on {form.ends_at ? prettyDate(form.ends_at) : 'its end date'}.
        </p>
      </section>

      <div className="between">
        <div className="cluster cluster-sm">
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create promotion'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => router.push('/admin/promotions')}
          >
            Cancel
          </button>
        </div>

        {isEdit && (
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={() => void onDelete()}
          >
            Delete promotion
          </button>
        )}
      </div>
    </form>
  );
}
