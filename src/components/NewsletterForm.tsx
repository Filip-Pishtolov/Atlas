'use client';

import { useState } from 'react';

export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
      setState('done');
      setMessage(data.message ?? 'Thanks — you are on the list.');
      setEmail('');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (state === 'done') {
    return (
      <p className="alert alert-good" style={{ marginTop: 'var(--s4)' }}>
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 'var(--s4)' }}>
      <label className="label" htmlFor="newsletter-email">
        New departures, once a month
      </label>
      <div className="cluster cluster-sm" style={{ marginTop: 'var(--s2)' }}>
        <input
          id="newsletter-email"
          className="input"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ flex: '1 1 180px' }}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={state === 'sending'}
        >
          {state === 'sending' ? 'Joining…' : 'Join'}
        </button>
      </div>
      {state === 'error' && (
        <p className="error-text" style={{ marginTop: 'var(--s2)' }}>
          {message}
        </p>
      )}
    </form>
  );
}
