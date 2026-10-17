import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalId(value: unknown): number | null | 'invalid' {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n <= 0) return 'invalid';
  return n;
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
  const phone = text(data.phone);
  const subject = text(data.subject);
  const message = text(data.message);
  const tourId = optionalId(data.tour_id);

  if (name.length < 2 || name.length > 120) {
    return NextResponse.json(
      { error: 'Please give your name, 2 to 120 characters (field: name).' },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email) || email.length > 190) {
    return NextResponse.json(
      { error: 'Please give a valid email address (field: email).' },
      { status: 400 },
    );
  }
  if (phone && phone.length > 40) {
    return NextResponse.json(
      { error: 'Phone number must be 40 characters or fewer (field: phone).' },
      { status: 400 },
    );
  }
  if (subject.length < 3 || subject.length > 160) {
    return NextResponse.json(
      { error: 'Please give a subject, 3 to 160 characters (field: subject).' },
      { status: 400 },
    );
  }
  if (message.length < 10) {
    return NextResponse.json(
      {
        error:
          'Please write at least 10 characters so we can help properly (field: message).',
      },
      { status: 400 },
    );
  }
  if (message.length > 4000) {
    return NextResponse.json(
      { error: 'Message must be 4000 characters or fewer (field: message).' },
      { status: 400 },
    );
  }
  if (tourId === 'invalid') {
    return NextResponse.json(
      { error: 'tour_id must be a positive whole number (field: tour_id).' },
      { status: 400 },
    );
  }
  if (tourId !== null) {
    const tour = get<{ id: number }>('SELECT id FROM tours WHERE id = ?', tourId);
    if (!tour) {
      return NextResponse.json(
        { error: 'That tour no longer exists (field: tour_id).' },
        { status: 404 },
      );
    }
  }

  const result = run(
    `INSERT INTO enquiries (name, email, phone, tour_id, subject, message, status)
     VALUES (?, ?, ?, ?, ?, ?, 'new')`,
    name,
    email,
    phone || null,
    tourId,
    subject,
    message,
  );

  return NextResponse.json({ ok: true, id: result.lastInsertRowid }, { status: 201 });
}
