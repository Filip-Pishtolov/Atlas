'use client';

import { useState } from 'react';

export default function ReviewForm({
  tourId,
  tourTitle,
  defaultAuthorName,
}: {
  tourId: number;
  tourTitle: string;
  defaultAuthorName?: string;
}) {
  const [rating, setRating] = useState('5');
  const [authorName, setAuthorName] = useState(defaultAuthorName ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (authorName.trim().length < 2) {
      setError('Please tell us the name you would like shown on the review.');
      return;
    }
    if (title.trim().length < 3) {
      setError('Please add a short headline for your review.');
      return;
    }
    if (body.trim().length < 20) {
      setError('Please write at least a couple of sentences — 20 characters minimum.');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tour_id: tourId,
          rating: Number(rating),
          title: title.trim(),
          body: body.trim(),
          author_name: authorName.trim(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? 'We could not save your review. Please try again.');
        return;
      }

      setDone(true);
    } catch {
      setError('We could not reach the server. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="alert alert-good">
        <strong>Thank you.</strong> Your review of {tourTitle} has been sent to
        our team. We read every one and publish it once we have checked it
        against the booking — usually within two working days.
      </div>
    );
  }

  return (
    <form className="card card-pad stack" onSubmit={onSubmit}>
      <div>
        <h3 style={{ marginBottom: 'var(--s1)' }}>Write a review</h3>
        <p className="hint">
          Travelled with us on {tourTitle}? Tell other travellers what the trip
          was actually like. Reviews are checked by the Atlas team before they
          appear on the site.
        </p>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="review-name">
            Your name
          </label>
          <input
            id="review-name"
            className="input"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Maria K."
            required
            maxLength={80}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="review-rating">
            Rating
          </label>
          <select
            id="review-rating"
            className="select"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          >
            <option value="5">5 — Outstanding</option>
            <option value="4">4 — Very good</option>
            <option value="3">3 — Mixed</option>
            <option value="2">2 — Disappointing</option>
            <option value="1">1 — Poor</option>
          </select>
        </div>

        <div className="field span-2">
          <label className="label" htmlFor="review-title">
            Headline
          </label>
          <input
            id="review-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The guiding made this trip"
            required
            maxLength={120}
          />
        </div>

        <div className="field span-2">
          <label className="label" htmlFor="review-body">
            Your review
          </label>
          <textarea
            id="review-body"
            className="textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What was the pace like? How were the guides, the food, the accommodation? What would you tell a friend before they booked?"
            required
            maxLength={2000}
          />
          <span className="hint">{body.length} / 2000 characters</span>
        </div>
      </div>

      <div className="cluster">
        <button type="submit" className="btn btn-primary" disabled={sending}>
          {sending ? 'Sending…' : 'Submit review'}
        </button>
        <span className="hint">
          We publish first names and an initial only — never your email address.
        </span>
      </div>
    </form>
  );
}
