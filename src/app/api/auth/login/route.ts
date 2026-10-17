import { NextResponse } from 'next/server';
import { get } from '@/lib/db';
import {
  createSession,
  sessionCookieName,
  sessionCookieOptions,
  stripPassword,
  verifyPassword,
} from '@/lib/auth';
import type { User } from '@/lib/types';

export const dynamic = 'force-dynamic';

const GENERIC = 'Email or password is incorrect';

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
  const password = typeof data.password === 'string' ? data.password : '';

  if (!email) {
    return NextResponse.json(
      { error: 'Please enter your email address (field: email).' },
      { status: 400 },
    );
  }
  if (!password) {
    return NextResponse.json(
      { error: 'Please enter your password (field: password).' },
      { status: 400 },
    );
  }

  const user = get<User>('SELECT * FROM users WHERE lower(email) = ?', email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  const sid = createSession(user.id);
  const res = NextResponse.json({ user: stripPassword(user) }, { status: 200 });
  res.cookies.set(sessionCookieName, sid, sessionCookieOptions);
  return res;
}
