'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AuthForm({
  mode,
  next = '/account',
}: {
  mode: 'login' | 'register';
  next?: string;
}) {
  const router = useRouter();
  const isRegister = mode === 'register';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  function validate(): boolean {
    const found: Record<string, string> = {};

    if (isRegister && !name.trim()) found.name = 'Please tell us your name.';
    if (!email.trim()) found.email = 'An email address is required.';
    else if (!EMAIL_RE.test(email.trim())) found.email = 'That does not look like an email address.';
    if (!password) found.password = 'A password is required.';
    else if (isRegister && password.length < 8) {
      found.password = 'Use at least 8 characters.';
    }
    if (isRegister && confirm !== password) {
      found.confirm = 'The two passwords do not match.';
    }

    setErrors(found);
    return Object.keys(found).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setBusy(true);
    setFormError('');

    try {
      const res = await fetch(`/api/auth/${isRegister ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isRegister
            ? { name: name.trim(), email: email.trim(), password }
            : { email: email.trim(), password },
        ),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(
          data.error ??
            (isRegister
              ? 'We could not create that account.'
              : 'Those details did not match an Atlas account.'),
        );
      }

      router.push(next);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="stack">
      {formError && (
        <p className="alert alert-danger" role="alert">
          {formError}
        </p>
      )}

      {isRegister && (
        <div className="field">
          <label className="label" htmlFor="auth-name">
            Full name
          </label>
          <input
            id="auth-name"
            className={`input${errors.name ? ' input-error' : ''}`}
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>
      )}

      <div className="field">
        <label className="label" htmlFor="auth-email">
          Email
        </label>
        <input
          id="auth-email"
          className={`input${errors.email ? ' input-error' : ''}`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {errors.email && <span className="error-text">{errors.email}</span>}
      </div>

      <div className="field">
        <label className="label" htmlFor="auth-password">
          Password
        </label>
        <input
          id="auth-password"
          className={`input${errors.password ? ' input-error' : ''}`}
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {isRegister && !errors.password && (
          <span className="hint">At least 8 characters.</span>
        )}
        {errors.password && <span className="error-text">{errors.password}</span>}
      </div>

      {isRegister && (
        <div className="field">
          <label className="label" htmlFor="auth-confirm">
            Confirm password
          </label>
          <input
            id="auth-confirm"
            className={`input${errors.confirm ? ' input-error' : ''}`}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {errors.confirm && <span className="error-text">{errors.confirm}</span>}
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy
          ? isRegister
            ? 'Creating your account…'
            : 'Signing you in…'
          : isRegister
            ? 'Create account'
            : 'Sign in'}
      </button>
    </form>
  );
}
