'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/money';
import type { Departure } from '@/lib/types';

export interface BookingFormTour {
  id: number;
  slug: string;
  title: string;
  duration_days: number;
  group_size_max: number;
  meeting_point: string | null;
  hero_image: string;
  destination_name: string;
  country: string;
}

export interface BookingContactPrefill {
  name: string;
  email: string;
  phone: string | null;
}

interface Quote {
  baseTotalCents: number;
  discountCents: number;
  totalCents: number;
  perPersonCents: number;
  depositCents: number;
  promotionName: string | null;
  badgeText: string | null;
  codeRejected: boolean;
}

interface TravellerDraft {
  full_name: string;
  dob: string;
  nationality: string;
  dietary: string;
}

const STEP_LABELS = ['Your trip', 'Travellers', 'Contact & confirm'] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function localDeposit(totalCents: number): number {
  return Math.round((totalCents * 0.2) / 100) * 100;
}

function emptyTraveller(): TravellerDraft {
  return { full_name: '', dob: '', nationality: '', dietary: '' };
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function BookingForm({
  tour,
  departure,
  seatsLeft,
  contact,
}: {
  tour: BookingFormTour;
  departure: Departure;
  themeIds: number[];
  seatsLeft: number;
  contact: BookingContactPrefill | null;
}) {
  const router = useRouter();

  const maxTravellers = Math.max(1, Math.min(tour.group_size_max, seatsLeft));
  const balanceDueDate = shiftDays(departure.start_date, -60);

  const [step, setStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);

  const [travellers, setTravellers] = useState(1);
  const [people, setPeople] = useState<TravellerDraft[]>([emptyTraveller()]);

  const [contactName, setContactName] = useState(contact?.name ?? '');
  const [contactEmail, setContactEmail] = useState(contact?.email ?? '');
  const [contactPhone, setContactPhone] = useState(contact?.phone ?? '');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(false);

  const [codeInput, setCodeInput] = useState('');
  const [appliedCode, setAppliedCode] = useState('');

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    setPeople((prev) => {
      if (prev.length === travellers) return prev;
      if (prev.length > travellers) return prev.slice(0, travellers);
      return [
        ...prev,
        ...Array.from({ length: travellers - prev.length }, emptyTraveller),
      ];
    });
  }, [travellers]);

  useEffect(() => {
    let cancelled = false;
    setQuoting(true);

    const fallback: Quote = {
      baseTotalCents: departure.price_cents * travellers,
      discountCents: 0,
      totalCents: departure.price_cents * travellers,
      perPersonCents: departure.price_cents,
      depositCents: localDeposit(departure.price_cents * travellers),
      promotionName: null,
      badgeText: null,
      codeRejected: false,
    };

    (async () => {
      try {
        const res = await fetch('/api/promotions/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tour_id: tour.id,
            departure_id: departure.id,
            travellers,
            code: appliedCode || null,
          }),
        });
        const data = (await res.json()) as Quote & { error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? 'Could not price this booking');
        setQuote(data);
      } catch {
        if (!cancelled) setQuote(fallback);
      } finally {
        if (!cancelled) setQuoting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tour.id, departure.id, departure.price_cents, travellers, appliedCode]);

  function goTo(next: number) {
    setStep(next);
    setFurthestStep((f) => Math.max(f, next));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validateStep(n: number): boolean {
    const found: Record<string, string> = {};

    if (n === 1) {
      if (!Number.isInteger(travellers) || travellers < 1) {
        found.travellers = 'Choose at least one traveller.';
      } else if (travellers > maxTravellers) {
        found.travellers = `Only ${maxTravellers} ${
          maxTravellers === 1 ? 'seat is' : 'seats are'
        } left on this departure.`;
      }
    }

    if (n === 2) {
      const today = new Date().toISOString().slice(0, 10);
      people.forEach((p, i) => {
        if (!p.full_name.trim()) {
          found[`t${i}-name`] = 'We need the name exactly as it appears on the passport.';
        }
        if (p.dob && p.dob >= today) {
          found[`t${i}-dob`] = 'Date of birth must be in the past.';
        }
      });
    }

    if (n === 3) {
      if (!contactName.trim()) found.contactName = 'Tell us who to contact about this trip.';
      if (!contactEmail.trim()) found.contactEmail = 'An email address is required.';
      else if (!EMAIL_RE.test(contactEmail.trim())) found.contactEmail = 'That does not look like an email address.';
      const typed = codeInput.trim().toUpperCase();
      if (typed && typed !== appliedCode) {
        found.code = 'Press Apply to check this code, or clear the field.';
      }
      if (!terms) found.terms = 'Please accept the booking conditions to continue.';
    }

    setErrors(found);
    return Object.keys(found).length === 0;
  }

  function onNext() {
    if (validateStep(step)) goTo(step + 1);
  }

  function applyCode() {
    setAppliedCode(codeInput.trim().toUpperCase());
  }

  function clearCode() {
    setCodeInput('');
    setAppliedCode('');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep(3)) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departure_id: departure.id,
          travellers: people.map((p) => ({
            full_name: p.full_name.trim(),
            dob: p.dob || null,
            nationality: p.nationality.trim() || null,
            dietary: p.dietary.trim() || null,
          })),
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim() || null,
          code: appliedCode || null,
          notes: notes.trim() || null,
        }),
      });

      const data = (await res.json()) as { reference?: string; error?: string };
      if (!res.ok || !data.reference) {
        throw new Error(data.error ?? 'We could not complete your booking. Please try again.');
      }

      router.push(`/book/confirmation/${encodeURIComponent(data.reference)}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'We could not complete your booking.',
      );
      setSubmitting(false);
    }
  }

  const q: Quote = quote ?? {
    baseTotalCents: departure.price_cents * travellers,
    discountCents: 0,
    totalCents: departure.price_cents * travellers,
    perPersonCents: departure.price_cents,
    depositCents: localDeposit(departure.price_cents * travellers),
    promotionName: null,
    badgeText: null,
    codeRejected: false,
  };
  const balanceCents = Math.max(0, q.totalCents - q.depositCents);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 'var(--s6)',
      }}
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className="stack stack-lg"
        style={{ flex: '1 1 440px', minWidth: 0 }}
      >
        <ol
          className="cluster cluster-sm"
          style={{ listStyle: 'none', padding: 0, margin: 0 }}
          aria-label="Booking steps"
        >
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const reachable = n <= furthestStep;
            return (
              <li key={label}>
                <button
                  type="button"
                  className={`chip${step === n ? ' active' : ''}`}
                  aria-current={step === n ? 'step' : undefined}
                  disabled={!reachable || submitting}
                  onClick={() => reachable && goTo(n)}
                >
                  <span className="mono" style={{ marginRight: 'var(--s2)' }}>
                    {n}
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>

        {step === 1 && (
          <section className="card card-pad stack">
            <div>
              <span className="eyebrow" style={{ margin: 0 }}>
                Step 1 of 3
              </span>
              <h2 style={{ marginTop: 'var(--s2)' }}>Your trip</h2>
            </div>

            <p className="muted" style={{ margin: 0 }}>
              You are booking the {formatDate(departure.start_date)} departure of{' '}
              <strong>{tour.title}</strong>, {tour.duration_days} days in{' '}
              {tour.destination_name}, {tour.country}.
            </p>

            <dl className="meta-list">
              <div className="meta-item">
                <dt>Departs</dt>
                <dd>{formatDate(departure.start_date)}</dd>
              </div>
              <div className="meta-item">
                <dt>Returns</dt>
                <dd>{formatDate(departure.end_date)}</dd>
              </div>
              <div className="meta-item">
                <dt>Seats left</dt>
                <dd className="tabular">{seatsLeft}</dd>
              </div>
              <div className="meta-item">
                <dt>Meeting point</dt>
                <dd>{tour.meeting_point ?? 'Confirmed 30 days before travel'}</dd>
              </div>
            </dl>

            <div className="field" style={{ maxWidth: '18rem' }}>
              <label className="label" htmlFor="travellers">
                How many travellers?
              </label>
              <select
                id="travellers"
                className={`select${errors.travellers ? ' input-error' : ''}`}
                value={travellers}
                onChange={(e) => setTravellers(Number(e.target.value))}
              >
                {Array.from({ length: maxTravellers }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'traveller' : 'travellers'}
                  </option>
                ))}
              </select>
              <span className="hint">
                This departure takes a maximum of {tour.group_size_max} people and{' '}
                {seatsLeft} {seatsLeft === 1 ? 'seat is' : 'seats are'} still open.
              </span>
              {errors.travellers && (
                <span className="error-text">{errors.travellers}</span>
              )}
            </div>

            <div className="cluster">
              <button type="button" className="btn btn-primary" onClick={onNext}>
                Continue to travellers
              </button>
              <Link className="btn btn-ghost" href={`/tours/${tour.slug}`}>
                Back to the tour
              </Link>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="card card-pad stack">
            <div>
              <span className="eyebrow" style={{ margin: 0 }}>
                Step 2 of 3
              </span>
              <h2 style={{ marginTop: 'var(--s2)' }}>Who is travelling?</h2>
            </div>

            <p className="muted" style={{ margin: 0 }}>
              Names must match each traveller&rsquo;s passport. Everything else can be
              added later — your trip coordinator will chase anything missing.
            </p>

            {people.map((p, i) => (
              <fieldset
                key={i}
                className="stack"
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r)',
                  padding: 'var(--s4)',
                }}
              >
                <legend className="cluster cluster-sm" style={{ padding: '0 var(--s2)' }}>
                  <span className="eyebrow" style={{ margin: 0 }}>
                    Traveller {i + 1}
                  </span>
                  {i === 0 && <span className="badge badge-accent">Lead traveller</span>}
                </legend>

                <div className="form-grid">
                  <div className="field span-2">
                    <label className="label" htmlFor={`t${i}-name`}>
                      Full name (as on passport)
                    </label>
                    <input
                      id={`t${i}-name`}
                      className={`input${errors[`t${i}-name`] ? ' input-error' : ''}`}
                      type="text"
                      autoComplete={i === 0 ? 'name' : 'off'}
                      value={p.full_name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPeople((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, full_name: v } : x)),
                        );
                      }}
                    />
                    {errors[`t${i}-name`] && (
                      <span className="error-text">{errors[`t${i}-name`]}</span>
                    )}
                  </div>

                  <div className="field">
                    <label className="label" htmlFor={`t${i}-dob`}>
                      Date of birth <span className="muted">(optional)</span>
                    </label>
                    <input
                      id={`t${i}-dob`}
                      className={`input${errors[`t${i}-dob`] ? ' input-error' : ''}`}
                      type="date"
                      value={p.dob}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPeople((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, dob: v } : x)),
                        );
                      }}
                    />
                    {errors[`t${i}-dob`] && (
                      <span className="error-text">{errors[`t${i}-dob`]}</span>
                    )}
                  </div>

                  <div className="field">
                    <label className="label" htmlFor={`t${i}-nat`}>
                      Nationality <span className="muted">(optional)</span>
                    </label>
                    <input
                      id={`t${i}-nat`}
                      className="input"
                      type="text"
                      placeholder="Irish"
                      value={p.nationality}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPeople((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, nationality: v } : x)),
                        );
                      }}
                    />
                  </div>

                  <div className="field span-2">
                    <label className="label" htmlFor={`t${i}-diet`}>
                      Dietary requirements <span className="muted">(optional)</span>
                    </label>
                    <input
                      id={`t${i}-diet`}
                      className="input"
                      type="text"
                      placeholder="Vegetarian, no shellfish, coeliac…"
                      value={p.dietary}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPeople((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, dietary: v } : x)),
                        );
                      }}
                    />
                  </div>
                </div>
              </fieldset>
            ))}

            <div className="cluster">
              <button type="button" className="btn btn-primary" onClick={onNext}>
                Continue to contact details
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => goTo(1)}>
                Back
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="card card-pad stack">
            <div>
              <span className="eyebrow" style={{ margin: 0 }}>
                Step 3 of 3
              </span>
              <h2 style={{ marginTop: 'var(--s2)' }}>Contact &amp; confirm</h2>
            </div>

            <p className="muted" style={{ margin: 0 }}>
              One person holds the booking. We send the joining pack, the balance
              reminder and any itinerary change to this address.
            </p>

            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="contact-name">
                  Contact name
                </label>
                <input
                  id="contact-name"
                  className={`input${errors.contactName ? ' input-error' : ''}`}
                  type="text"
                  autoComplete="name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
                {errors.contactName && (
                  <span className="error-text">{errors.contactName}</span>
                )}
              </div>

              <div className="field">
                <label className="label" htmlFor="contact-email">
                  Email
                </label>
                <input
                  id="contact-email"
                  className={`input${errors.contactEmail ? ' input-error' : ''}`}
                  type="email"
                  autoComplete="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
                {errors.contactEmail && (
                  <span className="error-text">{errors.contactEmail}</span>
                )}
              </div>

              <div className="field span-2">
                <label className="label" htmlFor="contact-phone">
                  Phone <span className="muted">(optional)</span>
                </label>
                <input
                  id="contact-phone"
                  className="input"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+353 87 000 0000"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
                <span className="hint">
                  Used only for urgent changes in the 48 hours before departure.
                </span>
              </div>

              <div className="field span-2">
                <label className="label" htmlFor="notes">
                  Anything we should know? <span className="muted">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  className="textarea"
                  placeholder="Room-sharing preferences, arriving a day early, celebrating something…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <hr className="divider" />

            <div className="field">
              <label className="label" htmlFor="promo-code">
                Promotion code
              </label>
              <div className="cluster cluster-sm">
                <input
                  id="promo-code"
                  className={`input${q.codeRejected || errors.code ? ' input-error' : ''}`}
                  type="text"
                  placeholder="ATLAS10"
                  value={codeInput}
                  autoCapitalize="characters"
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyCode();
                    }
                  }}
                  style={{ flex: '1 1 12rem', textTransform: 'uppercase' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={applyCode}
                  disabled={!codeInput.trim() || quoting}
                >
                  Apply
                </button>
                {appliedCode && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={clearCode}>
                    Remove
                  </button>
                )}
              </div>
              {errors.code ? (
                <span className="error-text">{errors.code}</span>
              ) : q.codeRejected ? (
                <span className="error-text">
                  That code isn&rsquo;t valid for this booking — your total is
                  unchanged.
                </span>
              ) : appliedCode ? (
                <span className="hint">
                  Code <span className="mono">{appliedCode}</span> applied.
                </span>
              ) : (
                <span className="hint">
                  Seasonal offers are applied automatically — you only need a code if
                  you were sent one.
                </span>
              )}
            </div>

            <div className="checkbox-row">
              <input
                id="terms"
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
              />
              <label htmlFor="terms">
                I have read the booking conditions and understand the 20% deposit is
                non-refundable inside 60 days of departure.
              </label>
            </div>
            {errors.terms && <span className="error-text">{errors.terms}</span>}

            {submitError && (
              <p className="alert alert-danger" role="alert">
                {submitError}
              </p>
            )}

            <div className="cluster">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={submitting}
              >
                {submitting ? 'Confirming…' : `Confirm booking — pay ${formatMoney(q.depositCents)} deposit`}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => goTo(2)}
                disabled={submitting}
              >
                Back
              </button>
            </div>

            <p className="hint" style={{ margin: 0 }}>
              No card details are collected and no money changes hands — Atlas is a
              fictional agency built for a university assignment.
            </p>
          </section>
        )}
      </form>

      <aside
        className="card card-pad stack"
        aria-label="Price summary"
        style={{ flex: '1 1 290px', position: 'sticky', top: 'var(--s5)' }}
      >
        <div>
          <span className="eyebrow" style={{ margin: 0 }}>
            Your booking
          </span>
          <h2 className="card-title" style={{ marginTop: 'var(--s2)' }}>
            {tour.title}
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            {tour.destination_name}, {tour.country} · {tour.duration_days} days
          </p>
        </div>

        <img
          src={tour.hero_image}
          alt={`${tour.title} in ${tour.destination_name}`}
          loading="lazy"
          decoding="async"
          width={600}
          height={400}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: 'var(--r)',
            display: 'block',
          }}
        />

        <dl className="meta-list">
          <div className="meta-item">
            <dt>Departs</dt>
            <dd>{formatDate(departure.start_date)}</dd>
          </div>
          <div className="meta-item">
            <dt>Returns</dt>
            <dd>{formatDate(departure.end_date)}</dd>
          </div>
          <div className="meta-item">
            <dt>Travellers</dt>
            <dd className="tabular">{travellers}</dd>
          </div>
        </dl>

        <div className="stack stack-sm">
          <div className="between">
            <span className="muted">
              {formatMoney(departure.price_cents)} × {travellers}{' '}
              {travellers === 1 ? 'traveller' : 'travellers'}
            </span>
            <span className="tabular">{formatMoney(q.baseTotalCents)}</span>
          </div>

          {q.discountCents > 0 && (
            <div className="between">
              <span className="cluster cluster-sm">
                {q.badgeText && <span className="badge badge-promo">{q.badgeText}</span>}
                <span className="muted">{q.promotionName ?? 'Promotion applied'}</span>
              </span>
              <span className="tabular" style={{ color: 'var(--good)' }}>
                −{formatMoney(q.discountCents)}
              </span>
            </div>
          )}

          <hr className="divider" style={{ margin: 'var(--s2) 0' }} />

          <div className="between">
            <strong>Total</strong>
            <span className="price price-lg">
              <span className="price-now">{formatMoney(q.totalCents)}</span>
              {q.discountCents > 0 && (
                <span className="price-was">{formatMoney(q.baseTotalCents)}</span>
              )}
            </span>
          </div>
          <div className="between">
            <span className="muted" style={{ fontSize: '0.86rem' }}>
              Per person
            </span>
            <span className="tabular" style={{ fontSize: '0.86rem' }}>
              {formatMoney(q.perPersonCents)}
            </span>
          </div>
        </div>

        <div className="alert alert-info stack stack-sm">
          <div className="between">
            <span>Deposit due today (20%)</span>
            <strong className="tabular">{formatMoney(q.depositCents)}</strong>
          </div>
          <div className="between">
            <span>Balance</span>
            <span className="tabular">{formatMoney(balanceCents)}</span>
          </div>
          <span style={{ fontSize: '0.82rem' }}>
            The balance falls due on {formatDate(balanceDueDate)}, 60 days before you
            travel.
          </span>
        </div>

        {quoting && (
          <p className="hint" style={{ margin: 0 }} aria-live="polite">
            Re-checking offers…
          </p>
        )}
        {!quoting && q.discountCents === 0 && !appliedCode && (
          <p className="hint" style={{ margin: 0 }}>
            No offer applies to this departure right now. Have a code? Add it at step
            three.
          </p>
        )}
      </aside>
    </div>
  );
}
