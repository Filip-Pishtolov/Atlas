'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

async function sendPatch(endpoint: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return data?.error ?? `Could not save (HTTP ${res.status}).`;
  } catch {
    return 'Network error — nothing was saved.';
  }
}

async function sendDelete(endpoint: string): Promise<string | null> {
  try {
    const res = await fetch(endpoint, { method: 'DELETE' });
    if (res.ok) return null;
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return data?.error ?? `Could not delete (HTTP ${res.status}).`;
  } catch {
    return 'Network error — nothing was deleted.';
  }
}

function useTransientReset(state: SaveState, reset: () => void): void {
  useEffect(() => {
    if (state !== 'saved') return;
    const timer = setTimeout(reset, 2000);
    return () => clearTimeout(timer);
  }, [state]);
}

export default function StatusSelect({
  endpoint,
  value,
  options,
  label,
  confirmOn,
  confirmMessage,
}: {
  endpoint: string;
  value: string;
  options: { value: string; label: string }[];
  label?: string;
  confirmOn?: string[];
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  useTransientReset(state, () => setState('idle'));

  useEffect(() => {
    setCurrent(value);
  }, [value]);

  async function onChange(next: string) {
    if (next === current) return;

    if (confirmOn?.includes(next)) {
      const message =
        confirmMessage ??
        `Change the status to "${next}"? This takes effect immediately.`;
      if (!window.confirm(message)) return;
    }

    const previous = current;
    setCurrent(next);
    setState('saving');
    setError(null);

    const failure = await sendPatch(endpoint, { status: next });
    if (failure) {
      setCurrent(previous);
      setError(failure);
      setState('error');
      return;
    }

    setState('saved');
    router.refresh();
  }

  return (
    <div className="stack stack-sm">
      <div className="cluster cluster-sm">
        <select
          className="select"
          aria-label={label ?? 'Change status'}
          value={current}
          disabled={state === 'saving'}
          onChange={(e) => void onChange(e.target.value)}
          style={{ minWidth: '9.5rem' }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="hint" aria-live="polite" style={{ minWidth: '4.5rem' }}>
          {state === 'saving' && 'Saving…'}
          {state === 'saved' && 'Saved'}
        </span>
      </div>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}

export function StatusActions({
  endpoint,
  current,
  actions,
  deleteConfirm,
}: {
  endpoint: string;
  current: string;
  actions: {
    value: string;
    label: string;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  }[];
  deleteConfirm?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  useTransientReset(state, () => setState('idle'));

  async function apply(value: string) {
    setPending(value);
    setState('saving');
    setError(null);

    const failure = await sendPatch(endpoint, { status: value });
    setPending(null);

    if (failure) {
      setError(failure);
      setState('error');
      return;
    }
    setState('saved');
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(deleteConfirm)) return;
    setPending('__delete');
    setState('saving');
    setError(null);

    const failure = await sendDelete(endpoint);
    setPending(null);

    if (failure) {
      setError(failure);
      setState('error');
      return;
    }
    setState('saved');
    router.refresh();
  }

  return (
    <div className="stack stack-sm">
      <div className="cluster cluster-sm">
        {actions.map((a) => {
          const isCurrent = a.value === current;
          return (
            <button
              key={a.value}
              type="button"
              className={`btn btn-sm btn-${a.variant ?? 'secondary'}`}
              aria-pressed={isCurrent}
              disabled={isCurrent || state === 'saving'}
              onClick={() => void apply(a.value)}
            >
              {pending === a.value ? 'Saving…' : a.label}
            </button>
          );
        })}
        {deleteConfirm && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={state === 'saving'}
            onClick={() => void remove()}
          >
            {pending === '__delete' ? 'Deleting…' : 'Delete'}
          </button>
        )}
        <span className="hint" aria-live="polite">
          {state === 'saved' && 'Saved'}
        </span>
      </div>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
