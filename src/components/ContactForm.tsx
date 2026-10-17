'use client';

import { useState } from 'react';

export interface ContactTourOption {
  id: number;
  title: string;
  destination_name: string;
}

interface ContactFormProps {
  tours: ContactTourOption[];
  initialTourId?: number | null;
  initialSubject?: string;
}

type FormState = 'idle' | 'sending' | 'sent' | 'error';

export default function ContactForm({
  tours,
  initialTourId = null,
  initialSubject = '',
}: ContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tourId, setTourId] = useState<string>(initialTourId ? String(initialTourId) : '');
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState('');

  function reset() {
    setName('');
    setEmail('');
    setPhone('');
    setTourId(initialTourId ? String(initialTourId) : '');
    setSubject(initialSubject);
    setMessage('');
    setError('');
    setState('idle');
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('sending');
    setError('');

    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          tour_id: tourId ? Number(tourId) : undefined,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const data: { error?: string } = await response
        .json()
        .catch(() => ({}) as { error?: string });

      if (!response.ok) {
        throw new Error(data.error ?? 'We could not send that. Please try again.');
      }

      setState('sent');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  if (state === 'sent') {
    return (
      <div className="card card-pad stack" role="status" aria-live="polite">
        <span className="badge badge-good">Enquiry received</span>
        <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.2rem', fontWeight: 600 }}>
          Thank you — it is in front of a person, not a queue
        </h3>
        <p className="muted" style={{ margin: 0 }}>
          One of the four of us will reply from a real address within one working
          day, usually the same afternoon. If your departure is inside two weeks,
          call the office on <span className="mono">+389 2 300 1188</span> instead
          — it is faster than we are.
        </p>
        <div className="cluster">
          <button type="button" className="btn btn-secondary" onClick={reset}>
            Send another enquiry
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="card card-pad stack" onSubmit={onSubmit} noValidate={false}>
      <div>
        <span className="eyebrow eyebrow-accent" style={{ margin: 0 }}>
          Enquiry form
        </span>
        <h2 style={{ fontSize: 'clamp(1.5rem, 1.2rem + 1vw, 2rem)', marginTop: 'var(--s2)' }}>
          Tell us what you are thinking about
        </h2>
      </div>

      {state === 'error' && (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      )}

      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="contact-name">
            Your name
          </label>
          <input
            id="contact-name"
            className="input"
            name="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Maria Kovač"
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="contact-email">
            Email
          </label>
          <input
            id="contact-email"
            className="input"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="contact-phone">
            Phone <span className="muted">(optional)</span>
          </label>
          <input
            id="contact-phone"
            className="input"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+385 91 234 5678"
          />
          <span className="hint">Only used if a reply needs a conversation.</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="contact-tour">
            Which trip? <span className="muted">(optional)</span>
          </label>
          <select
            id="contact-tour"
            className="select"
            name="tour_id"
            value={tourId}
            onChange={(e) => setTourId(e.target.value)}
          >
            <option value="">Not about a specific trip</option>
            {tours.map((tour) => (
              <option key={tour.id} value={tour.id}>
                {tour.title} — {tour.destination_name}
              </option>
            ))}
          </select>
          {tours.length === 0 && (
            <span className="hint">
              No trips are published yet, so this list is empty.
            </span>
          )}
        </div>

        <div className="field span-2">
          <label className="label" htmlFor="contact-subject">
            Subject
          </label>
          <input
            id="contact-subject"
            className="input"
            name="subject"
            type="text"
            required
            maxLength={140}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Two of us, walking in October"
          />
        </div>

        <div className="field span-2">
          <label className="label" htmlFor="contact-message">
            Your message
          </label>
          <textarea
            id="contact-message"
            className="textarea"
            name="message"
            required
            minLength={10}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Dates you have in mind, how many of you, and anything you are unsure about — fitness, solo travel, dietary needs, getting there."
          />
          <span className="hint">
            The more specific you are, the more useful the first reply will be.
          </span>
        </div>
      </div>

      <div className="between">
        <p className="muted" style={{ margin: 0, fontSize: '0.84rem', maxWidth: '46ch' }}>
          We use what you send here only to answer you, and keep it for two years.
          No marketing list, no third parties.
        </p>
        <button className="btn btn-primary btn-lg" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send enquiry'}
        </button>
      </div>
    </form>
  );
}
