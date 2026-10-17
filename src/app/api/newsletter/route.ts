import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Request body must be a JSON object' },
      { status: 400 },
    );
  }
  const data = body as Record<string, unknown>;

  const email = text(data.email).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 190) {
    return NextResponse.json(
      { error: 'Please give a valid email address (field: email).' },
      { status: 400 },
    );
  }

  const already = get<{ id: number }>(
    'SELECT id FROM newsletter_subscribers WHERE email = ?',
    email,
  );

  run('INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)', email);

  return NextResponse.json(
    {
      message: already
        ? 'You are already on the list — the next Atlas dispatch is on its way.'
        : 'You are on the list. Look out for the Atlas dispatch on the first Tuesday of every month.',
    },
    { status: 200 },
  );
}
