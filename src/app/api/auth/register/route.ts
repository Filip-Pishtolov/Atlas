import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import {
  createSession,
  hashPassword,
  sessionCookieName,
  sessionCookieOptions,
  stripPassword,
} from '@/lib/auth';
import type { User } from '@/lib/types';

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

  const name = text(data.name);
  const email = text(data.email).toLowerCase();
  const password = typeof data.password === 'string' ? data.password : '';
  const phone = text(data.phone);

  if (name.length < 2) {
    return NextResponse.json(
      { error: 'Please give a name of at least 2 characters (field: name).' },
      { status: 400 },
    );
  }
  if (name.length > 120) {
    return NextResponse.json(
      { error: 'Name must be 120 characters or fewer (field: name).' },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email) || email.length > 190) {
    return NextResponse.json(
      { error: 'Please give a valid email address (field: email).' },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters (field: password).' },
      { status: 400 },
    );
  }
  if (password.length > 200) {
    return NextResponse.json(
      { error: 'Password must be 200 characters or fewer (field: password).' },
      { status: 400 },
    );
  }
  if (phone && phone.length > 40) {
    return NextResponse.json(
      { error: 'Phone number must be 40 characters or fewer (field: phone).' },
      { status: 400 },
    );
  }

  const existing = get<{ id: number }>(
    'SELECT id FROM users WHERE lower(email) = ?',
    email,
  );
  if (existing) {
    return NextResponse.json(
      { error: 'An Atlas account already uses that email address.' },
      { status: 409 },
    );
  }

  let userId: number;
  try {
    const result = run(
      `INSERT INTO users (name, email, password_hash, role, phone)
       VALUES (?, ?, ?, 'customer', ?)`,
      name,
      email,
      hashPassword(password),
      phone || null,
    );
    userId = result.lastInsertRowid;
  } catch {
    return NextResponse.json(
      { error: 'An Atlas account already uses that email address.' },
      { status: 409 },
    );
  }

  const created = get<User>('SELECT * FROM users WHERE id = ?', userId);
  if (!created) {
    return NextResponse.json(
      { error: 'The account could not be created. Please try again.' },
      { status: 500 },
    );
  }

  const sid = createSession(created.id);
  const res = NextResponse.json({ user: stripPassword(created) }, { status: 201 });
  res.cookies.set(sessionCookieName, sid, sessionCookieOptions);
  return res;
}
